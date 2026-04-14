import { useCallback, useEffect, useState, type JSX } from 'react';
import type { Action, AppConfig, Provider } from '@textpilot/shared';
import { ACTIONS, DEFAULT_CONFIG } from '@textpilot/shared';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { HotkeyRecorder } from './HotkeyRecorder.js';
import { loadConfig, saveConfig } from './storage.js';

const LOG = '[desktop/Settings]';

interface Props {
  onClose: () => void;
}

const ACTION_LABEL: Record<Action, string> = {
  grammar: 'Fix grammar',
  rewrite: 'Rewrite',
  shorten: 'Shorten',
  bullets: 'Bullets',
  translate: 'Translate',
};

export function Settings({ onClose }: Props): JSX.Element {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void loadConfig().then(setConfig);
  }, []);

  const update = <K extends keyof AppConfig>(key: K, value: AppConfig[K]): void => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleCloseWindow = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (err) {
      console.error(`${LOG} Close failed`, err);
    }
  }, []);

  const handleSave = async (): Promise<void> => {
    setStatus('saving...');
    try {
      await saveConfig(config);
      setStatus('saved');
      setTimeout(() => setStatus(''), 1500);
    } catch (err) {
      console.error(`${LOG} Save failed`, err);
      setStatus('save failed');
    }
  };

  return (
    <div className="window">
      <header className="header" data-tauri-drag-region>
        <span className="app-badge">Settings</span>
        <div className="header-right">
          <button
            type="button"
            className="icon-chip"
            onClick={onClose}
            title="Back"
            aria-label="Back"
          >
            ‹
          </button>
          <button
            type="button"
            className="close-btn"
            onClick={() => void handleCloseWindow()}
            title="Close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </header>

      <div className="settings-body">
        <div className="field">
          <span className="field-label">Provider</span>
          <select
            value={config.provider}
            onChange={(e) => update('provider', e.target.value as Provider)}
          >
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">OpenAI (GPT)</option>
          </select>
        </div>

        <div className="field">
          <span className="field-label">API Key</span>
          <input
            type="password"
            value={config.apiKey}
            autoComplete="off"
            onChange={(e) => update('apiKey', e.target.value)}
            placeholder="sk-..."
          />
        </div>

        <div className="field">
          <span className="field-label">Default Action</span>
          <select
            value={config.defaultAction}
            onChange={(e) => update('defaultAction', e.target.value as Action)}
          >
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {ACTION_LABEL[action]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field-label">Hotkey Trigger</span>
          <HotkeyRecorder
            value={config.hotkeys.trigger}
            onChange={(trigger) => update('hotkeys', { ...config.hotkeys, trigger })}
          />
        </div>

        <label className="field-checkbox">
          <input
            type="checkbox"
            checked={config.showUI}
            onChange={(e) => update('showUI', e.target.checked)}
          />
          Show popup on hotkey (off = silent clipboard mode)
        </label>

        <label className="field-checkbox">
          <input
            type="checkbox"
            checked={config.trayEnabled}
            onChange={(e) => update('trayEnabled', e.target.checked)}
          />
          Tray icon enabled
        </label>

        <div className="settings-footer">
          <button type="button" className="save-btn" onClick={() => void handleSave()}>
            Save
          </button>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
          <span className="save-status">{status}</span>
        </div>
      </div>
    </div>
  );
}
