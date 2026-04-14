import type { AppConfig } from '@textpilot/shared';
import { DEFAULT_CONFIG } from '@textpilot/shared';
import { load } from '@tauri-apps/plugin-store';

const LOG = '[desktop/storage]';
const STORE_FILE = 'textpilot.config.json';
const CONFIG_KEY = 'config';

export async function loadConfig(): Promise<AppConfig> {
  try {
    const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
    const value = await store.get<AppConfig>(CONFIG_KEY);
    if (!value) return { ...DEFAULT_CONFIG };
    return {
      ...DEFAULT_CONFIG,
      ...value,
      hotkeys: { ...DEFAULT_CONFIG.hotkeys, ...value.hotkeys },
    };
  } catch (err) {
    console.error(`${LOG} Failed to load config`, err);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
    await store.set(CONFIG_KEY, config);
    await store.save();
    console.log(`${LOG} Config saved`);
  } catch (err) {
    console.error(`${LOG} Failed to save config`, err);
    throw err;
  }
}
