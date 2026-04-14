use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("[api] {0}")]
    Api(String),

    #[error("[clipboard] {0}")]
    Clipboard(String),

    #[error("[http] {0}")]
    Http(#[from] reqwest::Error),

    #[error("[serde] {0}")]
    Serde(#[from] serde_json::Error),

    #[error("[tauri] {0}")]
    Tauri(#[from] tauri::Error),

    #[error("[config] {0}")]
    Config(String),
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
