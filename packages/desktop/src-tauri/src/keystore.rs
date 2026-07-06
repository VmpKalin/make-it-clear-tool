use crate::config::Provider;
use crate::error::{AppError, AppResult};

const SERVICE: &str = "dev.textpilot.desktop";

pub fn set_api_key(provider: Provider, key: &str) -> AppResult<()> {
    let user = provider.keyring_id();
    log::debug!("[desktop/keystore] set_api_key: service={SERVICE}, user={user}");
    let entry = keyring::Entry::new(SERVICE, user)
        .map_err(|e| AppError::Keyring(format!("Failed to create keyring entry: {e}")))?;
    entry
        .set_password(key)
        .map_err(|e| AppError::Keyring(format!("Failed to store API key: {e}")))?;
    log::info!("[desktop/keystore] API key stored for {provider:?}");
    Ok(())
}

pub fn get_api_key(provider: Provider) -> Option<String> {
    let user = provider.keyring_id();
    log::debug!("[desktop/keystore] get_api_key: service={SERVICE}, user={user}");
    let entry = match keyring::Entry::new(SERVICE, user) {
        Ok(e) => e,
        Err(err) => {
            log::warn!("[desktop/keystore] Entry::new failed for {provider:?}: {err}");
            return None;
        }
    };
    match entry.get_password() {
        Ok(key) if !key.trim().is_empty() => Some(key),
        Ok(_) => {
            log::debug!("[desktop/keystore] get_api_key({provider:?}): stored key is empty");
            None
        }
        Err(err) => {
            log::warn!("[desktop/keystore] get_password failed for {provider:?}: {err}");
            None
        }
    }
}

pub fn has_api_key(provider: Provider) -> bool {
    let result = get_api_key(provider).is_some();
    log::debug!("[desktop/keystore] has_api_key({provider:?}) = {result}");
    result
}

pub fn clear_api_key(provider: Provider) -> AppResult<()> {
    let user = provider.keyring_id();
    let entry = keyring::Entry::new(SERVICE, user)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keyring_round_trip_claude() {
        let provider = Provider::Claude;
        let test_key = "sk-ant-test-roundtrip-claude";

        set_api_key(provider, test_key).expect("set_api_key should succeed");
        assert!(has_api_key(provider), "has_api_key must return true after set");

        let retrieved = get_api_key(provider).expect("get_api_key must return Some after set");
        assert_eq!(retrieved, test_key);

        clear_api_key(provider).expect("clear_api_key should succeed");
        assert!(!has_api_key(provider), "has_api_key must return false after clear");
    }

    #[test]
    fn keyring_round_trip_openai() {
        let provider = Provider::Openai;
        let test_key = "sk-test-roundtrip-openai";

        set_api_key(provider, test_key).expect("set_api_key should succeed");
        assert!(has_api_key(provider), "has_api_key must return true after set");

        let retrieved = get_api_key(provider).expect("get_api_key must return Some after set");
        assert_eq!(retrieved, test_key);

        clear_api_key(provider).expect("clear_api_key should succeed");
        assert!(!has_api_key(provider), "has_api_key must return false after clear");
    }

    #[test]
    fn keyring_id_is_canonical() {
        assert_eq!(Provider::Claude.keyring_id(), "claude-api-key");
        assert_eq!(Provider::Openai.keyring_id(), "openai-api-key");
    }
}
