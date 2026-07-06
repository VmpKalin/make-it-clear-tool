export function matchesHotkey(e: Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey' | 'code'>, hotkey: string): boolean {
  if (!hotkey) return false;
  const parts = hotkey.split('+').map((s) => s.trim().toLowerCase());
  const ctrlNeeded = parts.includes('ctrl');
  const shiftNeeded = parts.includes('shift');
  const altNeeded = parts.includes('alt');
  const metaNeeded = parts.includes('meta');
  const mainKey = parts.find((p) => !['ctrl', 'shift', 'alt', 'meta'].includes(p));
  if (!mainKey) return false;
  if (e.ctrlKey !== ctrlNeeded || e.shiftKey !== shiftNeeded || e.altKey !== altNeeded || e.metaKey !== metaNeeded) return false;
  let code = e.code;
  if (code.startsWith('Key')) code = code.slice(3).toLowerCase();
  else if (code.startsWith('Digit')) code = code.slice(5);
  else code = code.toLowerCase();
  return code === mainKey;
}

export function stripCodeFences(text: string): string {
  let s = text.trim();
  if (!s.startsWith('```')) return s;
  const firstNl = s.indexOf('\n');
  if (firstNl === -1) return s;
  s = s.slice(firstNl + 1);
  if (s.trimEnd().endsWith('```')) {
    s = s.slice(0, s.lastIndexOf('```'));
  }
  return s.trim();
}

export function parseError(raw: string): { message: string; authRelated: boolean } {
  const lower = raw.toLowerCase();
  if (lower.includes('api key is missing') || lower.includes('key is missing'))
    return { message: 'API key missing. Set it in Settings.', authRelated: true };
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid.*key'))
    return { message: 'Invalid API key. Check your key in Settings.', authRelated: true };
  if (lower.includes('429') || lower.includes('rate limit'))
    return { message: 'Rate limit reached. Try again in a moment.', authRelated: false };
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connect') || lower.includes('dns') || lower.includes('timeout'))
    return { message: 'No connection. Check your internet.', authRelated: false };
  if (lower.includes('403') || lower.includes('forbidden'))
    return { message: 'Access denied. Check your API key permissions.', authRelated: true };
  if (lower.includes('500') || lower.includes('internal server'))
    return { message: 'Provider error. Try again in a moment.', authRelated: false };
  if (lower.includes('truncated') || lower.includes('token limit'))
    return { message: 'Response truncated — review before using.', authRelated: false };
  return { message: 'Something went wrong. Try again.', authRelated: false };
}

export function cornerOrigin(relX: number, relY: number, w: number, h: number): string {
  const left = relX < w / 2;
  const top = relY < h / 2;
  return `${left ? 'left' : 'right'} ${top ? 'top' : 'bottom'}`;
}
