import type { Action, AppConfig, HotkeyMap, Provider } from '@textpilot/shared';
import { ACTIONS, DEFAULT_CONFIG } from '@textpilot/shared';
import { load } from '@tauri-apps/plugin-store';

const LOG = '[desktop/storage]';
const STORE_FILE = 'textpilot.config.json';
const CONFIG_KEY = 'config';

function isProvider(v: unknown): v is Provider {
  return v === 'claude' || v === 'openai';
}

function isAction(v: unknown): v is Action {
  return ACTIONS.includes(v as Action);
}

function normalizeHotkeys(raw: unknown): HotkeyMap {
  const d = DEFAULT_CONFIG.hotkeys;
  if (!raw || typeof raw !== 'object') return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    trigger: typeof o.trigger === 'string' ? o.trigger : d.trigger,
    quickAction: typeof o.quickAction === 'string' ? o.quickAction : undefined,
    grammar: typeof o.grammar === 'string' ? o.grammar : undefined,
    rewrite: typeof o.rewrite === 'string' ? o.rewrite : undefined,
    shorten: typeof o.shorten === 'string' ? o.shorten : undefined,
    bullets: typeof o.bullets === 'string' ? o.bullets : undefined,
    translate: typeof o.translate === 'string' ? o.translate : undefined,
    format: typeof o.format === 'string' ? o.format : undefined,
  };
}

function normalizeConfig(raw: unknown): AppConfig {
  const d = DEFAULT_CONFIG;
  if (!raw || typeof raw !== 'object') return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    provider: isProvider(o.provider) ? o.provider : d.provider,
    apiKey: '',
    defaultAction: isAction(o.defaultAction) ? o.defaultAction : d.defaultAction,
    showUI: typeof o.showUI === 'boolean' ? o.showUI : d.showUI,
    hotkeys: normalizeHotkeys(o.hotkeys),
    trayEnabled: typeof o.trayEnabled === 'boolean' ? o.trayEnabled : d.trayEnabled,
    autoRunOnPaste: typeof o.autoRunOnPaste === 'boolean' ? o.autoRunOnPaste : d.autoRunOnPaste,
    autoCopyResult: typeof o.autoCopyResult === 'boolean' ? o.autoCopyResult : d.autoCopyResult,
  };
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
    const raw = await store.get<unknown>(CONFIG_KEY);
    return normalizeConfig(raw);
  } catch (err) {
    console.error(`${LOG} Failed to load config`, err);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
    const { apiKey: _, ...safeConfig } = config;
    await store.set(CONFIG_KEY, safeConfig);
    await store.save();
    console.log(`${LOG} Config saved`);
  } catch (err) {
    console.error(`${LOG} Failed to save config`, err);
    throw err;
  }
}

interface WindowSize {
  width: number;
  height: number;
}

const WINDOW_SIZE_KEY = 'windowSize';
const MIN_W = 280;
const MAX_W = 1200;
const MIN_H = 150;
const MAX_H = 800;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export async function loadWindowSize(): Promise<WindowSize | null> {
  try {
    const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
    const raw = await store.get<WindowSize>(WINDOW_SIZE_KEY);
    if (!raw) return null;
    return {
      width: clamp(raw.width, MIN_W, MAX_W),
      height: clamp(raw.height, MIN_H, MAX_H),
    };
  } catch (err) {
    console.error(`${LOG} Failed to load window size`, err);
    return null;
  }
}

export async function saveWindowSize(width: number, height: number): Promise<void> {
  try {
    const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
    await store.set(WINDOW_SIZE_KEY, { width, height });
    await store.save();
  } catch (err) {
    console.error(`${LOG} Failed to save window size`, err);
  }
}
