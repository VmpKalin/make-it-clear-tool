# TextPilot — CLAUDE.md

AI-powered text assistant: browser extension + desktop widget (Windows & macOS).
Select text → trigger → result in clipboard instantly.

---

## Session Start Checklist

At the start of every new session, before doing anything:
1. Read this file fully
2. Run `git log --oneline -10` to understand current state
3. Check `## Progress` section at the bottom
4. Only then start implementing

---

## Skills

Before touching any UI file, read the design skill:
```
.claude/skills/frontend-design/SKILL.md
```
It contains exact color tokens, CSS patterns, component templates, and rules
for the TextPilot aesthetic. Never write UI code without reading it first.

---

## Documentation

Always use Context7 for any library or framework documentation.
Before implementing anything with external libraries, fetch their
current docs via Context7 first.

```
// Examples of what to fetch before using:
- tauri → resolve "tauri" in context7, fetch relevant docs
- @anthropic-ai/sdk → resolve "anthropic sdk" in context7
- webextension-polyfill → resolve in context7
- react → resolve "react" in context7
```

Never assume API signatures from memory — always verify via Context7.

---

## Project Structure

```
textpilot/
├── CLAUDE.md
├── package.json                  # root (pnpm workspaces)
├── pnpm-workspace.yaml
├── tsconfig.base.json
│
├── packages/
│   ├── shared/                   # shared logic across all platforms
│   │   ├── src/
│   │   │   ├── prompts.ts        # system prompts for each action
│   │   │   ├── providers.ts      # Claude + GPT API clients (streaming)
│   │   │   ├── types.ts          # Action, Provider, Config, Result types
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── extension/                # Chrome/Firefox browser extension
│   │   ├── src/
│   │   │   ├── background.ts     # service worker — API calls, clipboard write
│   │   │   ├── content.ts        # text selection detection, hotkey listener
│   │   │   ├── popup/
│   │   │   │   ├── popup.html
│   │   │   │   ├── popup.ts      # optional UI (toggled via settings)
│   │   │   │   └── popup.css
│   │   │   └── options/
│   │   │       ├── options.html  # settings page
│   │   │       └── options.ts    # provider, API key, default action, UI toggle
│   │   ├── manifest.json         # MV3
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── desktop/                  # Tauri 2 app (Windows + macOS)
│       ├── src/                  # React frontend (popup UI)
│       │   ├── main.tsx
│       │   ├── App.tsx           # main widget UI
│       │   ├── Settings.tsx      # settings window
│       │   └── index.css
│       ├── src-tauri/            # Rust backend
│       │   ├── Cargo.toml
│       │   ├── tauri.conf.json
│       │   └── src/
│       │       ├── main.rs
│       │       ├── hotkey.rs     # global hotkey registration
│       │       ├── tray.rs       # system tray icon + menu
│       │       ├── clipboard.rs  # read selection, write result
│       │       └── api.rs        # HTTP calls to Claude/GPT (reqwest + streaming)
│       ├── package.json
│       └── tsconfig.json
```

---

## Tech Stack

### Shared (`packages/shared`)
- TypeScript strict mode — pure logic, no runtime deps
- Exports: `runAction(text, action, config)` → `AsyncIterable<string>` (streaming)

### Browser Extension (`packages/extension`)
- Manifest V3 (Chrome + Firefox via `webextension-polyfill`)
- TypeScript + esbuild — no framework, bundle <50KB
- API calls from `background.ts` (service worker) to avoid CORS
- Storage: `chrome.storage.local` for config

### Desktop (`packages/desktop`)
- Tauri 2 — Rust backend + WebView frontend
- React 19 + TypeScript + Vite
- Global hotkey: `tauri-plugin-global-shortcut`
- System tray: `tauri-plugin-tray`
- Clipboard: `arboard` crate (read selected text + write result)
- HTTP/streaming: `reqwest` with SSE in Rust
- Config: `tauri-plugin-store` (JSON, OS config dir)
- Window: frameless, always-on-top, appears near cursor

---

## Code Style

### General (TypeScript)
- Strict mode everywhere — no `any`, ever
- `async/await` only — never raw `.then()` chains
- Named exports only — no default exports
- `interface` over `type` for object shapes
- Keep files under 150 lines — extract if bigger
- `camelCase.ts` for all source files
- Interfaces: `PascalCase` — `ActionResult`, `AppConfig`
- Constants: `UPPER_SNAKE_CASE` — `MAX_TOKENS`, `DEFAULT_ACTION`

### Error Handling
- Every async function must have try/catch
- Never swallow errors silently — always log with context
- Use typed custom errors:

```typescript
class ProviderError extends Error {
  constructor(provider: string, cause: unknown) {
    super(`Provider request failed: ${provider}`);
    this.cause = cause;
  }
}
```

### Config & Secrets
- All secrets in `.env` only — never hardcode
- All env vars accessed through `packages/shared/src/config.ts` only
- Validate at startup — fail fast if missing:

```typescript
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required');
}
```

### Service Pattern
Each service is a class with single responsibility:

```typescript
export class ClaudeProvider {
  constructor(private readonly apiKey: string) {}

  async *stream(text: string, action: Action): AsyncIterable<string> { ... }
}
```

### Logging
Structured prefix in all logs:

```
[shared/providers] Streaming with claude-haiku-4-5...
[extension/background] Hotkey triggered, action: grammar
[desktop/api] SSE stream complete in 1.2s
[desktop/clipboard] Result written to clipboard
```

### Rust (`src-tauri/`)
- Use `thiserror` for typed errors
- All Tauri commands return `Result<T, String>` — never panic
- Keep each `.rs` file under 150 lines — split by concern
- Log with `println!("[module] message")` consistently
- No `.unwrap()` without a comment explaining why it's safe

---

## Rules

- DO NOT modify `.env` — only `.env.example`
- DO NOT install new packages without mentioning it first
- DO NOT use `any` type in TypeScript
- DO NOT use `.unwrap()` in Rust without a safety comment
- Run `pnpm typecheck` after every major TypeScript change
- Run `cargo check` inside `packages/desktop/src-tauri/` after every Rust change
- Use Context7 before implementing anything with an external library
- After completing each task or file, update `## Progress` at the bottom
- Format progress as checkboxes with filename and one-line description

---

## Behavior: UX Flows

### Silent Mode (`showUI: false`) — default
```
User selects text
→ hotkey / tray click
→ clipboard read (selected text)
→ API call fires immediately with defaultAction
→ result streams in background
→ on complete: result written to clipboard
→ system notification: "Done — Ctrl+V to paste"
```

### UI Mode (`showUI: true`)
```
User selects text
→ hotkey
→ popup appears near cursor, text pre-filled
→ action buttons: [Grammar] [Rewrite] [Shorten] [Bullets]
→ default action highlighted, starts immediately
→ result streams into popup
→ [Copy] or auto-copy on done
```

### Tray Menu
```
Right-click tray →
  ├── Fix grammar        ⌃⇧1
  ├── Rewrite            ⌃⇧2
  ├── Shorten            ⌃⇧3
  ├── Bullets            ⌃⇧4
  ├── ───────────────
  ├── Settings
  └── Quit
```

---

## Settings Reference

| Setting | Type | Default |
|---|---|---|
| Provider | `claude` / `openai` | `claude` |
| API Key | string | — |
| Default Action | `grammar` / `rewrite` / `shorten` / `bullets` | `grammar` |
| Show UI | boolean | `false` |
| Hotkey trigger | string | `Ctrl+Shift+Space` |
| Per-action hotkeys | boolean | `false` |
| Tray enabled | boolean | `true` |

---

## System Prompts (English only, optimized for speed)

```typescript
export const SYSTEM_PROMPTS: Record<Action, string> = {
  grammar: `You are a grammar correction assistant. Fix grammar, spelling, and punctuation errors in the given English text. Return ONLY the corrected text, no explanations, no quotes, no markdown.`,
  rewrite: `You are a writing assistant. Rewrite the given English text to be clearer and more professional while preserving its meaning. Return ONLY the rewritten text, no explanations.`,
  shorten: `You are a writing assistant. Shorten the given English text while preserving its key meaning. Return ONLY the shortened text, no explanations.`,
  bullets: `You are a writing assistant. Convert the given English text into a concise bullet point list. Return ONLY the bullet points, no intro, no explanations.`,
}
```

Models:
- Claude → `claude-haiku-4-5` (fastest, cheapest)
- GPT → `gpt-4o-mini` (fastest, cheapest)

---

## Build & Dev

### Prerequisites
- Node.js 20+
- pnpm 9+
- Rust (stable) + Tauri CLI v2
- macOS build: Xcode Command Line Tools
- Windows build: MSVC build tools

### Commands
```bash
# install all
pnpm install

# dev — extension (watch, outputs to packages/extension/dist)
pnpm --filter extension dev

# dev — desktop
pnpm --filter desktop tauri dev

# typecheck all packages
pnpm typecheck

# build — extension (zip for Chrome Web Store)
pnpm --filter extension build

# build — desktop macOS (.dmg)
pnpm --filter desktop tauri build

# build — desktop Windows (.msi + .exe)
pnpm --filter desktop tauri build -- --target x86_64-pc-windows-msvc

# rust check (run from packages/desktop/)
cargo check
```

### Load extension locally
1. `pnpm --filter extension build`
2. Chrome → `chrome://extensions` → Developer mode ON
3. Load unpacked → `packages/extension/dist/`

---

## Key Decisions & Rationale

- **pnpm workspaces** — shared types/prompts, zero duplication across platforms
- **No framework in extension** — vanilla TS, bundle <50KB, faster load
- **Rust for API calls in desktop** — no Node.js runtime, proper SSE streaming, smaller binary
- **Haiku / gpt-4o-mini** — fastest + cheapest models, sufficient for text editing
- **MV3** — required for Chrome Web Store, works on Firefox via polyfill
- **Silent mode default** — minimal friction, clipboard-first UX
- **Tauri over Electron** — ~10MB vs ~200MB binary, native tray, no Chromium bundled

---

## Progress

- [x] `pnpm-workspace.yaml` — workspace config linking all packages
- [x] `tsconfig.base.json` — shared TS config (strict, ES2022, bundler resolution)
- [x] `package.json` — root scripts: typecheck, build:all
- [x] `packages/shared/src/types.ts` — Action, Provider, Config, AppConfig interfaces
- [x] `packages/shared/prompts.md` — canonical prompts (markdown, loaded at runtime)
- [x] `packages/shared/src/prompts.ts` — parser + loader (disk/url) with fallback const
- [x] `packages/shared/src/providers.ts` — runAction() streaming, Claude + GPT clients (SSE over fetch)
- [x] `packages/shared/src/index.ts` — barrel export
- [x] `packages/shared/{package.json,tsconfig.json}` — workspace package config
- [x] `packages/extension/manifest.json` — MV3, permissions, commands, web_accessible_resources
- [x] `packages/extension/src/background.ts` — service worker, API calls, clipboard write, notifications
- [x] `packages/extension/src/content.ts` — selection detection, message listener
- [x] `packages/extension/src/popup/popup.{html,css,ts}` — popup UI + action buttons
- [x] `packages/extension/src/options/options.{html,ts}` — settings page
- [x] `packages/extension/src/{config,messages}.ts` — storage helpers, message types
- [x] `packages/extension/build.mjs` — esbuild bundler + static asset copy
- [x] `packages/extension/{package.json,tsconfig.json}` — workspace package config
- [x] `packages/desktop/{package.json,tsconfig.json,vite.config.ts,index.html}` — Vite + React setup
- [x] `packages/desktop/src/{main,index.css,storage}.{tsx,ts,css}` — React root, styles, store
- [x] `packages/desktop/src/App.tsx` — main widget UI with stream event listeners
- [x] `packages/desktop/src/Settings.tsx` — settings window (provider/key/hotkeys)
- [x] `packages/desktop/src-tauri/{Cargo.toml,build.rs,tauri.conf.json}` — Rust crate + Tauri config
- [x] `packages/desktop/src-tauri/capabilities/default.json` — plugin permissions
- [x] `packages/desktop/src-tauri/src/{main,lib}.rs` — entry + command dispatch
- [x] `packages/desktop/src-tauri/src/hotkey.rs` — global shortcut registration
- [x] `packages/desktop/src-tauri/src/tray.rs` — system tray icon + menu
- [x] `packages/desktop/src-tauri/src/clipboard.rs` — arboard read/write
- [x] `packages/desktop/src-tauri/src/api.rs` — reqwest SSE streaming to Claude/GPT
- [x] `packages/desktop/src-tauri/src/{config,error,prompts}.rs` — shared types, typed errors, prompts
- [x] `packages/desktop/src/HotkeyRecorder.tsx` — keyboard shortcut recorder component
- [x] `packages/desktop/src/App.tsx` — dual-panel view transitions with switchView state machine, labeled result divider
- [x] `packages/desktop/src/index.css` — slide-in/out view transitions (250ms cubic-bezier), result-divider row with action label, result area tinted background
- [ ] `cargo check` — blocked: Rust toolchain not installed on this machine