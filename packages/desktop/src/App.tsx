import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { Action, AppConfig } from '@textpilot/shared';
import { ACTIONS, ACTION_LABELS } from '@textpilot/shared';
import { invoke } from '@tauri-apps/api/core';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { Settings } from './Settings.js';
import { loadConfig, loadWindowSize, saveConfig, saveWindowSize } from './storage.js';

const LOG = '[desktop/App]';

/** Returns true if the keyboard event matches a hotkey string like "Ctrl+Shift+B". */
function matchesHotkey(e: KeyboardEvent, hotkey: string): boolean {
  if (!hotkey) return false;
  const parts = hotkey.split('+').map((s) => s.trim().toLowerCase());
  const ctrlNeeded = parts.includes('ctrl');
  const shiftNeeded = parts.includes('shift');
  const altNeeded = parts.includes('alt');
  const metaNeeded = parts.includes('meta');
  const mainKey = parts.find((p) => !['ctrl', 'shift', 'alt', 'meta'].includes(p));
  if (!mainKey) return false;
  if (e.ctrlKey !== ctrlNeeded || e.shiftKey !== shiftNeeded || e.altKey !== altNeeded || e.metaKey !== metaNeeded) return false;
  let code = e.code;
  if (code.startsWith('Key')) code = code.slice(3).toLowerCase();
  else if (code.startsWith('Digit')) code = code.slice(5);
  else code = code.toLowerCase();
  return code === mainKey;
}

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

type HotkeyTriggerPayload = Record<string, never>;

type AnimState = 'hidden' | 'appearing' | 'visible' | 'disappearing';

function cornerOrigin(relX: number, relY: number, w: number, h: number): string {
  const left = relX < w / 2;
  const top = relY < h / 2;
  return `${left ? 'left' : 'right'} ${top ? 'top' : 'bottom'}`;
}

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
  const [anim, setAnim] = useState<AnimState>('visible');
  const [origin, setOrigin] = useState('center center');
  const requestIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hidingRef = useRef(false);

  const hasResult = busy || output.length > 0;

  const MAX_HEIGHT = 500;

  const resizeToFit = useCallback(() => {
    requestAnimationFrame(async () => {
      try {
        const root = document.documentElement;
        const needed = root.scrollHeight;
        const scale = await getCurrentWindow().scaleFactor();
        const phys = await getCurrentWindow().outerSize();
        const currentLogical = Math.round(phys.height / scale);
        if (needed > currentLogical && currentLogical < MAX_HEIGHT) {
          const newH = Math.min(needed, MAX_HEIGHT);
          await getCurrentWindow().setSize(new LogicalSize(Math.round(phys.width / scale), newH));
        }
      } catch (err) {
        console.warn(`${LOG} Resize failed`, err);
      }
    });
  }, []);

  const resetState = useCallback(() => {
    setText('');
    setOutput('');
    setActiveAction(null);
    setStatus('');
    setCopied(false);
    requestIdRef.current = null;
  }, []);

  const hideAndReset = useCallback(() => {
    if (hidingRef.current) return;
    hidingRef.current = true;
    setAnim('disappearing');
    setTimeout(() => {
      void getCurrentWindow().hide().catch((err: unknown) => {
        console.warn(`${LOG} Hide failed`, err);
      });
      resetState();
      setAnim('hidden');
    }, 150);
  }, [resetState]);

  useEffect(() => {
    void loadConfig().then(setConfig);
    void loadWindowSize().then(async (size) => {
      if (size) {
        await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
      }
      await invoke('frontend_ready');
    });
  }, []);

  useEffect(() => {
    let saveTimeout: number | undefined;
    let ready = false;
    const readyTimer = window.setTimeout(() => { ready = true; }, 1500);
    const unlisten = getCurrentWindow().onResized(() => {
      if (!ready) return;
      window.clearTimeout(saveTimeout);
      saveTimeout = window.setTimeout(async () => {
        try {
          const scale = await getCurrentWindow().scaleFactor();
          const phys = await getCurrentWindow().outerSize();
          void saveWindowSize(
            Math.round(phys.width / scale),
            Math.round(phys.height / scale),
          );
        } catch (err) {
          console.warn(`${LOG} Size save failed`, err);
        }
      }, 500);
    });
    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(saveTimeout);
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<[number, number]>('textpilot://window-will-appear', (event) => {
      hidingRef.current = false;
      const [relX, relY] = event.payload;
      const el = containerRef.current;
      const w = el?.offsetWidth ?? 400;
      const h = el?.offsetHeight ?? 200;
      setOrigin(cornerOrigin(relX, relY, w, h));
      setAnim('appearing');
      setTimeout(() => setAnim('visible'), 200);
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    let hideTimeout: number | undefined;
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) {
        window.clearTimeout(hideTimeout);
        textareaRef.current?.focus();
      } else {
        hideTimeout = window.setTimeout(() => {
          void hideAndReset();
        }, 200);
      }
    });
    return () => {
      window.clearTimeout(hideTimeout);
      void unlisten.then((fn) => fn());
    };
  }, [hideAndReset]);

  useEffect(() => {
    const unlistenChunk = listen<StreamChunk>('textpilot://stream-chunk', (event) => {
      if (event.payload.request_id !== requestIdRef.current) return;
      setOutput((prev) => prev + event.payload.chunk);
      resizeToFit();
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
    async (action: Action, textOverride?: string, configOverride?: AppConfig) => {
      const source = (textOverride ?? text).trim();
      const activeConfig = configOverride ?? config;
      if (!source) {
        setStatus('paste text first');
        return;
      }
      if (!activeConfig?.apiKey) {
        setStatus('set api key');
        switchView('settings');
        return;
      }

      setBusy(true);
      setOutput('');
      setCopied(false);
      setActiveAction(action);
      setStatus(`streaming · ${action}`);
      resizeToFit();

      try {
        const requestId = crypto.randomUUID();
        requestIdRef.current = requestId;

        const result = await invoke<string>('run_action', {
          requestId,
          text: source,
          action,
          config: activeConfig,
        });

        if (activeConfig.autoCopyResult) {
          await writeText(result);
          try {
            await sendNotification({ title: 'TextPilot', body: 'Done — paste anywhere.' });
          } catch (err) {
            console.warn(`${LOG} Notification failed`, err);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(`error: ${message}`);
        setBusy(false);
        requestIdRef.current = null;
      }
    },
    [text, config, switchView, resizeToFit],
  );

  const handleGlobalTrigger = useCallback(() => {
    if (view !== 'main') {
      switchView('main');
    }
    resetState();
    setStatus('ready');
  }, [resetState, switchView, view]);

  useEffect(() => {
    const unlisten = listen<HotkeyTriggerPayload>('textpilot://hotkey-trigger', () => {
      handleGlobalTrigger();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [handleGlobalTrigger]);

  // Local per-action keyboard shortcuts — only fire while the app window is focused.
  useEffect(() => {
    const handleActionHotkeys = (e: KeyboardEvent): void => {
      if (!config?.hotkeys) return;
      for (const action of ACTIONS) {
        const hotkey = config.hotkeys[action];
        if (hotkey && matchesHotkey(e, hotkey)) {
          e.preventDefault();
          void runAction(action);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleActionHotkeys);
    return () => window.removeEventListener('keydown', handleActionHotkeys);
  }, [config, runAction]);

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

  const handleEdit = useCallback(() => {
    setOutput('');
    setActiveAction(null);
    setStatus('');
    setCopied(false);
    requestIdRef.current = null;
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleReset = resetState;

  const handleClose = hideAndReset;

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        void hideAndReset();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'e') {
        e.preventDefault();
        handleEdit();
      } else if (mod && e.key === 'n') {
        e.preventDefault();
        handleReset();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [hideAndReset, handleEdit, handleReset]);

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

  const toggleAutoCopy = useCallback(async () => {
    if (!config) return;
    const updated = { ...config, autoCopyResult: !config.autoCopyResult };
    setConfig(updated);
    try {
      await saveConfig(updated);
    } catch (err) {
      console.error(`${LOG} Auto-copy save failed`, err);
    }
  }, [config]);

  const providerLabel = config?.provider ?? 'not configured';

  return (
    <div
      ref={containerRef}
      className={`view-container${anim === 'appearing' ? ' appear' : ''}${anim === 'disappearing' ? ' disappear' : ''}`}
      style={{ transformOrigin: origin }}
    >
      {(view === 'main' || prevView === 'main') && (
        <div
          className={`view-panel${prevView !== null ? (view === 'main' ? ' view-enter' : ' view-exit') : ''}`}
        >
          <div className="window">
            <header className="header" data-tauri-drag-region>
              <span className="app-badge">TextPilot</span>
              <div className="header-right">
                {hasResult && !busy && (
                  <>
                    <button
                      type="button"
                      className="icon-chip"
                      onClick={handleEdit}
                      title="Edit (Ctrl+E)"
                      aria-label="Edit"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 1L2 6H5V11L11 6H8V1Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="icon-chip"
                      onClick={handleReset}
                      title="New (Ctrl+N)"
                      aria-label="New"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                        <path d="M6 2.5V9.5M2.5 6H9.5" />
                      </svg>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="icon-chip"
                  onClick={() => switchView('settings')}
                  title="Settings"
                  aria-label="Settings"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                    <circle cx="6" cy="6" r="2" />
                    <path d="M6 1V2.5M6 9.5V11M1 6H2.5M9.5 6H11M2.1 2.1L3.2 3.2M8.8 8.8L9.9 9.9M9.9 2.1L8.8 3.2M3.2 8.8L2.1 9.9" />
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

            <main className={`body${hasResult ? ' has-result' : ''}`}>
              {!hasResult && (
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Paste or type text here..."
                  autoFocus
                  spellCheck={false}
                />
              )}
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
                    {ACTION_LABELS[action]}
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
              <label className="auto-run-toggle" title="Run default action automatically when you paste text">
                <input
                  type="checkbox"
                  checked={config?.autoRunOnPaste ?? false}
                  onChange={() => void toggleAutoRun()}
                />
                auto-run
              </label>
              <label className="auto-run-toggle" title="Copy result to clipboard automatically when done">
                <input
                  type="checkbox"
                  checked={config?.autoCopyResult ?? true}
                  onChange={() => void toggleAutoCopy()}
                />
                auto-copy
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
