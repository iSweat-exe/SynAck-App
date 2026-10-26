//! The streak: how many days in a row the learner solved an exercise or validated a protocol.
//! A day is a calendar day of the learner's own time zone. A streak stays alive on a day with
//! nothing done yet (it ends when a whole day has been missed), so opening the app in the morning
//! does not show it as lost.
//!
//! It is computed from the dates of the progress, which are synchronized (see `sync.rs`): there
//! is nothing else to store or to send.

use tauri::State;

use crate::auth::AuthService;
use crate::error::AppError;
use crate::progress::ProgressStore;

/// The length of the streak, given the distinct days with something done, latest first, and
/// today. Days are numbered one per calendar day, consecutive days having consecutive numbers.
fn streak_length(days_latest_first: &[i64], today: i64) -> u32 {
    let mut expected = match days_latest_first.first() {
        Some(&latest) if latest == today || latest == today - 1 => latest,
        _ => return 0,
    };
    let mut length = 0;
    for &day in days_latest_first {
        if day != expected {
            break;
        }
        length += 1;
        expected -= 1;
    }
    length
}

/// One day number per calendar day, in the learner's time zone. The Julian day starts at noon, so
/// half a day is added to make it change at midnight.
const DAY_OF: &str = "CAST(julianday(date({}, 'localtime')) + 0.5 AS INTEGER)";

fn day_of(column: &str) -> String {
    DAY_OF.replace("{}", column)
}

impl ProgressStore {
    /// The length of this account's streak, as of today.
    ///
    /// # Errors
    ///
    /// Returns an error if a query fails.
    pub fn streak(&self, user_id: &str) -> Result<u32, AppError> {
        let connection = self.lock();
        let today: i64 =
            connection.query_row(&format!("SELECT {}", day_of("'now'")), [], |row| row.get(0))?;
        let mut statement = connection.prepare(&format!(
            "SELECT DISTINCT day FROM (
                SELECT {solved} AS day FROM solved WHERE user_id = ?1
                UNION ALL
                SELECT {validated} AS day FROM validated_protocols WHERE user_id = ?1
             ) ORDER BY day DESC",
            solved = day_of("solved_at"),
            validated = day_of("validated_at"),
        ))?;
        let days = statement
            .query_map([user_id], |row| row.get(0))?
            .collect::<Result<Vec<i64>, _>>()?;
        Ok(streak_length(&days, today))
    }
}

/// The streak of the signed-in account.
#[tauri::command]
pub async fn get_streak(
    store: State<'_, ProgressStore>,
    auth: State<'_, AuthService>,
) -> Result<u32, AppError> {
    match auth.user_id().await {
        Some(user_id) => store.streak(&user_id),
        None => Ok(0),
    }
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::*;

    const USER: &str = "6f1c1e0e-8a5d-4f0e-9d5e-0f2f6a3b1c11";

    #[test]
    fn streak_length_should_be_zero_when_nothing_was_ever_done() {
        assert_eq!(streak_length(&[], 100), 0);
    }

    #[test]
    fn streak_length_should_be_one_when_only_today_was_done() {
        assert_eq!(streak_length(&[100], 100), 1);
    }

    #[test]
    fn streak_length_should_count_consecutive_days_up_to_today() {
        assert_eq!(streak_length(&[100, 99, 98], 100), 3);
    }

    #[test]
    fn streak_length_should_stay_alive_when_today_has_nothing_yet() {
        assert_eq!(streak_length(&[99, 98], 100), 2);
    }

    #[test]
    fn streak_length_should_be_zero_when_a_whole_day_was_missed() {
        assert_eq!(streak_length(&[98, 97], 100), 0);
    }

    #[test]
    fn streak_length_should_stop_at_the_first_gap() {
        assert_eq!(streak_length(&[100, 99, 97, 96], 100), 2);
    }

    #[test]
    fn streak_should_be_one_when_an_exercise_was_just_solved() {
        let dir = TempDir::new().unwrap();
        let store = ProgressStore::open(&dir.path().join("progress.db")).unwrap();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();
        assert_eq!(store.streak(USER).unwrap(), 1);
    }

    #[test]
    fn streak_should_count_a_protocol_validated_the_day_before() {
        let dir = TempDir::new().unwrap();
        let store = ProgressStore::open(&dir.path().join("progress.db")).unwrap();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();
        store.mark_protocol_validated(USER, "tcp").unwrap();
        // Yesterday, then the day before: the streak is made of three days in a row.
        store
            .lock()
            .execute_batch(
                "UPDATE validated_protocols SET validated_at = datetime('now', '-1 day');
                 INSERT INTO validated_protocols (user_id, protocol, validated_at)
                    VALUES ('6f1c1e0e-8a5d-4f0e-9d5e-0f2f6a3b1c11', 'dns', datetime('now', '-2 day'));",
            )
            .unwrap();
        assert_eq!(store.streak(USER).unwrap(), 3);
    }

    #[test]
    fn streak_should_be_zero_for_an_account_that_did_nothing() {
        let dir = TempDir::new().unwrap();
        let store = ProgressStore::open(&dir.path().join("progress.db")).unwrap();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();
        assert_eq!(store.streak("someone-else").unwrap(), 0);
    }
}
