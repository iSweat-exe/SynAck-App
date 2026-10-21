//! Talks to Supabase Auth and the Data API. Only the Rust side does: the web view never sees a
//! token, so it needs no `connect-src` to the network.

use std::time::Duration;

use serde::Deserialize;
use serde_json::{Value, json};
use url::Url;

use super::user::AuthUser;
use crate::error::AppError;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// The public settings of the project: its URL and its `anon` key. Both are meant to be shipped
/// in clients; the `service_role` key must NEVER be here (a test checks the key's role).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub url: String,
    pub anon_key: String,
}

impl Config {
    /// The settings embedded at build time from `supabase.json`.
    ///
    /// # Errors
    ///
    /// Returns an error if the file is malformed or the URL is not an `https` URL.
    pub fn embedded() -> Result<Self, AppError> {
        let config: Self = serde_json::from_str(include_str!("../../supabase.json"))
            .map_err(|error| AppError::AuthConfig(error.to_string()))?;
        if !config.url.starts_with("https://") {
            return Err(AppError::AuthConfig(
                "l'URL du projet doit commencer par https://".to_owned(),
            ));
        }
        Ok(config)
    }
}

/// A signed-in session. It holds secrets, so it deliberately has no `Debug`.
pub struct Session {
    pub access_token: String,
    pub refresh_token: String,
    pub user: AuthUser,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    user: Value,
}

pub struct Client {
    http: reqwest::Client,
    base: Url,
    anon_key: String,
}

impl Client {
    /// # Errors
    ///
    /// Returns an error if the URL is invalid or the HTTP client cannot be built.
    pub fn new(config: &Config) -> Result<Self, AppError> {
        let base =
            Url::parse(&config.url).map_err(|error| AppError::AuthConfig(error.to_string()))?;
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            // Never follow a redirect: the answers we expect are direct.
            .redirect(reqwest::redirect::Policy::none())
            // Real projects are served over https only; tests talk to a local http mock.
            .https_only(base.scheme() == "https")
            .user_agent(concat!("SynAck-Desktop/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|error| AppError::AuthConfig(error.to_string()))?;
        Ok(Self {
            http,
            base,
            anon_key: config.anon_key.clone(),
        })
    }

    fn endpoint(&self, path: &str) -> Url {
        // `path` is a constant of this file: joining it cannot fail.
        self.base.join(path).unwrap_or_else(|_| self.base.clone())
    }

    /// The address the browser is sent to, to sign in with `provider` using PKCE.
    pub fn authorize_url(&self, provider: &str, challenge: &str, redirect_to: &str) -> Url {
        let mut url = self.endpoint("auth/v1/authorize");
        url.query_pairs_mut()
            .append_pair("provider", provider)
            .append_pair("redirect_to", redirect_to)
            .append_pair("code_challenge", challenge)
            .append_pair("code_challenge_method", "s256");
        url
    }

    /// Turns the authorization code into a session.
    ///
    /// # Errors
    ///
    /// [`AppError::AuthNetwork`] if Supabase cannot be reached or is failing,
    /// [`AppError::AuthRejected`] if it refuses the code or the verifier.
    pub async fn exchange_code(&self, code: &str, verifier: &str) -> Result<Session, AppError> {
        self.token_request(
            "pkce",
            &json!({ "auth_code": code, "code_verifier": verifier }),
        )
        .await
    }

    /// Trades a refresh token for a new session. Refresh tokens are single use: the one in the
    /// answer replaces the one that was sent.
    ///
    /// # Errors
    ///
    /// [`AppError::AuthNetwork`] when it may work later (offline, server error),
    /// [`AppError::AuthRejected`] when the token is definitively no good.
    pub async fn refresh(&self, refresh_token: &str) -> Result<Session, AppError> {
        self.token_request("refresh_token", &json!({ "refresh_token": refresh_token }))
            .await
    }

    async fn token_request(&self, grant_type: &str, body: &Value) -> Result<Session, AppError> {
        let mut url = self.endpoint("auth/v1/token");
        url.query_pairs_mut().append_pair("grant_type", grant_type);

        let response = self
            .http
            .post(url)
            .header("apikey", &self.anon_key)
            .json(body)
            .send()
            .await
            .map_err(|_| AppError::AuthNetwork)?;

        let status = response.status();
        // Any 2xx is a success: the status code used for success has changed before.
        if !status.is_success() {
            return Err(failure(status));
        }
        let token: TokenResponse = response.json().await.map_err(|_| AppError::AuthRejected)?;
        Ok(Session {
            user: AuthUser::from_json(&token.user).ok_or(AppError::AuthRejected)?,
            access_token: token.access_token,
            refresh_token: token.refresh_token,
        })
    }

    /// Records the age declaration of the signed-in account on the server (idempotent).
    ///
    /// # Errors
    ///
    /// [`AppError::AuthNetwork`] if the server cannot be reached,
    /// [`AppError::AuthAgeNotRecorded`] if it refuses.
    pub async fn declare_age(&self, access_token: &str) -> Result<(), AppError> {
        let response = self
            .http
            .post(self.endpoint("rest/v1/rpc/declare_age"))
            .header("apikey", &self.anon_key)
            .bearer_auth(access_token)
            .json(&json!({}))
            .send()
            .await
            .map_err(|_| AppError::AuthNetwork)?;
        if response.status().is_success() {
            Ok(())
        } else if response.status().is_server_error() {
            Err(AppError::AuthNetwork)
        } else {
            Err(AppError::AuthAgeNotRecorded)
        }
    }

    /// Ends this device's session on the server. Best effort: the local cleanup does not depend
    /// on it, and a failure here only means the server forgets a bit later.
    pub async fn sign_out(&self, access_token: &str) {
        let mut url = self.endpoint("auth/v1/logout");
        url.query_pairs_mut().append_pair("scope", "local");
        let _ = self
            .http
            .post(url)
            .header("apikey", &self.anon_key)
            .bearer_auth(access_token)
            .send()
            .await;
    }
}

/// Server trouble and throttling may pass; anything else is a definitive "no".
fn failure(status: reqwest::StatusCode) -> AppError {
    if status.is_server_error() || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        AppError::AuthNetwork
    } else {
        AppError::AuthRejected
    }
}

#[cfg(test)]
mod tests {
    use base64::Engine as _;
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;

    use super::*;

    #[test]
    fn embedded_should_load_an_https_project_url() {
        assert!(Config::embedded().unwrap().url.starts_with("https://"));
    }

    /// The key ships inside the application: it must be the `anon` key, never `service_role`.
    #[test]
    fn embedded_should_hold_the_anon_key_and_never_a_service_role_key() {
        let key = Config::embedded().unwrap().anon_key;
        let payload = key.split('.').nth(1).expect("a JWT has three parts");
        let claims: Value =
            serde_json::from_slice(&URL_SAFE_NO_PAD.decode(payload).unwrap()).unwrap();
        assert_eq!(claims["role"], "anon");
    }

    #[test]
    fn authorize_url_should_ask_for_pkce_with_the_s256_method_and_the_given_redirect() {
        let client = Client::new(&Config::embedded().unwrap()).unwrap();
        let url = client.authorize_url("github", "CHALLENGE", "http://127.0.0.1:1/callback");
        let pairs: Vec<(String, String)> = url
            .query_pairs()
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();

        assert_eq!(url.path(), "/auth/v1/authorize");
        assert!(pairs.contains(&("provider".to_owned(), "github".to_owned())));
        assert!(pairs.contains(&("code_challenge".to_owned(), "CHALLENGE".to_owned())));
        assert!(pairs.contains(&("code_challenge_method".to_owned(), "s256".to_owned())));
        assert!(pairs.contains(&(
            "redirect_to".to_owned(),
            "http://127.0.0.1:1/callback".to_owned()
        )));
    }

    #[test]
    fn failure_should_treat_server_errors_and_throttling_as_transient() {
        for status in [500, 502, 503, 429] {
            let status = reqwest::StatusCode::from_u16(status).unwrap();
            assert!(matches!(failure(status), AppError::AuthNetwork), "{status}");
        }
    }

    #[test]
    fn failure_should_treat_client_errors_as_definitive_refusals() {
        for status in [400, 401, 403, 404, 422] {
            let status = reqwest::StatusCode::from_u16(status).unwrap();
            assert!(
                matches!(failure(status), AppError::AuthRejected),
                "{status}"
            );
        }
    }
}
