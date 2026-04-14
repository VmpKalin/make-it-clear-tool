# TextPilot — Frontend Design Skill

Read this file before touching any UI file in packages/desktop/src/ or packages/extension/src/popup/.

TextPilot is a premium, minimal dark-theme desktop widget and browser extension.
The aesthetic direction: **refined utilitarian** — every pixel earns its place, nothing decorative for its own sake.
Think: developer tool that happens to look exceptional.

---

## Core Aesthetic

- Dark, near-black backgrounds. Not pure black — slightly warm dark (#1c1c1f, #18181b)
- One accent color family: purple (#7F77DD light, #534AB7 mid, #3C3489 dark)
- Everything else is white at varying opacity levels
- No gradients. No glow. No shadows except subtle window shadow
- Micro-interactions only — nothing that feels "animated for animation's sake"

---

## Typography

Font: **DM Sans** (Google Fonts) — import in index.css:
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@400&display=swap');
```

Usage:
- UI labels, buttons: `DM Sans` 400
- Result text: `DM Sans` 400, 13.5px, line-height 1.65
- Original/muted text: `DM Sans` 300 italic
- Hotkeys, status, badges: `DM Mono` 400
- Never go below 11px
- Never use font-weight 600 or 700 — too heavy for dark theme

---

## Color Tokens

Define in index.css as CSS variables:

```css
:root {
  --bg-primary: #1c1c1f;       /* main window background */
  --bg-secondary: #141416;      /* header, titlebar, deeper areas */
  --bg-elevated: #242428;       /* hover states, input backgrounds */

  --accent: #7F77DD;            /* primary purple */
  --accent-dim: #534AB7;        /* buttons, active states */
  --accent-muted: rgba(83, 74, 183, 0.25); /* subtle tint on active */
  --accent-border: rgba(143, 135, 221, 0.35); /* purple borders */
  --accent-text: #CECBF6;       /* text on purple backgrounds */

  --text-primary: rgba(255, 255, 255, 0.88);   /* main result text */
  --text-secondary: rgba(255, 255, 255, 0.45); /* labels, placeholders */
  --text-muted: rgba(255, 255, 255, 0.22);     /* original text, hints */
  --text-mono: rgba(255, 255, 255, 0.18);      /* hotkeys, status */

  --border-subtle: rgba(255, 255, 255, 0.06);  /* dividers */
  --border-default: rgba(255, 255, 255, 0.10); /* button borders */
  --border-hover: rgba(255, 255, 255, 0.18);   /* hover borders */

  --green-dot: #1D9E75;         /* streaming status indicator */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}
```

---

## Component Patterns

### Window / Root container
```css
.window {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 0.5px solid var(--border-subtle);
  overflow: hidden;
  font-family: 'DM Sans', sans-serif;
  /* no box-shadow — Tauri handles window shadow natively */
}
```

### Header bar
```css
.header {
  background: var(--bg-secondary);
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

Add `data-tauri-drag-region` to header so user can drag the window.

### App name / badge
```css
.app-badge {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--accent-muted);
  color: var(--accent);
  border: 0.5px solid var(--accent-border);
  border-radius: 20px;
  padding: 3px 10px;
}
```

### Close button
```css
.close-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 0.5px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 12px;
  transition: background 0.15s, color 0.15s;
}
.close-btn:hover {
  background: rgba(255, 80, 80, 0.15);
  color: rgba(255, 100, 100, 0.8);
  border-color: rgba(255, 80, 80, 0.3);
}
```

### Original text (input preview)
```css
.original-text {
  padding: 12px 16px;
  font-size: 12px;
  font-style: italic;
  font-weight: 300;
  color: var(--text-muted);
  line-height: 1.6;
  border-bottom: 0.5px solid var(--border-subtle);
  /* clamp to 2 lines */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

### Result area
```css
.result-area {
  padding: 14px 16px;
  min-height: 80px;
}

.result-text {
  font-size: 13.5px;
  color: var(--text-primary);
  line-height: 1.65;
}
```

### Streaming cursor
```css
.cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: var(--accent);
  border-radius: 1px;
  margin-left: 2px;
  vertical-align: middle;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

Show cursor only while streaming. Hide when done.

### Action buttons row
```css
.actions {
  padding: 10px 16px 12px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.action-btn {
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: 20px; /* pill shape */
  border: 0.5px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: all 0.15s;
}

.action-btn:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.action-btn.active {
  background: var(--accent-muted);
  border-color: var(--accent-border);
  color: var(--accent-text);
}
```

### Copy button
```css
.copy-btn {
  margin-left: auto;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.05em;
  padding: 5px 14px;
  border-radius: 20px;
  background: var(--accent-dim);
  border: 0.5px solid var(--accent-border);
  color: var(--accent-text);
  cursor: pointer;
  transition: background 0.15s;
}
.copy-btn:hover {
  background: var(--accent);
}
.copy-btn:active {
  transform: scale(0.97);
}
```

### Status bar
```css
.status-bar {
  padding: 7px 16px;
  border-top: 0.5px solid var(--border-subtle);
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green-dot);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.status-text {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: var(--text-mono);
  letter-spacing: 0.04em;
}

.provider-badge {
  margin-left: auto;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: var(--text-mono);
  letter-spacing: 0.04em;
}
```

Show status dot + "streaming..." while API call is in progress.
When done: hide dot, show "done" or nothing.

---

## Window Appear Animation

Subtle fade + scale on mount — add to root container:

```css
@keyframes appear {
  from {
    opacity: 0;
    transform: scale(0.97) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.window {
  animation: appear 0.15s ease-out forwards;
}
```

---

## Tauri-specific

- Add `data-tauri-drag-region` to the header div — lets user drag the window
- Close button calls `getCurrentWindow().close()` from `@tauri-apps/api/window`
- Window should be: frameless, transparent, always-on-top
- In `tauri.conf.json` windows config:
  ```json
  {
    "decorations": false,
    "transparent": true,
    "alwaysOnTop": true,
    "resizable": false,
    "width": 360,
    "height": 280
  }
  ```

---

## Extension Popup (packages/extension/src/popup/)

Same color tokens and typography. Differences:
- No drag region (browser handles popup positioning)
- No close button (browser closes popup on blur)
- Width fixed at 320px (Chrome popup max)
- No window animation (browser handles popup appear)
- Slightly more compact padding (10px instead of 14px)

---

## What NOT to do

- No white or light backgrounds
- No colored gradients anywhere
- No box-shadows on inner elements (only on window level via Tauri)
- No font-weight above 500
- No border-radius above 20px except the window itself (16px)
- No emoji in UI
- No transitions longer than 200ms
- No layout shifts during streaming
