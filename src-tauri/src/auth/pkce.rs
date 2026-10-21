//! PKCE (RFC 7636): proves that whoever exchanges the authorization code is whoever started the
//! sign-in. Without it, a program that intercepted the code on the loopback port could use it.

use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use sha2::{Digest, Sha256};

use crate::error::AppError;

/// A secret `verifier` (kept in memory, sent only when exchanging the code) and its public
/// `challenge` (sent to the browser at the start).
pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
}

impl Pkce {
    /// Draws a new pair from the operating system's secure random generator.
    ///
    /// # Errors
    ///
    /// Returns an error if the system cannot provide random bytes.
    pub fn generate() -> Result<Self, AppError> {
        // 32 random bytes encode to 43 characters, the minimum RFC 7636 §4.1 allows.
        let mut bytes = [0_u8; 32];
        getrandom::fill(&mut bytes)
            .map_err(|error| AppError::Io(std::io::Error::other(error.to_string())))?;
        let verifier = URL_SAFE_NO_PAD.encode(bytes);
        Ok(Self {
            challenge: challenge_for(&verifier),
            verifier,
        })
    }
}

/// `BASE64URL(SHA256(verifier))`, the `S256` method.
pub fn challenge_for(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn challenge_for_should_match_the_rfc_7636_test_vector() {
        // RFC 7636, appendix B.
        assert_eq!(
            challenge_for("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn generate_should_produce_a_verifier_of_43_url_safe_characters() {
        let pkce = Pkce::generate().unwrap();
        assert_eq!(pkce.verifier.len(), 43);
        assert!(
            pkce.verifier
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        );
    }

    #[test]
    fn generate_should_derive_the_challenge_from_the_verifier() {
        let pkce = Pkce::generate().unwrap();
        assert_eq!(pkce.challenge, challenge_for(&pkce.verifier));
    }

    #[test]
    fn generate_should_never_repeat_a_verifier() {
        assert_ne!(
            Pkce::generate().unwrap().verifier,
            Pkce::generate().unwrap().verifier
        );
    }
}
