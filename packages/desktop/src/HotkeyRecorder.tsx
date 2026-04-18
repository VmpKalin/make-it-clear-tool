import { useCallback, useEffect, useRef, useState, type JSX } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

function normalizeCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

function collectModifiers(e: KeyboardEvent): string[] {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push('Ctrl');
  if (e.shiftKey) mods.push('Shift');
  if (e.altKey) mods.push('Alt');
  if (e.metaKey) mods.push('Meta');
  return mods;
}

function parseChips(value: string): string[] {
  return value
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function HotkeyRecorder({ value, onChange }: Props): JSX.Element {
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState<string[]>([]);
  const committedRef = useRef<string | null>(null);

  const stopRecording = useCallback(() => {
    setRecording(false);
    setPreview([]);
    committedRef.current = null;
  }, []);

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        stopRecording();
        return;
      }

      if (MODIFIER_KEYS.has(e.key)) {
        setPreview(collectModifiers(e));
        return;
      }

      const main = normalizeCode(e.code);
      if (!main) return;
      const combo = [...collectModifiers(e), main].join('+');
      committedRef.current = combo;
      setPreview(parseChips(combo));
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      e.preventDefault();
      if (committedRef.current) {
        onChange(committedRef.current);
        stopRecording();
        return;
      }
      if (MODIFIER_KEYS.has(e.key)) {
        setPreview(collectModifiers(e));
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [recording, onChange, stopRecording]);

  const startRecording = useCallback(() => {
    committedRef.current = null;
    setPreview([]);
    setRecording(true);
  }, []);

  const chips = recording ? preview : parseChips(value);
  const showPlaceholder = chips.length === 0;

  return (
    <button
      type="button"
      className={`hotkey-recorder${recording ? ' recording' : ''}`}
      onClick={() => {
        if (!recording) startRecording();
      }}
      aria-label="Record hotkey"
    >
      {showPlaceholder ? (
        <span className="hotkey-placeholder">
          {recording ? 'Press keys...' : 'Not set'}
        </span>
      ) : (
        chips.map((chip, i) => (
          <span key={`${chip}-${i}`} className="hotkey-chip">
            {chip}
          </span>
        ))
      )}
    </button>
  );
}
