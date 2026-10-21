//! Programming languages, described by data (`languages.json`), and detection of their tools.

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::path;
use crate::runner::{self, Job};

const DETECT_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Detect {
    /// Executable names to try, in order of preference.
    pub commands: Vec<String>,
    pub version_args: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct InstallGuide {
    pub url: String,
    pub steps: Vec<String>,
}

/// A command line whose arguments may use `{out}`, the path of the compiled program.
#[derive(Debug, Deserialize)]
pub struct CompileStep {
    /// Passed to the detected tool (the compiler).
    pub args: Vec<String>,
}

/// What to launch once the code is ready. `program` is `{tool}` (the detected interpreter)
/// or `{out}` (the compiled program).
#[derive(Debug, Deserialize)]
pub struct ExecStep {
    pub program: String,
    pub args: Vec<String>,
}

/// How to run a piece of code in this language.
#[derive(Debug, Deserialize)]
pub struct RunSpec {
    /// Name of the source file written in the temporary directory.
    pub file: String,
    /// Absent for interpreted languages.
    pub compile: Option<CompileStep>,
    pub exec: ExecStep,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct Language {
    pub id: String,
    pub name: String,
    pub detect: Detect,
    pub run: RunSpec,
    /// Keyed by `windows`, `macos` or `linux`.
    pub install: HashMap<String, InstallGuide>,
}

/// A tool found on this machine.
pub struct Detected {
    pub path: PathBuf,
    pub version: String,
}

/// The key used in `languages.json` for the OS this build runs on.
fn current_os() -> &'static str {
    match std::env::consts::OS {
        "windows" => "windows",
        "macos" => "macos",
        _ => "linux",
    }
}

/// Parses the embedded language list.
///
/// # Errors
///
/// Returns an error if `languages.json` is malformed (guarded by a unit test).
pub fn all() -> Result<Vec<Language>, AppError> {
    Ok(serde_json::from_str(include_str!("../languages.json"))?)
}

/// Finds a language by id.
///
/// # Errors
///
/// Returns an error if the language list is malformed or the id is unknown.
pub fn find(id: &str) -> Result<Language, AppError> {
    all()?
        .into_iter()
        .find(|language| language.id == id)
        .ok_or_else(|| AppError::UnknownLanguage(id.to_owned()))
}

fn first_line(text: &str) -> Option<&str> {
    text.lines().map(str::trim).find(|line| !line.is_empty())
}

/// Finds a working tool for the language. A name on the PATH is not enough (the Windows Store
/// `python.exe` placeholder exists but fails), so each candidate must answer its version command.
pub async fn detect(language: &Language) -> Option<Detected> {
    let cwd = std::env::temp_dir();
    // Read again each time: a tool installed while SynAck is open must be found (see `path`).
    let search_path = path::refreshed();
    let args: Vec<&str> = language
        .detect
        .version_args
        .iter()
        .map(String::as_str)
        .collect();
    for name in &language.detect.commands {
        let found = match &search_path {
            Some(search_path) => which::which_in(name, Some(search_path), &cwd),
            None => which::which(name),
        };
        let Ok(path) = found else {
            continue;
        };
        let job = Job {
            program: &path,
            args: &args,
            cwd: &cwd,
            env: &[],
            stdin: "",
            timeout: DETECT_TIMEOUT,
        };
        let Ok(out) = runner::run(&job).await else {
            continue;
        };
        if out.exit_code == Some(0) {
            let version = first_line(&out.stdout)
                .or_else(|| first_line(&out.stderr))
                .unwrap_or_default()
                .to_owned();
            return Some(Detected { path, version });
        }
    }
    None
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    /// How to install the tool on this OS; only present when it is missing.
    pub install: Option<InstallGuide>,
}

/// Detects every known language and tells how to install the missing ones.
#[tauri::command]
pub async fn check_environment() -> Result<Vec<ToolStatus>, AppError> {
    let mut statuses = Vec::new();
    for language in all()? {
        let detected = detect(&language).await;
        let install = if detected.is_none() {
            language.install.get(current_os()).cloned()
        } else {
            None
        };
        statuses.push(ToolStatus {
            id: language.id,
            name: language.name,
            installed: detected.is_some(),
            path: detected.as_ref().map(|d| d.path.display().to_string()),
            version: detected.map(|d| d.version),
            install,
        });
    }
    Ok(statuses)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_should_parse_when_embedded_data_is_read() {
        assert!(all().unwrap().len() >= 6);
    }

    #[test]
    fn all_should_provide_an_install_guide_for_every_os_when_data_is_read() {
        for language in all().unwrap() {
            for os in ["windows", "macos", "linux"] {
                assert!(
                    language
                        .install
                        .get(os)
                        .is_some_and(|g| !g.steps.is_empty()),
                    "{} has no install steps for {os}",
                    language.id
                );
            }
        }
    }

    #[test]
    fn all_should_run_from_a_tool_or_a_compiled_program_when_data_is_read() {
        for language in all().unwrap() {
            let program = &language.run.exec.program;
            assert!(
                program == "{tool}" || program == "{out}",
                "{}: {program}",
                language.id
            );
            if program == "{out}" {
                assert!(
                    language.run.compile.is_some(),
                    "{} never compiles",
                    language.id
                );
            }
        }
    }

    #[test]
    fn find_should_fail_when_language_is_unknown() {
        assert!(matches!(find("cobol"), Err(AppError::UnknownLanguage(_))));
    }

    /// Run by hand, from a process whose `PATH` lacks the compiler (as when it was installed after
    /// the terminal opened): `cargo test --no-run`, then start the test binary with a short
    /// `PATH` and `--ignored stale_path`. It must still find `gcc`.
    #[tokio::test]
    #[ignore = "needs gcc installed and a deliberately stale PATH"]
    async fn detect_should_find_gcc_when_the_process_path_is_stale() {
        let stale = std::env::var("PATH").unwrap_or_default().to_lowercase();
        assert!(
            !stale.contains("msys64"),
            "the PATH of this process must not hold gcc: {stale}"
        );
        let detected = detect(&find("c").unwrap()).await;
        assert!(detected.is_some(), "gcc was not found");
    }

    #[tokio::test]
    async fn detect_should_find_python_when_installed() {
        let detected = detect(&find("python").unwrap()).await.unwrap();
        assert!(detected.version.starts_with("Python"));
    }
}
