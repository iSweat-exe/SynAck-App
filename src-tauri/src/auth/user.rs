//! What the interface may know about the signed-in account. Tokens never appear here.

use serde::Serialize;
use serde_json::Value;
use url::Url;

/// Hosts the sign-in providers serve avatars from. This list MUST match `img-src` in
/// `tauri.conf.json`: a test checks it, so the two cannot drift apart.
pub const AVATAR_HOSTS: [&str; 2] = ["avatars.githubusercontent.com", "cdn.discordapp.com"];

const MAX_NAME_CHARS: usize = 60;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthUser {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
    /// Set by the server, so it can be trusted (unlike `user_metadata`, which the user can edit).
    pub provider: String,
}

/// An avatar URL is shown in the interface, so only `https` URLs on the providers' own CDNs
/// pass: anything else (a tracking pixel, an `http` URL, `user:pass@host`) is dropped.
fn allowed_avatar(candidate: &str) -> Option<String> {
    let url = Url::parse(candidate).ok()?;
    let host = url.host_str()?;
    (url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && AVATAR_HOSTS.contains(&host))
    .then(|| url.to_string())
}

fn text_field<'a>(metadata: Option<&'a Value>, keys: &[&str]) -> Option<&'a str> {
    let metadata = metadata?;
    keys.iter()
        .filter_map(|key| metadata.get(key)?.as_str())
        .map(str::trim)
        .find(|value| !value.is_empty())
}

impl AuthUser {
    /// Reads the `user` object of a Supabase session. The name and avatar come from
    /// `user_metadata`: they are for display only, never for deciding what someone may do.
    pub fn from_json(user: &Value) -> Option<Self> {
        let id = user.get("id")?.as_str()?.trim();
        if id.is_empty() || id.len() > 64 {
            return None;
        }
        let metadata = user.get("user_metadata");
        let name: String = text_field(
            metadata,
            &["full_name", "name", "user_name", "preferred_username"],
        )
        .unwrap_or("Utilisateur")
        .chars()
        .filter(|character| !character.is_control())
        .take(MAX_NAME_CHARS)
        .collect();

        Some(Self {
            id: id.to_owned(),
            name,
            avatar_url: text_field(metadata, &["avatar_url", "picture"]).and_then(allowed_avatar),
            provider: user
                .pointer("/app_metadata/provider")
                .and_then(Value::as_str)
                .unwrap_or("inconnu")
                .to_owned(),
        })
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn github_user() -> Value {
        json!({
            "id": "6f1c1e0e-8a5d-4f0e-9d5e-0f2f6a3b1c11",
            "app_metadata": { "provider": "github" },
            "user_metadata": {
                "user_name": "octocat",
                "name": "The Octocat",
                "avatar_url": "https://avatars.githubusercontent.com/u/1?v=4"
            }
        })
    }

    #[test]
    fn from_json_should_read_the_display_fields_when_the_user_comes_from_github() {
        let user = AuthUser::from_json(&github_user()).unwrap();
        assert_eq!(user.name, "The Octocat");
        assert_eq!(user.provider, "github");
        assert_eq!(
            user.avatar_url.as_deref(),
            Some("https://avatars.githubusercontent.com/u/1?v=4")
        );
    }

    #[test]
    fn from_json_should_fall_back_to_the_user_name_when_there_is_no_full_name() {
        let mut user = github_user();
        user["user_metadata"] = json!({ "user_name": "octocat" });
        assert_eq!(AuthUser::from_json(&user).unwrap().name, "octocat");
    }

    #[test]
    fn from_json_should_use_a_neutral_name_when_the_provider_gave_none() {
        let mut user = github_user();
        user["user_metadata"] = json!({});
        assert_eq!(AuthUser::from_json(&user).unwrap().name, "Utilisateur");
    }

    #[test]
    fn from_json_should_drop_control_characters_and_cap_the_length_of_the_name() {
        let mut user = github_user();
        user["user_metadata"] = json!({ "name": format!("a\u{0}b{}", "x".repeat(200)) });
        let name = AuthUser::from_json(&user).unwrap().name;
        assert!(!name.contains('\u{0}'));
        assert_eq!(name.chars().count(), MAX_NAME_CHARS);
    }

    #[test]
    fn from_json_should_refuse_a_user_without_an_id() {
        assert!(AuthUser::from_json(&json!({ "user_metadata": {} })).is_none());
    }

    #[test]
    fn allowed_avatar_should_accept_the_discord_cdn() {
        assert!(allowed_avatar("https://cdn.discordapp.com/avatars/1/a.png").is_some());
    }

    #[test]
    fn allowed_avatar_should_refuse_any_other_host() {
        assert_eq!(allowed_avatar("https://evil.example/pixel.png"), None);
    }

    #[test]
    fn allowed_avatar_should_refuse_a_host_that_only_looks_like_an_allowed_one() {
        assert_eq!(
            allowed_avatar("https://avatars.githubusercontent.com.evil.example/a.png"),
            None
        );
    }

    #[test]
    fn allowed_avatar_should_refuse_plain_http() {
        assert_eq!(
            allowed_avatar("http://avatars.githubusercontent.com/u/1"),
            None
        );
    }

    #[test]
    fn allowed_avatar_should_refuse_credentials_in_the_url() {
        assert_eq!(
            allowed_avatar("https://user:pass@cdn.discordapp.com/a.png"),
            None
        );
    }
}
