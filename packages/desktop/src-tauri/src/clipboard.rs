use crate::error::{AppError, AppResult};

const LOG: &str = "[desktop/clipboard]";
const POLL_INTERVAL_MS: u64 = 20;
const POLL_TIMEOUT_MS: u64 = 1000;

pub fn read_selection() -> AppResult<String> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| AppError::Clipboard(format!("init failed: {e}")))?;
    match clipboard.get_text() {
        Ok(text) => {
            log::info!("{LOG} Read {} chars", text.len());
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
    log::info!("{LOG} Wrote {} chars", text.len());
    Ok(())
}

pub fn restore(text: &str) -> AppResult<()> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| AppError::Clipboard(format!("init failed: {e}")))?;
    clipboard
        .set_text(text.to_string())
        .map_err(|e| AppError::Clipboard(format!("restore failed: {e}")))?;
    log::info!("{LOG} Restored original clipboard ({} chars)", text.len());
    Ok(())
}

/// Capture selected text from the frontmost application by simulating Cmd+C / Ctrl+C.
///
/// Uses the platform clipboard change counter to detect whether the copy succeeded,
/// polling every ~20ms for up to ~1 second. Returns `None` if nothing was selected
/// (counter never changed).
pub fn grab_selection() -> Option<String> {
    let counter_before = change_count();
    simulate_copy();

    let mut elapsed: u64 = 0;
    loop {
        std::thread::sleep(std::time::Duration::from_millis(POLL_INTERVAL_MS));
        elapsed += POLL_INTERVAL_MS;

        if change_count() != counter_before {
            let text = read_selection().unwrap_or_default();
            log::info!("{LOG} Copy detected after {elapsed}ms, got {} chars", text.len());
            if text.trim().is_empty() {
                return None;
            }
            return Some(text);
        }

        if elapsed >= POLL_TIMEOUT_MS {
            log::info!("{LOG} Clipboard unchanged after {POLL_TIMEOUT_MS}ms — nothing selected");
            return None;
        }
    }
}

// ---------------------------------------------------------------------------
// Platform: clipboard change counter
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
fn change_count() -> i64 {
    #[link(name = "user32")]
    extern "system" {
        fn GetClipboardSequenceNumber() -> u32;
    }
    // SAFETY: GetClipboardSequenceNumber is a well-defined Win32 API that
    // requires no handle and returns the global clipboard sequence number.
    unsafe { GetClipboardSequenceNumber() as i64 }
}

#[cfg(target_os = "macos")]
fn change_count() -> i64 {
    use std::ffi::c_void;

    extern "C" {
        fn objc_getClass(name: *const u8) -> *mut c_void;
        fn sel_registerName(name: *const u8) -> *mut c_void;
    }

    // SAFETY: Objective-C runtime calls to get [NSPasteboard generalPasteboard].changeCount.
    // objc_msgSend is cast to the concrete signature needed for each call — this is the
    // standard pattern for Rust ObjC FFI without the objc crate.
    unsafe {
        let cls = objc_getClass(b"NSPasteboard\0".as_ptr());
        let sel_gp = sel_registerName(b"generalPasteboard\0".as_ptr());
        let sel_cc = sel_registerName(b"changeCount\0".as_ptr());

        type SendPtr = unsafe extern "C" fn(*mut c_void, *mut c_void) -> *mut c_void;
        type SendI64 = unsafe extern "C" fn(*mut c_void, *mut c_void) -> i64;

        extern "C" {
            fn objc_msgSend(obj: *mut c_void, sel: *mut c_void) -> *mut c_void;
        }

        let send_ptr: SendPtr = std::mem::transmute(objc_msgSend as *const ());
        let send_i64: SendI64 = std::mem::transmute(objc_msgSend as *const ());

        let pasteboard = send_ptr(cls, sel_gp);
        send_i64(pasteboard, sel_cc)
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn change_count() -> i64 {
    0
}

// ---------------------------------------------------------------------------
// Platform: simulate Cmd+C / Ctrl+C
// ---------------------------------------------------------------------------

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

    // SAFETY: keybd_event is a well-defined Windows API for synthetic key input.
    unsafe {
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
    log::info!("{LOG} Simulated Ctrl+C");
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

    // SAFETY: CGEvent API is well-defined for synthetic keyboard events.
    // Events are posted at HIDEventTap and delivered to the frontmost app.
    // Requires Accessibility permission — silently dropped without it.
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
    log::info!("{LOG} Simulated Cmd+C via CGEventPost");
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn simulate_copy() {
    log::info!("{LOG} simulate_copy not supported on this platform");
}
