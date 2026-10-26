mod auth;
mod cases;
mod check;
mod drafts;
mod error;
mod execute;
mod exercises;
mod languages;
mod onboarding;
mod path;
mod progress;
mod protocols;
mod runner;
mod streak;
mod sync;

use tauri::Manager;

/// The secret store of the session. In a debug build only, `SYNACK_KEYRING_ACCOUNT` selects
/// another entry, so an automated test never reads or wipes the session of a real account.
fn secret_store() -> auth::KeyringStore {
    let account = if cfg!(debug_assertions) {
        std::env::var("SYNACK_KEYRING_ACCOUNT").ok()
    } else {
        None
    };
    account.map_or_else(auth::KeyringStore::new, |account| {
        auth::KeyringStore::with_account(&account)
    })
}

/// Builds and runs the Tauri application until its last window closes.
///
/// # Panics
///
/// Panics if the window system cannot start: there is no caller left to report to.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[expect(clippy::expect_used, reason = "startup failure is unrecoverable")]
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(progress::ProgressStore::open(&dir.join("progress.db"))?);
            app.manage(protocols::QuizSessions::default());
            app.manage(auth::AuthService::new(
                auth::Client::new(&auth::Config::embedded()?)?,
                Box::new(secret_store()),
                auth::CALLBACK_PORT,
            ));
            // Updates come from the GitHub releases (see `tauri.conf.json`, `plugins.updater`).
            // The plugin does the network work in Rust and checks the signature of what it
            // downloads against the public key embedded in the configuration.
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::cancel_sign_in,
            auth::current_user,
            auth::sign_in,
            auth::sign_out,
            check::check_exercise,
            drafts::get_drafts,
            drafts::save_draft,
            exercises::list_exercises,
            languages::check_environment,
            onboarding::get_onboarding,
            onboarding::save_onboarding,
            progress::get_solved,
            progress::get_validated_protocols,
            protocols::start_protocol_quiz,
            protocols::submit_protocol_quiz,
            streak::get_streak
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
