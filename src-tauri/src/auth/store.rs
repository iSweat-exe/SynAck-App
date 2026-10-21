//! Where the refresh token lives between two launches: the operating system's secret store
//! (Windows Credential Manager, macOS Keychain, Secret Service on Linux), never a plain file and
//! never the web view. Only the refresh token is stored; the access token stays in memory.

use crate::error::AppError;

const SERVICE: &str = "app.synack.desktop";
const ACCOUNT: &str = "supabase-refresh-token";

pub trait TokenStore: Send + Sync {
    /// The saved refresh token, if any.
    fn load(&self) -> Result<Option<String>, AppError>;
    fn save(&self, token: &str) -> Result<(), AppError>;
    /// Forgets the refresh token. Forgetting what is not there is not an error.
    fn clear(&self) -> Result<(), AppError>;
}

/// The operating system's secret store.
pub struct KeyringStore {
    account: String,
}

impl KeyringStore {
    pub fn new() -> Self {
        Self::with_account(ACCOUNT)
    }

    /// A store under another name, so a test never touches the real session.
    pub fn with_account(account: &str) -> Self {
        Self {
            account: account.to_owned(),
        }
    }

    fn entry(&self) -> Result<keyring::Entry, AppError> {
        keyring::Entry::new(SERVICE, &self.account).map_err(storage_error)
    }
}

#[expect(
    clippy::needless_pass_by_value,
    reason = "used directly as a `map_err` callback"
)]
fn storage_error(error: keyring::Error) -> AppError {
    AppError::AuthStorage(error.to_string())
}

impl TokenStore for KeyringStore {
    fn load(&self) -> Result<Option<String>, AppError> {
        match self.entry()?.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(storage_error(error)),
        }
    }

    fn save(&self, token: &str) -> Result<(), AppError> {
        self.entry()?.set_password(token).map_err(storage_error)
    }

    fn clear(&self) -> Result<(), AppError> {
        match self.entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(storage_error(error)),
        }
    }
}

#[cfg(test)]
pub mod memory {
    use std::sync::{Mutex, PoisonError};

    use super::TokenStore;
    use crate::error::AppError;

    /// A store that lives in memory, for tests.
    #[derive(Default)]
    pub struct MemoryStore(Mutex<Option<String>>);

    impl MemoryStore {
        pub fn with_token(token: &str) -> Self {
            Self(Mutex::new(Some(token.to_owned())))
        }

        pub fn current(&self) -> Option<String> {
            self.0
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .clone()
        }
    }

    impl TokenStore for std::sync::Arc<MemoryStore> {
        fn load(&self) -> Result<Option<String>, AppError> {
            MemoryStore::load(self)
        }

        fn save(&self, token: &str) -> Result<(), AppError> {
            MemoryStore::save(self, token)
        }

        fn clear(&self) -> Result<(), AppError> {
            MemoryStore::clear(self)
        }
    }

    impl TokenStore for MemoryStore {
        fn load(&self) -> Result<Option<String>, AppError> {
            Ok(self.current())
        }

        fn save(&self, token: &str) -> Result<(), AppError> {
            *self.0.lock().unwrap_or_else(PoisonError::into_inner) = Some(token.to_owned());
            Ok(())
        }

        fn clear(&self) -> Result<(), AppError> {
            *self.0.lock().unwrap_or_else(PoisonError::into_inner) = None;
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Talks to the REAL secret store of the machine, so it only runs when asked for:
    /// `cargo test -- --ignored keyring`.
    #[test]
    #[ignore = "uses the real operating system secret store"]
    fn keyring_store_should_save_load_and_clear_a_token_in_the_real_secret_store() {
        let store = KeyringStore::with_account("test-refresh-token");
        store.clear().unwrap();
        assert_eq!(store.load().unwrap(), None);

        store.save("a-refresh-token").unwrap();
        assert_eq!(store.load().unwrap().as_deref(), Some("a-refresh-token"));

        store.clear().unwrap();
        assert_eq!(store.load().unwrap(), None);
    }
}
