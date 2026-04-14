import type { Action } from '@textpilot/shared';
import { isAction, loadConfig } from '../config.js';

const LOG = '[extension/popup]';

const input = document.getElementById('input') as HTMLTextAreaElement;
const output = document.getElementById('output') as HTMLPreElement;
const status = document.getElementById('status') as HTMLParagraphElement;
const openOptions = document.getElementById('open-options') as HTMLAnchorElement;
const buttons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('.actions button[data-action]'),
);

function setBusy(busy: boolean): void {
  for (const btn of buttons) btn.disabled = busy;
}

async function prefillFromActiveTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const res = await chrome.tabs.sendMessage<unknown, { text: string }>(tab.id, {
      kind: 'get-selection',
    });
    if (res?.text) {
      input.value = res.text;
    }
  } catch (err) {
    console.warn(`${LOG} Could not read selection from tab`, err);
  }
}

async function triggerAction(action: Action): Promise<void> {
  const text = input.value.trim();
  if (!text) {
    status.textContent = 'Type or select some text first.';
    return;
  }

  const config = await loadConfig();
  if (!config.apiKey) {
    status.textContent = 'Set your API key in Settings.';
    void chrome.runtime.openOptionsPage();
    return;
  }

  setBusy(true);
  output.textContent = '';
  status.textContent = `Running ${action}...`;

  try {
    const response = await chrome.runtime.sendMessage<
      { kind: 'run-action'; text: string; action: Action },
      { ok: true; result: string } | { ok: false; error: string }
    >({ kind: 'run-action', text, action });

    if (response?.ok) {
      output.textContent = response.result;
      status.textContent = 'Copied to clipboard.';
    } else {
      status.textContent = `Error: ${response?.error ?? 'unknown'}`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    status.textContent = `Error: ${message}`;
    console.error(`${LOG} Run failed`, err);
  } finally {
    setBusy(false);
  }
}

for (const btn of buttons) {
  btn.addEventListener('click', () => {
    const raw = btn.dataset.action ?? '';
    if (isAction(raw)) void triggerAction(raw);
  });
}

openOptions.addEventListener('click', (e) => {
  e.preventDefault();
  void chrome.runtime.openOptionsPage();
});

void prefillFromActiveTab();
