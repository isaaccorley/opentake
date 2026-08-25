import { createOpfsStore, type OpfsWriter } from './opfs';
import {
  isRuntimeMessage,
  type RecordingSessionMarker,
  type RuntimeMessage,
} from './protocol';

type ActiveRecording = {
  recorder: MediaRecorder;
  stream: MediaStream;
  writer: OpfsWriter;
  writeChain: Promise<void>;
  session: RecordingSessionMarker;
  epochMs: number;
};

let active: ActiveRecording | undefined;
let startGeneration = 0;

void chrome.runtime
  .sendMessage({
    type: 'OFFSCREEN_READY',
  } satisfies RuntimeMessage)
  .catch(() => undefined);

function syntheticTestStream(): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Synthetic recording canvas is unavailable');
  let frame = 0;
  const paint = () => {
    frame += 1;
    context.fillStyle = '#10252c';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#d4f36a';
    context.fillRect((frame * 5) % 1080, 260, 200, 200);
    requestAnimationFrame(paint);
  };
  paint();
  return canvas.captureStream(30);
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRuntimeMessage(message)) return false;
    if (message.type === 'OFFSCREEN_START') {
      const generation = ++startGeneration;
      void start(
        message.session,
        message.streamId,
        message.countdownMs,
        generation,
      );
      sendResponse({ accepted: true });
    }
    if (message.type === 'OFFSCREEN_STOP') {
      startGeneration += 1;
      stop();
      sendResponse({ accepted: true });
    }
    return false;
  },
);

async function start(
  session: RecordingSessionMarker,
  streamId: string,
  countdownMs: number,
  generation: number,
): Promise<void> {
  if (active) return;
  if (countdownMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, countdownMs));
  }
  if (generation !== startGeneration) return;

  let stream: MediaStream | undefined;
  let writer: OpfsWriter | undefined;
  try {
    const source = {
      mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
    } as MediaTrackConstraints;
    stream =
      import.meta.env.MODE === 'e2e' &&
      streamId === '__opentake_e2e_synthetic_media__'
        ? syntheticTestStream()
        : await navigator.mediaDevices.getUserMedia({
            audio: source,
            video: source,
          });
    const store = createOpfsStore();
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
      sessionId: session.id,
      epochMs,
      mimeType: recorder.mimeType,
    } satisfies RuntimeMessage);
  } catch (error) {
    stream?.getTracks().forEach((track) => {
      track.stop();
    });
    await writer?.abort().catch(() => undefined);
    await reportFailure(session.id, error);
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
