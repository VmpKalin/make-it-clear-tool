use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tauri_plugin_notification::NotificationExt;

use crate::config::HotkeyMap;
use crate::error::{AppError, AppResult};

const GRAB_DELAY_MS: u64 = 200;

#[derive(Clone, Serialize)]
pub struct HotkeyTriggerPayload {}

pub fn register_hotkeys(app: &AppHandle, hotkeys: &HotkeyMap) -> AppResult<()> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();

    let trimmed = hotkeys.trigger.trim();
    if !trimmed.is_empty() {
        let shortcut: Shortcut = trimmed
            .parse()
            .map_err(|e| AppError::Config(format!("Invalid trigger hotkey '{trimmed}': {e}")))?;
        gs.register(shortcut)
            .map_err(|e| AppError::Config(format!("Failed to register trigger '{trimmed}': {e}")))?;
        println!("[desktop/hotkey] Registered trigger: {trimmed}");
    }

    if let Some(ref qa) = hotkeys.quick_action {
        let qa_trimmed = qa.trim();
        if !qa_trimmed.is_empty() {
            let shortcut: Shortcut = qa_trimmed
                .parse()
                .map_err(|e| AppError::Config(format!("Invalid quick-action hotkey '{qa_trimmed}': {e}")))?;
            gs.register(shortcut)
                .map_err(|e| AppError::Config(format!("Failed to register quick-action '{qa_trimmed}': {e}")))?;
            println!("[desktop/hotkey] Registered quick-action: {qa_trimmed}");
        }
    }

    Ok(())
}

fn grab_selection() -> String {
    crate::clipboard::simulate_copy();
    std::thread::sleep(std::time::Duration::from_millis(GRAB_DELAY_MS));
    let text = crate::clipboard::read_selection().unwrap_or_default();
    println!("[desktop/hotkey] Grabbed {} chars from clipboard", text.len());
    text
}

pub fn dispatch_shortcut(app: &AppHandle, shortcut: &Shortcut) {
    let config = crate::load_saved_config(app);

    let is_quick_action = config
        .hotkeys
        .quick_action
        .as_deref()
        .and_then(|qa| {
            let trimmed = qa.trim();
            if trimmed.is_empty() { return None; }
            trimmed.parse::<Shortcut>().ok()
        })
        .map(|qa_shortcut| qa_shortcut.id() == shortcut.id())
        .unwrap_or(false);

    println!("[desktop/hotkey] Shortcut fired (id={}), is_quick_action={}", shortcut.id(), is_quick_action);

    if is_quick_action {
        dispatch_quick_action(app);
    } else {
        dispatch_trigger(app);
    }
}

fn dispatch_trigger(app: &AppHandle) {
    println!("[desktop/hotkey] Trigger fired — showing window");
    if let Some(window) = app.get_webview_window("main") {
        crate::position::show_near_cursor(&window);
    }
    let _ = app.emit("textpilot://hotkey-trigger", HotkeyTriggerPayload {});
}

fn dispatch_quick_action(app: &AppHandle) {
    println!("[desktop/hotkey] Quick-action fired");
    let config = crate::load_saved_config(app);

    if config.api_key.trim().is_empty() {
        println!("[desktop/hotkey] Quick-action: no API key, showing settings");
        if let Some(window) = app.get_webview_window("main") {
            crate::position::show_near_cursor(&window);
        }
        let _ = app.emit("textpilot://open-settings", ());
        return;
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let text = grab_selection();
        if text.trim().is_empty() {
            println!("[desktop/hotkey] Quick-action: no text available");
            return;
        }

        let request_id = format!(
            "quick-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        );

        tauri::async_runtime::spawn(async move {
            println!(
                "[desktop/hotkey] Quick-action: running {:?}",
                config.default_action
            );
            match crate::api::run_action(
                &app_handle,
                &request_id,
                &text,
                config.default_action,
                &config,
            )
            .await
            {
                Ok(result) => {
                    let cleaned = crate::strip_code_fences(&result);
                    if let Err(err) = crate::clipboard::write_result(&cleaned) {
                        eprintln!("[desktop/hotkey] Quick-action clipboard write failed: {err}");
                        return;
                    }
                    let _ = app_handle
                        .notification()
                        .builder()
                        .title("TextPilot")
                        .body("Done — Ctrl+V to paste")
                        .show();
                }
                Err(err) => {
                    eprintln!("[desktop/hotkey] Quick-action failed: {err}");
                }
            }
        });
    });
}
