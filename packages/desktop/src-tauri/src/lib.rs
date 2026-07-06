mod accessibility;
mod api;
mod clipboard;
mod config;
mod error;
mod hotkey;
mod keystore;
mod position;
mod prompts;
mod tray;

use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_store::StoreExt;

use crate::config::{Action, AppConfig, HotkeyMap, Provider};
use crate::error::AppResult;

const MAX_INPUT_CHARS: usize = 20_000;

fn validate_input(text: &str) -> Result<(), String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("Input text is empty".to_string());
    }
    let count = trimmed.chars().count();
    if count > MAX_INPUT_CHARS {
        return Err(format!(
            "Input text too long ({count} characters, max {MAX_INPUT_CHARS})"
        ));
    }
    Ok(())
}

pub(crate) fn strip_code_fences(text: &str) -> String {
    let s = text.trim();
    if !s.starts_with("```") {
        return s.to_string();
    }
    let after_fence = match s.find('\n') {
        Some(i) => &s[i + 1..],
        None => return s.to_string(),
    };
    let trimmed = after_fence.trim_end();
    if let Some(stripped) = trimmed.strip_suffix("```") {
        stripped.trim().to_string()
    } else {
        after_fence.trim().to_string()
    }
}

#[tauri::command]
async fn run_action(
    app: AppHandle,
    request_id: String,
    text: String,
    action: Action,
) -> Result<String, String> {
    validate_input(&text)?;
    let config = load_saved_config(&app);
    let api_key = keystore::get_api_key(config.provider)
        .ok_or_else(|| "API key is missing. Set it in Settings.".to_string())?;

    match api::run_action(&app, &request_id, &text, action, &config, &api_key).await {
        Ok(result) => {
            let cleaned = strip_code_fences(&result);
            if config.auto_copy_result {
                let text = cleaned.clone();
                let write_result =
                    tokio::task::spawn_blocking(move || clipboard::write_result(&text))
                        .await
                        .map_err(|e| format!("Clipboard task failed: {e}"))?;
                if let Err(err) = write_result {
                    api::emit_error(&app, &request_id, &err.to_string());
                    return Err(err.to_string());
                }
            }
            Ok(cleaned)
        }
        Err(err) => {
            api::emit_error(&app, &request_id, &err.to_string());
            Err(err.to_string())
        }
    }
}

#[tauri::command]
async fn read_clipboard_selection() -> Result<String, String> {
    tokio::task::spawn_blocking(clipboard::read_selection)
        .await
        .map_err(|e| format!("Clipboard task failed: {e}"))?
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_hotkeys(app: AppHandle, hotkeys: HotkeyMap) -> Result<(), String> {
    hotkey::register_hotkeys(&app, &hotkeys).map_err(|e| e.to_string())
}

#[tauri::command]
fn frontend_ready(app: AppHandle) {
    log::info!("[desktop/lib] Frontend ready");
    if let Some(window) = app.get_webview_window("main") {
        position::show_near_cursor(&window);
    }
}

pub(crate) fn load_saved_config(app: &AppHandle) -> AppConfig {
    let Ok(store) = app.store("textpilot.config.json") else {
        return AppConfig::default();
    };
    let Some(value) = store.get("config") else {
        return AppConfig::default();
    };

    serde_json::from_value::<AppConfig>(value.clone()).unwrap_or_default()
}

#[tauri::command]
fn set_api_key(provider: Provider, key: String) -> Result<(), String> {
    keystore::set_api_key(provider, &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn has_api_key(provider: Provider) -> bool {
    keystore::has_api_key(provider)
}

#[tauri::command]
fn clear_api_key(provider: Provider) -> Result<(), String> {
    keystore::clear_api_key(provider).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_accessibility_settings() {
    accessibility::open_settings();
}

#[cfg(test)]
mod tests {
    use super::{strip_code_fences, validate_input, MAX_INPUT_CHARS};

    #[test]
    fn no_fences_returns_trimmed() {
        assert_eq!(strip_code_fences("hello world"), "hello world");
        assert_eq!(strip_code_fences("  spaced  "), "spaced");
    }

    #[test]
    fn strips_fences_with_language() {
        let input = "```rust\nfn main() {}\n```";
        assert_eq!(strip_code_fences(input), "fn main() {}");
    }

    #[test]
    fn strips_fences_no_language() {
        let input = "```\nhello\n```";
        assert_eq!(strip_code_fences(input), "hello");
    }

    #[test]
    fn unclosed_fence_returns_body() {
        let input = "```python\nprint('hi')";
        assert_eq!(strip_code_fences(input), "print('hi')");
    }

    #[test]
    fn fence_only_no_newline() {
        assert_eq!(strip_code_fences("```"), "```");
    }

    #[test]
    fn empty_input() {
        assert_eq!(strip_code_fences(""), "");
    }

    #[test]
    fn multibyte_utf8_content() {
        let input = "```\nпривіт світ 🌍\n```";
        assert_eq!(strip_code_fences(input), "привіт світ 🌍");
    }

    #[test]
    fn multiline_content() {
        let input = "```js\nline1\nline2\nline3\n```";
        assert_eq!(strip_code_fences(input), "line1\nline2\nline3");
    }

    #[test]
    fn empty_input_rejected() {
        assert!(validate_input("").is_err());
        assert!(validate_input("   ").is_err());
        assert!(validate_input("\n\t").is_err());
    }

    #[test]
    fn oversized_input_rejected() {
        let text: String = "a".repeat(MAX_INPUT_CHARS + 1);
        assert!(validate_input(&text).is_err());
    }

    #[test]
    fn valid_input_accepted() {
        assert!(validate_input("hello world").is_ok());
        assert!(validate_input(&"a".repeat(MAX_INPUT_CHARS)).is_ok());
    }
}

fn migrate_api_key_to_keyring(app: &AppHandle) {
    let Ok(store) = app.store("textpilot.config.json") else { return };
    let Some(mut value) = store.get("config") else { return };

    let api_key = value
        .get("apiKey")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if api_key.trim().is_empty() {
        return;
    }

    let provider = match value.get("provider").and_then(|v| v.as_str()) {
        Some("openai") => Provider::Openai,
        _ => Provider::Claude,
    };

    if let Err(e) = keystore::set_api_key(provider, &api_key) {
        log::error!("[desktop/lib] API key migration to keyring failed: {e}");
        return;
    }

    if let Some(obj) = value.as_object_mut() {
        obj.remove("apiKey");
    }
    store.set("config", value);
    let _ = store.save();
    log::info!("[desktop/lib] Migrated API key from store to OS keyring");
}

fn bootstrap(app: &AppHandle) -> AppResult<()> {
    std::panic::set_hook(Box::new(|info| {
        log::error!("[panic] {info}");
    }));
    migrate_api_key_to_keyring(app);
    let config = load_saved_config(app);
    if config.tray_enabled {
        tray::build(app)?;
    } else {
        log::info!("[desktop/lib] Tray disabled by config — skipping tray setup");
    }
    if let Err(err) = hotkey::register_hotkeys(app, &config.hotkeys) {
        log::warn!("[desktop/lib] Failed to register hotkeys: {err}");
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("textpilot".into()),
                    }),
                ])
                .max_file_size(5_000_000)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(5))
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                position::show_near_cursor(&window);
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        hotkey::dispatch_shortcut(app, shortcut);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![run_action, read_clipboard_selection, update_hotkeys, frontend_ready, set_api_key, has_api_key, clear_api_key, open_accessibility_settings])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(err) = bootstrap(&handle) {
                log::error!("[desktop/lib] Bootstrap error: {err}");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                log::info!("[desktop/lib] Close intercepted — window hidden");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
