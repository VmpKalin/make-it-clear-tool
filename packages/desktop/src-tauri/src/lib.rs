mod api;
mod clipboard;
mod config;
mod error;
mod hotkey;
mod prompts;
mod tray;

use tauri::{AppHandle, Manager};

use crate::config::{Action, AppConfig};
use crate::error::AppResult;

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
            if let Err(err) = clipboard::write_result(&result) {
                api::emit_error(&app, &request_id, &err.to_string());
                return Err(err.to_string());
            }
            Ok(result)
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

fn bootstrap(app: &AppHandle) -> AppResult<()> {
    tray::build(app)?;
    let default_trigger = config::HotkeyMap::default().trigger;
    if let Err(err) = hotkey::register_default(app, &default_trigger) {
        eprintln!("[desktop/lib] Failed to register default hotkey: {err}");
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![run_action, read_clipboard_selection])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(err) = bootstrap(&handle) {
                eprintln!("[desktop/lib] Bootstrap error: {err}");
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
