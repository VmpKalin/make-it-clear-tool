# TextPilot

AI-powered text assistant for Windows and macOS. Select text anywhere, press a hotkey, get the result in your clipboard.

Two surfaces share one core:
- **Desktop widget** — Windows & macOS (Tauri 2)
- **Browser extension** — Chrome / Firefox (Manifest V3)

Both talk to Claude (`claude-haiku-4-5`) or OpenAI (`gpt-4o-mini`) with streaming responses.

---

## Install

### Windows

Download the `.exe` (NSIS installer) or `.msi` from the [latest release](../../releases/latest) and run it.

### macOS

Download the `.dmg` from the [latest release](../../releases/latest), open it, and drag TextPilot to Applications.

The app is not notarized with Apple, so macOS will block it on first launch. Run this once in Terminal to fix it:

```bash
xattr -cr /Applications/TextPilot.app
```

Alternatively: right-click the app in Finder → **Open** → **Open**.

---

## Actions

| Action    | What it does                                                |
| --------- | ----------------------------------------------------------- |
| Grammar   | Fix spelling, punctuation, and unclear sentences            |
| Rewrite   | Improve clarity while keeping your voice                    |
| Shorten   | Remove filler, keep the meaning                             |
| Format    | Grammar + clean up spacing, indentation, line breaks        |
| Translate | English ↔ Ukrainian, auto-detected                         |

---

## How it works

### Two hotkeys

TextPilot uses two separate global hotkeys (configurable in Settings):

| Hotkey         | Default        | What it does                                                                 |
| -------------- | -------------- | ---------------------------------------------------------------------------- |
| Open Window    | `Ctrl+Alt+B`   | Opens the TextPilot widget near your cursor                                  |
| Quick Action   | *(not set)*    | Grabs selected text → runs default action silently → copies result to clipboard → notification |

**Quick Action** is the fastest workflow: select text in any app, press the hotkey, wait for the notification, paste.

### Window mode

1. Press the Open Window hotkey (or click the tray icon)
2. Paste or type text
3. Click an action button (Grammar, Rewrite, Shorten, Format, Translate)
4. Result streams in real-time
5. Result is auto-copied to clipboard — just paste anywhere

### Keyboard shortcuts (inside the window)

| Shortcut  | Action                                    |
| --------- | ----------------------------------------- |
| `Ctrl+Z`  | Restore last input when the field is empty |
| `Ctrl+E`  | Edit — go back to your input              |
| `Ctrl+N`  | New — clear and start fresh               |
| `Esc`     | Hide and clear everything                 |

Per-action hotkeys are also configurable in Settings.

### Status bar toggles

- **auto-run** — default action runs as soon as you paste text
- **auto-copy** — result is copied to clipboard automatically when done

---

## Configuration

Set via the Settings window (desktop) or options page (extension):

| Setting        | Default               | Description                                    |
| -------------- | --------------------- | ---------------------------------------------- |
| Provider       | `claude`              | Claude (Anthropic) or OpenAI (GPT)             |
| API Key        | —                     | Your API key for the selected provider         |
| Default Action | `grammar`             | Action used by Quick Action hotkey             |
| Open Window    | `Ctrl+Alt+B`          | Hotkey to show the widget                      |
| Quick Action   | *(not set)*           | Hotkey for silent grab-run-copy flow           |
| Tray enabled   | `true`                | Show system tray icon                          |
| Auto-run       | `false`               | Run default action on paste                    |
| Auto-copy      | `true`                | Copy result to clipboard when done             |

API keys are stored locally (Tauri store on desktop, `chrome.storage.local` in the extension) and are never sent anywhere except the chosen provider's API.

---

## Repo layout

```
packages/
  shared/      # types, prompts, streaming providers (Claude + OpenAI)
  extension/   # MV3 browser extension (vanilla TS + esbuild)
  desktop/     # Tauri 2 widget (React 19 frontend + Rust backend)
```

Monorepo managed by **pnpm workspaces**.

---

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (stable) + Tauri CLI v2 — only for building the desktop app
- macOS: Xcode Command Line Tools
- Windows: MSVC build tools

End users of a packaged `.msi` / `.dmg` / `.exe` do **not** need any of this.

### Quick start

```bash
pnpm install

# typecheck everything
pnpm typecheck

# desktop — Tauri dev window
pnpm --filter desktop tauri dev

# extension — dev build with watch
pnpm --filter extension dev
```

### Load the extension in Chrome

1. `pnpm --filter extension build`
2. Visit `chrome://extensions` and enable Developer mode
3. *Load unpacked* and select `packages/extension/dist/`

### Build desktop binaries

```bash
# macOS (.dmg)
pnpm --filter desktop tauri build

# Windows (.msi + .exe)
pnpm --filter desktop tauri build
```

Rust sanity check:

```bash
cd packages/desktop/src-tauri
cargo check
```

---

## Tech stack

- **Shared** — TypeScript strict, SSE streaming over `fetch`
- **Extension** — MV3, vanilla TS, `webextension-polyfill`, esbuild (<50 KB bundle)
- **Desktop** — Tauri 2, React 19, Vite, `reqwest` (rustls) for streaming, `arboard` for clipboard, `tauri-plugin-global-shortcut` for hotkeys, `tauri-plugin-store` for config

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
