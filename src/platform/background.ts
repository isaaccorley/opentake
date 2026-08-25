import contentScript from './content-script.iife.ts?script';
import { createOpfsStore } from './opfs';
import {
  isRuntimeMessage,
  LAST_RECORDING_STORAGE_KEY,
  type RecordingSessionMarker,
  type RuntimeMessage,
  type RuntimeResponse,
  SESSION_STORAGE_KEY,
  type SerializedEventLog,
} from './protocol';

const store = createOpfsStore();
let resolveOffscreenReady: (() => void) | undefined;

function isSerializedEventLog(
  value: unknown,
): value is { log: SerializedEventLog } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'log' in value &&
    typeof value.log === 'object' &&
    value.log !== null &&
    'cursor' in value.log &&
    Array.isArray(value.log.cursor)
  );
}

async function getSession(): Promise<RecordingSessionMarker | undefined> {
  const data = await chrome.storage.local.get(SESSION_STORAGE_KEY);
  return data[SESSION_STORAGE_KEY] as RecordingSessionMarker | undefined;
}

async function responseFor(message: RuntimeMessage): Promise<RuntimeResponse> {
  if (message.type === 'RECORDING_STATUS') {
    const session = await getSession();
    return {
      ok: true,
      state: session
        ? session.startedAt === null
          ? 'starting'
          : 'recording'
        : 'idle',
      ...(session ? { session } : {}),
    };
  }

  if (message.type === 'START_RECORDING') {
    if (import.meta.env.MODE === 'firefox') {
      return {
        ok: false,
        code: 'UNSUPPORTED',
        error: 'Firefox tab capture is not implemented yet.',
      };
    }
    const sessionId = crypto.randomUUID();
    const marker: RecordingSessionMarker = {
      id: sessionId,
      requestedAt: Date.now(),
      startedAt: null,
      targetTabId: message.targetTabId,
      mediaKey: `recording-${sessionId}.webm`,
      eventKey: `events-${sessionId}.json`,
      mimeType: null,
      finalized: false,
    };
    await chrome.storage.local.remove('recordingError');
    await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: marker });
    try {
      await ensureOffscreen();
      await chrome.runtime.sendMessage({
        type: 'OFFSCREEN_START',
        session: marker,
        streamId: message.streamId,
        countdownMs: message.countdownMs ?? 0,
      } satisfies RuntimeMessage);
      return { ok: true, state: 'starting', sessionId };
    } catch (error) {
      await chrome.storage.local.remove(SESSION_STORAGE_KEY);
      throw error;
    }
  }

  if (message.type === 'OFFSCREEN_RECORDING_STARTED') {
    const session = await getSession();
    if (!session || session.id !== message.sessionId) {
      return {
        ok: false,
        code: 'NO_SESSION',
        error: 'Recording session was lost',
      };
    }
    const started: RecordingSessionMarker = {
      ...session,
      startedAt: message.epochMs,
      mimeType: message.mimeType,
    };
    await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: started });
    await injectCollector(started.targetTabId, message.epochMs);
    return { ok: true, state: 'recording', sessionId: started.id };
  }

  if (message.type === 'STOP_RECORDING') {
    const session = await getSession();
    if (!session) {
      return { ok: false, code: 'NO_SESSION', error: 'No recording is active' };
    }
    if (session.startedAt === null) {
      await chrome.runtime.sendMessage({
        type: 'OFFSCREEN_STOP',
      } satisfies RuntimeMessage);
      await chrome.storage.local.remove(SESSION_STORAGE_KEY);
      return { ok: true, state: 'stopped', sessionId: session.id };
    }
    const collectorResult: unknown = await chrome.tabs
      .sendMessage(session.targetTabId, {
        type: 'COLLECTOR_STOP',
      } satisfies RuntimeMessage)
      .catch(() => undefined);
    if (isSerializedEventLog(collectorResult)) {
      await store.putStream(
        session.eventKey,
        new Blob([JSON.stringify(collectorResult.log)], {
          type: 'application/json',
        }),
      );
    }
    await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_STOP',
    } satisfies RuntimeMessage);
    return { ok: true, state: 'stopped', sessionId: session.id };
  }

  if (message.type === 'OFFSCREEN_FINALIZED') {
    const session = await getSession();
    if (session?.id === message.sessionId) {
      await chrome.storage.local.set({
        [LAST_RECORDING_STORAGE_KEY]: {
          ...session,
          durationSec: message.durationSec,
          finalized: true,
        },
      });
      await chrome.storage.local.remove(SESSION_STORAGE_KEY);
      await chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
    }
    return { ok: true, state: 'stopped', sessionId: message.sessionId };
  }

  if (message.type === 'OFFSCREEN_FAILED') {
    await chrome.storage.local.set({ recordingError: message.error });
    const session = await getSession();
    if (session?.id === message.sessionId) {
      await chrome.storage.local.remove(SESSION_STORAGE_KEY);
    }
    return { ok: false, error: message.error };
  }

  return { ok: true, state: 'recording' };
}

async function ensureOffscreen(): Promise<void> {
  if (import.meta.env.MODE === 'firefox') {
    throw new Error('Offscreen recording is unavailable in Firefox');
  }
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (existing.length > 0) return;
  const ready = new Promise<void>((resolve) => {
    resolveOffscreenReady = resolve;
  });
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Record tab media while the service worker is suspended.',
  });
  try {
    await Promise.race([
      ready,
      new Promise<never>((_resolve, reject) => {
        setTimeout(
          () => reject(new Error('Offscreen recorder did not become ready')),
          2000,
        );
      }),
    ]);
  } finally {
    resolveOffscreenReady = undefined;
  }
}

async function injectCollector(tabId: number, epochMs: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [contentScript],
  });
  await chrome.tabs.sendMessage(tabId, {
    type: 'COLLECTOR_START',
    epochMs,
  } satisfies RuntimeMessage);
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRuntimeMessage(message)) return false;
    if (message.type === 'OFFSCREEN_READY') {
      resolveOffscreenReady?.();
      return false;
    }
    if (
      message.type === 'OFFSCREEN_START' ||
      message.type === 'OFFSCREEN_STOP'
    ) {
      return false;
    }
    responseFor(message)
      .then(sendResponse)
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Platform operation failed',
        } satisfies RuntimeResponse),
      );
    return true;
  },
);
