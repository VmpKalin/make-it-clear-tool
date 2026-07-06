/// macOS Accessibility permission helpers.
///
/// CGEventPost requires Accessibility permission to deliver synthetic keyboard
/// events to other applications. Without it, events are silently dropped.
/// We use AXIsProcessTrustedWithOptions with kAXTrustedCheckOptionPrompt = true
/// so the system shows its permission dialog on first launch.

#[cfg(target_os = "macos")]
pub fn is_granted() -> bool {
    use std::ffi::c_void;

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;
        static kAXTrustedCheckOptionPrompt: *const c_void;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFDictionaryCreate(
            allocator: *const c_void,
            keys: *const *const c_void,
            values: *const *const c_void,
            num_values: isize,
            key_callbacks: *const c_void,
            value_callbacks: *const c_void,
        ) -> *const c_void;
        fn CFRelease(cf: *const c_void);
        static kCFBooleanTrue: *const c_void;
        static kCFTypeDictionaryKeyCallBacks: u8;
        static kCFTypeDictionaryValueCallBacks: u8;
    }

    // SAFETY: AXIsProcessTrustedWithOptions and CFDictionaryCreate are stable
    // ApplicationServices/CoreFoundation APIs. We pass kAXTrustedCheckOptionPrompt
    // = kCFBooleanTrue so the OS shows its accessibility permission dialog if
    // the app is not yet trusted.
    let trusted = unsafe {
        let keys: [*const c_void; 1] = [kAXTrustedCheckOptionPrompt];
        let values: [*const c_void; 1] = [kCFBooleanTrue];
        let dict = CFDictionaryCreate(
            std::ptr::null(),
            keys.as_ptr(),
            values.as_ptr(),
            1,
            &kCFTypeDictionaryKeyCallBacks as *const u8 as *const c_void,
            &kCFTypeDictionaryValueCallBacks as *const u8 as *const c_void,
        );
        let result = AXIsProcessTrustedWithOptions(dict);
        if !dict.is_null() {
            CFRelease(dict);
        }
        result
    };

    log::info!(
        "[desktop/accessibility] Permission: {}",
        if trusted { "granted" } else { "NOT granted (prompt shown)" }
    );

    trusted
}

#[cfg(target_os = "macos")]
pub fn open_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn();
    log::info!("[desktop/accessibility] Opened System Settings → Accessibility");
}

#[cfg(not(target_os = "macos"))]
pub fn is_granted() -> bool {
    true
}

#[cfg(not(target_os = "macos"))]
pub fn open_settings() {}
