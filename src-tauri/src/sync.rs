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

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use rusqlite::OptionalExtension;
use serde::Deserialize;
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, Manager};

use crate::auth::{AuthService, Client};
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
struct RemoteOnboarding {
    answers: Value,
}

#[derive(Deserialize)]
struct RemoteDraft {
    exercise: String,
    language: String,
    code: String,
    updated_at: String,
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

    fn pending_onboarding(&self, user_id: &str) -> Result<Option<String>, AppError> {
        let answers = self
            .lock()
            .query_row(
                "SELECT answers FROM onboarding WHERE user_id = ?1 AND synced = 0",
                [user_id],
                |row| row.get(0),
            )
            .optional()?;
        Ok(answers)
    }

    /// Marks the answers as sent, unless they changed while they were being sent.
    fn mark_onboarding_synced(&self, user_id: &str, answers: &str) -> Result<(), AppError> {
        self.lock().execute(
            "UPDATE onboarding SET synced = 1 WHERE user_id = ?1 AND answers = ?2",
            (user_id, answers),
        )?;
        Ok(())
    }

    /// Takes the answers of the server when this computer has none. Returns how many were added.
    fn merge_onboarding(
        &self,
        user_id: &str,
        remote: &[RemoteOnboarding],
    ) -> Result<usize, AppError> {
        let Some(row) = remote.first() else {
            return Ok(0);
        };
        let added = self.lock().execute(
            "INSERT OR IGNORE INTO onboarding (user_id, answers, synced) VALUES (?1, ?2, 1)",
            (user_id, row.answers.to_string()),
        )?;
        Ok(added)
    }

    fn pending_drafts(&self, user_id: &str) -> Result<Vec<(String, String, String)>, AppError> {
        let connection = self.lock();
        let mut statement = connection.prepare(
            "SELECT exercise, language, code FROM drafts
             WHERE user_id = ?1 AND synced = 0
             ORDER BY updated_at, exercise, language",
        )?;
        let rows = statement
            .query_map([user_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    /// Marks a draft as sent, unless the learner went on typing while it was being sent.
    fn mark_draft_synced(
        &self,
        user_id: &str,
        exercise: &str,
        language: &str,
        code: &str,
    ) -> Result<(), AppError> {
        self.lock().execute(
            "UPDATE drafts SET synced = 1
             WHERE user_id = ?1 AND exercise = ?2 AND language = ?3 AND code = ?4",
            (user_id, exercise, language, code),
        )?;
        Ok(())
    }

    /// Takes the drafts of the server that are newer than this computer's, but never replaces code
    /// that was not sent yet. Returns how many drafts changed here.
    fn merge_drafts(&self, user_id: &str, remote: &[RemoteDraft]) -> Result<usize, AppError> {
        let connection = self.lock();
        let mut changed = 0;
        for row in remote {
            changed += connection.execute(
                "INSERT INTO drafts (user_id, exercise, language, code, updated_at, synced)
                 VALUES (?1, ?2, ?3, ?4, ?5, 1)
                 ON CONFLICT(user_id, exercise, language) DO UPDATE SET
                    code = excluded.code, updated_at = excluded.updated_at, synced = 1
                 WHERE drafts.synced = 1 AND excluded.updated_at > drafts.updated_at",
                (
                    user_id,
                    &row.exercise,
                    &row.language,
                    &row.code,
                    local_time(&row.updated_at),
                ),
            )?;
        }
        Ok(changed)
    }
}

/// Sends one row. `Ok(true)` when the server took it, `Ok(false)` when it refused it for good.
async fn send(
    client: &Client,
    token: &str,
    function: &str,
    arguments: &Value,
) -> Result<bool, AppError> {
    match client.rpc(token, function, arguments).await {
        Ok(()) => Ok(true),
        // The server judged this row invalid: it stays here, and it must not block the others.
        Err(AppError::SyncRejected) => Ok(false),
        Err(error) => Err(error),
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
        if send(client, token, "record_solved_exercise", &arguments).await? {
            store.mark_solved_synced(user, &exercise, &language)?;
            report.pushed += 1;
        }
    }
    for protocol in store.pending_protocols(user)? {
        let arguments = json!({ "p_protocol": protocol });
        if send(client, token, "record_validated_protocol", &arguments).await? {
            store.mark_protocol_synced(user, &protocol)?;
            report.pushed += 1;
        }
    }
    if let Some(answers) = store.pending_onboarding(user)? {
        let parsed: Value = serde_json::from_str(&answers)?;
        let arguments = json!({ "p_answers": parsed });
        if send(client, token, "save_onboarding", &arguments).await? {
            store.mark_onboarding_synced(user, &answers)?;
            report.pushed += 1;
        }
    }
    for (exercise, language, code) in store.pending_drafts(user)? {
        let arguments = json!({ "p_exercise": exercise, "p_language": language, "p_code": code });
        if send(client, token, "save_draft", &arguments).await? {
            store.mark_draft_synced(user, &exercise, &language, &code)?;
            report.pushed += 1;
        }
    }

    let solved: Vec<RemoteSolved> = client
        .select(token, "solved_exercises", "exercise,language,solved_at")
        .await?;
    let protocols: Vec<RemoteProtocol> = client
        .select(token, "validated_protocols", "protocol,validated_at")
        .await?;
    let onboarding: Vec<RemoteOnboarding> = client.select(token, "onboarding", "answers").await?;
    let drafts: Vec<RemoteDraft> = client
        .select(token, "drafts", "exercise,language,code,updated_at")
        .await?;
    report.pulled = store.merge_solved(user, &solved)?
        + store.merge_protocols(user, &protocols)?
        + store.merge_onboarding(user, &onboarding)?
        + store.merge_drafts(user, &drafts)?;
    Ok(report)
}

/// Synchronizes in the background, without making anybody wait. A failure is not an error for the
/// learner: the progress is safe here and goes next time.
pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        run(&app).await;
    });
}

async fn run(app: &AppHandle) {
    let store = app.state::<ProgressStore>();
    let auth = app.state::<AuthService>();
    if let Ok(report) = sync(&store, &auth).await
        && report.pulled > 0
    {
        let _ = app.emit(PROGRESS_CHANGED, ());
    }
}

/// How long the learner must stop typing before a draft is sent.
const EDIT_QUIET_PERIOD: Duration = Duration::from_secs(20);

/// Counts the edits, so that only the last one of a burst sends anything.
static EDITS: AtomicU64 = AtomicU64::new(0);

/// Synchronizes once the learner has stopped typing for a while: each edit postpones the
/// synchronization, so typing never makes a request per keystroke.
pub fn spawn_after_edit(app: AppHandle) {
    let edit = EDITS.fetch_add(1, Ordering::SeqCst) + 1;
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(EDIT_QUIET_PERIOD).await;
        if EDITS.load(Ordering::SeqCst) == edit {
            run(&app).await;
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
            "/rest/v1/validated_protocols" | "/rest/v1/onboarding" | "/rest/v1/drafts" => {
                (200, "[]".to_owned())
            }
            path if path.starts_with("/rest/v1/rpc/") => (rpc_status, String::new()),
            _ => (404, "{}".to_owned()),
        }
    }

    /// Like [`supabase`], with an onboarding and drafts already on the server.
    fn supabase_with(onboarding: Value, drafts: Value) -> impl Fn(&Recorded) -> (u16, String) {
        move |request| match request.path() {
            "/rest/v1/onboarding" => (200, onboarding.to_string()),
            "/rest/v1/drafts" => (200, drafts.to_string()),
            _ => supabase(json!([]), 204)(request),
        }
    }

    fn answers() -> crate::onboarding::Onboarding {
        use crate::onboarding::{Goal, Level, Motivation, Onboarding, Style, WeeklyTime};
        Onboarding {
            level: Level::Beginner,
            goals: vec![Goal::Web],
            known_languages: vec![],
            motivation: Motivation::Career,
            weekly_time: WeeklyTime::OneToThree,
            styles: vec![Style::Practice],
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

    #[tokio::test]
    async fn sync_should_send_the_onboarding_answers_that_were_not_sent() {
        let mock = Mock::start(supabase(json!([]), 204)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.save_onboarding(USER, &answers()).unwrap();

        sync(&store, &auth).await.unwrap();

        let calls = mock.requests_to("/rest/v1/rpc/save_onboarding");
        assert_eq!(calls[0].json()["p_answers"]["level"], "beginner");
    }

    #[tokio::test]
    async fn sync_should_send_the_onboarding_answers_only_once() {
        let mock = Mock::start(supabase(json!([]), 204)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.save_onboarding(USER, &answers()).unwrap();

        sync(&store, &auth).await.unwrap();
        sync(&store, &auth).await.unwrap();

        assert_eq!(mock.requests_to("/rest/v1/rpc/save_onboarding").len(), 1);
    }

    #[tokio::test]
    async fn sync_should_bring_the_onboarding_answers_when_this_computer_has_none() {
        let remote = json!([{ "answers": serde_json::to_value(answers()).unwrap() }]);
        let mock = Mock::start(supabase_with(remote, json!([]))).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();

        sync(&store, &auth).await.unwrap();

        assert_eq!(store.onboarding(USER).unwrap(), Some(answers()));
    }

    #[tokio::test]
    async fn sync_should_keep_the_onboarding_answers_of_this_computer_when_the_server_has_others() {
        let other = crate::onboarding::Onboarding {
            level: crate::onboarding::Level::Advanced,
            ..answers()
        };
        let remote = json!([{ "answers": serde_json::to_value(other).unwrap() }]);
        let mock = Mock::start(supabase_with(remote, json!([]))).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store.save_onboarding(USER, &answers()).unwrap();

        sync(&store, &auth).await.unwrap();

        assert_eq!(store.onboarding(USER).unwrap(), Some(answers()));
    }

    #[tokio::test]
    async fn sync_should_send_the_drafts_that_were_not_sent() {
        let mock = Mock::start(supabase(json!([]), 204)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store
            .save_draft(USER, "fizzbuzz", "python", "print(1)")
            .unwrap();

        sync(&store, &auth).await.unwrap();

        let calls = mock.requests_to("/rest/v1/rpc/save_draft");
        assert_eq!(
            calls[0].json(),
            json!({ "p_exercise": "fizzbuzz", "p_language": "python", "p_code": "print(1)" })
        );
    }

    #[tokio::test]
    async fn sync_should_keep_a_draft_to_send_later_when_the_server_is_down() {
        let mock = Mock::start(supabase(json!([]), 503)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store
            .save_draft(USER, "fizzbuzz", "python", "print(1)")
            .unwrap();

        let _ = sync(&store, &auth).await;

        assert_eq!(store.pending_drafts(USER).unwrap().len(), 1);
    }

    #[tokio::test]
    async fn sync_should_bring_a_draft_written_on_another_computer() {
        let remote = json!([{
            "exercise": "fizzbuzz",
            "language": "python",
            "code": "print('from afar')",
            "updated_at": "2026-10-26T10:00:00+00:00"
        }]);
        let mock = Mock::start(supabase_with(json!([]), remote)).await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();

        sync(&store, &auth).await.unwrap();

        assert_eq!(store.drafts(USER).unwrap()[0].code, "print('from afar')");
    }

    #[tokio::test]
    async fn sync_should_never_replace_code_that_was_not_sent_yet_with_a_draft_from_the_server() {
        // The server is down for the push, so the local draft stays "not sent"...
        let remote = json!([{
            "exercise": "fizzbuzz",
            "language": "python",
            "code": "print('from afar')",
            "updated_at": "2999-01-01T00:00:00+00:00"
        }]);
        let mock = Mock::start(move |request: &Recorded| match request.path() {
            "/rest/v1/rpc/save_draft" => (400, String::new()),
            _ => supabase_with(json!([]), remote.clone())(request),
        })
        .await;
        let auth = signed_in(&mock.url).await;
        let (_dir, store) = store();
        store
            .save_draft(USER, "fizzbuzz", "python", "print('mine')")
            .unwrap();

        sync(&store, &auth).await.unwrap();

        // ...and what the learner wrote is what they get, even if the server's copy is newer.
        assert_eq!(store.drafts(USER).unwrap()[0].code, "print('mine')");
    }
}
