//! The `PATH` programs are looked up in.
//!
//! A program receives its `PATH` when it starts and never sees a later change. On Windows that
//! meant a compiler installed while the application was open stayed "missing" until the
//! application (and the terminal that started it) was restarted. Here the `PATH` is read again from the registry, where
//! Windows keeps the one new programs will get, and merged with the one the process already has.

use std::ffi::OsString;
use std::path::PathBuf;

/// The `PATH` to use now, or `None` to keep the process's own (not Windows, or the registry
/// could not be read).
pub fn refreshed() -> Option<OsString> {
    #[cfg(windows)]
    {
        let registry = registry_entries()?;
        let current: Vec<PathBuf> = std::env::var_os("PATH")
            .map(|path| std::env::split_paths(&path).collect())
            .unwrap_or_default();
        std::env::join_paths(merge(registry, current)).ok()
    }
    #[cfg(not(windows))]
    {
        None
    }
}

/// Puts `first` before `then` and drops the duplicates. Windows ignores case and a trailing
/// separator in a path, so `C:\Tools\` and `c:\tools` are the same entry.
#[cfg(any(windows, test))]
fn merge(first: Vec<PathBuf>, then: Vec<PathBuf>) -> Vec<PathBuf> {
    fn key(entry: &std::path::Path) -> String {
        entry
            .to_string_lossy()
            .trim_end_matches(['\\', '/'])
            .to_lowercase()
    }

    let mut merged: Vec<PathBuf> = Vec::new();
    for entry in first.into_iter().chain(then) {
        let entry_key = key(&entry);
        if !entry_key.is_empty() && !merged.iter().any(|kept| key(kept) == entry_key) {
            merged.push(entry);
        }
    }
    merged
}

/// Replaces `%NAME%` with the value of the variable (`%SystemRoot%\system32` is how Windows
/// writes many entries of the `PATH`). An unknown variable is left as it is.
#[cfg(any(windows, test))]
fn expand(value: &str, lookup: impl Fn(&str) -> Option<String>) -> String {
    let mut expanded = String::with_capacity(value.len());
    let mut rest = value;
    while let Some(start) = rest.find('%') {
        expanded.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        let known = after
            .find('%')
            .filter(|end| *end > 0)
            .and_then(|end| lookup(&after[..end]).map(|found| (end, found)));
        if let Some((end, found)) = known {
            expanded.push_str(&found);
            rest = &after[end + 1..];
        } else {
            // Not a variable: keep the percent sign and go on after it.
            expanded.push('%');
            rest = after;
        }
    }
    expanded.push_str(rest);
    expanded
}

/// The machine `PATH` then the user's, as new programs receive them.
#[cfg(windows)]
fn registry_entries() -> Option<Vec<PathBuf>> {
    use winreg::RegKey;
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};

    let read = |root, subkey: &str| -> Option<String> {
        RegKey::predef(root)
            .open_subkey_with_flags(subkey, KEY_READ)
            .ok()?
            .get_value::<String, _>("Path")
            .ok()
    };
    let machine = read(
        HKEY_LOCAL_MACHINE,
        r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
    )?;
    // A user without their own `PATH` is normal.
    let user = read(HKEY_CURRENT_USER, "Environment").unwrap_or_default();

    let entries = [machine, user]
        .iter()
        .flat_map(|value| {
            expand(value, |name| std::env::var(name).ok())
                .split(';')
                .map(PathBuf::from)
                .collect::<Vec<_>>()
        })
        .collect();
    Some(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn paths(values: &[&str]) -> Vec<PathBuf> {
        values.iter().map(PathBuf::from).collect()
    }

    #[test]
    fn merge_should_add_a_new_entry_after_the_ones_it_is_given_first() {
        let merged = merge(paths(&[r"C:\msys64\ucrt64\bin"]), paths(&[r"C:\Windows"]));
        assert_eq!(merged, paths(&[r"C:\msys64\ucrt64\bin", r"C:\Windows"]));
    }

    #[test]
    fn merge_should_keep_the_entries_the_process_already_had() {
        let merged = merge(paths(&[r"C:\Windows"]), paths(&[r"C:\tools\cargo\bin"]));
        assert!(merged.contains(&PathBuf::from(r"C:\tools\cargo\bin")));
    }

    #[test]
    fn merge_should_treat_case_and_a_trailing_separator_as_the_same_entry() {
        let merged = merge(paths(&[r"C:\Tools\"]), paths(&[r"c:\tools", r"C:\TOOLS\"]));
        assert_eq!(merged, paths(&[r"C:\Tools\"]));
    }

    #[test]
    fn merge_should_drop_empty_entries() {
        assert_eq!(
            merge(paths(&["", r"C:\a"]), paths(&[""])),
            paths(&[r"C:\a"])
        );
    }

    #[test]
    fn expand_should_replace_a_known_variable() {
        let lookup = |name: &str| (name == "SystemRoot").then(|| r"C:\Windows".to_owned());
        assert_eq!(
            expand(r"%SystemRoot%\system32", lookup),
            r"C:\Windows\system32"
        );
    }

    #[test]
    fn expand_should_leave_an_unknown_variable_as_it_is() {
        assert_eq!(expand(r"%NOPE%\bin", |_| None), r"%NOPE%\bin");
    }

    #[test]
    fn expand_should_leave_a_lone_percent_sign_alone() {
        assert_eq!(expand("100%", |_| None), "100%");
        assert_eq!(expand("a%%b", |_| None), "a%%b");
    }

    #[test]
    fn expand_should_handle_several_variables() {
        let lookup = |name: &str| Some(format!("<{name}>"));
        assert_eq!(expand("%A%;%B%", lookup), "<A>;<B>");
    }

    /// The registry of any Windows machine lists its own system directory.
    #[cfg(windows)]
    #[test]
    fn refreshed_should_include_the_windows_system_directory_when_run_on_windows() {
        let path = refreshed().expect("the registry can be read");
        let entries: Vec<String> = std::env::split_paths(&path)
            .map(|entry| entry.to_string_lossy().to_lowercase())
            .collect();
        assert!(
            entries.iter().any(|entry| entry.ends_with(r"\system32")),
            "{entries:?}"
        );
    }
}
