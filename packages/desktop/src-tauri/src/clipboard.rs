use crate::error::{AppError, AppResult};

pub fn read_selection() -> AppResult<String> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| AppError::Clipboard(format!("init failed: {e}")))?;
    match clipboard.get_text() {
        Ok(text) => {
            println!("[desktop/clipboard] Read {} chars", text.len());
            Ok(text)
        }
        Err(arboard::Error::ContentNotAvailable) => Ok(String::new()),
        Err(e) => Err(AppError::Clipboard(format!("read failed: {e}"))),
    }
}

pub fn write_result(text: &str) -> AppResult<()> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| AppError::Clipboard(format!("init failed: {e}")))?;
    clipboard
        .set_text(text.to_string())
        .map_err(|e| AppError::Clipboard(format!("write failed: {e}")))?;
    println!("[desktop/clipboard] Wrote {} chars", text.len());
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn simulate_copy() {
    const VK_SHIFT: u8 = 0x10;
    const VK_CONTROL: u8 = 0x11;
    const VK_MENU: u8 = 0x12;
    const VK_LWIN: u8 = 0x5B;
    const VK_RWIN: u8 = 0x5C;
    const VK_C: u8 = 0x43;
    const KEYEVENTF_KEYUP: u32 = 0x0002;

    extern "system" {
        fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
    }

    // SAFETY: keybd_event is a well-defined Windows API for synthetic key input
    unsafe {
        // Release modifier keys still held from the hotkey combo (e.g. Ctrl+Alt+B).
        // Without this, the OS sees Ctrl+Alt+C instead of Ctrl+C.
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_RWIN, 0, KEYEVENTF_KEYUP, 0);
    }

    std::thread::sleep(std::time::Duration::from_millis(30));

    unsafe {
        keybd_event(VK_CONTROL, 0, 0, 0);
        keybd_event(VK_C, 0, 0, 0);
        keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
    }
    println!("[desktop/clipboard] Simulated Ctrl+C");
}

#[cfg(target_os = "macos")]
pub fn simulate_copy() {
    type CGEventRef = *mut std::ffi::c_void;

    extern "C" {
        fn CGEventCreateKeyboardEvent(
            source: *mut std::ffi::c_void,
            virtualKey: u16,
            keyDown: bool,
        ) -> CGEventRef;
        fn CGEventSetFlags(event: CGEventRef, flags: u64);
        fn CGEventPost(tap: u32, event: CGEventRef);
        fn CFRelease(cf: *const std::ffi::c_void);
    }

    const KVK_ANSI_C: u16 = 8;
    const KCG_EVENT_FLAG_MASK_COMMAND: u64 = 1 << 20;

    // SAFETY: CGEvent API is well-defined for synthetic keyboard events
    unsafe {
        let down = CGEventCreateKeyboardEvent(std::ptr::null_mut(), KVK_ANSI_C, true);
        if !down.is_null() {
            CGEventSetFlags(down, KCG_EVENT_FLAG_MASK_COMMAND);
            CGEventPost(0, down);
            CFRelease(down as *const _);
        }

        let up = CGEventCreateKeyboardEvent(std::ptr::null_mut(), KVK_ANSI_C, false);
        if !up.is_null() {
            CGEventSetFlags(up, KCG_EVENT_FLAG_MASK_COMMAND);
            CGEventPost(0, up);
            CFRelease(up as *const _);
        }
    }
    println!("[desktop/clipboard] Simulated Cmd+C");
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn simulate_copy() {
    println!("[desktop/clipboard] simulate_copy not supported on this platform");
}
