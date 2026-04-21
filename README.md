# TextPilot

AI-powered text assistant. Select text, trigger, result lands in your clipboard.

Two surfaces share one core:
- **Browser extension** - Chrome / Firefox (Manifest V3)
- **Desktop widget** - Windows & macOS (Tauri 2)

Both talk to Claude (`claude-haiku-4-5`) or OpenAI (`gpt-4o-mini`) with streaming responses.

---

## Actions

| Action  | What it does                                    |
| ------- | ------------------------------------------------ |
| Grammar | Fix grammar, spelling, punctuation               |
| Rewrite | Clearer, more professional phrasing              |
| Shorten | Trim while preserving meaning                    |
| Bullets | Convert prose into a concise bullet list         |

---

## Modes

- **Silent (default)** - hotkey fires, result streams to the clipboard, system notification confirms.
- **UI** - frameless popup appears near the cursor with action pills, streaming result, copy button.

Toggle via Settings -> *Show popup on hotkey*.

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

## Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (stable) + Tauri CLI v2 - **only for building the desktop app**
- macOS build: Xcode Command Line Tools
- Windows build: MSVC build tools

End users of a packaged `.msi` / `.dmg` / `.zip` do **not** need Rust installed.

---

## Quick start

```bash
pnpm install

# typecheck everything
pnpm typecheck

# extension - dev build with watch
pnpm --filter extension dev

# desktop - Tauri dev window
pnpm --filter desktop tauri dev
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
pnpm --filter desktop tauri build -- --target x86_64-pc-windows-msvc
```

Rust sanity check:

```bash
cd packages/desktop/src-tauri
cargo check
```

---

## Configuration

Set via the Settings window (desktop) or options page (extension):

| Setting         | Default               |
| --------------- | --------------------- |
| Provider        | `claude`              |
| API Key         | -                     |
| Default Action  | `grammar`             |
| Show UI         | `false` (silent mode) |
| Hotkey Trigger  | `Ctrl+Shift+Space`    |
| Tray enabled    | `true`                |

API keys are stored locally (Tauri store on desktop, `chrome.storage.local` in the extension) - never sent anywhere except the chosen provider.

---

## Design

The desktop widget follows a **refined utilitarian** dark theme - `#1c1c1f` background, purple accent family (`#7F77DD` / `#534AB7`), DM Sans + DM Mono typography. See `.claude/skills/frontend-design/SKILL.md` for exact tokens.

---

## Tech stack

- **Shared** - TypeScript strict, SSE streaming over `fetch`
- **Extension** - MV3, vanilla TS, `webextension-polyfill`, esbuild (<50 KB bundle)
- **Desktop** - Tauri 2, React 19, Vite, `reqwest` (rustls) for streaming, `arboard` for clipboard, `tauri-plugin-global-shortcut` for hotkeys, `tauri-plugin-store` for config

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
