//! The sign-in logic: starting a PKCE sign-in, restoring a session at launch, signing out.
//!
//! The access token only lives in memory. The refresh token is kept in the system secret store
//! and is replaced each time it is used (it is single use). The web view only ever receives an
//! [`AuthUser`].

use std::sync::{Arc, Mutex as StdMutex, PoisonError};
use std::time::{Duration, Instant};

use tokio::sync::{Mutex, Notify};
use url::Url;

use super::Provider;
use super::callback::{self, CALLBACK_PATH};
use super::pkce::Pkce;
use super::store::TokenStore;
use super::supabase::{Client, Session};
use super::user::AuthUser;
use crate::error::AppError;

/// The learner has this long to finish signing in in the browser.
pub const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(180);

/// What a request to the Data API needs. It holds a secret, so it deliberately has no `Debug`,
/// and it never leaves the Rust side.
pub struct Credentials {
    pub access_token: String,
    pub user_id: String,
}

/// An access token is renewed when it has less than this left, so that it never expires
/// during a request.
const RENEW_MARGIN: Duration = Duration::from_secs(60);

struct ActiveSession {
    access_token: String,
    expires_at: Instant,
    user: AuthUser,
}

pub struct AuthService {
    client: Client,
    store: Box<dyn TokenStore>,
    /// The loopback port the browser is redirected to. It must be allowed in the Supabase
    /// project (Authentication > URL Configuration > Redirect URLs).
    port: u16,
    sign_in_timeout: Duration,
    /// Held while a session is restored, so two restorations never spend the same refresh token.
    session: Mutex<Option<ActiveSession>>,
    /// Present while a sign-in is waiting for the browser.
    pending: StdMutex<Option<Arc<Notify>>>,
}

impl AuthService {
    pub fn new(client: Client, store: Box<dyn TokenStore>, port: u16) -> Self {
        Self::with_timeout(client, store, port, SIGN_IN_TIMEOUT)
    }

    pub fn with_timeout(
        client: Client,
        store: Box<dyn TokenStore>,
        port: u16,
        sign_in_timeout: Duration,
    ) -> Self {
        Self {
            client,
            store,
            port,
            sign_in_timeout,
            session: Mutex::new(None),
            pending: StdMutex::new(None),
        }
    }

    /// The account that is signed in, if any: in memory, or restored from the saved refresh
    /// token. Called when the application opens.
    ///
    /// # Errors
    ///
    /// Returns an error when the saved session could not be checked (offline, secret store
    /// locked). The saved token is kept in that case: it may work next time.
    pub async fn restore(&self) -> Result<Option<AuthUser>, AppError> {
        let mut session = self.session.lock().await;
        if let Some(active) = session.as_ref() {
            return Ok(Some(active.user.clone()));
        }
        let Some(saved) = self.store.load()? else {
            return Ok(None);
        };

        self.renew(&mut session, &saved).await?;
        Ok(session.as_ref().map(|active| active.user.clone()))
    }

    /// Trades the saved refresh token for a new session. A token that is definitively refused
    /// (expired, revoked, or already used) ends the session; a network failure keeps everything.
    async fn renew(
        &self,
        session: &mut Option<ActiveSession>,
        saved: &str,
    ) -> Result<(), AppError> {
        match self.client.refresh(saved).await {
            Ok(fresh) => {
                // The old token is spent: the new one must be saved before anything else.
                self.store.save(&fresh.refresh_token)?;
                *session = Some(active(fresh));
                Ok(())
            }
            Err(AppError::AuthRejected) => {
                self.store.clear()?;
                *session = None;
                Ok(())
            }
            Err(error) => Err(error),
        }
    }

    /// The id of the account that is signed in, without touching the network.
    pub async fn user_id(&self) -> Option<String> {
        self.session
            .lock()
            .await
            .as_ref()
            .map(|active| active.user.id.clone())
    }

    /// What to send to the Data API as the signed-in account, renewing the access token first if
    /// it is about to expire. `None` when nobody is signed in.
    ///
    /// # Errors
    ///
    /// Returns an error when the token had to be renewed and could not be (offline, secret store
    /// locked). Nothing is lost in that case: it works again once the network is back.
    pub async fn credentials(&self) -> Result<Option<Credentials>, AppError> {
        let mut session = self.session.lock().await;
        let expiring = session.as_ref().is_some_and(|active| {
            active.expires_at.saturating_duration_since(Instant::now()) <= RENEW_MARGIN
        });
        if expiring {
            match self.store.load()? {
                Some(saved) => self.renew(&mut session, &saved).await?,
                None => *session = None,
            }
        }
        Ok(session.as_ref().map(|active| Credentials {
            access_token: active.access_token.clone(),
            user_id: active.user.id.clone(),
        }))
    }

    /// The client of the project, for the modules that talk to its Data API.
    pub fn client(&self) -> &Client {
        &self.client
    }

    /// Signs in through the system browser.
    ///
    /// `open_browser` receives the address to open. The learner must have confirmed their age:
    /// this is checked here, not only in the interface.
    ///
    /// # Errors
    ///
    /// See [`AppError`]: the age is not confirmed, a sign-in is already running, the port is
    /// busy, the browser cannot be opened, the learner cancels or takes too long, or the
    /// provider or Supabase refuses.
    pub async fn sign_in(
        &self,
        provider: Provider,
        age_confirmed: bool,
        open_browser: impl FnOnce(&Url) -> Result<(), AppError>,
    ) -> Result<AuthUser, AppError> {
        if !age_confirmed {
            return Err(AppError::AuthAgeRequired);
        }
        let cancel = self.begin()?;
        let result = self.run_sign_in(provider, &cancel, open_browser).await;
        self.end();
        result
    }

    async fn run_sign_in(
        &self,
        provider: Provider,
        cancel: &Notify,
        open_browser: impl FnOnce(&Url) -> Result<(), AppError>,
    ) -> Result<AuthUser, AppError> {
        let listener = callback::bind(self.port).await?;
        let redirect = format!(
            "http://127.0.0.1:{}{CALLBACK_PATH}",
            listener.local_addr()?.port()
        );
        let pkce = Pkce::generate()?;
        let url = self
            .client
            .authorize_url(provider.as_str(), &pkce.challenge, &redirect);
        open_browser(&url)?;

        let code = tokio::select! {
            outcome = callback::wait_for_code(&listener) => outcome?,
            () = cancel.notified() => return Err(AppError::AuthCancelled),
            () = tokio::time::sleep(self.sign_in_timeout) => return Err(AppError::AuthTimeout),
        };
        // Nothing else may be received on this port.
        drop(listener);

        let session = self.client.exchange_code(&code, &pkce.verifier).await?;
        if let Err(error) = self.client.declare_age(&session.access_token).await {
            // No account may be signed in without its age on record: undo the session.
            self.client.sign_out(&session.access_token).await;
            return Err(error);
        }
        self.store.save(&session.refresh_token)?;

        let user = session.user.clone();
        *self.session.lock().await = Some(active(session));
        Ok(user)
    }

    /// Gives up the sign-in that is waiting for the browser, if any.
    pub fn cancel_sign_in(&self) {
        if let Some(pending) = self.pending_slot().as_ref() {
            pending.notify_one();
        }
    }

    /// Signs out: the server forgets this device's session (when it can be reached), and the
    /// refresh token is wiped from the secret store whatever happens.
    ///
    /// # Errors
    ///
    /// Returns an error if the secret store cannot be wiped: the token would stay on disk.
    pub async fn sign_out(&self) -> Result<(), AppError> {
        self.cancel_sign_in();
        let previous = self.session.lock().await.take();
        if let Some(previous) = previous {
            self.client.sign_out(&previous.access_token).await;
        }
        self.store.clear()
    }

    fn pending_slot(&self) -> std::sync::MutexGuard<'_, Option<Arc<Notify>>> {
        self.pending.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn begin(&self) -> Result<Arc<Notify>, AppError> {
        let mut slot = self.pending_slot();
        if slot.is_some() {
            return Err(AppError::AuthBusy);
        }
        let cancel = Arc::new(Notify::new());
        *slot = Some(Arc::clone(&cancel));
        Ok(cancel)
    }

    fn end(&self) {
        *self.pending_slot() = None;
    }
}

fn active(session: Session) -> ActiveSession {
    ActiveSession {
        access_token: session.access_token,
        expires_at: Instant::now() + session.expires_in,
        user: session.user,
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex as TestMutex;

    use serde_json::{Value, json};

    use super::*;
    use crate::auth::pkce::challenge_for;
    use crate::auth::store::memory::MemoryStore;
    use crate::auth::supabase::Config;
    use crate::auth::testing::{Mock, Recorded};

    fn session_body(refresh: &str) -> String {
        json!({
            "access_token": "access-1",
            "token_type": "bearer",
            "expires_in": 3600,
            "refresh_token": refresh,
            "user": {
                "id": "6f1c1e0e-8a5d-4f0e-9d5e-0f2f6a3b1c11",
                "app_metadata": { "provider": "github" },
                "user_metadata": {
                    "name": "The Octocat",
                    "avatar_url": "https://avatars.githubusercontent.com/u/1"
                }
            }
        })
        .to_string()
    }

    fn client(url: &str) -> Client {
        Client::new(&Config {
            url: url.to_owned(),
            anon_key: "anon-key".to_owned(),
        })
        .unwrap()
    }

    fn service_for(url: &str, store: &Arc<MemoryStore>, timeout: Duration) -> Arc<AuthService> {
        Arc::new(AuthService::with_timeout(
            client(url),
            Box::new(Arc::clone(store)),
            0,
            timeout,
        ))
    }

    /// A Supabase that accepts everything a healthy sign-in sends.
    fn healthy(request: &Recorded) -> (u16, String) {
        match request.path() {
            "/auth/v1/token" => (200, session_body("refresh-1")),
            "/rest/v1/rpc/declare_age" | "/auth/v1/logout" => (204, String::new()),
            _ => (404, "{}".to_owned()),
        }
    }

    /// Plays the browser: reads where it is sent to, and comes back to the loopback server with
    /// the given query, after the learner "signed in".
    fn browser(query: &'static str) -> impl FnOnce(&Url) -> Result<(), AppError> {
        move |url| {
            let redirect = url
                .query_pairs()
                .find(|(key, _)| key == "redirect_to")
                .map(|(_, value)| value.into_owned())
                .unwrap();
            tokio::spawn(async move {
                let _ = reqwest::get(format!("{redirect}?{query}")).await;
            });
            Ok(())
        }
    }

    #[tokio::test]
    async fn sign_in_should_return_the_user_and_remember_only_the_refresh_token() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        let user = service
            .sign_in(Provider::Github, true, browser("code=abc"))
            .await
            .unwrap();

        assert_eq!(user.name, "The Octocat");
        assert_eq!(user.provider, "github");
        assert_eq!(store.current().as_deref(), Some("refresh-1"));
    }

    #[tokio::test]
    async fn sign_in_should_prove_it_started_the_flow_by_sending_the_verifier_of_the_challenge() {
        let challenge = Arc::new(TestMutex::new(None::<String>));
        let seen = Arc::clone(&challenge);
        let mock = Mock::start(move |request: &Recorded| {
            if request.path() == "/auth/v1/token" {
                let verifier = request.json()["code_verifier"]
                    .as_str()
                    .unwrap_or_default()
                    .to_owned();
                let expected = seen.lock().unwrap().clone().unwrap_or_default();
                // Supabase would refuse a verifier that does not hash to the challenge.
                return if challenge_for(&verifier) == expected {
                    (200, session_body("refresh-1"))
                } else {
                    (400, "{}".to_owned())
                };
            }
            healthy(request)
        })
        .await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        let capture = Arc::clone(&challenge);
        let open = move |url: &Url| {
            let value = url
                .query_pairs()
                .find(|(key, _)| key == "code_challenge")
                .map(|(_, value)| value.into_owned());
            *capture.lock().unwrap() = value;
            browser("code=abc")(url)
        };

        assert!(service.sign_in(Provider::Github, true, open).await.is_ok());
    }

    #[tokio::test]
    async fn sign_in_should_record_the_age_declaration_with_the_access_token() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        service
            .sign_in(Provider::Discord, true, browser("code=abc"))
            .await
            .unwrap();

        let calls = mock.requests_to("/rest/v1/rpc/declare_age");
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].header("authorization"), Some("Bearer access-1"));
        assert_eq!(calls[0].header("apikey"), Some("anon-key"));
    }

    #[tokio::test]
    async fn sign_in_should_refuse_to_start_when_the_age_is_not_confirmed() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        let outcome = service
            .sign_in(Provider::Github, false, |_| {
                panic!("the browser must not open")
            })
            .await;

        assert!(matches!(outcome, Err(AppError::AuthAgeRequired)));
        assert!(mock.requests().is_empty());
    }

    #[tokio::test]
    async fn sign_in_should_fail_and_save_nothing_when_the_provider_refuses() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        let outcome = service
            .sign_in(Provider::Github, true, browser("error=access_denied"))
            .await;

        assert!(matches!(outcome, Err(AppError::AuthRejected)));
        assert_eq!(store.current(), None);
        assert!(mock.requests_to("/auth/v1/token").is_empty());
    }

    #[tokio::test]
    async fn sign_in_should_undo_the_session_when_the_age_cannot_be_recorded() {
        let mock = Mock::start(|request: &Recorded| match request.path() {
            "/rest/v1/rpc/declare_age" => (403, "{}".to_owned()),
            _ => healthy(request),
        })
        .await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        let outcome = service
            .sign_in(Provider::Github, true, browser("code=abc"))
            .await;

        assert!(matches!(outcome, Err(AppError::AuthAgeNotRecorded)));
        assert_eq!(store.current(), None);
        assert_eq!(mock.requests_to("/auth/v1/logout").len(), 1);
        assert_eq!(service.restore().await.unwrap(), None);
    }

    #[tokio::test]
    async fn sign_in_should_fail_when_supabase_refuses_the_code() {
        let mock = Mock::start(|request: &Recorded| match request.path() {
            "/auth/v1/token" => (404, r#"{"error_code":"flow_state_not_found"}"#.to_owned()),
            _ => healthy(request),
        })
        .await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        let outcome = service
            .sign_in(Provider::Github, true, browser("code=stale"))
            .await;

        assert!(matches!(outcome, Err(AppError::AuthRejected)));
        assert_eq!(store.current(), None);
    }

    #[tokio::test]
    async fn sign_in_should_time_out_when_the_browser_never_comes_back() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, Duration::from_millis(200));

        let outcome = service.sign_in(Provider::Github, true, |_| Ok(())).await;

        assert!(matches!(outcome, Err(AppError::AuthTimeout)));
    }

    #[tokio::test]
    async fn sign_in_should_stop_when_the_learner_cancels() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        let waiting = {
            let service = Arc::clone(&service);
            tokio::spawn(async move { service.sign_in(Provider::Github, true, |_| Ok(())).await })
        };
        tokio::time::sleep(Duration::from_millis(100)).await;
        service.cancel_sign_in();

        assert!(matches!(
            waiting.await.unwrap(),
            Err(AppError::AuthCancelled)
        ));
    }

    #[tokio::test]
    async fn sign_in_should_refuse_a_second_sign_in_while_one_is_running() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        let first = {
            let service = Arc::clone(&service);
            tokio::spawn(async move { service.sign_in(Provider::Github, true, |_| Ok(())).await })
        };
        tokio::time::sleep(Duration::from_millis(100)).await;
        let second = service.sign_in(Provider::Discord, true, |_| Ok(())).await;
        service.cancel_sign_in();

        assert!(matches!(second, Err(AppError::AuthBusy)));
        assert!(matches!(first.await.unwrap(), Err(AppError::AuthCancelled)));
    }

    #[tokio::test]
    async fn sign_in_should_be_possible_again_after_a_failed_attempt() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, Duration::from_millis(100));

        let _ = service.sign_in(Provider::Github, true, |_| Ok(())).await;
        let retry = service
            .sign_in(Provider::Github, true, |_| Err(AppError::AuthCancelled))
            .await;

        assert!(!matches!(retry, Err(AppError::AuthBusy)));
    }

    #[tokio::test]
    async fn restore_should_return_nobody_when_nothing_was_saved() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        assert_eq!(service.restore().await.unwrap(), None);
        assert!(mock.requests().is_empty());
    }

    #[tokio::test]
    async fn restore_should_sign_in_silently_and_rotate_the_saved_refresh_token() {
        let mock = Mock::start(|request: &Recorded| {
            if request.path() == "/auth/v1/token" {
                assert_eq!(
                    request.query("grant_type").as_deref(),
                    Some("refresh_token")
                );
                assert_eq!(request.json()["refresh_token"], "old-token");
                return (200, session_body("new-token"));
            }
            healthy(request)
        })
        .await;
        let store = Arc::new(MemoryStore::with_token("old-token"));
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        let user = service.restore().await.unwrap().unwrap();

        assert_eq!(user.name, "The Octocat");
        assert_eq!(store.current().as_deref(), Some("new-token"));
    }

    #[tokio::test]
    async fn restore_should_not_ask_the_server_again_when_a_session_is_already_open() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::with_token("old-token"));
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        let first = service.restore().await.unwrap();
        let second = service.restore().await.unwrap();

        assert_eq!(first, second);
        assert_eq!(mock.requests_to("/auth/v1/token").len(), 1);
    }

    #[tokio::test]
    async fn restore_should_forget_the_saved_token_when_the_server_refuses_it() {
        let mock = Mock::start(|request: &Recorded| match request.path() {
            "/auth/v1/token" => (
                400,
                r#"{"error_code":"refresh_token_not_found"}"#.to_owned(),
            ),
            _ => healthy(request),
        })
        .await;
        let store = Arc::new(MemoryStore::with_token("revoked"));
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        assert_eq!(service.restore().await.unwrap(), None);
        assert_eq!(store.current(), None);
    }

    #[tokio::test]
    async fn restore_should_keep_the_saved_token_when_the_server_cannot_be_reached() {
        // Nothing listens on port 1: the learner is "offline".
        let store = Arc::new(MemoryStore::with_token("still-good"));
        let service = service_for("http://127.0.0.1:1", &store, SIGN_IN_TIMEOUT);

        let outcome = service.restore().await;

        assert!(matches!(outcome, Err(AppError::AuthNetwork)));
        assert_eq!(store.current().as_deref(), Some("still-good"));
    }

    #[tokio::test]
    async fn restore_should_keep_the_saved_token_when_the_server_is_failing() {
        let mock = Mock::start(|_: &Recorded| (503, "{}".to_owned())).await;
        let store = Arc::new(MemoryStore::with_token("still-good"));
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        assert!(matches!(
            service.restore().await,
            Err(AppError::AuthNetwork)
        ));
        assert_eq!(store.current().as_deref(), Some("still-good"));
    }

    #[tokio::test]
    async fn sign_out_should_end_the_server_session_and_wipe_the_saved_token() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);
        service
            .sign_in(Provider::Github, true, browser("code=abc"))
            .await
            .unwrap();

        service.sign_out().await.unwrap();

        let logouts = mock.requests_to("/auth/v1/logout");
        assert_eq!(logouts.len(), 1);
        assert_eq!(logouts[0].header("authorization"), Some("Bearer access-1"));
        assert_eq!(logouts[0].query("scope").as_deref(), Some("local"));
        assert_eq!(store.current(), None);
        assert_eq!(service.restore().await.unwrap(), None);
    }

    #[tokio::test]
    async fn sign_out_should_wipe_the_saved_token_even_when_the_server_cannot_be_reached() {
        let store = Arc::new(MemoryStore::with_token("a-token"));
        let service = service_for("http://127.0.0.1:1", &store, SIGN_IN_TIMEOUT);

        service.sign_out().await.unwrap();

        assert_eq!(store.current(), None);
    }

    #[tokio::test]
    async fn credentials_should_be_nobody_when_nobody_is_signed_in() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);

        assert!(service.credentials().await.unwrap().is_none());
    }

    #[tokio::test]
    async fn credentials_should_give_the_access_token_without_renewing_it_while_it_is_valid() {
        let mock = Mock::start(healthy).await;
        let store = Arc::new(MemoryStore::with_token("refresh-0"));
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);
        service.restore().await.unwrap();

        let credentials = service.credentials().await.unwrap().unwrap();

        assert_eq!(credentials.access_token, "access-1");
        assert_eq!(mock.requests_to("/auth/v1/token").len(), 1);
    }

    #[tokio::test]
    async fn credentials_should_renew_the_access_token_when_it_is_about_to_expire() {
        // The server says the token lives 10 seconds: less than the renewal margin.
        let mock = Mock::start(|request: &Recorded| match request.path() {
            "/auth/v1/token" => (200, session_body("refresh-1").replace("3600", "10")),
            _ => healthy(request),
        })
        .await;
        let store = Arc::new(MemoryStore::with_token("refresh-0"));
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);
        service.restore().await.unwrap();

        service.credentials().await.unwrap();

        assert_eq!(mock.requests_to("/auth/v1/token").len(), 2);
    }

    #[tokio::test]
    async fn credentials_should_keep_the_session_when_the_renewal_cannot_reach_the_server() {
        let mock = Mock::start(|request: &Recorded| match request.path() {
            "/auth/v1/token" if request.query("grant_type").as_deref() == Some("refresh_token") => {
                (503, "{}".to_owned())
            }
            "/auth/v1/token" => (200, session_body("refresh-1").replace("3600", "10")),
            _ => healthy(request),
        })
        .await;
        let store = Arc::new(MemoryStore::default());
        let service = service_for(&mock.url, &store, SIGN_IN_TIMEOUT);
        // Sign in, then let the access token get old.
        service
            .sign_in(Provider::Github, true, browser("code=abc"))
            .await
            .unwrap();

        let outcome = service.credentials().await;

        assert!(matches!(outcome, Err(AppError::AuthNetwork)));
        assert_eq!(store.current().as_deref(), Some("refresh-1"));
    }

    #[test]
    fn nothing_the_interface_receives_should_contain_a_token() {
        let user = AuthUser::from_json(
            &serde_json::from_str::<Value>(&session_body("secret-refresh")).unwrap()["user"],
        )
        .unwrap();
        let sent = serde_json::to_string(&user).unwrap();
        assert!(!sent.contains("secret-refresh"));
        assert!(!sent.contains("access-1"));
    }
}
