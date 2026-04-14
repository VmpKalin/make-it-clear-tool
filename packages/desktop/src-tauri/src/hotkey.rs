use tauri::{AppHandle, Manager, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::config::Action;
use crate::error::{AppError, AppResult};

pub fn register_default(app: &AppHandle, trigger: &str) -> AppResult<()> {
    let shortcut: Shortcut = trigger
        .parse()
        .map_err(|e| AppError::Config(format!("Invalid hotkey '{trigger}': {e}")))?;
    let handle = app.clone();

    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _sc, event| {
            if event.state() == ShortcutState::Pressed {
                println!("[desktop/hotkey] Trigger pressed");
                dispatch_trigger(&handle);
            }
        })
        .map_err(|e| AppError::Config(format!("Failed to register hotkey: {e}")))?;
    Ok(())
}

fn dispatch_trigger(app: &AppHandle) {
    let _ = app.emit("textpilot://hotkey-trigger", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn command_to_action(command: &str) -> Option<Action> {
    match command {
        "run-grammar" => Some(Action::Grammar),
        "run-rewrite" => Some(Action::Rewrite),
        "run-shorten" => Some(Action::Shorten),
        "run-bullets" => Some(Action::Bullets),
        _ => None,
    }
}
