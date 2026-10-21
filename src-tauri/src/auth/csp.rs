//! Guards the Content Security Policy in `tauri.conf.json`. It is the last wall if the web view
//! ever rendered something hostile, so it must not erode silently.

use serde_json::Value;

use super::user::AVATAR_HOSTS;

fn policy() -> String {
    let config: Value = serde_json::from_str(include_str!("../../tauri.conf.json")).unwrap();
    config["app"]["security"]["csp"]
        .as_str()
        .unwrap()
        .to_owned()
}

/// The sources of one directive, e.g. `img-src`.
fn sources(directive: &str) -> Vec<String> {
    policy()
        .split(';')
        .map(str::trim)
        .find_map(|part| {
            let mut words = part.split_whitespace();
            (words.next() == Some(directive)).then(|| words.map(str::to_owned).collect())
        })
        .unwrap_or_default()
}

#[test]
fn csp_should_not_allow_eval_or_inline_scripts() {
    let policy = policy();
    assert!(!policy.contains("unsafe-eval"));
    assert!(!sources("script-src").iter().any(|s| s == "'unsafe-inline'"));
    assert_eq!(sources("script-src"), ["'self'"]);
}

#[test]
fn csp_should_forbid_plugins_forms_framing_and_base_tag_changes() {
    for directive in [
        "object-src",
        "base-uri",
        "form-action",
        "frame-src",
        "frame-ancestors",
    ] {
        assert_eq!(sources(directive), ["'none'"], "{directive}");
    }
}

#[test]
fn csp_should_not_let_the_web_view_talk_to_the_network() {
    // All network traffic goes through Rust: the web view only needs the Tauri IPC channel.
    let connect = sources("connect-src");
    assert_eq!(connect.len(), 2, "{connect:?}");
    assert!(
        connect
            .iter()
            .all(|source| source == "ipc:" || source == "http://ipc.localhost"),
        "{connect:?}"
    );
}

#[test]
fn csp_should_allow_images_only_from_the_app_and_the_provider_avatar_hosts() {
    let remote: Vec<String> = sources("img-src")
        .into_iter()
        .filter(|source| source.starts_with("https://"))
        .collect();
    let mut expected: Vec<String> = AVATAR_HOSTS
        .iter()
        .map(|host| format!("https://{host}"))
        .collect();
    let mut remote_sorted = remote;
    remote_sorted.sort();
    expected.sort();
    assert_eq!(remote_sorted, expected);
}

#[test]
fn csp_should_never_use_a_wildcard_source() {
    for source in policy().split_whitespace() {
        assert!(!source.contains('*'), "{source}");
        assert_ne!(source, "https:", "any https host would be allowed");
        assert_ne!(source, "http:");
    }
}
