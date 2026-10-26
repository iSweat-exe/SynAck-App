//! The code of exercises in progress: what the learner wrote and did not finish. It is kept per
//! account, in the local database and in Supabase (see `sync.rs`), so that closing the app or
//! changing computer does not lose it. An exercise is "in progress" when it has a draft that is
//! not the starter code and it is not solved: the interface decides that, from these drafts.

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::auth::AuthService;
use crate::check::MAX_CODE_BYTES;
use crate::error::AppError;
use crate::exercises;
use crate::progress::ProgressStore;
use crate::sync;

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub exercise: String,
    pub language: String,
    pub code: String,
}

/// A draft is only kept for an exercise and a language that exist, and not longer than an
/// exercise accepts: the same limits as a check.
fn validate(exercise: &str, language: &str, code: &str) -> Result<(), AppError> {
    let exercise = exercises::find(exercise)?;
    if !exercise.starters.contains_key(language) {
        return Err(AppError::LanguageNotOffered(language.to_owned()));
    }
    if code.len() > MAX_CODE_BYTES {
        return Err(AppError::CodeTooLong);
    }
    Ok(())
}

impl ProgressStore {
    /// Every draft of this account.
    ///
    /// # Errors
    ///
    /// Returns an error if the query fails.
    pub fn drafts(&self, user_id: &str) -> Result<Vec<Draft>, AppError> {
        let connection = self.lock();
        let mut statement = connection.prepare(
            "SELECT exercise, language, code FROM drafts
             WHERE user_id = ?1
             ORDER BY exercise, language",
        )?;
        let drafts = statement
            .query_map([user_id], |row| {
                Ok(Draft {
                    exercise: row.get(0)?,
                    language: row.get(1)?,
                    code: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(drafts)
    }

    /// Keeps the code of an exercise in progress, replacing the earlier draft.
    ///
    /// # Errors
    ///
    /// Returns an error if the exercise or the language is unknown, the code is too long, or the
    /// write fails.
    pub fn save_draft(
        &self,
        user_id: &str,
        exercise: &str,
        language: &str,
        code: &str,
    ) -> Result<(), AppError> {
        validate(exercise, language, code)?;
        self.lock().execute(
            "INSERT INTO drafts (user_id, exercise, language, code) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(user_id, exercise, language) DO UPDATE SET
                code = excluded.code, updated_at = datetime('now'), synced = 0",
            (user_id, exercise, language, code),
        )?;
        Ok(())
    }
}

/// The drafts of the signed-in account.
#[tauri::command]
pub async fn get_drafts(
    store: State<'_, ProgressStore>,
    auth: State<'_, AuthService>,
) -> Result<Vec<Draft>, AppError> {
    match auth.user_id().await {
        Some(user_id) => store.drafts(&user_id),
        None => Ok(Vec::new()),
    }
}

/// Keeps the code the signed-in account is writing, and sends it to the server a little later
/// (after the last edit, so that typing does not make a request per keystroke).
#[tauri::command]
pub async fn save_draft(
    app: AppHandle,
    store: State<'_, ProgressStore>,
    auth: State<'_, AuthService>,
    exercise: String,
    language: String,
    code: String,
) -> Result<(), AppError> {
    let user_id = auth.user_id().await.ok_or(AppError::NotSignedIn)?;
    store.save_draft(&user_id, &exercise, &language, &code)?;
    sync::spawn_after_edit(app);
    Ok(())
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::*;

    const USER: &str = "6f1c1e0e-8a5d-4f0e-9d5e-0f2f6a3b1c11";

    fn store() -> (TempDir, ProgressStore) {
        let dir = TempDir::new().unwrap();
        let store = ProgressStore::open(&dir.path().join("progress.db")).unwrap();
        (dir, store)
    }

    #[test]
    fn drafts_should_be_empty_when_nothing_was_written() {
        let (_dir, store) = store();
        assert_eq!(store.drafts(USER).unwrap().len(), 0);
    }

    #[test]
    fn save_draft_should_be_read_back_when_saved() {
        let (_dir, store) = store();
        store
            .save_draft(USER, "fizzbuzz", "python", "print(1)")
            .unwrap();
        assert_eq!(
            store.drafts(USER).unwrap(),
            [Draft {
                exercise: "fizzbuzz".to_owned(),
                language: "python".to_owned(),
                code: "print(1)".to_owned(),
            }]
        );
    }

    #[test]
    fn save_draft_should_replace_the_code_when_saved_again() {
        let (_dir, store) = store();
        store
            .save_draft(USER, "fizzbuzz", "python", "print(1)")
            .unwrap();
        store
            .save_draft(USER, "fizzbuzz", "python", "print(2)")
            .unwrap();
        assert_eq!(store.drafts(USER).unwrap()[0].code, "print(2)");
    }

    #[test]
    fn save_draft_should_keep_a_draft_per_language() {
        let (_dir, store) = store();
        store.save_draft(USER, "fizzbuzz", "python", "a").unwrap();
        store
            .save_draft(USER, "fizzbuzz", "javascript", "b")
            .unwrap();
        assert_eq!(store.drafts(USER).unwrap().len(), 2);
    }

    #[test]
    fn drafts_should_not_show_the_code_of_another_account() {
        let (_dir, store) = store();
        store
            .save_draft("alice", "fizzbuzz", "python", "a")
            .unwrap();
        assert_eq!(store.drafts("bob").unwrap().len(), 0);
    }

    #[test]
    fn save_draft_should_refuse_an_unknown_exercise() {
        let (_dir, store) = store();
        let outcome = store.save_draft(USER, "nope", "python", "a");
        assert!(matches!(outcome, Err(AppError::UnknownExercise(_))));
    }

    #[test]
    fn save_draft_should_refuse_a_language_the_exercise_does_not_offer() {
        let (_dir, store) = store();
        let outcome = store.save_draft(USER, "fizzbuzz", "cobol", "a");
        assert!(matches!(outcome, Err(AppError::LanguageNotOffered(_))));
    }

    #[test]
    fn save_draft_should_refuse_code_that_is_too_long() {
        let (_dir, store) = store();
        let code = "#".repeat(MAX_CODE_BYTES + 1);
        let outcome = store.save_draft(USER, "fizzbuzz", "python", &code);
        assert!(matches!(outcome, Err(AppError::CodeTooLong)));
    }
}
