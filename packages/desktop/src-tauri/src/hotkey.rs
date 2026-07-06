use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tauri_plugin_notification::NotificationExt;

use crate::config::HotkeyMap;
use crate::error::{AppError, AppResult};

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
        log::info!("[desktop/hotkey] Registered trigger: {trimmed}");
    }

    if let Some(ref qa) = hotkeys.quick_action {
        let qa_trimmed = qa.trim();
        if !qa_trimmed.is_empty() {
            let shortcut: Shortcut = qa_trimmed
                .parse()
                .map_err(|e| AppError::Config(format!("Invalid quick-action hotkey '{qa_trimmed}': {e}")))?;
            gs.register(shortcut)
                .map_err(|e| AppError::Config(format!("Failed to register quick-action '{qa_trimmed}': {e}")))?;
            log::info!("[desktop/hotkey] Registered quick-action: {qa_trimmed}");
        }
    }

    Ok(())
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

    log::info!("[desktop/hotkey] Shortcut fired (id={}), is_quick_action={}", shortcut.id(), is_quick_action);

    if is_quick_action {
        dispatch_quick_action(app);
    } else {
        dispatch_trigger(app);
    }
}

fn dispatch_trigger(app: &AppHandle) {
    let config = crate::load_saved_config(app);
    if !config.show_ui {
        log::info!("[desktop/hotkey] Trigger fired — silent mode (showUI=false)");
        dispatch_quick_action(app);
        return;
    }
    log::info!("[desktop/hotkey] Trigger fired — showing window");
    if let Some(window) = app.get_webview_window("main") {
        crate::position::show_near_cursor(&window);
    }
    let _ = app.emit("textpilot://hotkey-trigger", HotkeyTriggerPayload {});
}

fn dispatch_quick_action(app: &AppHandle) {
    log::info!("[desktop/hotkey] Quick-action fired");
    let config = crate::load_saved_config(app);

    if !crate::keystore::has_api_key(config.provider) {
        log::info!("[desktop/hotkey] Quick-action: no API key, showing settings");
        if let Some(window) = app.get_webview_window("main") {
            crate::position::show_near_cursor(&window);
        }
        let _ = app.emit("textpilot://open-settings", ());
        return;
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        if !crate::accessibility::is_granted() {
            log::warn!("[desktop/hotkey] Quick-action: Accessibility permission not granted");
            let _ = app_handle
                .notification()
                .builder()
                .title("TextPilot")
                .body("Accessibility permission required. Open System Settings → Privacy & Security → Accessibility.")
                .show();
            if let Some(window) = app_handle.get_webview_window("main") {
                crate::position::show_near_cursor(&window);
            }
            let _ = app_handle.emit("textpilot://accessibility-missing", ());
            return;
        }

        let snapshot = crate::clipboard::read_selection().unwrap_or_default();

        let text = match crate::clipboard::grab_selection() {
            Some(t) => t,
            None => {
                log::info!("[desktop/hotkey] Quick-action: no text selected");
                let _ = crate::clipboard::restore(&snapshot);
                let _ = app_handle
                    .notification()
                    .builder()
                    .title("TextPilot")
                    .body("Select some text first.")
                    .show();
                return;
            }
        };

        let request_id = format!(
            "quick-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        );

        tauri::async_runtime::spawn(async move {
            log::info!(
                "[desktop/hotkey] Quick-action: running {:?}",
                config.default_action
            );
            let api_key = match crate::keystore::get_api_key(config.provider) {
                Some(k) => k,
                None => {
                    log::error!("[desktop/hotkey] Quick-action: API key missing from keyring");
                    let _ = crate::clipboard::restore(&snapshot);
                    return;
                }
            };

            match crate::api::run_action(
                &app_handle,
                &request_id,
                &text,
                config.default_action,
                &config,
                &api_key,
            )
            .await
            {
                Ok(result) => {
                    let cleaned = crate::strip_code_fences(&result);
                    if let Err(err) = crate::clipboard::write_result(&cleaned) {
                        log::error!("[desktop/hotkey] Quick-action clipboard write failed: {err}");
                        let _ = crate::clipboard::restore(&snapshot);
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
                    log::error!("[desktop/hotkey] Quick-action failed: {err}");
                    let _ = crate::clipboard::restore(&snapshot);
                    let _ = app_handle
                        .notification()
                        .builder()
                        .title("TextPilot — Error")
                        .body(err.to_string())
                        .show();
                }
            }
        });
    });
}
