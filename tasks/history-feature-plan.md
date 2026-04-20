# TextPilot Desktop: Request History Feature Plan

## Goal

Add a local request history to the desktop app so users can click and review previous requests and results, then reuse them quickly.

## Scope (MVP)

- Platform: desktop app only (`packages/desktop`)
- Storage: local Tauri Store, no database
- Visibility: a simple History view accessible from the main UI
- Retention: keep only the latest N entries, recommended default is 50

## Why This Fits the Current Architecture

- The app already uses `@tauri-apps/plugin-store` in `packages/desktop/src/storage.ts`.
- Request execution already passes through one place: `runAction` in `packages/desktop/src/App.tsx`.
- That gives one clean place to log success and error history records.

## Data Model

```ts
interface HistoryEntry {
  id: string;
  createdAt: string;
  action: Action;
  provider: 'claude' | 'openai';
  input: string;
  output: string;
  ok: boolean;
  error?: string;
  durationMs: number;
}
```

## Store Keys

- `history` -> `HistoryEntry[]`
- Optional:
  - `historyEnabled` -> `boolean`
  - `historyLimit` -> `number`, or use a hardcoded constant

## Implementation Steps

### 1. Extend the Desktop Storage Layer

File: `packages/desktop/src/storage.ts`

Add:

- `HISTORY_KEY` constant
- `HISTORY_LIMIT` constant, for example 50
- `loadHistory(): Promise<HistoryEntry[]>`
- `appendHistory(entry: HistoryEntry): Promise<void>`
- `clearHistory(): Promise<void>`

Behavior:

- `appendHistory` prepends the newest item.
- Trim the array to `HISTORY_LIMIT`.
- Save using the existing Tauri Store flow.

### 2. Log Requests in the App Runtime

File: `packages/desktop/src/App.tsx`

In `runAction`:

- Capture `startedAt` before `invoke('run_action', ...)`.
- On success, call `appendHistory(...)` with `ok: true`.
- On error, call `appendHistory(...)` with `ok: false` and `error`.
- Wrap history persistence in its own `try/catch` so history failures never break the main UX.

### 3. Add History View State

File: `packages/desktop/src/App.tsx`

Change:

- Extend `view` from `'main' | 'settings'` to `'main' | 'settings' | 'history'`.
- Add a header button to open the history screen.
- Load history when entering the history view.

### 4. Create a History UI Component

File to add: `packages/desktop/src/History.tsx`

Render:

- List of history entries, newest first
- Per item:
  - timestamp
  - action and provider
  - short input preview
  - status, success or error
- Item actions:
  - `Use input` to put the original input back into the editor
  - `Copy output`
  - `Run again`
- Global action:
  - `Clear history`

### 5. Add Styles

File: `packages/desktop/src/index.css`

Add styles for:

- history panel container
- history rows or cards
- metadata line
- action buttons
- empty state block
- scroll behavior

### 6. Add an Optional Privacy Control

Files:

- `packages/shared/src/types.ts`
- `packages/desktop/src/Settings.tsx`
- `packages/desktop/src/storage.ts`
- `packages/desktop/src/App.tsx`

Add:

- `historyEnabled: boolean` to config, default `true`
- A Settings toggle: `Save history locally`
- Skip history logging when disabled

### 7. Validation Checklist

- A successful request creates a history entry.
- A failed request creates an error history entry.
- Ordering is newest first.
- Limit trimming works.
- `Use input` populates the editor correctly.
- `Copy output` works.
- `Run again` uses the original action and input.
- `Clear history` removes all entries.
- The app does not crash if store read or write fails.

### 8. Commands to Run

- `pnpm typecheck`
- `cargo check` in `packages/desktop/src-tauri/`, if the Rust toolchain is available

### 9. Update the Project Progress Log

File: `CLAUDE.md`, section `## Progress`

Add checkboxes for:

- storage history API
- history UI component
- App wiring and actions
- optional privacy toggle
- typecheck and check status

## Recommended MVP Order

1. Implement storage helpers.
2. Log history records from `runAction`.
3. Add a basic history screen with a list and `Use input`.
4. Add `Copy output` and `Run again`.
5. Add `Clear history`.
6. Add the optional privacy toggle.

## Notes

- This should stay local-only. No sync is needed.
- Start simple. Store the full input and output first, then optimize later only if size becomes a problem.
- If the history grows beyond what fits comfortably in the config store, move it into a separate file such as `textpilot.history.json`.