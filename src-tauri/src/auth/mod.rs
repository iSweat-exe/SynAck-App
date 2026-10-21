//! Authentication: sign in with GitHub or Discord through Supabase, in the system browser.
//!
//! The flow (OAuth 2.0 for native apps, RFC 8252, with PKCE):
//! 1. a loopback server starts on `127.0.0.1`;
//! 2. the system browser opens the Supabase `authorize` address, with the PKCE challenge;
//! 3. after signing in with the provider, the browser is redirected to the loopback server with
//!    an authorization code;
//! 4. the app exchanges the code (and the secret PKCE verifier) for a session.
//!
//! The web view never handles a token: it only learns who is signed in.

mod callback;
#[cfg(test)]
mod csp;
mod pkce;
mod service;
mod store;
mod supabase;
#[cfg(test)]
mod testing;
mod user;

use serde::Deserialize;
use tauri::State;
use url::Url;

pub use service::AuthService;
pub use store::KeyringStore;
pub use supabase::{Client, Config};
pub use user::AuthUser;

use crate::error::AppError;

/// The loopback port of the redirect. It MUST be allowed in the Supabase project
/// (Authentication > URL Configuration > Redirect URLs): `http://127.0.0.1:53682/callback`.
pub const CALLBACK_PORT: u16 = 53682;

/// The sign-in providers on offer. Both are enabled in the Supabase project.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Github,
    Discord,
}

impl Provider {
    pub fn as_str(self) -> &'static str {
        match self {
            Provider::Github => "github",
            Provider::Discord => "discord",
        }
    }
}

/// Opens an address in the default browser. Only ever called with the Supabase `authorize`
/// address built by [`Client::authorize_url`].
fn open_in_browser(url: &Url) -> Result<(), AppError> {
    opener::open(url.as_str()).map_err(|error| AppError::AuthBrowser(error.to_string()))
}

/// Who is signed in, if anyone. Restores the saved session silently when the app opens.
#[tauri::command]
pub async fn current_user(service: State<'_, AuthService>) -> Result<Option<AuthUser>, AppError> {
    service.restore().await
}

/// Signs in with `provider` through the system browser. The age declaration is required here,
/// not only in the interface.
#[tauri::command]
pub async fn sign_in(
    service: State<'_, AuthService>,
    provider: Provider,
    age_confirmed: bool,
) -> Result<AuthUser, AppError> {
    service
        .sign_in(provider, age_confirmed, open_in_browser)
        .await
}

/// Gives up a sign-in that is waiting for the browser.
#[tauri::command]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri hands `State` over by value"
)]
pub fn cancel_sign_in(service: State<'_, AuthService>) {
    service.cancel_sign_in();
}

/// Signs out and wipes the saved session.
#[tauri::command]
pub async fn sign_out(service: State<'_, AuthService>) -> Result<(), AppError> {
    service.sign_out().await
}
