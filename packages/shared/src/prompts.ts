import type { Action } from './types.js';
import { ACTIONS } from './types.js';

const LOG = '[shared/prompts]';

export type SystemPrompts = Record<Action, string>;

export const FALLBACK_SYSTEM_PROMPTS: SystemPrompts = {
  grammar:
    'You are a grammar correction assistant. Fix grammar, spelling, and punctuation errors in the given English text. Return ONLY the corrected text, no explanations, no quotes, no markdown.',
  rewrite:
    'You are a writing assistant. Rewrite the given English text to be clearer and more professional while preserving its meaning. Return ONLY the rewritten text, no explanations.',
  shorten:
    'You are a writing assistant. Shorten the given English text while preserving its key meaning. Return ONLY the shortened text, no explanations.',
  bullets:
    'You are a writing assistant. Convert the given English text into a concise bullet point list. Return ONLY the bullet points, no intro, no explanations.',
};

export function parsePromptsMarkdown(markdown: string): SystemPrompts {
  const lines = markdown.split(/\r?\n/);
  const buckets: Partial<Record<Action, string[]>> = {};
  let current: Action | null = null;

  for (const line of lines) {
    const header = /^##\s+([a-z]+)\s*$/i.exec(line);
    if (header && header[1]) {
      const slug = header[1].toLowerCase() as Action;
      if ((ACTIONS as readonly string[]).includes(slug)) {
        current = slug;
        buckets[current] = [];
      } else {
        current = null;
      }
      continue;
    }
    if (current) {
      buckets[current]?.push(line);
    }
  }

  const result: Partial<SystemPrompts> = {};
  for (const action of ACTIONS) {
    const body = buckets[action];
    if (!body) {
      throw new Error(`${LOG} Missing prompt section "## ${action}" in prompts.md`);
    }
    const text = body.join('\n').trim();
    if (!text) {
      throw new Error(`${LOG} Empty prompt section "## ${action}" in prompts.md`);
    }
    result[action] = text;
  }
  return result as SystemPrompts;
}

interface NodeFsPromises {
  readFile(path: string, encoding: 'utf8'): Promise<string>;
}

const dynamicImport = new Function('spec', 'return import(spec)') as (
  spec: string,
) => Promise<unknown>;

export async function loadPromptsFromDisk(filePath: string): Promise<SystemPrompts> {
  try {
    const mod = (await dynamicImport('node:fs/promises')) as NodeFsPromises;
    const raw = await mod.readFile(filePath, 'utf8');
    const prompts = parsePromptsMarkdown(raw);
    console.log(`${LOG} Loaded prompts from ${filePath}`);
    return prompts;
  } catch (cause) {
    console.error(`${LOG} Failed to load prompts from ${filePath}`, cause);
    throw new Error(`${LOG} Could not load prompts.md from ${filePath}`);
  }
}

export async function loadPromptsFromUrl(url: string): Promise<SystemPrompts> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const raw = await res.text();
    const prompts = parsePromptsMarkdown(raw);
    console.log(`${LOG} Loaded prompts from ${url}`);
    return prompts;
  } catch (cause) {
    console.error(`${LOG} Failed to load prompts from ${url}`, cause);
    throw new Error(`${LOG} Could not load prompts.md from ${url}`);
  }
}

export function getSystemPrompt(action: Action, overrides?: Partial<SystemPrompts>): string {
  return overrides?.[action] ?? FALLBACK_SYSTEM_PROMPTS[action];
}
