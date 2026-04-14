import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { Action, AppConfig } from '@textpilot/shared';
import { ACTIONS } from '@textpilot/shared';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { Settings } from './Settings.js';
import { loadConfig } from './storage.js';

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
};

export function App(): JSX.Element {
  const [view, setView] = useState<'widget' | 'settings'>('widget');
  const [text, setText] = useState('');
  const [original, setOriginal] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const hasResult = busy || output.length > 0;

  useEffect(() => {
    void loadConfig().then(setConfig);
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
  }, []);

  const runAction = useCallback(
    async (action: Action) => {
      const source = (hasResult ? original : text).trim();
      if (!source) {
        setStatus('paste text first');
        return;
      }
      if (!config?.apiKey) {
        setStatus('set api key');
        setView('settings');
        return;
      }

      setOriginal(source);
      setBusy(true);
      setOutput('');
      setCopied(false);
      setActiveAction(action);
      setStatus(`streaming · ${action}`);

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
    [text, original, hasResult, config],
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
    setOutput('');
    setOriginal('');
    setActiveAction(null);
    setStatus('');
    setCopied(false);
  }, []);

  const handleClose = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (err) {
      console.error(`${LOG} Close failed`, err);
    }
  }, []);

  if (view === 'settings') {
    return (
      <Settings
        onClose={() => {
          void loadConfig().then((c) => {
            setConfig(c);
            setView('widget');
          });
        }}
      />
    );
  }

  const providerLabel = config?.provider ?? 'not configured';

  return (
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
            onClick={() => setView('settings')}
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

      <main className="body">
        {hasResult ? (
          <>
            <div
              className="original-text"
              title="Click to edit"
              onClick={() => {
                setText(original);
                handleReset();
              }}
            >
              {original}
            </div>
            <div className="result-area" aria-live="polite">
              <p className="result-text">
                {output}
                {busy && <span className="cursor" aria-hidden="true" />}
              </p>
            </div>
          </>
        ) : (
          <div className="input-area">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type text here..."
              autoFocus
              spellCheck={false}
            />
          </div>
        )}
      </main>

      <div className="actions">
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
        <span className="provider-badge">{providerLabel}</span>
      </footer>
    </div>
  );
}
