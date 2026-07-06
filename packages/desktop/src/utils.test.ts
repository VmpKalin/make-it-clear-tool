import { describe, it, expect } from 'vitest';
import { matchesHotkey, stripCodeFences, parseError, cornerOrigin } from './utils.js';

describe('matchesHotkey', () => {
  const makeEvent = (code: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {}) => ({
    code,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.shift ?? false,
    altKey: mods.alt ?? false,
    metaKey: mods.meta ?? false,
  });

  it('matches Ctrl+Shift+B', () => {
    const e = makeEvent('KeyB', { ctrl: true, shift: true });
    expect(matchesHotkey(e, 'Ctrl+Shift+B')).toBe(true);
  });

  it('rejects when modifier is missing', () => {
    const e = makeEvent('KeyB', { ctrl: true });
    expect(matchesHotkey(e, 'Ctrl+Shift+B')).toBe(false);
  });

  it('rejects extra modifiers', () => {
    const e = makeEvent('KeyB', { ctrl: true, shift: true, alt: true });
    expect(matchesHotkey(e, 'Ctrl+Shift+B')).toBe(false);
  });

  it('matches digit keys', () => {
    const e = makeEvent('Digit1', { ctrl: true });
    expect(matchesHotkey(e, 'Ctrl+1')).toBe(true);
  });

  it('is case-insensitive in hotkey string', () => {
    const e = makeEvent('KeyA', { ctrl: true });
    expect(matchesHotkey(e, 'ctrl+a')).toBe(true);
    expect(matchesHotkey(e, 'CTRL+A')).toBe(true);
  });

  it('returns false for empty hotkey', () => {
    const e = makeEvent('KeyA', { ctrl: true });
    expect(matchesHotkey(e, '')).toBe(false);
  });

  it('returns false for modifier-only hotkey', () => {
    const e = makeEvent('ControlLeft', { ctrl: true });
    expect(matchesHotkey(e, 'Ctrl')).toBe(false);
  });

  it('handles Meta modifier', () => {
    const e = makeEvent('KeyC', { meta: true });
    expect(matchesHotkey(e, 'Meta+C')).toBe(true);
  });

  it('handles non-Key/Digit codes', () => {
    const e = makeEvent('Space', { ctrl: true });
    expect(matchesHotkey(e, 'Ctrl+space')).toBe(true);
  });
});

describe('stripCodeFences', () => {
  it('returns plain text unchanged', () => {
    expect(stripCodeFences('hello world')).toBe('hello world');
  });

  it('strips fences with language tag', () => {
    expect(stripCodeFences('```ts\nconst x = 1;\n```')).toBe('const x = 1;');
  });

  it('strips fences without language tag', () => {
    expect(stripCodeFences('```\ncontent\n```')).toBe('content');
  });

  it('handles unclosed fences', () => {
    expect(stripCodeFences('```js\ncode here')).toBe('code here');
  });

  it('handles fences with no newline', () => {
    expect(stripCodeFences('```')).toBe('```');
  });

  it('trims surrounding whitespace', () => {
    expect(stripCodeFences('  hello  ')).toBe('hello');
  });

  it('handles empty input', () => {
    expect(stripCodeFences('')).toBe('');
  });

  it('preserves multi-byte UTF-8', () => {
    expect(stripCodeFences('```\nтест 🎉\n```')).toBe('тест 🎉');
  });

  it('handles multiple code blocks (only strips outer)', () => {
    const input = '```\ninner ```block``` here\n```';
    const result = stripCodeFences(input);
    expect(result).toContain('inner');
  });
});

describe('parseError', () => {
  it('detects 401 as auth-related', () => {
    const result = parseError('HTTP 401: Unauthorized');
    expect(result.authRelated).toBe(true);
    expect(result.message).toContain('API key');
  });

  it('detects rate limit', () => {
    const result = parseError('429 rate limit exceeded');
    expect(result.authRelated).toBe(false);
    expect(result.message).toContain('Rate limit');
  });

  it('detects network errors', () => {
    const result = parseError('NetworkError: Failed to fetch');
    expect(result.authRelated).toBe(false);
    expect(result.message).toContain('connection');
  });

  it('detects 403 as auth-related', () => {
    const result = parseError('HTTP 403 Forbidden');
    expect(result.authRelated).toBe(true);
  });

  it('detects 500 server error', () => {
    const result = parseError('Internal Server Error 500');
    expect(result.authRelated).toBe(false);
    expect(result.message).toContain('Provider error');
  });

  it('returns generic message for unknown errors', () => {
    const result = parseError('something completely unexpected');
    expect(result.authRelated).toBe(false);
    expect(result.message).toContain('Something went wrong');
  });

  it('handles empty string', () => {
    const result = parseError('');
    expect(result.message).toBeTruthy();
  });

  it('detects truncation error', () => {
    const result = parseError('Response was truncated (hit token limit). The result may be incomplete.');
    expect(result.authRelated).toBe(false);
    expect(result.message).toContain('truncated');
  });
});

describe('cornerOrigin', () => {
  it('top-left corner', () => {
    expect(cornerOrigin(50, 50, 400, 200)).toBe('left top');
  });

  it('top-right corner', () => {
    expect(cornerOrigin(350, 50, 400, 200)).toBe('right top');
  });

  it('bottom-left corner', () => {
    expect(cornerOrigin(50, 150, 400, 200)).toBe('left bottom');
  });

  it('bottom-right corner', () => {
    expect(cornerOrigin(350, 150, 400, 200)).toBe('right bottom');
  });

  it('exact center goes to right bottom', () => {
    expect(cornerOrigin(200, 100, 400, 200)).toBe('right bottom');
  });
});
