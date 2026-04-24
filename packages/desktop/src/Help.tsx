import { useCallback, type JSX } from 'react';
import type { AppConfig } from '@textpilot/shared';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface Props {
  onClose: () => void;
  config: AppConfig | null;
}

function Kbd({ children }: { children: string }): JSX.Element {
  return <kbd className="help-kbd">{children}</kbd>;
}

function Row({ keys, desc }: { keys: string[]; desc: string }): JSX.Element {
  return (
    <div className="help-row">
      <span className="help-keys">
        {keys.map((k, i) => (
          <Kbd key={i}>{k}</Kbd>
        ))}
      </span>
      <span className="help-desc">{desc}</span>
    </div>
  );
}

export function Help({ onClose, config }: Props): JSX.Element {
  const triggerKeys = (config?.hotkeys?.trigger || 'Ctrl+Shift+Space').split('+').map((s) => s.trim());

  const handleClose = useCallback(async () => {
    try {
      await getCurrentWindow().hide();
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="window">
      <header className="header" data-tauri-drag-region>
        <span className="app-badge">Guide</span>
        <div className="header-right">
          <button
            type="button"
            className="icon-chip"
            onClick={onClose}
            title="Back"
            aria-label="Back"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 2L3.5 6L7.5 10" />
            </svg>
          </button>
          <button
            type="button"
            className="close-btn"
            onClick={() => void handleClose()}
            title="Close"
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
              <path d="M2 2L8 8M8 2L2 8" />
            </svg>
          </button>
        </div>
      </header>

      <div className="help-body">
        <p className="help-intro">
          Type or paste text, pick an action, get the result. That simple.
        </p>

        <section className="help-section">
          <h3 className="help-section-title">Actions</h3>
          <table className="help-table">
            <tbody>
              <tr><td className="help-table-key">Grammar</td><td>Fix spelling, punctuation, and unclear sentences</td></tr>
              <tr><td className="help-table-key">Rewrite</td><td>Improve clarity while keeping your voice</td></tr>
              <tr><td className="help-table-key">Shorten</td><td>Remove filler, keep the meaning</td></tr>
              <tr><td className="help-table-key">Format</td><td>Fix grammar + clean up spacing, indentation, line breaks</td></tr>
              <tr><td className="help-table-key">Translate</td><td>English ↔ Ukrainian, auto-detected</td></tr>
            </tbody>
          </table>
        </section>

        <div className="help-divider" />

        <section className="help-section">
          <h3 className="help-section-title">Global</h3>
          <Row keys={triggerKeys} desc="Open TextPilot from anywhere" />
          <p className="help-hint">System-wide — works even when the app is in background. Configurable in Settings.</p>
        </section>

        <section className="help-section">
          <h3 className="help-section-title">Window</h3>
          <Row keys={['Ctrl', 'Z']} desc="Restore last input when the field is empty" />
          <Row keys={['Ctrl', 'E']} desc="Edit — go back to your input" />
          <Row keys={['Ctrl', 'N']} desc="New — clear and start fresh" />
          <Row keys={['Esc']} desc="Hide and clear everything" />
          <p className="help-hint">Clicking outside the window hides it but keeps your input text. If a result is showing, it clears on blur. Per-action shortcuts are configurable in Settings.</p>
        </section>

        <div className="help-divider" />

        <section className="help-section">
          <h3 className="help-section-title">Status bar toggles</h3>
          <div className="help-toggles">
            <div className="help-toggle-row">
              <span className="help-toggle-badge">auto-run</span>
              <span className="help-toggle-desc">Default action runs as soon as you paste</span>
            </div>
            <div className="help-toggle-row">
              <span className="help-toggle-badge">auto-copy</span>
              <span className="help-toggle-desc">Result is copied to clipboard automatically — just paste. Can be turned off.</span>
            </div>
          </div>
        </section>

        <div className="help-divider" />

        <section className="help-section">
          <h3 className="help-section-title">Workflow</h3>
          <div className="help-flow">
            <span className="help-flow-step">Open</span>
            <span className="help-flow-arrow">→</span>
            <span className="help-flow-step">Paste text</span>
            <span className="help-flow-arrow">→</span>
            <span className="help-flow-step">Pick action</span>
            <span className="help-flow-arrow">→</span>
            <span className="help-flow-step">Paste anywhere</span>
          </div>
        </section>
      </div>
    </div>
  );
}
