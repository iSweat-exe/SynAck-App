use serde::{Serialize, Serializer};

/// Errors returned to the front end as a ready-to-display French message.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0} est introuvable sur cette machine.")]
    ToolNotFound(String),
    #[error("Langage inconnu : {0}.")]
    UnknownLanguage(String),
    #[error("Exercice inconnu : {0}.")]
    UnknownExercise(String),
    #[error("Cet exercice ne propose pas le langage « {0} ».")]
    LanguageNotOffered(String),
    #[error("Protocole inconnu : {0}.")]
    UnknownProtocol(String),
    #[error("Ce quiz n'est plus valable : recommence-le.")]
    QuizExpired,
    #[error("Les réponses envoyées ne correspondent pas au quiz.")]
    QuizMalformed,
    #[error("Les réponses du questionnaire sont incomplètes ou invalides.")]
    OnboardingInvalid,
    #[error("Le code est trop long pour être un exercice de ce niveau.")]
    CodeTooLong,
    #[error("Les données des langages sont invalides : {0}")]
    Data(#[from] serde_json::Error),
    #[error("La progression n'a pas pu être lue ou enregistrée : {0}")]
    Database(#[from] rusqlite::Error),
    #[error("La connexion a échoué ou a été refusée. Réessaie.")]
    AuthRejected,
    #[error("Impossible de joindre le service de connexion. Vérifie ta connexion à Internet.")]
    AuthNetwork,
    #[error("La connexion a été annulée.")]
    AuthCancelled,
    #[error("Le délai de connexion est dépassé. Réessaie.")]
    AuthTimeout,
    #[error("Le port {0} est déjà utilisé par un autre programme : ferme-le puis réessaie.")]
    AuthPortBusy(u16),
    #[error("Une connexion est déjà en cours.")]
    AuthBusy,
    #[error("Tu dois confirmer avoir au moins 15 ans pour te connecter.")]
    AuthAgeRequired,
    #[error("Ta déclaration d'âge n'a pas pu être enregistrée : la connexion est annulée.")]
    AuthAgeNotRecorded,
    #[error("Impossible d'ouvrir le navigateur : {0}")]
    AuthBrowser(String),
    #[error("Impossible d'utiliser le coffre de secrets du système : {0}")]
    AuthStorage(String),
    #[error("La configuration de la connexion est invalide : {0}")]
    AuthConfig(String),
    #[error("Tu dois être connecté pour faire cela.")]
    NotSignedIn,
    #[error(
        "La synchronisation est impossible pour le moment. Ta progression reste sur cet ordinateur et sera envoyée plus tard."
    )]
    SyncUnavailable,
    #[error("Le serveur a refusé d'enregistrer la progression.")]
    SyncRejected,
    #[error("Impossible de préparer ou de lancer l'exécution : {0}")]
    Io(#[from] std::io::Error),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
