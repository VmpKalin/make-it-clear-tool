use tauri::{Emitter, PhysicalPosition, PhysicalSize, WebviewWindow};

const CURSOR_OFFSET_X: i32 = 10;
const CURSOR_OFFSET_Y: i32 = -10;

#[cfg(target_os = "windows")]
fn cursor_position() -> Option<(i32, i32)> {
    #[repr(C)]
    #[allow(clippy::upper_case_acronyms)]
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

#[allow(clippy::too_many_arguments)]
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

#[cfg(test)]
mod tests {
    use super::clamp_to_screen;

    #[test]
    fn within_bounds_unchanged() {
        let (x, y) = clamp_to_screen(500, 400, 400, 200, 0, 0, 1920, 1080);
        assert_eq!((x, y), (500, 400));
    }

    #[test]
    fn clamps_to_left_margin() {
        let (x, _) = clamp_to_screen(50, 400, 400, 200, 0, 0, 1920, 1080);
        assert_eq!(x, 192); // 1920/10 = 192
    }

    #[test]
    fn clamps_to_right_edge() {
        let (x, _) = clamp_to_screen(1800, 400, 400, 200, 0, 0, 1920, 1080);
        assert_eq!(x, 1920 - 192 - 400); // max_x = 1328
    }

    #[test]
    fn clamps_to_top_margin() {
        let (_, y) = clamp_to_screen(500, 50, 400, 200, 0, 0, 1920, 1080);
        assert_eq!(y, 108); // 1080/10 = 108
    }

    #[test]
    fn clamps_to_bottom_edge() {
        let (_, y) = clamp_to_screen(500, 1000, 400, 200, 0, 0, 1920, 1080);
        assert_eq!(y, 1080 - 108 - 200); // max_y = 772
    }

    #[test]
    fn respects_monitor_offset() {
        // x=2500 is comfortably inside the second monitor's safe area
        let (x, y) = clamp_to_screen(2500, 500, 400, 200, 1920, 0, 1920, 1080);
        assert_eq!((x, y), (2500, 500));
    }

    #[test]
    fn small_monitor_window_larger_than_available() {
        let (x, y) = clamp_to_screen(0, 0, 800, 600, 0, 0, 800, 600);
        // margins: 80, 60. max_x = 800 - 80 - 800 = -80, clamped to min_x = 80
        assert_eq!(x, 80);
        assert_eq!(y, 60);
    }

    #[test]
    fn zero_size_monitor() {
        let (x, y) = clamp_to_screen(100, 100, 400, 200, 0, 0, 0, 0);
        assert_eq!((x, y), (0, 0));
    }

    #[test]
    fn negative_coordinates() {
        // mon starts at -1920, margin=192, so min_x=-1728, max_x=-592
        // x=-100 > max_x, gets clamped down; y=-100 < min_y=108, clamped up
        let (x, y) = clamp_to_screen(-100, -100, 400, 200, -1920, 0, 1920, 1080);
        assert_eq!((x, y), (-592, 108));
    }
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

    let cursor_monitor = window.available_monitors().ok().and_then(|monitors| {
        monitors.into_iter().find(|mon| {
            let mp = mon.position();
            let ms = mon.size();
            cur_x >= mp.x
                && cur_x < mp.x + ms.width as i32
                && cur_y >= mp.y
                && cur_y < mp.y + ms.height as i32
        })
    });

    let monitor = cursor_monitor
        .or_else(|| window.current_monitor().ok().flatten());

    let (final_x, final_y) = if let Some(mon) = monitor {
        let mon_pos = mon.position();
        let mon_size = mon.size();
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
