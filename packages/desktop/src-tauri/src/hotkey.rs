use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::config::HotkeyMap;
use crate::error::{AppError, AppResult};

#[derive(Clone, Serialize)]
pub struct HotkeyTriggerPayload;

pub fn register_hotkeys(app: &AppHandle, hotkeys: &HotkeyMap) -> AppResult<()> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();

    let trimmed = hotkeys.trigger.trim();
    if trimmed.is_empty() {
        println!("[desktop/hotkey] No trigger hotkey configured");
        return Ok(());
    }

    let shortcut: Shortcut = trimmed
        .parse()
        .map_err(|e| AppError::Config(format!("Invalid hotkey '{trimmed}': {e}")))?;

    gs.register(shortcut)
        .map_err(|e| AppError::Config(format!("Failed to register '{trimmed}': {e}")))?;

    println!("[desktop/hotkey] Registered global trigger: {trimmed}");
    Ok(())
}

pub fn dispatch_shortcut(app: &AppHandle, _shortcut: &Shortcut) {
    println!("[desktop/hotkey] Global trigger fired");

    if let Some(window) = app.get_webview_window("main") {
        crate::position::show_near_cursor(&window);
    }

    let _ = app.emit("textpilot://hotkey-trigger", HotkeyTriggerPayload);
}
