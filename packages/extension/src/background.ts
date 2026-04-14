import type { Action, AppConfig, SystemPrompts } from '@textpilot/shared';
import {
  runAction,
  getSystemPrompt,
  parsePromptsMarkdown,
  FALLBACK_SYSTEM_PROMPTS,
} from '@textpilot/shared';
import { loadConfig } from './config.js';
import type { RuntimeMessage } from './messages.js';

const LOG = '[extension/background]';

let cachedPrompts: SystemPrompts | null = null;

async function getPrompts(): Promise<SystemPrompts> {
  if (cachedPrompts) return cachedPrompts;
  try {
    const url = chrome.runtime.getURL('prompts.md');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedPrompts = parsePromptsMarkdown(await res.text());
    console.log(`${LOG} Prompts loaded from bundled prompts.md`);
  } catch (err) {
    console.error(`${LOG} Falling back to inline prompts`, err);
    cachedPrompts = { ...FALLBACK_SYSTEM_PROMPTS };
  }
  return cachedPrompts;
}

function actionFromCommand(command: string): Action | null {
  switch (command) {
    case 'run-grammar':
      return 'grammar';
    case 'run-rewrite':
      return 'rewrite';
    case 'run-shorten':
      return 'shorten';
    case 'run-bullets':
      return 'bullets';
    case 'run-translate':
      return 'translate';
    default:
      return null;
  }
}

async function notify(title: string, message: string): Promise<void> {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title,
      message,
    });
  } catch (err) {
    console.warn(`${LOG} Notification failed`, err);
  }
}

async function requestSelectionFromActiveTab(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  const response = await chrome.tabs.sendMessage<RuntimeMessage, { text: string }>(tab.id, {
    kind: 'get-selection',
  });
  return response?.text ?? '';
}

async function writeToClipboard(text: string): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab for clipboard write');
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (value: string) => {
      void navigator.clipboard.writeText(value);
    },
    args: [text],
  });
}

async function executeAction(text: string, action: Action, config: AppConfig): Promise<string> {
  const prompts = await getPrompts();
  const systemPrompt = getSystemPrompt(action, prompts);

  let buffer = '';
  try {
    for await (const chunk of runAction({ text, action, config, systemPrompt })) {
      buffer += chunk;
    }
  } catch (err) {
    console.error(`${LOG} Provider stream failed`, err);
    throw err;
  }
  return buffer;
}

async function runFlow(action: Action): Promise<void> {
  console.log(`${LOG} Running action=${action}`);
  try {
    const config = await loadConfig();
    if (!config.apiKey) {
      await notify('TextPilot', 'Set your API key in the extension options.');
      await chrome.runtime.openOptionsPage();
      return;
    }
    const text = await requestSelectionFromActiveTab();
    if (!text.trim()) {
      await notify('TextPilot', 'Select some text first.');
      return;
    }
    const result = await executeAction(text, action, config);
    await writeToClipboard(result);
    await notify('TextPilot — Done', 'Result copied. Ctrl+V to paste.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${LOG} runFlow failed`, err);
    await notify('TextPilot — Error', message);
  }
}

chrome.commands.onCommand.addListener((command) => {
  console.log(`${LOG} Hotkey triggered: ${command}`);
  void (async () => {
    const config = await loadConfig();
    if (command === 'run-default-action') {
      await runFlow(config.defaultAction);
      return;
    }
    const action = actionFromCommand(command);
    if (action) await runFlow(action);
  })();
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.kind === 'run-action') {
    void (async () => {
      try {
        const config = await loadConfig();
        const result = await executeAction(message.text, message.action, config);
        await writeToClipboard(result);
        sendResponse({ ok: true, result });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        sendResponse({ ok: false, error });
      }
    })();
    return true;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log(`${LOG} Installed`);
  void getPrompts();
});
