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
}

impl Action {
    pub fn command_id(&self) -> &'static str {
        match self {
            Action::Grammar => "run-grammar",
            Action::Rewrite => "run-rewrite",
            Action::Shorten => "run-shorten",
            Action::Bullets => "run-bullets",
            Action::Translate => "run-translate",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyMap {
    pub trigger: String,
    pub grammar: Option<String>,
    pub rewrite: Option<String>,
    pub shorten: Option<String>,
    pub bullets: Option<String>,
    pub translate: Option<String>,
}

impl Default for HotkeyMap {
    fn default() -> Self {
        Self {
            trigger: "Ctrl+Alt+B".to_string(),
            grammar: None,
            rewrite: None,
            shorten: None,
            bullets: None,
            translate: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub provider: Provider,
    #[serde(default)]
    pub api_key: String,
    pub default_action: Action,
    #[serde(default)]
    pub show_ui: bool,
    #[serde(default)]
    pub hotkeys: HotkeyMap,
    #[serde(default = "default_true")]
    pub tray_enabled: bool,
    #[serde(default)]
    pub auto_run_on_paste: bool,
    #[serde(default = "default_true")]
    pub auto_copy_result: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            provider: Provider::Claude,
            api_key: String::new(),
            default_action: Action::Grammar,
            show_ui: false,
            hotkeys: HotkeyMap::default(),
            tray_enabled: true,
            auto_run_on_paste: false,
            auto_copy_result: true,
        }
    }
}
