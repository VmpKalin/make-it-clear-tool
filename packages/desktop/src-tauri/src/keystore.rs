use crate::config::Provider;
use crate::error::{AppError, AppResult};

const SERVICE: &str = "dev.textpilot.desktop";

fn entry_user(provider: Provider) -> &'static str {
    match provider {
        Provider::Claude => "claude-api-key",
        Provider::Openai => "openai-api-key",
    }
}

pub fn set_api_key(provider: Provider, key: &str) -> AppResult<()> {
    let entry = keyring::Entry::new(SERVICE, entry_user(provider))
        .map_err(|e| AppError::Keyring(format!("Failed to create keyring entry: {e}")))?;
    entry
        .set_password(key)
        .map_err(|e| AppError::Keyring(format!("Failed to store API key: {e}")))?;
    log::info!("[desktop/keystore] API key stored for {provider:?}");
    Ok(())
}

pub fn get_api_key(provider: Provider) -> Option<String> {
    let entry = keyring::Entry::new(SERVICE, entry_user(provider)).ok()?;
    match entry.get_password() {
        Ok(key) if !key.trim().is_empty() => Some(key),
        _ => None,
    }
}

pub fn has_api_key(provider: Provider) -> bool {
    get_api_key(provider).is_some()
}

pub fn clear_api_key(provider: Provider) -> AppResult<()> {
    let entry = keyring::Entry::new(SERVICE, entry_user(provider))
        .map_err(|e| AppError::Keyring(format!("Failed to create keyring entry: {e}")))?;
    match entry.delete_credential() {
        Ok(()) => {
            log::info!("[desktop/keystore] API key cleared for {provider:?}");
            Ok(())
        }
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Keyring(format!("Failed to clear API key: {e}"))),
    }
}
