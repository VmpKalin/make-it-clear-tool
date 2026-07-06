use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Claude,
    Openai,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    Grammar,
    Rewrite,
    Shorten,
    Bullets,
    Translate,
    Format,
}

impl Action {
    #[allow(dead_code)]
    pub fn command_id(&self) -> &'static str {
        match self {
            Action::Grammar => "run-grammar",
            Action::Rewrite => "run-rewrite",
            Action::Shorten => "run-shorten",
            Action::Bullets => "run-bullets",
            Action::Translate => "run-translate",
            Action::Format => "run-format",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct HotkeyMap {
    pub trigger: String,
    pub quick_action: Option<String>,
    pub grammar: Option<String>,
    pub rewrite: Option<String>,
    pub shorten: Option<String>,
    pub bullets: Option<String>,
    pub translate: Option<String>,
    pub format: Option<String>,
}

impl Default for HotkeyMap {
    fn default() -> Self {
        Self {
            trigger: "Ctrl+Alt+B".to_string(),
            quick_action: None,
            grammar: None,
            rewrite: None,
            shorten: None,
            bullets: None,
            translate: None,
            format: None,
        }
    }
}

fn deser_provider<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Provider, D::Error> {
    let v = match serde_json::Value::deserialize(d) {
        Ok(v) => v,
        Err(_) => return Ok(Provider::Claude),
    };
    Ok(match v.as_str() {
        Some("claude") => Provider::Claude,
        Some("openai") => Provider::Openai,
        _ => Provider::Claude,
    })
}

fn deser_action<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Action, D::Error> {
    let v = match serde_json::Value::deserialize(d) {
        Ok(v) => v,
        Err(_) => return Ok(Action::Grammar),
    };
    Ok(match v.as_str() {
        Some("grammar") => Action::Grammar,
        Some("rewrite") => Action::Rewrite,
        Some("shorten") => Action::Shorten,
        Some("bullets") => Action::Bullets,
        Some("translate") => Action::Translate,
        Some("format") => Action::Format,
        _ => Action::Grammar,
    })
}

fn deser_hotkeys<'de, D: serde::Deserializer<'de>>(d: D) -> Result<HotkeyMap, D::Error> {
    let v = match serde_json::Value::deserialize(d) {
        Ok(v) => v,
        Err(_) => return Ok(HotkeyMap::default()),
    };
    Ok(serde_json::from_value::<HotkeyMap>(v).unwrap_or_default())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppConfig {
    #[serde(deserialize_with = "deser_provider")]
    pub provider: Provider,
    #[serde(deserialize_with = "deser_action")]
    pub default_action: Action,
    #[serde(rename = "showUI")]
    pub show_ui: bool,
    #[serde(deserialize_with = "deser_hotkeys")]
    pub hotkeys: HotkeyMap,
    pub tray_enabled: bool,
    pub auto_run_on_paste: bool,
    pub auto_copy_result: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            provider: Provider::Claude,
            default_action: Action::Grammar,
            show_ui: false,
            hotkeys: HotkeyMap::default(),
            tray_enabled: true,
            auto_run_on_paste: false,
            auto_copy_result: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_provider_falls_back() {
        let c: AppConfig = serde_json::from_str(r#"{"provider":"gemini"}"#).unwrap();
        assert_eq!(c.provider, Provider::Claude);
    }

    #[test]
    fn unknown_action_falls_back() {
        let c: AppConfig = serde_json::from_str(r#"{"defaultAction":"summarize"}"#).unwrap();
        assert_eq!(c.default_action, Action::Grammar);
    }

    #[test]
    fn missing_fields_use_defaults() {
        let c: AppConfig = serde_json::from_str(r#"{"provider":"openai"}"#).unwrap();
        assert_eq!(c.provider, Provider::Openai);
        assert_eq!(c.default_action, Action::Grammar);
        assert!(c.auto_copy_result);
        assert!(!c.show_ui);
    }

    #[test]
    fn empty_object_uses_all_defaults() {
        let c: AppConfig = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(c.provider, Provider::Claude);
        assert_eq!(c.default_action, Action::Grammar);
        assert!(c.tray_enabled);
    }

    #[test]
    fn bad_field_type_preserves_others() {
        let c: AppConfig =
            serde_json::from_str(r#"{"provider":42,"defaultAction":"rewrite","showUI":true}"#)
                .unwrap();
        assert_eq!(c.provider, Provider::Claude);
        assert_eq!(c.default_action, Action::Rewrite);
        assert!(c.show_ui);
    }

    #[test]
    fn bad_hotkeys_value_falls_back() {
        let c: AppConfig = serde_json::from_str(r#"{"hotkeys":"invalid"}"#).unwrap();
        assert_eq!(c.hotkeys.trigger, "Ctrl+Alt+B");
    }

    #[test]
    fn partial_hotkeys_preserved() {
        let c: AppConfig =
            serde_json::from_str(r#"{"hotkeys":{"trigger":"Ctrl+X"}}"#).unwrap();
        assert_eq!(c.hotkeys.trigger, "Ctrl+X");
        assert!(c.hotkeys.quick_action.is_none());
    }
}
