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

#[tauri::command]
fn update_hotkey(app: AppHandle, trigger: String) -> Result<(), String> {
    hotkey::register_trigger(&app, &trigger).map_err(|e| e.to_string())
}

#[tauri::command]
fn frontend_ready(app: AppHandle) {
    println!("[desktop/lib] Frontend ready");
    if let Some(window) = app.get_webview_window("main") {
        position::show_near_cursor(&window);
    }
}

fn load_saved_trigger(app: &AppHandle) -> String {
    let fallback = config::HotkeyMap::default().trigger;
    let Ok(store) = app.store("textpilot.config.json") else {
        return fallback;
    };
    let Some(value) = store.get("config") else {
        return fallback;
    };
    value
        .get("hotkeys")
        .and_then(|h| h.get("trigger"))
        .and_then(|t| t.as_str())
        .map(String::from)
        .unwrap_or(fallback)
}

fn bootstrap(app: &AppHandle) -> AppResult<()> {
    tray::build(app)?;
    let trigger = load_saved_trigger(app);
    if let Err(err) = hotkey::register_trigger(app, &trigger) {
        eprintln!("[desktop/lib] Failed to register hotkey '{trigger}': {err}");
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
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        hotkey::dispatch_trigger(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![run_action, read_clipboard_selection, update_hotkey, frontend_ready])
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
