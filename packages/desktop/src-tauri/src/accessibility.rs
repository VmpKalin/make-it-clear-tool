/// macOS Accessibility permission helpers.
///
/// CGEventPost requires Accessibility permission to deliver synthetic keyboard
/// events to other applications. Without it, events are silently dropped.
/// osascript + System Events also fails from a Tauri background process (-609).
/// So Accessibility is the only viable path for text capture on macOS.

#[cfg(target_os = "macos")]
pub fn is_granted() -> bool {
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
    }

    // SAFETY: AXIsProcessTrusted is a well-defined ApplicationServices API.
    let trusted = unsafe { AXIsProcessTrusted() };

    println!(
        "[desktop/accessibility] Permission: {}",
        if trusted { "granted" } else { "NOT granted" }
    );

    trusted
}

#[cfg(target_os = "macos")]
pub fn open_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn();
    println!("[desktop/accessibility] Opened System Settings → Accessibility");
}

#[cfg(not(target_os = "macos"))]
pub fn is_granted() -> bool {
    true
}

#[cfg(not(target_os = "macos"))]
pub fn open_settings() {}
