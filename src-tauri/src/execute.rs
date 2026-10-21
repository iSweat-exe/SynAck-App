//! Writes code to a throwaway directory, compiles it if the language needs it, then runs it.
//! All the language-specific parts come from `languages.json`.
//!
//! Compiling (`prepare`) and running (`run_prepared`) are separate so that an exercise can
//! compile once and run many test cases.

use std::env::consts::EXE_SUFFIX;
use std::path::{Path, PathBuf};
use std::time::Duration;

use tempfile::TempDir;

use crate::error::AppError;
use crate::languages::{self, Language};
use crate::runner::{self, Job, RunOutput};

/// Compiling can be slow (Rust, first Go build).
pub const COMPILE_TIMEOUT: Duration = Duration::from_secs(60);

/// Code that is ready to be run any number of times.
pub struct Prepared {
    /// Owns the temporary directory: it is deleted when this value is dropped.
    workdir: TempDir,
    program: PathBuf,
    args: Vec<String>,
    env: Vec<(String, String)>,
}

pub enum Prepare {
    Ready(Prepared),
    /// The compilation failed or timed out.
    CompileFailed(RunOutput),
}

fn substitute(template: &str, tool: &Path, out: &Path) -> String {
    template
        .replace("{tool}", &tool.display().to_string())
        .replace("{out}", &out.display().to_string())
}

fn substitute_all(templates: &[String], tool: &Path, out: &Path) -> Vec<String> {
    templates
        .iter()
        .map(|template| substitute(template, tool, out))
        .collect()
}

fn as_strs(values: &[String]) -> Vec<&str> {
    values.iter().map(String::as_str).collect()
}

async fn compile(
    language: &Language,
    tool: &Path,
    out: &Path,
    workdir: &Path,
    timeout: Duration,
) -> Result<Option<RunOutput>, AppError> {
    let Some(step) = &language.run.compile else {
        return Ok(None);
    };
    let args = substitute_all(&step.args, tool, out);
    let job = Job {
        program: tool,
        args: &as_strs(&args),
        cwd: workdir,
        env: &[],
        stdin: "",
        timeout,
    };
    Ok(Some(runner::run(&job).await?))
}

/// Writes `code` to a new temporary directory and compiles it if the language needs it.
///
/// # Errors
///
/// Returns an error if the language is unknown, its tool is not installed, or a process
/// cannot be started. Code that does not compile is NOT an error: it is `CompileFailed`.
pub async fn prepare(
    language_id: &str,
    code: &str,
    compile_timeout: Duration,
) -> Result<Prepare, AppError> {
    let language = languages::find(language_id)?;
    let tool = languages::detect(&language)
        .await
        .ok_or_else(|| AppError::ToolNotFound(language.name.clone()))?
        .path;
    let workdir = TempDir::new()?;
    std::fs::write(workdir.path().join(&language.run.file), code)?;
    let out = workdir.path().join(format!("main{EXE_SUFFIX}"));

    if let Some(output) = compile(&language, &tool, &out, workdir.path(), compile_timeout).await?
        && (output.timed_out || output.exit_code != Some(0))
    {
        return Ok(Prepare::CompileFailed(output));
    }

    Ok(Prepare::Ready(Prepared {
        program: PathBuf::from(substitute(&language.run.exec.program, &tool, &out)),
        args: substitute_all(&language.run.exec.args, &tool, &out),
        env: language
            .run
            .env
            .iter()
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect(),
        workdir,
    }))
}

/// Runs prepared code once, feeding `stdin` to the program.
///
/// # Errors
///
/// Returns an error if the process cannot be started.
pub async fn run_prepared(
    prepared: &Prepared,
    stdin: &str,
    timeout: Duration,
) -> Result<RunOutput, AppError> {
    let args = as_strs(&prepared.args);
    let env: Vec<(&str, &str)> = prepared
        .env
        .iter()
        .map(|(key, value)| (key.as_str(), value.as_str()))
        .collect();
    let job = Job {
        program: &prepared.program,
        args: &args,
        cwd: prepared.workdir.path(),
        env: &env,
        stdin,
        timeout,
    };
    runner::run(&job).await
}

#[cfg(test)]
mod tests {
    use super::*;

    const RUN: Duration = Duration::from_secs(10);

    /// Tests that need a real toolchain are skipped (loudly) when it is not installed.
    async fn available(id: &str) -> bool {
        let installed = languages::detect(&languages::find(id).unwrap())
            .await
            .is_some();
        if !installed {
            eprintln!("skipping: {id} is not installed on this machine");
        }
        installed
    }

    /// Prepares `code` and returns it, panicking if it does not compile.
    async fn ready(id: &str, code: &str) -> Prepared {
        match prepare(id, code, COMPILE_TIMEOUT).await.unwrap() {
            Prepare::Ready(prepared) => prepared,
            Prepare::CompileFailed(output) => panic!("does not compile: {}", output.stderr),
        }
    }

    #[test]
    fn substitute_should_replace_tool_and_out_when_both_are_present() {
        let text = substitute("{tool} -o {out}", Path::new("cc"), Path::new("a.out"));
        assert_eq!(text, "cc -o a.out");
    }

    #[tokio::test]
    async fn prepare_should_fail_when_language_is_unknown() {
        let result = prepare("cobol", "", COMPILE_TIMEOUT).await;
        assert!(matches!(result, Err(AppError::UnknownLanguage(_))));
    }

    #[tokio::test]
    async fn run_prepared_should_capture_stdout_when_program_succeeds() {
        if !available("python").await {
            return;
        }
        let prepared = ready("python", "print('héllo')").await;
        let out = run_prepared(&prepared, "", RUN).await.unwrap();
        assert_eq!(out.stdout.trim(), "héllo");
        assert_eq!(out.exit_code, Some(0));
    }

    #[tokio::test]
    async fn run_prepared_should_report_exit_code_and_stderr_when_program_raises() {
        if !available("python").await {
            return;
        }
        let prepared = ready("python", "raise ValueError('boom')").await;
        let out = run_prepared(&prepared, "", RUN).await.unwrap();
        assert_eq!(out.exit_code, Some(1));
        assert!(out.stderr.contains("ValueError: boom"));
    }

    #[tokio::test]
    async fn run_prepared_should_run_a_compiled_program_when_language_is_rust() {
        if !available("rust").await {
            return;
        }
        let prepared = ready("rust", "fn main() { println!(\"ok\"); }").await;
        let out = run_prepared(&prepared, "", RUN).await.unwrap();
        assert_eq!(out.stdout.trim(), "ok");
    }

    #[tokio::test]
    async fn run_prepared_should_run_a_compiled_program_when_language_is_c() {
        if !available("c").await {
            return;
        }
        let code = "#include <stdio.h>\nint main(void) { puts(\"ok\"); return 0; }\n";
        let out = run_prepared(&ready("c", code).await, "", RUN)
            .await
            .unwrap();
        assert_eq!(out.stdout.trim(), "ok");
    }

    /// The program built by `g++` needs the compiler's runtime DLLs when it runs: it only works if
    /// the program is started with the same up-to-date `PATH` the compiler was found with.
    #[tokio::test]
    async fn run_prepared_should_run_a_compiled_program_when_language_is_cpp() {
        if !available("cpp").await {
            return;
        }
        let code = "#include <iostream>\nint main() { std::cout << \"ok\" << std::endl; }\n";
        let out = run_prepared(&ready("cpp", code).await, "", RUN)
            .await
            .unwrap();
        assert_eq!(out.stdout.trim(), "ok", "{}", out.stderr);
    }

    #[tokio::test]
    async fn prepare_should_return_compile_failed_when_c_does_not_compile() {
        if !available("c").await {
            return;
        }
        let result = prepare("c", "int main( { oops", COMPILE_TIMEOUT)
            .await
            .unwrap();
        assert!(matches!(result, Prepare::CompileFailed(_)));
    }

    #[tokio::test]
    async fn run_prepared_should_run_a_compiled_program_when_language_is_go() {
        if !available("go").await {
            return;
        }
        let code = "package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"ok\") }";
        let out = run_prepared(&ready("go", code).await, "", RUN)
            .await
            .unwrap();
        assert_eq!(out.stdout.trim(), "ok");
    }

    #[tokio::test]
    async fn prepare_should_return_compile_failed_when_rust_does_not_compile() {
        if !available("rust").await {
            return;
        }
        let result = prepare("rust", "fn main() { let x: i32 = \"a\"; }", COMPILE_TIMEOUT)
            .await
            .unwrap();
        let Prepare::CompileFailed(output) = result else {
            panic!("expected a compile failure");
        };
        assert!(output.stderr.contains("error"));
    }

    #[tokio::test]
    async fn prepare_should_return_compile_failed_when_go_does_not_compile() {
        if !available("go").await {
            return;
        }
        let result = prepare("go", "package main\nfunc main() { x }", COMPILE_TIMEOUT)
            .await
            .unwrap();
        assert!(matches!(result, Prepare::CompileFailed(_)));
    }

    #[tokio::test]
    async fn run_prepared_should_kill_program_when_timeout_exceeded() {
        if !available("python").await {
            return;
        }
        let prepared = ready("python", "while True: pass").await;
        let out = run_prepared(&prepared, "", Duration::from_millis(500))
            .await
            .unwrap();
        assert!(out.timed_out);
        assert_eq!(out.exit_code, None);
    }

    #[tokio::test]
    async fn run_prepared_should_truncate_output_when_stream_exceeds_cap() {
        if !available("python").await {
            return;
        }
        let prepared = ready("python", "print('x' * 3_000_000)").await;
        let out = run_prepared(&prepared, "", RUN).await.unwrap();
        assert!(out.truncated);
        assert_eq!(out.stdout.len(), 1024 * 1024);
    }

    #[tokio::test]
    async fn run_prepared_should_feed_stdin_to_the_program_when_input_is_given() {
        if !available("python").await {
            return;
        }
        let prepared = ready("python", "print(int(input()) * 2)").await;
        let first = run_prepared(&prepared, "21\n", RUN).await.unwrap();
        let second = run_prepared(&prepared, "4\n", RUN).await.unwrap();
        assert_eq!(first.stdout.trim(), "42");
        assert_eq!(second.stdout.trim(), "8");
    }

    #[tokio::test]
    async fn run_prepared_should_give_eof_to_the_program_when_input_is_empty() {
        if !available("python").await {
            return;
        }
        let prepared = ready("python", "import sys\nprint(repr(sys.stdin.read()))").await;
        let out = run_prepared(&prepared, "", RUN).await.unwrap();
        assert_eq!(out.stdout.trim(), "''");
    }
}
