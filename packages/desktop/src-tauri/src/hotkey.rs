use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::config::Action;
use crate::error::{AppError, AppResult};

pub fn register_trigger(app: &AppHandle, trigger: &str) -> AppResult<()> {
    let shortcut: Shortcut = trigger
        .parse()
        .map_err(|e| AppError::Config(format!("Invalid hotkey '{trigger}': {e}")))?;

    let gs = app.global_shortcut();
    let _ = gs.unregister_all();

    gs.register(shortcut)
        .map_err(|e| AppError::Config(format!("Failed to register hotkey '{trigger}': {e}")))?;
    println!("[desktop/hotkey] Registered hotkey: {trigger}");

    Ok(())
}

pub fn dispatch_trigger(app: &AppHandle) {
    println!("[desktop/hotkey] Dispatching trigger");
    let _ = app.emit("textpilot://hotkey-trigger", ());
    if let Some(window) = app.get_webview_window("main") {
        crate::position::show_near_cursor(&window);
    }
}

pub fn command_to_action(command: &str) -> Option<Action> {
    match command {
        "run-grammar" => Some(Action::Grammar),
        "run-rewrite" => Some(Action::Rewrite),
        "run-shorten" => Some(Action::Shorten),
        "run-bullets" => Some(Action::Bullets),
        "run-translate" => Some(Action::Translate),
        _ => None,
    }
}
