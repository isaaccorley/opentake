import type { RuntimeResponse } from './protocol';

/** Stable UI-facing API; callers never need to know which MV3 context handles a request. */
export async function startRecording(
  targetTabId: number,
  streamId: string,
  countdownMs = 0,
): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage({
    type: 'START_RECORDING',
    targetTabId,
    streamId,
    countdownMs,
  });
}

export async function stopRecording(): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
}

export async function recordingStatus(): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage({ type: 'RECORDING_STATUS' });
}

export { probeExportCapabilities } from './export-capabilities';
export { createOpfsStore, OpfsQuotaError, OpfsStore } from './opfs';
export type {
  RuntimeMessage,
  RuntimeResponse,
  RecordingSessionMarker,
  SerializedEventLog,
} from './protocol';
