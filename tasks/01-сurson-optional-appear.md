Read CLAUDE.md and .claude/skills/frontend-design/SKILL.md.

Add a setting to disable the popup window appearing near cursor on hotkey trigger.

1. Add new setting in config:
- Key: "showWindowOnHotkey" (boolean, default: true)
- When true: hotkey trigger shows the popup window near cursor (current behavior)
- When false: hotkey trigger runs the default action silently — result goes straight 
  to clipboard, no window appears at all (pure silent mode)

2. Add toggle in Settings UI:
- Label: "Show window on hotkey"
- Sub-label: "Off = silent clipboard mode, result pastes automatically"
- Use the same toggle component style as other boolean settings

3. Wire up the behavior:
- In hotkey handler: read this setting before deciding whether to show the window
- If disabled: run default action silently, write result to clipboard, 
  show a brief system notification "Done — Ctrl+V to paste"
- If enabled: show window near cursor as usual

4. Save and load this setting via tauri-plugin-store alongside other config.

After changes:
- cargo check in packages/desktop/src-tauri/
- pnpm --filter @textpilot/desktop build