use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

use crate::error::{AppError, AppResult};

pub fn build(app: &AppHandle) -> AppResult<()> {
    let menu = build_menu(app)?;

    // Tray size is controlled by the OS (16px @1x / 32px @2x on Windows,
    // 22px on macOS). To make the glyph crisp we pass the highest-resolution
    // bundle icon we have — the OS downscales it cleanly.
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

    println!("[desktop/tray] Initialised");
    Ok(())
}

fn build_menu(app: &AppHandle) -> AppResult<Menu<tauri::Wry>> {
    let settings = MenuItemBuilder::with_id("open-settings", "Settings...").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&settings)
        .item(&quit)
        .build()?;
    Ok(menu)
}

fn handle_menu_event(app: &AppHandle, id: &str) {
    println!("[desktop/tray] Menu event: {id}");
    match id {
        "open-settings" => {
            if let Some(window) = app.get_webview_window("main") {
                crate::position::show_near_cursor(&window);
                let _ = window.emit("textpilot://open-settings", ());
            }
        }
        "quit" => app.exit(0),
        _ => {}
    }
}
