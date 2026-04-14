import type { Action, AppConfig } from '@textpilot/shared';
import { ACTIONS, DEFAULT_CONFIG } from '@textpilot/shared';

const LOG = '[extension/config]';
const STORAGE_KEY = 'textpilot.config.v1';

export async function loadConfig(): Promise<AppConfig> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const value = stored[STORAGE_KEY] as Partial<AppConfig> | undefined;
    if (!value) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...value, hotkeys: { ...DEFAULT_CONFIG.hotkeys, ...value.hotkeys } };
  } catch (err) {
    console.error(`${LOG} Failed to load config`, err);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
    console.log(`${LOG} Config saved`);
  } catch (err) {
    console.error(`${LOG} Failed to save config`, err);
    throw err;
  }
}

export function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value);
}
