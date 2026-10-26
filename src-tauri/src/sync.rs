//! Keeps the progress of the signed-in account in Supabase, so that it follows the learner to
//! another computer. The local database stays the copy the app reads at once and the one that
//! works offline: a success is written there first, marked "not sent yet", then sent in the
//! background. Whatever could not be sent (offline, server down) is sent next time.
//!
//! The web view takes no part in it and never sees a token. It is only told, by an event, when
//! progress that came from the server changed what it shows.
//!
//! Experience, coins and levels are not stored: they are computed from the exercises solved and
//! the protocols validated.

use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

use crate::auth::AuthService;
use crate::error::AppError;
use crate::progress::ProgressStore;

/// Emitted to the web view when a synchronization brought progress that was not known here.
pub const PROGRESS_CHANGED: &str = "progress-changed";

/// What one synchronization did.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct SyncReport {
    /// Rows sent to the server.
    pub pushed: usize,
    /// Rows the server had and this computer did not.
    pub pulled: usize,
}

#[derive(Deserialize)]
struct RemoteSolved {
    exercise: String,
    language: String,
    solved_at: String,
}

#[derive(Deserialize)]
struct RemoteProtocol {
    protocol: String,
    validated_at: String,
}

/// `PostgREST` answers `2026-10-26T17:36:19.123456+00:00`; the local database keeps UTC as
/// `YYYY-MM-DD HH:MM:SS`. The project's time zone is UTC, so cutting the date is enough.
fn local_time(remote: &str) -> String {
    remote
        .get(..19)
        .map_or_else(|| remote.to_owned(), |head| head.replacen('T', " ", 1))
}

impl ProgressStore {
    /// Gives the account the progress made before accounts existed (rows with no owner). The first
    /// account to synchronize on a computer takes it.
    fn adopt_unowned(&self, user_id: &str) -> Result<(), AppError> {
        let connection = self.lock();
        for table in ["solved", "validated_protocols"] {
            connection.execute(
                &format!("UPDATE OR IGNORE {table} SET user_id = ?1 WHERE user_id = ''"),
                [user_id],
            )?;
            // What could not be moved was already there under the account.
            connection.execute(&format!("DELETE FROM {table} WHERE user_id = ''"), [])?;
        }
        Ok(())
    }

    fn pending_solved(&self, user_id: &str) -> Result<Vec<(String, String)>, AppError> {
        let connection = self.lock();
        let mut statement = connection.prepare(
            "SELECT exercise, language FROM solved
             WHERE user_id = ?1 AND synced = 0
             ORDER BY solved_at, exercise, language",
        )?;
        let rows = statement
            .query_map([user_id], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    fn mark_solved_synced(
        &self,
        user_id: &str,
        exercise: &str,
        language: &str,
    ) -> Result<(), AppError> {
        self.lock().execute(
            "UPDATE solved SET synced = 1 WHERE user_id = ?1 AND exercise = ?2 AND language = ?3",
            (user_id, exercise, language),
        )?;
        Ok(())
    }

    /// Adds what the server has and this computer does not. Returns how many rows were added.
    fn merge_solved(&self, user_id: &str, remote: &[RemoteSolved]) -> Result<usize, AppError> {
        let connection = self.lock();
        let mut added = 0;
        for row in remote {
            added += connection.execute(
                "INSERT OR IGNORE INTO solved (user_id, exercise, language, solved_at, synced)
                 VALUES (?1, ?2, ?3, ?4, 1)",
                (
                    user_id,
                    &row.exercise,
                    &row.language,
                    local_time(&row.solved_at),
                ),
            )?;
        }
        Ok(added)
    }

    fn pending_protocols(&self, user_id: &str) -> Result<Vec<String>, AppError> {
        let connection = self.lock();
        let mut statement = connection.prepare(
            "SELECT protocol FROM validated_protocols
             WHERE user_id = ?1 AND synced = 0
             ORDER BY validated_at, protocol",
        )?;
        let rows = statement
            .query_map([user_id], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    fn mark_protocol_synced(&self, user_id: &str, protocol: &str) -> Result<(), AppError> {
        self.lock().execute(
            "UPDATE validated_protocols SET synced = 1 WHERE user_id = ?1 AND protocol = ?2",
            (user_id, protocol),
        )?;
        Ok(())
    }

    fn merge_protocols(&self, user_id: &str, remote: &[RemoteProtocol]) -> Result<usize, AppError> {
        let connection = self.lock();
        let mut added = 0;
        for row in remote {
            added += connection.execute(
                "INSERT OR IGNORE INTO validated_protocols (user_id, protocol, validated_at, synced)
                 VALUES (?1, ?2, ?3, 1)",
                (user_id, &row.protocol, local_time(&row.validated_at)),
            )?;
        }
        Ok(added)
    }
}

/// Sends what the server does not have yet, then brings back what this computer does not have.
/// Does nothing when nobody is signed in.
///
/// # Errors
///
/// [`AppError::SyncUnavailable`] when the server cannot be reached (nothing is lost: what was not
/// sent stays marked and goes next time), [`AppError::SyncRejected`] when it refuses a read, or
/// a local database error.
pub async fn sync(store: &ProgressStore, auth: &AuthService) -> Result<SyncReport, AppError> {
    let Some(credentials) = auth.credentials().await? else {
        return Ok(SyncReport::default());
    };
    let client = auth.client();
    let (token, user) = (
        credentials.access_token.as_str(),
        credentials.user_id.as_str(),
    );
    store.adopt_unowned(user)?;

    let mut report = SyncReport::default();

    for (exercise, language) in store.pending_solved(user)? {
        let arguments = json!({ "p_exercise": exercise, "p_language": language });
        match client
            .rpc(token, "record_solved_exercise", &arguments)
            .await
        {
            Ok(()) => {
                store.mark_solved_synced(user, &exercise, &language)?;
                report.pushed += 1;
            }
            // The server judged this row invalid: it stays here, and it must not block the others.
            Err(AppError::SyncRejected) => {}
            Err(error) => return Err(error),
        }
    }
    for protocol in store.pending_protocols(user)? {
        let arguments = json!({ "p_protocol": protocol });
        match client
            .rpc(token, "record_validated_protocol", &arguments)
            .await
        {
            Ok(()) => {
                store.mark_protocol_synced(user, &protocol)?;
                report.pushed += 1;
            }
            Err(AppError::SyncRejected) => {}
            Err(error) => return Err(error),
        }
    }

    let solved: Vec<RemoteSolved> = client
        .select(token, "solved_exercises", "exercise,language,solved_at")
        .await?;
    let protocols: Vec<RemoteProtocol> = client
        .select(token, "validated_protocols", "protocol,validated_at")
        .await?;
    report.pulled = store.merge_solved(user, &solved)? + store.merge_protocols(user, &protocols)?;
    Ok(report)
}

/// Synchronizes in the background, without making anybody wait. A failure is not an error for the
/// learner: the progress is safe here and goes next time.
pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let store = app.state::<ProgressStore>();
        let auth = app.state::<AuthService>();
        if let Ok(report) = sync(&store, &auth).await
            && report.pulled > 0
        {
            let _ = app.emit(PROGRESS_CHANGED, ());
        }
    });
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use serde_json::{Value, json};
    use tempfile::TempDir;

    use super::*;
    use crate::auth::store::memory::MemoryStore;
    use crate::auth::testing::{Mock, Recorded};
    use crate::auth::{Client, Config};

    const USER: &str = "6f1c1e0e-8a5d-4f0e-9d5e-0f2f6a3b1c11";

    fn session_body() -> String {
        json!({
            "access_token": "access-1",
            "token_type": "bearer",
            "expires_in": 3600,
            "refresh_token": "refresh-1",
            "user": {
                "id": USER,
                "app_metadata": { "provider": "github" },
                "user_metadata": { "name": "The Octocat" }
            }
        })
        .to_string()
    }

    /// A Supabase that knows the account and answers the progress calls like the real one.
    fn supabase(remote_solved: Value, rpc_status: u16) -> impl Fn(&Recorded) -> (u16, String) {
        move |request| match request.path() {
            "/auth/v1/token" => (200, session_body()),
            "/rest/v1/solved_exercises" => (200, remote_solved.to_string()),
            "/rest/v1/validated_protocols" => (200, "[]".to_owned()),
            path if path.starts_with("/rest/v1/rpc/") => (rpc_status, String::new()),
            _ => (404, "{}".to_owned()),
        }
    }

    async fn signed_in(url: &str) -> AuthService {
        let client = Client::new(&Config {
            url: url.to_owned(),
            anon_key: "anon-key".to_owned(),
        })
        .unwrap();
        let service = AuthService::new(
            client,
            Box::new(Arc::new(MemoryStore::with_token("refresh-0"))),
            0,
        );
        assert!(service.restore().await.unwrap().is_some());
        service
    }

    fn store() -> (TempDir, ProgressStore) {
        let dir = TempDir::new().unwrap();
        let store = ProgressStore::open(&dir.path().join("progress.db")).unwrap();
        (dir, store)
    }

    #[test]
    fn local_time_should_turn_a_postgrest_timestamp_into_the_local_format() {
        assert_eq!(
            local_time("2026-10-26T17:36:19.123456+00:00"),
            "2026-10-26 17:36:19"
        );
    }

    #[test]
    fn local_time_should_keep_what_it_does_not_understand() {
        assert_eq!(local_time("soon"), "soon");
    }

    #[tokio::test]
    async fn sync_should_send_the_pending_exercises_with_the_access_token_of_the_account() {
        let mock = Mock::start(supabase(json!([]), 204)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();

        sync(&store, &auth).await.unwrap();

        let calls = mock.requests_to("/rest/v1/rpc/record_solved_exercise");
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].header("authorization"), Some("Bearer access-1"));
        assert_eq!(
            calls[0].json(),
            json!({ "p_exercise": "fizzbuzz", "p_language": "python" })
        );
    }

    #[tokio::test]
    async fn sync_should_send_the_pending_protocols() {
        let mock = Mock::start(supabase(json!([]), 204)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.mark_protocol_validated(USER, "tcp").unwrap();

        sync(&store, &auth).await.unwrap();

        let calls = mock.requests_to("/rest/v1/rpc/record_validated_protocol");
        assert_eq!(calls[0].json(), json!({ "p_protocol": "tcp" }));
    }

    #[tokio::test]
    async fn sync_should_not_send_an_exercise_twice_once_the_server_has_it() {
        let mock = Mock::start(supabase(json!([]), 204)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();

        sync(&store, &auth).await.unwrap();
        sync(&store, &auth).await.unwrap();

        assert_eq!(
            mock.requests_to("/rest/v1/rpc/record_solved_exercise")
                .len(),
            1
        );
    }

    #[tokio::test]
    async fn sync_should_keep_the_exercise_to_send_later_when_the_server_is_down() {
        let mock = Mock::start(supabase(json!([]), 503)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();

        let outcome = sync(&store, &auth).await;

        assert!(matches!(outcome, Err(AppError::SyncUnavailable)));
        assert_eq!(store.pending_solved(USER).unwrap().len(), 1);
    }

    #[tokio::test]
    async fn sync_should_keep_the_exercise_on_this_computer_when_the_server_is_down() {
        let mock = Mock::start(supabase(json!([]), 503)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();

        let _ = sync(&store, &auth).await;

        assert_eq!(store.all(USER).unwrap().len(), 1);
    }

    #[tokio::test]
    async fn sync_should_bring_the_progress_of_another_computer_with_its_date() {
        let remote = json!([{
            "exercise": "tips",
            "language": "python",
            "solved_at": "2026-10-20T10:00:00.123+00:00"
        }]);
        let mock = Mock::start(supabase(remote, 204)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();

        let report = sync(&store, &auth).await.unwrap();

        assert_eq!(report.pulled, 1);
        assert_eq!(store.all(USER).unwrap()[0].solved_at, "2026-10-20 10:00:00");
    }

    #[tokio::test]
    async fn sync_should_report_nothing_pulled_when_this_computer_already_has_everything() {
        let remote = json!([{
            "exercise": "tips",
            "language": "python",
            "solved_at": "2026-10-20T10:00:00+00:00"
        }]);
        let mock = Mock::start(supabase(remote, 204)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();

        sync(&store, &auth).await.unwrap();
        let second = sync(&store, &auth).await.unwrap();

        assert_eq!(second.pulled, 0);
    }

    #[tokio::test]
    async fn sync_should_not_report_as_pulled_what_it_has_just_sent() {
        let remote = json!([{
            "exercise": "fizzbuzz",
            "language": "python",
            "solved_at": "2026-10-26T10:00:00+00:00"
        }]);
        let mock = Mock::start(supabase(remote, 204)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();

        let report = sync(&store, &auth).await.unwrap();

        assert_eq!(
            report,
            SyncReport {
                pushed: 1,
                pulled: 0
            }
        );
    }

    #[tokio::test]
    async fn sync_should_give_the_progress_from_before_accounts_to_the_account() {
        let mock = Mock::start(supabase(json!([]), 204)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.mark_solved("", "fizzbuzz", "python").unwrap();

        sync(&store, &auth).await.unwrap();

        assert_eq!(store.all(USER).unwrap().len(), 1);
    }

    #[tokio::test]
    async fn sync_should_do_nothing_when_nobody_is_signed_in() {
        let mock = Mock::start(supabase(json!([]), 204)).await;
        let client = Client::new(&Config {
            url: mock.url.clone(),
            anon_key: "anon-key".to_owned(),
        })
        .unwrap();
        let auth = AuthService::new(client, Box::new(Arc::new(MemoryStore::default())), 0);
        let (_dir, store) = store();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();

        let report = sync(&store, &auth).await.unwrap();

        assert_eq!(report, SyncReport::default());
        assert!(mock.requests().is_empty());
    }

    #[tokio::test]
    async fn sync_should_go_on_with_the_other_exercises_when_the_server_refuses_one() {
        let mock = Mock::start(supabase(json!([]), 400)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();
        store.mark_solved(USER, "tips", "python").unwrap();

        sync(&store, &auth).await.unwrap();

        assert_eq!(
            mock.requests_to("/rest/v1/rpc/record_solved_exercise")
                .len(),
            2
        );
    }
}
