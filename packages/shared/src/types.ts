export type Action = 'grammar' | 'rewrite' | 'shorten' | 'bullets' | 'translate';

export type Provider = 'claude' | 'openai';

export const ACTIONS: readonly Action[] = [
  'grammar',
  'rewrite',
  'shorten',
  'bullets',
  'translate',
] as const;

export interface HotkeyMap {
  trigger: string;
  grammar?: string;
  rewrite?: string;
  shorten?: string;
  bullets?: string;
  translate?: string;
}

export interface AppConfig {
  provider: Provider;
  apiKey: string;
  defaultAction: Action;
  showUI: boolean;
  hotkeys: HotkeyMap;
  trayEnabled: boolean;
  autoRunOnPaste: boolean;
}

export interface ActionResult {
  original: string;
  result: string;
  action: Action;
}

export interface RunActionParams {
  text: string;
  action: Action;
  config: AppConfig;
  systemPrompt: string;
  signal?: AbortSignal;
}

export class ProviderError extends Error {
  readonly provider: Provider;
  readonly status?: number;

  constructor(provider: Provider, message: string, status?: number, cause?: unknown) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
    this.provider = provider;
    this.status = status;
    this.cause = cause;
  }
}

export const DEFAULT_CONFIG: AppConfig = {
  provider: 'claude',
  apiKey: '',
  defaultAction: 'grammar',
  showUI: false,
  hotkeys: {
    trigger: 'Ctrl+Shift+Space',
  },
  trayEnabled: true,
  autoRunOnPaste: false,
};
