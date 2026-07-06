import { readFile } from 'node:fs/promises';
import type { SystemPrompts } from './prompts.js';
import { parsePromptsMarkdown } from './prompts.js';

const LOG = '[shared/prompts]';

export async function loadPromptsFromDisk(filePath: string): Promise<SystemPrompts> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const prompts = parsePromptsMarkdown(raw);
    console.log(`${LOG} Loaded prompts from ${filePath}`);
    return prompts;
  } catch (cause) {
    console.error(`${LOG} Failed to load prompts from ${filePath}`, cause);
    throw new Error(`${LOG} Could not load prompts.md from ${filePath}`);
  }
}
