import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { Action, AppConfig } from '@textpilot/shared';
import { ACTIONS } from '@textpilot/shared';
import { invoke } from '@tauri-apps/api/core';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { Settings } from './Settings.js';
import { loadConfig, saveConfig } from './storage.js';

const LOG = '[desktop/App]';

interface StreamChunk {
  request_id: string;
  chunk: string;
}

interface StreamDone {
  request_id: string;
}

interface StreamError {
  request_id: string;
  message: string;
}

const ACTION_LABEL: Record<Action, string> = {
  grammar: 'Grammar',
  rewrite: 'Rewrite',
  shorten: 'Shorten',
  bullets: 'Bullets',
  translate: 'Translate',
};

const DEFAULT_WIDTH = 420;
const COMPACT_HEIGHT = 300;
const MIN_RESULT_HEIGHT = 380;
const MAX_HEIGHT = 640;

export function App(): JSX.Element {
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [prevView, setPrevView] = useState<'main' | 'settings' | null>(null);
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);

  const hasResult = busy || output.length > 0;

  const resizeTo = useCallback(async (height: number) => {
    try {
      await getCurrentWindow().setSize(new LogicalSize(DEFAULT_WIDTH, height));
    } catch (err) {
      console.warn(`${LOG} Resize failed`, err);
    }
  }, []);

  const resizeToFit = useCallback(() => {
    requestAnimationFrame(() => {
      const resultEl = resultRef.current;
      if (!resultEl) return;
      // header(~46) + textarea(140) + divider(28) + resultText + resultPadding(32) + actions(42) + status(30)
      const chrome = 46 + 140 + 28 + 32 + 42 + 30;
      const resultHeight = resultEl.scrollHeight;
      const needed = Math.max(MIN_RESULT_HEIGHT, Math.min(chrome + resultHeight, MAX_HEIGHT));
      void resizeTo(needed);
    });
  }, [resizeTo]);

  useEffect(() => {
    void loadConfig().then(setConfig);
  }, []);

  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) {
        textareaRef.current?.focus();
      }
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        void getCurrentWindow().hide();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    const unlistenChunk = listen<StreamChunk>('textpilot://stream-chunk', (event) => {
      if (event.payload.request_id !== requestIdRef.current) return;
      setOutput((prev) => prev + event.payload.chunk);
    });

    const unlistenDone = listen<StreamDone>('textpilot://stream-done', (event) => {
      if (event.payload.request_id !== requestIdRef.current) return;
      setBusy(false);
      setStatus('done');
      requestIdRef.current = null;
      resizeToFit();
    });

    const unlistenError = listen<StreamError>('textpilot://stream-error', (event) => {
      if (event.payload.request_id !== requestIdRef.current) return;
      setBusy(false);
      setStatus(`error: ${event.payload.message}`);
      requestIdRef.current = null;
    });

    return () => {
      void unlistenChunk.then((fn) => fn());
      void unlistenDone.then((fn) => fn());
      void unlistenError.then((fn) => fn());
    };
  }, [resizeToFit]);

  const switchView = useCallback(
    (to: 'main' | 'settings') => {
      if (prevView !== null) return;
      setPrevView(view);
      setView(to);
      setTimeout(() => setPrevView(null), 280);
    },
    [view, prevView],
  );

  useEffect(() => {
    const unlisten = listen('textpilot://open-settings', () => {
      switchView('settings');
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [switchView]);

  const runAction = useCallback(
    async (action: Action, textOverride?: string) => {
      const source = (textOverride ?? text).trim();
      if (!source) {
        setStatus('paste text first');
        return;
      }
      if (!config?.apiKey) {
        setStatus('set api key');
        switchView('settings');
        return;
      }

      setBusy(true);
      setOutput('');
      setCopied(false);
      setActiveAction(action);
      setStatus(`streaming · ${action}`);
      void resizeTo(MIN_RESULT_HEIGHT);

      try {
        const requestId = crypto.randomUUID();
        requestIdRef.current = requestId;

        const result = await invoke<string>('run_action', {
          requestId,
          text: source,
          action,
          config,
        });

        await writeText(result);
        try {
          await sendNotification({ title: 'TextPilot', body: 'Done — paste anywhere.' });
        } catch (err) {
          console.warn(`${LOG} Notification failed`, err);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(`error: ${message}`);
        setBusy(false);
        requestIdRef.current = null;
      }
    },
    [text, config, switchView, resizeTo],
  );

  const handleCopy = useCallback(async () => {
    if (!output) return;
    try {
      await writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(`${LOG} Copy failed`, err);
      setStatus('copy failed');
    }
  }, [output]);

  const handleReset = useCallback(() => {
    setText('');
    setOutput('');
    setActiveAction(null);
    setStatus('');
    setCopied(false);
    void resizeTo(COMPACT_HEIGHT);
  }, [resizeTo]);

  const handleClose = useCallback(async () => {
    try {
      await getCurrentWindow().hide();
    } catch (err) {
      console.error(`${LOG} Hide failed`, err);
    }
  }, []);

  const handlePaste = useCallback(() => {
    if (!config?.autoRunOnPaste) return;
    setTimeout(() => {
      const current = textareaRef.current?.value ?? '';
      if (!current.trim()) return;
      void runAction(config.defaultAction, current);
    }, 0);
  }, [config, runAction]);

  const toggleAutoRun = useCallback(async () => {
    if (!config) return;
    const updated = { ...config, autoRunOnPaste: !config.autoRunOnPaste };
    setConfig(updated);
    try {
      await saveConfig(updated);
    } catch (err) {
      console.error(`${LOG} Auto-run save failed`, err);
    }
  }, [config]);

  const providerLabel = config?.provider ?? 'not configured';

  return (
    <div className="view-container">
      {(view === 'main' || prevView === 'main') && (
        <div
          className={`view-panel${prevView !== null ? (view === 'main' ? ' view-enter' : ' view-exit') : ''}`}
        >
          <div className="window">
            <header className="header" data-tauri-drag-region>
              <span className="app-badge">TextPilot</span>
              <div className="header-right">
                {hasResult && !busy && (
                  <button
                    type="button"
                    className="icon-chip"
                    onClick={handleReset}
                    title="New"
                    aria-label="New"
                  >
                    +
                  </button>
                )}
                <button
                  type="button"
                  className="icon-chip"
                  onClick={() => switchView('settings')}
                  title="Settings"
                  aria-label="Settings"
                >
                  ·
                </button>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => void handleClose()}
                  title="Close"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </header>

            <main className={`body${hasResult ? ' has-result' : ''}`}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={handlePaste}
                placeholder="Paste or type text here..."
                autoFocus
                spellCheck={false}
              />
              {hasResult && (
                <>
                  <div className="result-divider">
                    <span className="result-divider-label">
                      {activeAction} →
                    </span>
                  </div>
                  <div className="result-area" aria-live="polite">
                    <p ref={resultRef} className="result-text">
                      {output}
                      {busy && <span className="cursor" aria-hidden="true" />}
                    </p>
                  </div>
                </>
              )}
            </main>

            <div className="actions">
              <div className="actions-scroll">
                {ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={`action-btn${activeAction === action ? ' active' : ''}`}
                    disabled={busy}
                    onClick={() => void runAction(action)}
                  >
                    {ACTION_LABEL[action]}
                  </button>
                ))}
              </div>
              {hasResult && !busy && (
                <button
                  type="button"
                  className={`copy-btn${copied ? ' copied' : ''}`}
                  onClick={() => void handleCopy()}
                  disabled={!output}
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              )}
            </div>

            <footer className="status-bar">
              {busy && <span className="status-dot" aria-hidden="true" />}
              <span className="status-text">{status || 'ready'}</span>
              <label className="auto-run-toggle" title="Auto-run default action on paste">
                <input
                  type="checkbox"
                  checked={config?.autoRunOnPaste ?? false}
                  onChange={() => void toggleAutoRun()}
                />
                auto
              </label>
              <span className="provider-badge">{providerLabel}</span>
            </footer>
          </div>
        </div>
      )}
      {(view === 'settings' || prevView === 'settings') && (
        <div
          className={`view-panel${prevView !== null ? (view === 'settings' ? ' view-enter' : ' view-exit') : ''}`}
        >
          <Settings
            onClose={() => {
              void loadConfig().then((c) => {
                setConfig(c);
                switchView('main');
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
