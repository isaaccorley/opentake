import { createOpfsStore, type OpfsWriter } from './opfs';
import {
  isRuntimeMessage,
  type RecordingSessionMarker,
  type RuntimeMessage,
  SESSION_STORAGE_KEY,
} from './protocol';

type ActiveRecording = {
  recorder: MediaRecorder;
  stream: MediaStream;
  writer: OpfsWriter;
  writeChain: Promise<void>;
  session: RecordingSessionMarker;
  epochMs: number;
};

const store = createOpfsStore();
let active: ActiveRecording | undefined;
let startGeneration = 0;

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isRuntimeMessage(message)) return false;
  if (message.type === 'OFFSCREEN_START') {
    const generation = ++startGeneration;
    void start(
      message.sessionId,
      message.streamId,
      message.countdownMs,
      generation,
    );
  }
  if (message.type === 'OFFSCREEN_STOP') {
    startGeneration += 1;
    stop();
  }
  return false;
});

async function start(
  sessionId: string,
  streamId: string,
  countdownMs: number,
  generation: number,
): Promise<void> {
  if (active) return;
  if (countdownMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, countdownMs));
  }
  if (generation !== startGeneration) return;

  const stored = await chrome.storage.local.get(SESSION_STORAGE_KEY);
  const session = stored[SESSION_STORAGE_KEY] as
    | RecordingSessionMarker
    | undefined;
  if (!session || session.id !== sessionId) return;

  let stream: MediaStream | undefined;
  let writer: OpfsWriter | undefined;
  try {
    const source = {
      mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
    } as MediaTrackConstraints;
    stream = await navigator.mediaDevices.getUserMedia({
      audio: source,
      video: source,
    });
    writer = await store.openWriter(session.mediaKey);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const epochMs = performance.timeOrigin + performance.now();
    const recording: ActiveRecording = {
      recorder,
      stream,
      writer,
      writeChain: Promise.resolve(),
      session,
      epochMs,
    };
    active = recording;
    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      recording.writeChain = recording.writeChain.then(() =>
        recording.writer.write(event.data),
      );
    };
    recorder.onstop = () => void finalize(recording);
    recorder.onerror = () => stop();
    recorder.start(1000);
    await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_RECORDING_STARTED',
      sessionId,
      epochMs,
      mimeType: recorder.mimeType,
    } satisfies RuntimeMessage);
  } catch (error) {
    stream?.getTracks().forEach((track) => {
      track.stop();
    });
    await writer?.abort().catch(() => undefined);
    await reportFailure(sessionId, error);
  }
}

function stop(): void {
  if (active?.recorder.state === 'recording') active.recorder.stop();
}

async function finalize(recording: ActiveRecording): Promise<void> {
  try {
    await recording.writeChain;
    await recording.writer.close();
    const durationSec =
      (performance.timeOrigin + performance.now() - recording.epochMs) / 1000;
    recording.stream.getTracks().forEach((track) => {
      track.stop();
    });
    active = undefined;
    await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_FINALIZED',
      sessionId: recording.session.id,
      durationSec,
    } satisfies RuntimeMessage);
  } catch (error) {
    await recording.writer.abort().catch(() => undefined);
    recording.stream.getTracks().forEach((track) => {
      track.stop();
    });
    active = undefined;
    await reportFailure(recording.session.id, error);
  }
}

async function reportFailure(sessionId: string, error: unknown): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_FAILED',
    sessionId,
    error: error instanceof Error ? error.message : 'Recording failed',
  } satisfies RuntimeMessage);
}
