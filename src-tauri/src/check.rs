//! Checks a learner's program against an exercise.
//!
//! Two modes: `Examples` runs only the examples shown in the statement (a quick try, nothing is
//! recorded); `Submit` also draws fresh hidden tests, and is the only way to solve an exercise.
//! The decision (and the record in the database) is made here, never by the front end.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use fastrand::Rng;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::auth::AuthService;
use crate::cases::{self, Case};
use crate::error::AppError;
use crate::execute::{self, COMPILE_TIMEOUT, Prepare, Prepared};
use crate::exercises::{self, Exercise};
use crate::progress::ProgressStore;
use crate::runner::RunOutput;
use crate::sync;

/// A solution this long is not a solution: it is a lookup table or something worse.
const MAX_CODE_BYTES: usize = 20_000;

/// Time allowed to run one test case.
const CASE_TIMEOUT: Duration = Duration::from_secs(5);

/// Stop after this many timeouts: the program is stuck, running more tests only makes us wait.
const MAX_TIMEOUTS: usize = 2;

/// Hidden tests that failed are shown, but only the first few.
const MAX_FAILURES_SHOWN: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Mode {
    /// Only the examples of the statement.
    Examples,
    /// The examples, then the hidden tests. Can solve the exercise.
    Submit,
}

/// The first line where the output differs from the expected one. A missing line is `None`.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineDiff {
    /// Starts at 1.
    pub line: usize,
    pub expected: Option<String>,
    pub actual: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseResult {
    pub input: String,
    pub expected: String,
    pub actual: String,
    pub stderr: String,
    pub passed: bool,
    /// Where the output starts to differ; `None` when it matches.
    pub diff: Option<LineDiff>,
    pub timed_out: bool,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HiddenSummary {
    pub total: usize,
    pub passed: usize,
    /// The first failures, so the learner can see what went wrong.
    pub failures: Vec<CaseResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckReport {
    /// Set when the code does not compile: no test was run.
    pub compile_error: Option<RunOutput>,
    pub examples: Vec<CaseResult>,
    /// `None` in `Examples` mode, or when an example failed (fix those first).
    pub hidden: Option<HiddenSummary>,
    pub solved: bool,
}

/// Makes outputs comparable: Windows line endings and trailing spaces do not matter.
fn normalize(text: &str) -> String {
    text.replace("\r\n", "\n")
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_owned()
}

/// Compares two outputs line by line (after `normalize`) and returns the first difference.
fn first_difference(expected: &str, actual: &str) -> Option<LineDiff> {
    let expected = normalize(expected);
    let actual = normalize(actual);
    let mut expected_lines = expected.lines();
    let mut actual_lines = actual.lines();
    for line in 1.. {
        let (wanted, got) = (expected_lines.next(), actual_lines.next());
        if wanted != got {
            return Some(LineDiff {
                line,
                expected: wanted.map(str::to_owned),
                actual: got.map(str::to_owned),
            });
        }
        if wanted.is_none() {
            break;
        }
    }
    None
}

async fn run_case(
    prepared: &Prepared,
    case: &Case,
    timeout: Duration,
) -> Result<CaseResult, AppError> {
    let output = execute::run_prepared(prepared, &case.input, timeout).await?;
    let passed = !output.timed_out
        && output.exit_code == Some(0)
        && normalize(&output.stdout) == normalize(&case.expected);
    Ok(CaseResult {
        input: case.input.clone(),
        expected: case.expected.clone(),
        diff: first_difference(&case.expected, &output.stdout),
        actual: output.stdout,
        stderr: output.stderr,
        passed,
        timed_out: output.timed_out,
        exit_code: output.exit_code,
    })
}

/// Compiles `code` once, then runs the examples and, in `Submit` mode, the hidden tests.
///
/// # Errors
///
/// Returns an error if the language is not offered for this exercise, the code is too long,
/// the language's tool is not installed, or a process cannot start.
pub async fn check(
    exercise: &Exercise,
    language: &str,
    code: &str,
    mode: Mode,
    rng: &mut Rng,
    case_timeout: Duration,
) -> Result<CheckReport, AppError> {
    if !exercise.starters.contains_key(language) {
        return Err(AppError::LanguageNotOffered(language.to_owned()));
    }
    if code.len() > MAX_CODE_BYTES {
        return Err(AppError::CodeTooLong);
    }

    let prepared = match execute::prepare(language, code, COMPILE_TIMEOUT).await? {
        Prepare::CompileFailed(output) => {
            return Ok(CheckReport {
                compile_error: Some(output),
                examples: Vec::new(),
                hidden: None,
                solved: false,
            });
        }
        Prepare::Ready(prepared) => prepared,
    };

    let mut timeouts = 0;
    let mut examples = Vec::with_capacity(exercise.examples.len());
    for example in &exercise.examples {
        let case = Case {
            input: example.input.clone(),
            expected: example.output.clone(),
        };
        let result = run_case(&prepared, &case, case_timeout).await?;
        timeouts += usize::from(result.timed_out);
        examples.push(result);
        if timeouts >= MAX_TIMEOUTS {
            break;
        }
    }
    let examples_passed = examples.iter().all(|result| result.passed);

    let hidden = if mode == Mode::Submit && examples_passed {
        let cases = cases::generate(&exercise.id, rng)
            .ok_or_else(|| AppError::UnknownExercise(exercise.id.clone()))?;
        let mut summary = HiddenSummary {
            total: cases.len(),
            passed: 0,
            failures: Vec::new(),
        };
        for case in &cases {
            let result = run_case(&prepared, case, case_timeout).await?;
            timeouts += usize::from(result.timed_out);
            if result.passed {
                summary.passed += 1;
            } else if summary.failures.len() < MAX_FAILURES_SHOWN {
                summary.failures.push(result);
            }
            if timeouts >= MAX_TIMEOUTS {
                break;
            }
        }
        Some(summary)
    } else {
        None
    };

    let solved = hidden
        .as_ref()
        .is_some_and(|summary| summary.total > 0 && summary.passed == summary.total);
    Ok(CheckReport {
        compile_error: None,
        examples,
        hidden,
        solved,
    })
}

fn fresh_seed() -> u64 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();
    u64::try_from(nanos).unwrap_or_default()
}

/// Checks the learner's code and, when it passes everything, records the exercise as solved.
#[tauri::command]
pub async fn check_exercise(
    app: AppHandle,
    store: State<'_, ProgressStore>,
    auth: State<'_, AuthService>,
    exercise: String,
    language: String,
    code: String,
    mode: Mode,
) -> Result<CheckReport, AppError> {
    // The account comes from the sign-in service: a success is only ever recorded for it.
    let user_id = auth.user_id().await.ok_or(AppError::NotSignedIn)?;
    let exercise = exercises::find(&exercise)?;
    let mut rng = Rng::with_seed(fresh_seed());
    let report = check(&exercise, &language, &code, mode, &mut rng, CASE_TIMEOUT).await?;
    if report.solved {
        store.mark_solved(&user_id, &exercise.id, &language)?;
        sync::spawn(app);
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use super::*;
    use crate::languages;

    const LANGUAGES: [(&str, &str); 2] = [("python", "py"), ("javascript", "js")];

    async fn available(language: &str) -> bool {
        let installed = languages::detect(&languages::find(language).unwrap())
            .await
            .is_some();
        if !installed {
            eprintln!("skipping: {language} is not installed on this machine");
        }
        installed
    }

    fn solution_path(id: &str, extension: &str) -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("exercises")
            .join(id)
            .join(format!("solution.{extension}"))
    }

    async fn run(
        exercise: &Exercise,
        language: &str,
        code: &str,
        mode: Mode,
        seed: u64,
    ) -> CheckReport {
        let mut rng = Rng::with_seed(seed);
        check(exercise, language, code, mode, &mut rng, CASE_TIMEOUT)
            .await
            .unwrap()
    }

    #[test]
    fn catalog_should_have_a_spec_for_every_exercise_and_no_spec_without_exercise() {
        let mut from_catalog: Vec<String> = exercises::all()
            .unwrap()
            .into_iter()
            .map(|e| e.id)
            .collect();
        let mut from_specs: Vec<String> = cases::ids().into_iter().map(str::to_owned).collect();
        from_catalog.sort();
        from_specs.sort();
        assert_eq!(from_catalog, from_specs);
    }

    #[test]
    fn catalog_examples_should_match_the_reference_solution() {
        for exercise in exercises::all().unwrap() {
            for example in &exercise.examples {
                let expected = cases::solve(&exercise.id, &example.input).unwrap();
                assert_eq!(
                    normalize(&example.output),
                    normalize(&expected),
                    "{}: example {:?}",
                    exercise.id,
                    example.input
                );
            }
        }
    }

    #[test]
    fn catalog_should_offer_every_language_with_a_starter_and_a_solution_file() {
        for exercise in exercises::all().unwrap() {
            assert!(!exercise.examples.is_empty(), "{}: no example", exercise.id);
            for (language, extension) in LANGUAGES {
                assert!(
                    exercise.starters.contains_key(language),
                    "{}: no {language} starter",
                    exercise.id
                );
                assert!(
                    solution_path(&exercise.id, extension).exists(),
                    "{}: no {language} solution",
                    exercise.id
                );
            }
        }
    }

    #[tokio::test]
    async fn submit_should_solve_the_exercise_when_the_reference_solution_is_used() {
        for exercise in exercises::all().unwrap() {
            for (language, extension) in LANGUAGES {
                if !available(language).await {
                    continue;
                }
                let code = std::fs::read_to_string(solution_path(&exercise.id, extension)).unwrap();
                for seed in 1..=3 {
                    let report = run(&exercise, language, &code, Mode::Submit, seed).await;
                    assert!(
                        report.solved,
                        "{} [{language}] seed {seed}: {:?} {:?}",
                        exercise.id,
                        report.hidden.as_ref().map(|h| &h.failures),
                        report.examples.iter().find(|r| !r.passed)
                    );
                }
            }
        }
    }

    #[tokio::test]
    async fn submit_should_not_solve_the_exercise_when_the_starter_code_is_unchanged() {
        for exercise in exercises::all().unwrap() {
            for (language, _) in LANGUAGES {
                if !available(language).await {
                    continue;
                }
                let starter = &exercise.starters[language];
                let report = run(&exercise, language, starter, Mode::Submit, 1).await;
                assert!(
                    !report.solved,
                    "{} [{language}] starter solves it",
                    exercise.id
                );
            }
        }
    }

    #[tokio::test]
    async fn submit_should_not_solve_the_exercise_when_the_program_is_empty() {
        if !available("python").await {
            return;
        }
        for exercise in exercises::all().unwrap() {
            let report = run(&exercise, "python", "", Mode::Submit, 1).await;
            assert!(!report.solved, "{}: empty program solves it", exercise.id);
        }
    }

    /// A program that only knows the answers shown in the statement: it must pass the examples
    /// (so the learner can see them work) but must NOT solve the exercise.
    #[tokio::test]
    async fn submit_should_not_solve_the_exercise_when_answers_are_hard_coded() {
        if !available("python").await {
            return;
        }
        for exercise in exercises::all().unwrap() {
            let table: Vec<String> = exercise
                .examples
                .iter()
                .map(|e| {
                    format!(
                        "{}: {}",
                        serde_json::to_string(&e.input).unwrap(),
                        serde_json::to_string(&e.output).unwrap()
                    )
                })
                .collect();
            let cheat = format!(
                "import sys\nanswers = {{{}}}\nprint(answers.get(sys.stdin.read(), ''))\n",
                table.join(", ")
            );

            let examples = run(&exercise, "python", &cheat, Mode::Examples, 1).await;
            assert!(
                examples.examples.iter().all(|r| r.passed),
                "{}",
                exercise.id
            );

            let submit = run(&exercise, "python", &cheat, Mode::Submit, 1).await;
            assert!(!submit.solved, "{}: hard-coding solves it", exercise.id);
        }
    }

    #[tokio::test]
    async fn examples_mode_should_never_solve_the_exercise_even_when_the_code_is_right() {
        if !available("python").await {
            return;
        }
        let exercise = exercises::find("fizzbuzz").unwrap();
        let code = std::fs::read_to_string(solution_path("fizzbuzz", "py")).unwrap();
        let report = run(&exercise, "python", &code, Mode::Examples, 1).await;
        assert!(report.examples.iter().all(|r| r.passed));
        assert!(report.hidden.is_none());
        assert!(!report.solved);
    }

    #[tokio::test]
    async fn submit_should_skip_the_hidden_tests_when_an_example_fails() {
        if !available("python").await {
            return;
        }
        let exercise = exercises::find("fizzbuzz").unwrap();
        let report = run(&exercise, "python", "print('nope')", Mode::Submit, 1).await;
        assert!(report.hidden.is_none());
    }

    #[tokio::test]
    async fn submit_should_report_the_failing_hidden_tests_when_a_edge_case_is_missed() {
        if !available("python").await {
            return;
        }
        // Right for the examples (n = 5 and n = 15), wrong when 15 is not the largest multiple.
        let exercise = exercises::find("fizzbuzz").unwrap();
        let code = "n = int(input())\nfor i in range(1, n + 1):\n    print('FizzBuzz' if i == 15 else 'Fizz' if i % 3 == 0 else 'Buzz' if i % 5 == 0 else i)\n";
        let report = run(&exercise, "python", code, Mode::Submit, 1).await;
        let hidden = report.hidden.unwrap();
        assert!(!report.solved);
        assert!(hidden.passed < hidden.total);
        assert!(!hidden.failures.is_empty());
    }

    #[tokio::test]
    async fn submit_should_return_a_compile_error_when_the_code_does_not_compile() {
        let mut exercise = exercises::find("fizzbuzz").unwrap();
        exercise.starters.insert("rust".to_owned(), String::new());
        if !available("rust").await {
            return;
        }
        let report = run(&exercise, "rust", "fn main() { oops }", Mode::Submit, 1).await;
        assert!(report.compile_error.is_some());
        assert!(!report.solved);
    }

    #[tokio::test]
    async fn submit_should_stop_early_when_the_program_never_ends() {
        if !available("python").await {
            return;
        }
        let exercise = exercises::find("fizzbuzz").unwrap();
        let mut rng = Rng::with_seed(1);
        let started = std::time::Instant::now();
        let report = check(
            &exercise,
            "python",
            "while True: pass",
            Mode::Submit,
            &mut rng,
            Duration::from_millis(300),
        )
        .await
        .unwrap();
        assert!(!report.solved);
        assert!(report.examples.iter().any(|r| r.timed_out));
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[tokio::test]
    async fn check_should_refuse_a_language_when_the_exercise_does_not_offer_it() {
        let exercise = exercises::find("fizzbuzz").unwrap();
        let mut rng = Rng::with_seed(1);
        let result = check(&exercise, "cobol", "", Mode::Submit, &mut rng, CASE_TIMEOUT).await;
        assert!(matches!(result, Err(AppError::LanguageNotOffered(_))));
    }

    #[tokio::test]
    async fn check_should_refuse_the_code_when_it_is_too_long() {
        let exercise = exercises::find("fizzbuzz").unwrap();
        let mut rng = Rng::with_seed(1);
        let code = "#".repeat(MAX_CODE_BYTES + 1);
        let result = check(
            &exercise,
            "python",
            &code,
            Mode::Submit,
            &mut rng,
            CASE_TIMEOUT,
        )
        .await;
        assert!(matches!(result, Err(AppError::CodeTooLong)));
    }

    #[test]
    fn first_difference_should_be_none_when_the_outputs_match() {
        assert_eq!(first_difference("a\nb", "a  \r\nb\n"), None);
    }

    #[test]
    fn first_difference_should_point_at_the_first_wrong_line() {
        let diff = first_difference("1\n2\nFizz", "1\n2\n3").unwrap();
        assert_eq!(diff.line, 3);
        assert_eq!(diff.expected.as_deref(), Some("Fizz"));
        assert_eq!(diff.actual.as_deref(), Some("3"));
    }

    #[test]
    fn first_difference_should_report_a_missing_line_when_the_output_is_too_short() {
        let diff = first_difference("1\n2", "1").unwrap();
        assert_eq!((diff.line, diff.actual), (2, None));
    }

    #[test]
    fn first_difference_should_report_an_extra_line_when_the_output_is_too_long() {
        let diff = first_difference("1", "1\n2").unwrap();
        assert_eq!((diff.line, diff.expected), (2, None));
    }

    #[test]
    fn normalize_should_ignore_line_endings_and_trailing_spaces_when_comparing() {
        assert_eq!(normalize("a  \r\nb\r\n\r\n"), "a\nb");
    }
}
