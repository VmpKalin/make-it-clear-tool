import type { Action, Provider } from '@textpilot/shared';
import { loadConfig, saveConfig } from '../config.js';

const LOG = '[extension/options]';

const providerEl = document.getElementById('provider') as HTMLSelectElement;
const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement;
const defaultActionEl = document.getElementById('defaultAction') as HTMLSelectElement;
const showUIEl = document.getElementById('showUI') as HTMLInputElement;
const hotkeyTriggerEl = document.getElementById('hotkeyTrigger') as HTMLInputElement;
const saveBtn = document.getElementById('save') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;

async function hydrate(): Promise<void> {
  const config = await loadConfig();
  providerEl.value = config.provider;
  apiKeyEl.value = config.apiKey;
  defaultActionEl.value = config.defaultAction;
  showUIEl.checked = config.showUI;
  hotkeyTriggerEl.value = config.hotkeys.trigger;
}

async function persist(): Promise<void> {
  statusEl.textContent = 'Saving...';
  try {
    const current = await loadConfig();
    await saveConfig({
      ...current,
      provider: providerEl.value as Provider,
      apiKey: apiKeyEl.value.trim(),
      defaultAction: defaultActionEl.value as Action,
      showUI: showUIEl.checked,
    });
    statusEl.textContent = 'Saved.';
    setTimeout(() => (statusEl.textContent = ''), 2000);
  } catch (err) {
    console.error(`${LOG} Save failed`, err);
    statusEl.textContent = 'Save failed.';
  }
}

saveBtn.addEventListener('click', () => {
  void persist();
});

void hydrate();
