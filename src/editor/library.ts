import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import {
  deserializeProjectDoc,
  type ProjectDoc,
  serializeProjectDoc,
} from '../core/project';
import { OpfsStore } from '../platform/opfs';

export function projectName(doc: ProjectDoc): string {
  return doc.title ?? `Recording ${new Date(doc.createdAt).toLocaleString()}`;
}

async function inspectMedia(
  file: File,
  id: string = crypto.randomUUID(),
): Promise<ProjectDoc> {
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video || !(await video.canDecode()))
      throw new Error(
        'This video cannot be decoded here. Try a WebM or MP4 file in Chrome.',
      );
    const durationSec = await input.computeDuration();
    if (!Number.isFinite(durationSec) || durationSec <= 0)
      throw new Error('The video has no playable duration.');
    return {
      version: 1,
      id,
      title: file.name,
      createdAt: Date.now(),
      source: {
        mediaKey: file.name,
        originalName: file.name,
        mimeType: (await input.getFormat()).mimeType,
        durationSec,
        width: video.displayWidth,
        height: video.displayHeight,
        fps: 30,
        devicePixelRatio: 1,
        hasAudio: Boolean(await input.getPrimaryAudioTrack()),
      },
      events: {
        epochMs: 0,
        cursor: new Float32Array(),
        clicks: [],
        keyMarks: [],
        scroll: [],
        viewport: [],
        blurIntervals: [],
      },
      edit: { trims: [{ start: 0, end: durationSec }], speed: [], zooms: [] },
      look: {
        background: { kind: 'none' },
        padding: 0,
        cornerRadius: 0,
        shadow: null,
        cursor: { scale: 1, smoothing: 0, clickRipple: false },
      },
      export: {
        aspect: 'source',
        resolution: 1080,
        fps: 30,
        container: 'webm',
        videoCodec: 'vp9',
        audioCodec: 'opus',
        rateControl: { mode: 'quality', quality: 80 },
      },
    };
  } finally {
    input.dispose();
  }
}

export async function saveProject(doc: ProjectDoc): Promise<void> {
  await new OpfsStore().putStream(
    `project-${doc.id}.json`,
    new Blob([serializeProjectDoc(doc)]),
  );
}

export async function importVideo(file: File): Promise<ProjectDoc> {
  const doc = await inspectMedia(file);
  doc.source.mediaKey = `source-${doc.id}`;
  await new OpfsStore().putStream(doc.source.mediaKey, file.stream());
  await saveProject(doc);
  return doc;
}

export async function loadLibrary(): Promise<ProjectDoc[]> {
  const store = new OpfsStore();
  const names = await store.list();
  const docs = await Promise.all(
    names
      .filter((name) => name.startsWith('project-') && name.endsWith('.json'))
      .map(async (name) =>
        deserializeProjectDoc(await (await store.getFile(name)).text()),
      ),
  );
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const stored = await chrome.storage.local.get([
      'lastRecording',
      'recordingLibrary',
    ]);
    const recordings = (stored.recordingLibrary ??
      (stored.lastRecording ? [stored.lastRecording] : [])) as Array<{
      id: string;
      mediaKey: string;
      requestedAt: number;
    }>;
    for (const recording of recordings) {
      if (docs.some((doc) => doc.id === recording.id)) continue;
      const doc = await inspectMedia(
        await store.getFile(recording.mediaKey),
        recording.id,
      );
      doc.createdAt = recording.requestedAt;
      doc.title = `Recording ${new Date(doc.createdAt).toLocaleString()}`;
      await saveProject(doc);
      docs.push(doc);
    }
  }
  return docs.sort((a, b) => b.createdAt - a.createdAt);
}
