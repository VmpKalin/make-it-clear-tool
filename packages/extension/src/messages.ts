import type { Action } from '@textpilot/shared';

export type RuntimeMessage =
  | { kind: 'run-action'; text: string; action: Action }
  | { kind: 'get-selection' }
  | { kind: 'stream-chunk'; requestId: string; chunk: string }
  | { kind: 'stream-done'; requestId: string; result: string }
  | { kind: 'stream-error'; requestId: string; error: string };

export interface GetSelectionResponse {
  text: string;
}

export interface RunActionResponse {
  requestId: string;
}
