/** Serializable messages shared by the popup, worker, offscreen page, and content script. */
export type RecordingSessionMarker = {
  id: string;
  requestedAt: number;
  startedAt: number | null;
  targetTabId: number;
  mediaKey: string;
  eventKey: string;
  mimeType: string | null;
  finalized: false;
};

export type SerializedEventLog = {
  epochMs: number;
  cursor: number[];
  clicks: Array<{ t: number; x: number; y: number; button: number }>;
  keyMarks: number[];
  scroll: Array<{ t: number; x: number; y: number }>;
  viewport: Array<{ t: number; w: number; h: number }>;
  blurIntervals: Array<{ start: number; end: number }>;
  syncMarkers: number[];
};

export type RuntimeMessage =
  | {
      type: 'START_RECORDING';
      targetTabId: number;
      streamId: string;
      countdownMs?: number;
    }
  | { type: 'STOP_RECORDING' }
  | { type: 'RECORDING_STATUS' }
  | {
      type: 'OFFSCREEN_START';
      session: RecordingSessionMarker;
      streamId: string;
      countdownMs: number;
    }
  | { type: 'OFFSCREEN_STOP' }
  | { type: 'OFFSCREEN_READY' }
  | {
      type: 'OFFSCREEN_RECORDING_STARTED';
      sessionId: string;
      epochMs: number;
      mimeType: string;
    }
  | {
      type: 'OFFSCREEN_FINALIZED';
      sessionId: string;
      durationSec: number;
    }
  | { type: 'OFFSCREEN_FAILED'; sessionId: string; error: string }
  | { type: 'COLLECTOR_START'; epochMs: number }
  | { type: 'COLLECTOR_STOP' };

export type RuntimeResponse =
  | {
      ok: true;
      state: 'idle' | 'starting' | 'recording' | 'stopped';
      sessionId?: string;
      session?: RecordingSessionMarker;
    }
  | {
      ok: false;
      error: string;
      code?: 'QUOTA' | 'UNSUPPORTED' | 'NO_SESSION' | 'PERMISSION';
    };

export const SESSION_STORAGE_KEY = 'recordingSession';
export const LAST_RECORDING_STORAGE_KEY = 'lastRecording';

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case 'START_RECORDING':
      return (
        typeof message.targetTabId === 'number' &&
        typeof message.streamId === 'string'
      );
    case 'OFFSCREEN_START':
      return (
        typeof message.session === 'object' &&
        message.session !== null &&
        'id' in message.session &&
        typeof message.session.id === 'string' &&
        typeof message.streamId === 'string' &&
        typeof message.countdownMs === 'number'
      );
    case 'OFFSCREEN_RECORDING_STARTED':
      return (
        typeof message.sessionId === 'string' &&
        typeof message.epochMs === 'number' &&
        typeof message.mimeType === 'string'
      );
    case 'OFFSCREEN_FINALIZED':
      return (
        typeof message.sessionId === 'string' &&
        typeof message.durationSec === 'number'
      );
    case 'OFFSCREEN_FAILED':
      return (
        typeof message.sessionId === 'string' &&
        typeof message.error === 'string'
      );
    case 'COLLECTOR_START':
      return typeof message.epochMs === 'number';
    case 'STOP_RECORDING':
    case 'RECORDING_STATUS':
    case 'OFFSCREEN_STOP':
    case 'OFFSCREEN_READY':
    case 'COLLECTOR_STOP':
      return true;
    default:
      return false;
  }
}
