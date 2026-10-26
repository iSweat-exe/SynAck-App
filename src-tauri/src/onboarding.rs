//! What the learner tells the app about themselves when they first sign in: their level, what they
//! aim for, how much time they have. Nothing uses it yet; it is kept so that exercises, courses
//! and paths can later be recommended to fit. It lives in the local database, one row per account, and in Supabase (see `sync.rs`).

use std::time::Duration;

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::auth::AuthService;
use crate::error::AppError;
use crate::progress::ProgressStore;
use crate::sync;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Level {
    Newcomer,
    Beginner,
    Intermediate,
    Advanced,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Goal {
    Web,
    Software,
    Cybersecurity,
    DataAi,
    Games,
    Systems,
    Devops,
    Undecided,
}

/// The languages the exercises can be solved in, and a few the learner may already know.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Python,
    Javascript,
    Rust,
    Go,
    C,
    Cpp,
    Java,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Motivation {
    Career,
    Studies,
    Project,
    Curiosity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WeeklyTime {
    UnderOneHour,
    OneToThree,
    ThreeToSeven,
    OverSeven,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Style {
    Reading,
    Practice,
    Visual,
    Challenges,
}

/// The answers. Every value is an enum, so that a made-up value is refused when it is read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Onboarding {
    pub level: Level,
    pub goals: Vec<Goal>,
    pub known_languages: Vec<Language>,
    pub motivation: Motivation,
    pub weekly_time: WeeklyTime,
    pub styles: Vec<Style>,
}

/// Removes the repeats of a multiple choice, keeping the order the learner chose.
fn distinct<T: PartialEq + Copy>(values: &[T]) -> Vec<T> {
    let mut seen = Vec::with_capacity(values.len());
    for value in values {
        if !seen.contains(value) {
            seen.push(*value);
        }
    }
    seen
}

impl Onboarding {
    /// The same answers without repeats, or an error if a required multiple choice is empty.
    fn checked(&self) -> Result<Self, AppError> {
        if self.goals.is_empty() || self.styles.is_empty() {
            return Err(AppError::OnboardingInvalid);
        }
        Ok(Self {
            goals: distinct(&self.goals),
            known_languages: distinct(&self.known_languages),
            styles: distinct(&self.styles),
            ..self.clone()
        })
    }
}

/// An account id comes from the sign-in service; it is only ever a key here.
fn check_user(user_id: &str) -> Result<(), AppError> {
    if user_id.is_empty() || user_id.len() > 128 {
        return Err(AppError::OnboardingInvalid);
    }
    Ok(())
}

impl ProgressStore {
    /// The answers of this account, if it has given them.
    ///
    /// # Errors
    ///
    /// Returns an error if the query fails or the account id is not valid.
    pub fn onboarding(&self, user_id: &str) -> Result<Option<Onboarding>, AppError> {
        check_user(user_id)?;
        let stored: Option<String> = self
            .lock()
            .query_row(
                "SELECT answers FROM onboarding WHERE user_id = ?1",
                [user_id],
                |row| row.get(0),
            )
            .optional()?;
        // Answers that no longer fit the current choices are treated as not given: ask again.
        Ok(stored.and_then(|json| serde_json::from_str(&json).ok()))
    }

    /// Saves the answers of this account, replacing any earlier ones.
    ///
    /// # Errors
    ///
    /// Returns an error if the answers are incomplete or the write fails.
    pub fn save_onboarding(&self, user_id: &str, answers: &Onboarding) -> Result<(), AppError> {
        check_user(user_id)?;
        let json = serde_json::to_string(&answers.checked()?)?;
        self.lock().execute(
            "INSERT INTO onboarding (user_id, answers) VALUES (?1, ?2)
             ON CONFLICT(user_id) DO UPDATE SET answers = excluded.answers,
                                                completed_at = datetime('now'),
                                                synced = 0",
            (user_id, json),
        )?;
        Ok(())
    }
}

/// How long the first look for answers on the server may keep the questions waiting.
const LOOKUP_TIMEOUT: Duration = Duration::from_secs(4);

/// The answers of the signed-in account, or nothing if it has not been through the questions yet.
/// On a computer that has never seen this account, the answers may already be on the server: it is
/// asked first (briefly), so that nobody is asked the questions twice. The account comes from the
/// sign-in service, never from the front end.
#[tauri::command]
pub async fn get_onboarding(
    store: State<'_, ProgressStore>,
    auth: State<'_, AuthService>,
) -> Result<Option<Onboarding>, AppError> {
    let user_id = auth.user_id().await.ok_or(AppError::NotSignedIn)?;
    if let Some(answers) = store.onboarding(&user_id)? {
        return Ok(Some(answers));
    }
    // Offline or slow: the questions are shown, and what the server has arrives later.
    let _ = tokio::time::timeout(LOOKUP_TIMEOUT, sync::sync(&store, &auth)).await;
    store.onboarding(&user_id)
}

/// Records the answers of the signed-in account, then sends them to the server in the background.
#[tauri::command]
pub async fn save_onboarding(
    app: AppHandle,
    store: State<'_, ProgressStore>,
    auth: State<'_, AuthService>,
    answers: Onboarding,
) -> Result<(), AppError> {
    let user_id = auth.user_id().await.ok_or(AppError::NotSignedIn)?;
    store.save_onboarding(&user_id, &answers)?;
    sync::spawn(app);
    Ok(())
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::*;

    fn store() -> (TempDir, ProgressStore) {
        let dir = TempDir::new().unwrap();
        let store = ProgressStore::open(&dir.path().join("progress.db")).unwrap();
        (dir, store)
    }

    fn answers() -> Onboarding {
        Onboarding {
            level: Level::Beginner,
            goals: vec![Goal::Web, Goal::Cybersecurity],
            known_languages: vec![Language::Python],
            motivation: Motivation::Career,
            weekly_time: WeeklyTime::OneToThree,
            styles: vec![Style::Practice],
        }
    }

    #[test]
    fn onboarding_should_be_none_when_the_account_has_not_answered() {
        let (_dir, store) = store();
        assert_eq!(store.onboarding("user-1").unwrap(), None);
    }

    #[test]
    fn save_onboarding_should_be_read_back_when_saved() {
        let (_dir, store) = store();
        store.save_onboarding("user-1", &answers()).unwrap();
        assert_eq!(store.onboarding("user-1").unwrap(), Some(answers()));
    }

    #[test]
    fn save_onboarding_should_keep_accounts_apart_when_two_answer() {
        let (_dir, store) = store();
        store.save_onboarding("user-1", &answers()).unwrap();
        assert_eq!(store.onboarding("user-2").unwrap(), None);
    }

    #[test]
    fn save_onboarding_should_replace_the_earlier_answers_when_saved_again() {
        let (_dir, store) = store();
        store.save_onboarding("user-1", &answers()).unwrap();
        let changed = Onboarding {
            level: Level::Advanced,
            ..answers()
        };
        store.save_onboarding("user-1", &changed).unwrap();
        assert_eq!(store.onboarding("user-1").unwrap(), Some(changed));
    }

    #[test]
    fn save_onboarding_should_drop_repeats_when_a_choice_comes_twice() {
        let (_dir, store) = store();
        let repeated = Onboarding {
            goals: vec![Goal::Web, Goal::Web, Goal::Games],
            ..answers()
        };
        store.save_onboarding("user-1", &repeated).unwrap();
        let goals = store.onboarding("user-1").unwrap().unwrap().goals;
        assert_eq!(goals, vec![Goal::Web, Goal::Games]);
    }

    #[test]
    fn save_onboarding_should_refuse_when_no_goal_is_given() {
        let (_dir, store) = store();
        let no_goal = Onboarding {
            goals: vec![],
            ..answers()
        };
        assert!(store.save_onboarding("user-1", &no_goal).is_err());
    }

    #[test]
    fn save_onboarding_should_refuse_when_no_style_is_given() {
        let (_dir, store) = store();
        let no_style = Onboarding {
            styles: vec![],
            ..answers()
        };
        assert!(store.save_onboarding("user-1", &no_style).is_err());
    }

    #[test]
    fn save_onboarding_should_accept_no_known_language_when_the_learner_never_coded() {
        let (_dir, store) = store();
        let newcomer = Onboarding {
            known_languages: vec![],
            ..answers()
        };
        assert!(store.save_onboarding("user-1", &newcomer).is_ok());
    }

    #[test]
    fn onboarding_should_refuse_an_empty_account_id() {
        let (_dir, store) = store();
        assert!(store.onboarding("").is_err());
    }

    #[test]
    fn answers_should_not_parse_when_the_level_is_made_up() {
        let json = r#"{"level":"wizard","goals":["web"],"knownLanguages":[],
            "motivation":"career","weeklyTime":"oneToThree","styles":["practice"]}"#;
        assert!(serde_json::from_str::<Onboarding>(json).is_err());
    }

    #[test]
    fn onboarding_should_be_none_when_the_stored_answers_no_longer_fit() {
        let (_dir, store) = store();
        store
            .lock()
            .execute(
                r#"INSERT INTO onboarding (user_id, answers) VALUES ('user-1', '{"level":"old"}')"#,
                [],
            )
            .unwrap();
        assert_eq!(store.onboarding("user-1").unwrap(), None);
    }
}
