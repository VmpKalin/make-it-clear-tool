mod api;
mod clipboard;
mod config;
mod error;
mod hotkey;
mod position;
mod prompts;
mod tray;

use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_store::StoreExt;

use crate::config::{Action, AppConfig, HotkeyMap};
use crate::error::AppResult;

fn strip_code_fences(text: &str) -> String {
    let s = text.trim();
    if !s.starts_with("```") {
        return s.to_string();
    }
    let after_fence = match s.find('\n') {
        Some(i) => &s[i + 1..],
        None => return s.to_string(),
    };
    let trimmed = after_fence.trim_end();
    if trimmed.ends_with("```") {
        trimmed[..trimmed.len() - 3].trim().to_string()
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
    config: AppConfig,
) -> Result<String, String> {
    match api::run_action(&app, &request_id, &text, action, &config).await {
        Ok(result) => {
            let cleaned = strip_code_fences(&result);
            if config.auto_copy_result {
                if let Err(err) = clipboard::write_result(&cleaned) {
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
fn read_clipboard_selection() -> Result<String, String> {
    clipboard::read_selection().map_err(|e| e.to_string())
}

#[tauri::command]
fn update_hotkeys(app: AppHandle, hotkeys: HotkeyMap) -> Result<(), String> {
    hotkey::register_hotkeys(&app, &hotkeys).map_err(|e| e.to_string())
}

#[tauri::command]
fn frontend_ready(app: AppHandle) {
    println!("[desktop/lib] Frontend ready");
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

fn bootstrap(app: &AppHandle) -> AppResult<()> {
    tray::build(app)?;
    let config = load_saved_config(app);
    if let Err(err) = hotkey::register_hotkeys(app, &config.hotkeys) {
        eprintln!("[desktop/lib] Failed to register hotkeys: {err}");
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                position::show_near_cursor(&window);
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        hotkey::dispatch_shortcut(app, &shortcut);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![run_action, read_clipboard_selection, update_hotkeys, frontend_ready])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(err) = bootstrap(&handle) {
                eprintln!("[desktop/lib] Bootstrap error: {err}");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                println!("[desktop/lib] Close intercepted — window hidden");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
