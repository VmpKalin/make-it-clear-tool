Read CLAUDE.md.

Add a feature: when user selects text in any app and presses the hotkey,
the selected text should automatically be pulled into the widget input field.

On hotkey trigger:
1. Read the current clipboard content before doing anything (save it)
2. Simulate Cmd+C (macOS) or Ctrl+C (Windows) to copy the selected text
3. Wait briefly for clipboard to update (~100ms)
4. Read the new clipboard content — this is the selected text
5. Show the widget window near cursor
6. Emit event to frontend with the selected text
7. Frontend puts the text into the input field automatically
8. Restore the original clipboard content after the text is captured
   so the user's previous clipboard is not lost
9. Immediately trigger the default action if "auto-run on paste" is enabled

In Rust use enigo crate or tauri's system APIs to simulate the copy shortcut.
Check Context7 for enigo or arboard APIs before implementing.

Add enigo to Cargo.toml if not already present — mention it before adding.

After changes:
- cargo check in packages/desktop/src-tauri/
- pnpm --filter @textpilot/desktop build