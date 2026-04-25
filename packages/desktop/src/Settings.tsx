import { useCallback, useEffect, useState, type JSX } from 'react';
import type { Action, AppConfig, Provider } from '@textpilot/shared';
import { ACTIONS, ACTION_LABELS, DEFAULT_CONFIG } from '@textpilot/shared';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { HotkeyRecorder } from './HotkeyRecorder.js';
import { loadConfig, saveConfig } from './storage.js';

const LOG = '[desktop/Settings]';

interface Props {
  onClose: () => void;
}

export function Settings({ onClose }: Props): JSX.Element {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void loadConfig().then(setConfig);
  }, []);

  const update = <K extends keyof AppConfig>(key: K, value: AppConfig[K]): void => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const updateActionHotkey = (action: Action, value: string | undefined): void => {
    setConfig((prev) => ({
      ...prev,
      hotkeys: {
        ...prev.hotkeys,
        [action]: value,
      },
    }));
  };

  const handleCloseWindow = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.hide();
    } catch (err) {
      console.error(`${LOG} Hide failed`, err);
    }
  }, []);

  const handleSave = async (): Promise<void> => {
    setStatus('saving...');
    try {
      await invoke('update_hotkeys', { hotkeys: config.hotkeys });
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
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 2L3.5 6L7.5 10" />
            </svg>
          </button>
          <button
            type="button"
            className="close-btn"
            onClick={() => void handleCloseWindow()}
            title="Close"
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
              <path d="M2 2L8 8M8 2L2 8" />
            </svg>
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
                {ACTION_LABELS[action]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field-label">Open Window</span>
          <HotkeyRecorder
            value={config.hotkeys.trigger}
            onChange={(trigger) => update('hotkeys', { ...config.hotkeys, trigger })}
          />
        </div>

        <div className="field">
          <span className="field-label">Quick Action</span>
          <HotkeyRecorder
            value={config.hotkeys.quickAction ?? ''}
            onChange={(quickAction) => update('hotkeys', { ...config.hotkeys, quickAction: quickAction || undefined })}
          />
          <span className="field-sub-label">Grabs selected text, runs default action, copies result to clipboard</span>
        </div>

        <div className="field">
          <span className="field-label">Action Hotkeys</span>
          <div className="hotkey-settings-list">
            {ACTIONS.map((action) => (
              <div key={action} className="hotkey-setting-row">
                <span className="hotkey-setting-label">{ACTION_LABELS[action]}</span>
                <div className="hotkey-setting-controls">
                  <HotkeyRecorder
                    value={config.hotkeys[action] ?? ''}
                    onChange={(value) => updateActionHotkey(action, value)}
                  />
                  <button
                    type="button"
                    className="ghost-btn hotkey-clear-btn"
                    onClick={() => updateActionHotkey(action, undefined)}
                    disabled={!config.hotkeys[action]}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))}
          </div>
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
            checked={config.autoRunOnPaste}
            onChange={(e) => update('autoRunOnPaste', e.target.checked)}
          />
          Auto-run default action on paste
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
