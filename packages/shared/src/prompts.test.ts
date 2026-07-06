import { describe, it, expect } from 'vitest';
import { parsePromptsMarkdown, FALLBACK_SYSTEM_PROMPTS } from './prompts.js';
import { ACTIONS } from './types.js';

describe('parsePromptsMarkdown', () => {
  const validMd = ACTIONS.map((a) => `## ${a}\nPrompt for ${a}`).join('\n\n');

  it('parses all action sections', () => {
    const result = parsePromptsMarkdown(validMd);
    for (const action of ACTIONS) {
      expect(result[action]).toBe(`Prompt for ${action}`);
    }
  });

  it('handles CRLF line endings', () => {
    const crlf = validMd.replace(/\n/g, '\r\n');
    const result = parsePromptsMarkdown(crlf);
    for (const action of ACTIONS) {
      expect(result[action]).toBe(`Prompt for ${action}`);
    }
  });

  it('throws on missing section', () => {
    const partial = '## grammar\nFix text';
    expect(() => parsePromptsMarkdown(partial)).toThrow('Missing prompt section');
  });

  it('throws on empty section body', () => {
    const withEmpty = ACTIONS.map((a) =>
      a === 'shorten' ? `## ${a}\n` : `## ${a}\nContent for ${a}`
    ).join('\n\n');
    expect(() => parsePromptsMarkdown(withEmpty)).toThrow('Empty prompt section');
  });

  it('handles multiline prompt bodies', () => {
    const multiline = ACTIONS.map((a) => `## ${a}\nLine 1\nLine 2\nLine 3`).join('\n\n');
    const result = parsePromptsMarkdown(multiline);
    expect(result.grammar).toBe('Line 1\nLine 2\nLine 3');
  });

  it('ignores unknown sections', () => {
    const withExtra = `## unknown\nIgnored\n\n${validMd}`;
    const result = parsePromptsMarkdown(withExtra);
    expect(result.grammar).toBe('Prompt for grammar');
  });

  it('handles UTF-8 content in prompts', () => {
    const utf8 = ACTIONS.map((a) => `## ${a}\nПеревести текст 🌍`).join('\n\n');
    const result = parsePromptsMarkdown(utf8);
    expect(result.translate).toBe('Перевести текст 🌍');
  });
});

describe('FALLBACK_SYSTEM_PROMPTS', () => {
  it('has prompts for all actions', () => {
    for (const action of ACTIONS) {
      expect(FALLBACK_SYSTEM_PROMPTS[action]).toBeTruthy();
      expect(FALLBACK_SYSTEM_PROMPTS[action].length).toBeGreaterThan(50);
    }
  });
});
