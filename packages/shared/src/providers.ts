import type { RunActionParams } from './types.js';
import { ProviderError } from './types.js';
import { getSystemPrompt } from './prompts.js';

const LOG = '[shared/providers]';

const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export const CLAUDE_MODEL = 'claude-haiku-4-5';
export const OPENAI_MODEL = 'gpt-4o-mini';

export const MAX_TOKENS = 2048;

export async function* runAction(params: RunActionParams): AsyncIterable<string> {
  const { text, action, config, systemPrompt, signal } = params;
  if (!config.apiKey) {
    throw new ProviderError(config.provider, 'API key is missing');
  }
  const prompt = systemPrompt || getSystemPrompt(action);
  console.log(`${LOG} Streaming with provider=${config.provider} action=${action}`);

  if (config.provider === 'claude') {
    yield* streamClaude(text, prompt, config.apiKey, signal);
    return;
  }
  if (config.provider === 'openai') {
    yield* streamOpenAI(text, prompt, config.apiKey, signal);
    return;
  }
  throw new ProviderError(config.provider, `Unknown provider "${config.provider as string}"`);
}

async function* streamClaude(
  text: string,
  systemPrompt: string,
  apiKey: string,
  signal?: AbortSignal,
): AsyncIterable<string> {
  let response: Response;
  try {
    response = await fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        stream: true,
        messages: [{ role: 'user', content: text }],
      }),
      signal,
    });
  } catch (cause) {
    throw new ProviderError('claude', 'Network error during request', undefined, cause);
  }

  if (!response.ok || !response.body) {
    const body = await safeReadError(response);
    throw new ProviderError('claude', `HTTP ${response.status}: ${body}`, response.status);
  }

  for await (const event of iterateSse(response.body)) {
    if (!event.data || event.data === '[DONE]') continue;
    try {
      const json = JSON.parse(event.data) as ClaudeStreamEvent;
      if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
        const chunk = json.delta.text ?? '';
        if (chunk) yield chunk;
      } else if (json.type === 'message_stop') {
        return;
      } else if (json.type === 'error') {
        throw new ProviderError('claude', json.error?.message ?? 'Unknown stream error');
      }
    } catch (cause) {
      if (cause instanceof ProviderError) throw cause;
      console.error(`${LOG} Failed to parse Claude SSE chunk`, event.data, cause);
    }
  }
}

async function* streamOpenAI(
  text: string,
  systemPrompt: string,
  apiKey: string,
  signal?: AbortSignal,
): AsyncIterable<string> {
  let response: Response;
  try {
    response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
      signal,
    });
  } catch (cause) {
    throw new ProviderError('openai', 'Network error during request', undefined, cause);
  }

  if (!response.ok || !response.body) {
    const body = await safeReadError(response);
    throw new ProviderError('openai', `HTTP ${response.status}: ${body}`, response.status);
  }

  for await (const event of iterateSse(response.body)) {
    if (!event.data) continue;
    if (event.data === '[DONE]') return;
    try {
      const json = JSON.parse(event.data) as OpenAIStreamEvent;
      const chunk = json.choices?.[0]?.delta?.content ?? '';
      if (chunk) yield chunk;
    } catch (cause) {
      console.error(`${LOG} Failed to parse OpenAI SSE chunk`, event.data, cause);
    }
  }
}

async function safeReadError(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '<unreadable body>';
  }
}

interface SseEvent {
  event?: string;
  data: string;
}

async function* iterateSse(body: ReadableStream<Uint8Array>): AsyncIterable<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        yield parseSseEvent(rawEvent);
      }
    }
    if (buffer.trim()) {
      yield parseSseEvent(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseEvent(raw: string): SseEvent {
  const out: SseEvent = { data: '' };
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      out.event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  out.data = dataLines.join('\n');
  return out;
}

interface ClaudeStreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
  error?: { message?: string };
}

interface OpenAIStreamEvent {
  choices?: Array<{ delta?: { content?: string } }>;
}
