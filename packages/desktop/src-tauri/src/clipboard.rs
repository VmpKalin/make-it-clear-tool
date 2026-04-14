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
