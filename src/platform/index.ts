import type { RuntimeResponse } from './protocol';

export async function startRecording(
  targetTabId: number,
  streamId?: string,
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
