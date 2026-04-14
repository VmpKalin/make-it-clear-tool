import type { RuntimeMessage } from './messages.js';

const LOG = '[extension/content]';

function getCurrentSelection(): string {
  const active = document.activeElement as HTMLElement | null;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    const { selectionStart, selectionEnd, value } = active;
    if (selectionStart !== null && selectionEnd !== null && selectionEnd > selectionStart) {
      return value.slice(selectionStart, selectionEnd);
    }
  }
  return window.getSelection()?.toString() ?? '';
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.kind === 'get-selection') {
    const text = getCurrentSelection();
    console.log(`${LOG} Selection requested, length=${text.length}`);
    sendResponse({ text });
    return false;
  }
  return false;
});

console.log(`${LOG} Content script loaded on ${location.host}`);
