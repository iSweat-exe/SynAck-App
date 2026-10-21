//! Runs a child process under supervision: timeout, capped output, no console window.

use std::io;
use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};

use serde::Serialize;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;
use tokio::task::JoinHandle;

use crate::error::AppError;
use crate::path;

/// Each output stream keeps at most this many bytes; the rest is read and dropped.
const MAX_STREAM_BYTES: usize = 1024 * 1024;

/// After the process is killed, how long to wait for its output pipes to close.
const PIPE_GRACE: Duration = Duration::from_secs(2);

/// What to run, where, and for how long.
pub struct Job<'a> {
    pub program: &'a Path,
    pub args: &'a [&'a str],
    pub cwd: &'a Path,
    pub env: &'a [(&'a str, &'a str)],
    /// Text sent to the program's standard input; empty means no input (the program sees EOF).
    pub stdin: &'a str,
    pub timeout: Duration,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunOutput {
    pub stdout: String,
    pub stderr: String,
    /// `None` when the process was killed because of the timeout.
    pub exit_code: Option<i32>,
    pub timed_out: bool,
    /// True when an output stream exceeded the size cap and was cut.
    pub truncated: bool,
    pub duration_ms: u64,
}

#[derive(Default)]
struct Captured {
    bytes: Vec<u8>,
    truncated: bool,
}

/// Reads a stream to the end, keeping only the first `limit` bytes so the child never blocks on a full pipe.
async fn read_capped<R: AsyncRead + Unpin>(mut reader: R, limit: usize) -> io::Result<Captured> {
    let mut captured = Captured::default();
    let mut chunk = [0u8; 8192];
    loop {
        let read = reader.read(&mut chunk).await?;
        if read == 0 {
            return Ok(captured);
        }
        let room = limit.saturating_sub(captured.bytes.len());
        captured.bytes.extend_from_slice(&chunk[..read.min(room)]);
        captured.truncated |= read > room;
    }
}

async fn collect(task: JoinHandle<io::Result<Captured>>) -> io::Result<Captured> {
    let abort = task.abort_handle();
    if let Ok(joined) = tokio::time::timeout(PIPE_GRACE, task).await {
        joined.map_err(io::Error::other)?
    } else {
        abort.abort();
        Ok(Captured::default())
    }
}

#[cfg(windows)]
fn hide_console(command: &mut Command) {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_console(_command: &mut Command) {}

fn missing_pipe(name: &str) -> io::Error {
    io::Error::other(format!("pipe {name} indisponible"))
}

/// Runs the job to completion or until its timeout, then kills the process.
///
/// # Errors
///
/// Returns an error if the process cannot be spawned or its output cannot be read.
pub async fn run(job: &Job<'_>) -> Result<RunOutput, AppError> {
    let mut command = Command::new(job.program);
    command
        .args(job.args)
        .envs(job.env.iter().copied())
        .current_dir(job.cwd)
        .stdin(if job.stdin.is_empty() {
            Stdio::null()
        } else {
            Stdio::piped()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    // The program and what it launches (a compiler, then the program it built, which may need
    // the compiler's DLLs) must see the same up-to-date `PATH` the detection used.
    if let Some(search_path) = path::refreshed() {
        command.env("PATH", search_path);
    }
    hide_console(&mut command);

    let started = Instant::now();
    let mut child = command.spawn()?;
    if !job.stdin.is_empty() {
        let mut stdin = child.stdin.take().ok_or_else(|| missing_pipe("stdin"))?;
        let input = job.stdin.to_owned();
        // Written from a task so a program that never reads cannot block us; dropping `stdin`
        // closes the pipe. A program that exits early makes the write fail, which is fine.
        tokio::spawn(async move {
            let _ = stdin.write_all(input.as_bytes()).await;
        });
    }
    let stdout = child.stdout.take().ok_or_else(|| missing_pipe("stdout"))?;
    let stderr = child.stderr.take().ok_or_else(|| missing_pipe("stderr"))?;
    let stdout_task = tokio::spawn(read_capped(stdout, MAX_STREAM_BYTES));
    let stderr_task = tokio::spawn(read_capped(stderr, MAX_STREAM_BYTES));

    let (exit_code, timed_out) =
        if let Ok(status) = tokio::time::timeout(job.timeout, child.wait()).await {
            (status?.code(), false)
        } else {
            child.kill().await?;
            (None, true)
        };

    let stdout = collect(stdout_task).await?;
    let stderr = collect(stderr_task).await?;
    Ok(RunOutput {
        stdout: String::from_utf8_lossy(&stdout.bytes).into_owned(),
        stderr: String::from_utf8_lossy(&stderr.bytes).into_owned(),
        exit_code,
        timed_out,
        truncated: stdout.truncated || stderr.truncated,
        duration_ms: u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX),
    })
}
