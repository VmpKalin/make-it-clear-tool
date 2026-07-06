use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

use crate::error::{AppError, AppResult};

pub fn build(app: &AppHandle) -> AppResult<()> {
    let menu = build_menu(app)?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| AppError::Config("No default window icon bundled for tray".into()))?;

    let _ = TrayIconBuilder::with_id("textpilot-tray")
        .icon(icon)
        .icon_as_template(false)
        .tooltip("TextPilot")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_menu_event(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    crate::position::show_near_cursor(&window);
                }
            }
        })
        .build(app)?;

    log::info!("[desktop/tray] Initialised");
    Ok(())
}

fn build_menu(app: &AppHandle) -> AppResult<Menu<tauri::Wry>> {
    let settings = MenuItemBuilder::with_id("open-settings", "Settings...").build(app)?;
    let open_logs = MenuItemBuilder::with_id("open-log-folder", "Open log folder").build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&settings)
        .item(&open_logs)
        .item(&separator)
        .item(&quit)
        .build()?;
    Ok(menu)
}

fn handle_menu_event(app: &AppHandle, id: &str) {
    log::info!("[desktop/tray] Menu event: {id}");
    match id {
        "open-settings" => {
            if let Some(window) = app.get_webview_window("main") {
                crate::position::show_near_cursor(&window);
                let _ = window.emit("textpilot://open-settings", ());
            }
        }
        "open-log-folder" => {
            match app.path().app_log_dir() {
                Ok(log_dir) => {
                    log::info!("[desktop/tray] Opening log folder: {}", log_dir.display());
                    open_folder(&log_dir);
                }
                Err(e) => log::error!("[desktop/tray] Failed to resolve log dir: {e}"),
            }
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

fn open_folder(path: &std::path::Path) {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer").arg(path).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(path).spawn();
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = std::process::Command::new("xdg-open").arg(path).spawn();
    }
}
