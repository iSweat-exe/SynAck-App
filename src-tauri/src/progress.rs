//! Which exercises the learner has solved, kept in a local SQLite database in the app's data
//! directory. Only the checker writes to it: the front end can read, never claim a success.

use std::path::Path;
use std::sync::{Mutex, MutexGuard, PoisonError};

use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::error::AppError;

/// Schema version stored in `PRAGMA user_version`. Add a step to `migrate` and bump this
/// whenever the schema changes; never edit a step that has already shipped.
const SCHEMA_VERSION: i32 = 4;

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SolvedEntry {
    pub exercise: String,
    pub language: String,
    /// UTC, `YYYY-MM-DD HH:MM:SS`.
    pub solved_at: String,
}

pub struct ProgressStore(Mutex<Connection>);

fn migrate(connection: &Connection) -> Result<(), AppError> {
    let version: i32 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
    // Version 1 tracked chapters of a course, which no longer exists.
    if version < 2 {
        connection.execute_batch(
            "DROP TABLE IF EXISTS progress;
             CREATE TABLE solved (
                exercise TEXT NOT NULL,
                language TEXT NOT NULL,
                solved_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (exercise, language)
             );",
        )?;
    }
    // Version 3: a protocol is validated by passing its quiz.
    if version < 3 {
        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS validated_protocols (
                protocol TEXT NOT NULL PRIMARY KEY,
                validated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );",
        )?;
    }
    // Version 4: what each account told the app about itself (see `onboarding.rs`).
    if version < 4 {
        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS onboarding (
                user_id TEXT NOT NULL PRIMARY KEY,
                answers TEXT NOT NULL,
                completed_at TEXT NOT NULL DEFAULT (datetime('now'))
             );",
        )?;
    }
    connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    Ok(())
}

impl ProgressStore {
    /// Opens (and creates or upgrades) the database at `path`.
    ///
    /// # Errors
    ///
    /// Returns an error if the file cannot be opened or migrated.
    pub fn open(path: &Path) -> Result<Self, AppError> {
        let connection = Connection::open(path)?;
        migrate(&connection)?;
        Ok(Self(Mutex::new(connection)))
    }

    pub(crate) fn lock(&self) -> MutexGuard<'_, Connection> {
        // A panic while holding the lock cannot leave the connection in a bad state.
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Every solved exercise, oldest first.
    ///
    /// # Errors
    ///
    /// Returns an error if the query fails.
    pub fn all(&self) -> Result<Vec<SolvedEntry>, AppError> {
        let connection = self.lock();
        let mut statement = connection.prepare(
            "SELECT exercise, language, solved_at FROM solved
             ORDER BY solved_at, exercise, language",
        )?;
        let entries = statement
            .query_map([], |row| {
                Ok(SolvedEntry {
                    exercise: row.get(0)?,
                    language: row.get(1)?,
                    solved_at: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    /// Records a success. Solving the same exercise in the same language again keeps the
    /// first date.
    ///
    /// # Errors
    ///
    /// Returns an error if the write fails.
    pub fn mark_solved(&self, exercise: &str, language: &str) -> Result<(), AppError> {
        self.lock().execute(
            "INSERT OR IGNORE INTO solved (exercise, language) VALUES (?1, ?2)",
            (exercise, language),
        )?;
        Ok(())
    }
}

impl ProgressStore {
    /// The ids of the protocols whose quiz was passed, oldest first.
    ///
    /// # Errors
    ///
    /// Returns an error if the query fails.
    pub fn validated_protocols(&self) -> Result<Vec<String>, AppError> {
        let connection = self.lock();
        let mut statement = connection
            .prepare("SELECT protocol FROM validated_protocols ORDER BY validated_at, protocol")?;
        let ids = statement
            .query_map([], |row| row.get(0))?
            .collect::<Result<Vec<String>, _>>()?;
        Ok(ids)
    }

    /// Records a passed quiz. Validating again keeps the first date.
    ///
    /// # Errors
    ///
    /// Returns an error if the write fails.
    pub fn mark_protocol_validated(&self, protocol: &str) -> Result<(), AppError> {
        self.lock().execute(
            "INSERT OR IGNORE INTO validated_protocols (protocol) VALUES (?1)",
            [protocol],
        )?;
        Ok(())
    }
}

/// Lists the exercises the learner has solved.
#[tauri::command]
pub async fn get_solved(store: State<'_, ProgressStore>) -> Result<Vec<SolvedEntry>, AppError> {
    store.all()
}

/// Lists the protocols the learner has validated.
#[tauri::command]
pub async fn get_validated_protocols(
    store: State<'_, ProgressStore>,
) -> Result<Vec<String>, AppError> {
    store.validated_protocols()
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

    #[test]
    fn all_should_be_empty_when_nothing_was_solved() {
        let (_dir, store) = store();
        assert_eq!(store.all().unwrap().len(), 0);
    }

    #[test]
    fn mark_solved_should_record_the_exercise_when_it_is_solved() {
        let (_dir, store) = store();
        store.mark_solved("fizzbuzz", "python").unwrap();
        let entries = store.all().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].exercise, "fizzbuzz");
        assert_eq!(entries[0].language, "python");
    }

    #[test]
    fn mark_solved_should_not_duplicate_the_entry_when_called_twice() {
        let (_dir, store) = store();
        store.mark_solved("fizzbuzz", "python").unwrap();
        store.mark_solved("fizzbuzz", "python").unwrap();
        assert_eq!(store.all().unwrap().len(), 1);
    }

    #[test]
    fn mark_solved_should_keep_each_language_when_solved_in_two_languages() {
        let (_dir, store) = store();
        store.mark_solved("fizzbuzz", "python").unwrap();
        store.mark_solved("fizzbuzz", "javascript").unwrap();
        assert_eq!(store.all().unwrap().len(), 2);
    }

    #[test]
    fn open_should_keep_existing_progress_when_the_database_is_reopened() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("progress.db");
        ProgressStore::open(&path)
            .unwrap()
            .mark_solved("tips", "python")
            .unwrap();
        let reopened = ProgressStore::open(&path).unwrap();
        assert_eq!(reopened.all().unwrap().len(), 1);
    }

    #[test]
    fn open_should_upgrade_a_version_1_database_when_the_course_tables_exist() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("progress.db");
        let old = Connection::open(&path).unwrap();
        old.execute_batch(
            "CREATE TABLE progress (course TEXT, chapter TEXT, kind TEXT, completed_at TEXT);
             INSERT INTO progress VALUES ('intro', '01', 'read', '2026-10-21 00:00:00');
             PRAGMA user_version = 1;",
        )
        .unwrap();
        drop(old);

        let store = ProgressStore::open(&path).unwrap();
        store.mark_solved("tips", "python").unwrap();
        assert_eq!(store.all().unwrap().len(), 1);
    }

    #[test]
    fn validated_protocols_should_be_empty_when_no_quiz_was_passed() {
        let (_dir, store) = store();
        assert_eq!(store.validated_protocols().unwrap().len(), 0);
    }

    #[test]
    fn mark_protocol_validated_should_record_the_protocol_once_when_called_twice() {
        let (_dir, store) = store();
        store.mark_protocol_validated("tcp").unwrap();
        store.mark_protocol_validated("tcp").unwrap();
        assert_eq!(store.validated_protocols().unwrap(), ["tcp"]);
    }

    #[test]
    fn open_should_add_the_protocols_table_when_the_database_is_version_2() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("progress.db");
        let old = Connection::open(&path).unwrap();
        old.execute_batch(
            "CREATE TABLE solved (exercise TEXT NOT NULL, language TEXT NOT NULL,
                solved_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (exercise, language));
             INSERT INTO solved (exercise, language) VALUES ('tips', 'python');
             PRAGMA user_version = 2;",
        )
        .unwrap();
        drop(old);

        let store = ProgressStore::open(&path).unwrap();
        store.mark_protocol_validated("dns").unwrap();
        assert_eq!(store.validated_protocols().unwrap(), ["dns"]);
        assert_eq!(store.all().unwrap().len(), 1);
    }
}
