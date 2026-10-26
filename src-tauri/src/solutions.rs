//! The walkthrough of an exercise: its reference solution and an explanation of the idea.
//!
//! It is shown to a learner only after they solved the exercise (the Rust side checks it, the
//! front end cannot ask for it earlier). The hidden tests and their oracle stay out of reach: the
//! walkthrough teaches the method, it does not let anyone skip an exercise from the interface.
//! The text is embedded in the application, so it protects the learning flow, not against someone
//! who reads the binary.

use serde::Serialize;
use tauri::State;

use crate::auth::AuthService;
use crate::error::AppError;
use crate::exercises;
use crate::progress::ProgressStore;

struct Walkthrough {
    id: &'static str,
    explanation: &'static str,
    python: &'static str,
    javascript: &'static str,
}

macro_rules! walkthrough {
    ($id:literal) => {
        Walkthrough {
            id: $id,
            explanation: include_str!(concat!("../exercises/", $id, "/explanation.md")),
            python: include_str!(concat!("../exercises/", $id, "/solution.py")),
            javascript: include_str!(concat!("../exercises/", $id, "/solution.js")),
        }
    };
}

const WALKTHROUGHS: [Walkthrough; 20] = [
    walkthrough!("fibonacci"),
    walkthrough!("dict_sum"),
    walkthrough!("list_extend"),
    walkthrough!("fizzbuzz"),
    walkthrough!("max_in_list"),
    walkthrough!("count_vowels"),
    walkthrough!("palindrome"),
    walkthrough!("factorial"),
    walkthrough!("reverse_words"),
    walkthrough!("tips"),
    walkthrough!("primes"),
    walkthrough!("word_count"),
    walkthrough!("dedupe"),
    walkthrough!("change_coins"),
    walkthrough!("caesar"),
    walkthrough!("lis"),
    walkthrough!("edit_distance"),
    walkthrough!("knapsack"),
    walkthrough!("shortest_path"),
    walkthrough!("topological_order"),
];

/// What the learner gets once they solved an exercise.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Solution {
    pub language: String,
    /// The reference solution, in the language asked for.
    pub code: String,
    /// The idea behind it, its pitfalls. Markdown.
    pub explanation: String,
}

/// The walkthrough of `exercise` in `language`, if `user_id` solved the exercise (in any language).
///
/// # Errors
///
/// [`AppError::UnknownExercise`] for an unknown exercise, [`AppError::SolutionLocked`] when the
/// account has not solved it, [`AppError::LanguageNotOffered`] when there is no solution in this
/// language.
pub fn unlock(
    store: &ProgressStore,
    user_id: &str,
    exercise: &str,
    language: &str,
) -> Result<Solution, AppError> {
    let exercise = exercises::find(exercise)?;
    let walkthrough = WALKTHROUGHS
        .iter()
        .find(|walkthrough| walkthrough.id == exercise.id)
        .ok_or_else(|| AppError::UnknownExercise(exercise.id.clone()))?;
    if !store.is_solved(user_id, &exercise.id)? {
        return Err(AppError::SolutionLocked);
    }
    let code = match language {
        "python" => walkthrough.python,
        "javascript" => walkthrough.javascript,
        other => return Err(AppError::LanguageNotOffered(other.to_owned())),
    };
    Ok(Solution {
        language: language.to_owned(),
        code: code.to_owned(),
        explanation: walkthrough.explanation.trim().to_owned(),
    })
}

/// The walkthrough of an exercise, for the signed-in account, once it solved the exercise.
#[tauri::command]
pub async fn get_solution(
    store: State<'_, ProgressStore>,
    auth: State<'_, AuthService>,
    exercise: String,
    language: String,
) -> Result<Solution, AppError> {
    let user_id = auth.user_id().await.ok_or(AppError::NotSignedIn)?;
    unlock(&store, &user_id, &exercise, &language)
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
    fn every_exercise_should_have_a_walkthrough() {
        for exercise in exercises::all().unwrap() {
            assert!(
                WALKTHROUGHS.iter().any(|w| w.id == exercise.id),
                "{}: no walkthrough",
                exercise.id
            );
        }
    }

    #[test]
    fn every_walkthrough_should_explain_and_give_a_solution_in_both_languages() {
        for walkthrough in &WALKTHROUGHS {
            assert!(
                !walkthrough.explanation.trim().is_empty(),
                "{}",
                walkthrough.id
            );
            assert!(!walkthrough.python.trim().is_empty(), "{}", walkthrough.id);
            assert!(
                !walkthrough.javascript.trim().is_empty(),
                "{}",
                walkthrough.id
            );
        }
    }

    #[test]
    fn unlock_should_refuse_the_walkthrough_when_the_exercise_is_not_solved() {
        let (_dir, store) = store();
        let outcome = unlock(&store, USER, "fizzbuzz", "python");
        assert!(matches!(outcome, Err(AppError::SolutionLocked)));
    }

    #[test]
    fn unlock_should_give_the_solution_when_the_exercise_is_solved() {
        let (_dir, store) = store();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();
        let solution = unlock(&store, USER, "fizzbuzz", "python").unwrap();
        assert!(solution.code.contains("FizzBuzz"));
    }

    #[test]
    fn unlock_should_give_the_solution_in_the_other_language_when_solved_in_one() {
        let (_dir, store) = store();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();
        assert!(unlock(&store, USER, "fizzbuzz", "javascript").is_ok());
    }

    #[test]
    fn unlock_should_refuse_the_walkthrough_when_only_another_account_solved_it() {
        let (_dir, store) = store();
        store.mark_solved("alice", "fizzbuzz", "python").unwrap();
        let outcome = unlock(&store, "bob", "fizzbuzz", "python");
        assert!(matches!(outcome, Err(AppError::SolutionLocked)));
    }

    #[test]
    fn unlock_should_refuse_a_language_without_a_solution() {
        let (_dir, store) = store();
        store.mark_solved(USER, "fizzbuzz", "python").unwrap();
        let outcome = unlock(&store, USER, "fizzbuzz", "cobol");
        assert!(matches!(outcome, Err(AppError::LanguageNotOffered(_))));
    }

    #[test]
    fn unlock_should_refuse_an_unknown_exercise() {
        let (_dir, store) = store();
        let outcome = unlock(&store, USER, "nope", "python");
        assert!(matches!(outcome, Err(AppError::UnknownExercise(_))));
    }
}
