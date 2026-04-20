use tauri::{Emitter, PhysicalPosition, PhysicalSize, WebviewWindow};

const CURSOR_OFFSET_X: i32 = 10;
const CURSOR_OFFSET_Y: i32 = -10;

#[cfg(target_os = "windows")]
fn cursor_position() -> Option<(i32, i32)> {
    #[repr(C)]
    struct POINT { x: i32, y: i32 }

    extern "system" {
        fn GetCursorPos(point: *mut POINT) -> i32;
    }

    let mut point = POINT { x: 0, y: 0 };
    // SAFETY: GetCursorPos writes to a valid POINT struct
    let ok = unsafe { GetCursorPos(&mut point) };
    if ok != 0 { Some((point.x, point.y)) } else { None }
}

#[cfg(target_os = "macos")]
fn cursor_position() -> Option<(i32, i32)> {
    #[repr(C)]
    #[derive(Copy, Clone)]
    struct CGPoint { x: f64, y: f64 }

    type CGEventRef = *const std::ffi::c_void;

    extern "C" {
        fn CGEventCreate(source: *const std::ffi::c_void) -> CGEventRef;
        fn CGEventGetLocation(event: CGEventRef) -> CGPoint;
        fn CFRelease(cf: *const std::ffi::c_void);
    }

    // SAFETY: CGEventCreate(null) returns a synthetic event with current cursor location
    unsafe {
        let event = CGEventCreate(std::ptr::null());
        if event.is_null() { return None; }
        let pos = CGEventGetLocation(event);
        CFRelease(event);
        Some((pos.x as i32, pos.y as i32))
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn cursor_position() -> Option<(i32, i32)> {
    None
}

fn clamp_to_screen(
    x: i32,
    y: i32,
    win_w: i32,
    win_h: i32,
    mon_x: i32,
    mon_y: i32,
    mon_w: i32,
    mon_h: i32,
) -> (i32, i32) {
    let margin_x = mon_w / 10;
    let margin_y = mon_h / 10;

    let min_x = mon_x + margin_x;
    let min_y = mon_y + margin_y;
    let max_x = mon_x + mon_w - margin_x - win_w;
    let max_y = mon_y + mon_h - margin_y - win_h;

    let cx = x.clamp(min_x, max_x.max(min_x));
    let cy = y.clamp(min_y, max_y.max(min_y));

    (cx, cy)
}

pub fn show_near_cursor(window: &WebviewWindow) {
    let Some((cur_x, cur_y)) = cursor_position() else {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    };

    let win_size = window
        .outer_size()
        .unwrap_or(PhysicalSize::new(400, 200));

    let target_x = cur_x + CURSOR_OFFSET_X;
    let target_y = cur_y + CURSOR_OFFSET_Y;

    let (final_x, final_y) = if let Ok(Some(monitor)) = window.current_monitor() {
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        clamp_to_screen(
            target_x,
            target_y,
            win_size.width as i32,
            win_size.height as i32,
            mon_pos.x,
            mon_pos.y,
            mon_size.width as i32,
            mon_size.height as i32,
        )
    } else if let Ok(monitors) = window.available_monitors() {
        let mut best = (target_x, target_y);
        for mon in &monitors {
            let mp = mon.position();
            let ms = mon.size();
            let mx = mp.x;
            let my = mp.y;
            let mw = ms.width as i32;
            let mh = ms.height as i32;
            if cur_x >= mx && cur_x < mx + mw && cur_y >= my && cur_y < my + mh {
                best = clamp_to_screen(
                    target_x, target_y,
                    win_size.width as i32, win_size.height as i32,
                    mx, my, mw, mh,
                );
                break;
            }
        }
        best
    } else {
        (target_x, target_y)
    };

    let _ = window.set_position(PhysicalPosition::new(final_x, final_y));

    let cursor_rel_x = cur_x - final_x;
    let cursor_rel_y = cur_y - final_y;
    let _ = window.emit("textpilot://window-will-appear", (cursor_rel_x, cursor_rel_y));

    let _ = window.show();
    let _ = window.set_focus();

    println!(
        "[desktop/position] Window at ({final_x}, {final_y}), cursor relative: ({cursor_rel_x}, {cursor_rel_y})"
    );
}
