mod api;
mod clipboard;
mod config;
mod error;
mod hotkey;
mod prompts;
mod tray;

use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::ShortcutState;

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
async fn resize_window(window: tauri::Window, height: f64, duration_ms: u64) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let outer = window.outer_size().map_err(|e| e.to_string())?;
    let logical_width = outer.width as f64 / scale;
    let start_height = outer.height as f64 / scale;

    if duration_ms == 0 || (start_height - height).abs() < 1.0 {
        return window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: logical_width,
                height,
            }))
            .map_err(|e| e.to_string());
    }

    let start = std::time::Instant::now();
    let duration = std::time::Duration::from_millis(duration_ms);
    let frame = std::time::Duration::from_millis(8);

    loop {
        let elapsed = start.elapsed();
        if elapsed >= duration {
            break;
        }
        let t = elapsed.as_secs_f64() / duration.as_secs_f64();
        // cubic-bezier(0.4, 0, 0.2, 1) approximation — ease-out cubic
        let eased = 1.0 - (1.0 - t).powi(3);
        let h = start_height + (height - start_height) * eased;
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: logical_width,
            height: h,
        }));
        tokio::time::sleep(frame).await;
    }

    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: logical_width,
            height,
        }))
        .map_err(|e| e.to_string())
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
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        hotkey::dispatch_trigger(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![run_action, read_clipboard_selection, resize_window])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(err) = bootstrap(&handle) {
                eprintln!("[desktop/lib] Bootstrap error: {err}");
            }

            // Build macOS menu bar: TextPilot > Settings, Quit
            let settings_item = MenuItemBuilder::new("Settings")
                .id("settings")
                .build(app)?;
            let quit_item = MenuItemBuilder::new("Quit TextPilot")
                .id("quit")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;
            let submenu = SubmenuBuilder::new(app, "TextPilot")
                .items(&[&settings_item, &quit_item])
                .build()?;
            let menu = Menu::with_items(app, &[&submenu])?;
            app.set_menu(menu)?;

            app.on_menu_event(|app, event| {
                match event.id().as_ref() {
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("navigate", "settings");
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                }
            });

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                    println!("[desktop/lib] Close intercepted — window hidden");
                }
                tauri::WindowEvent::Focused(false) => {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
