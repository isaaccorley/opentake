import {
  ALL_FORMATS,
  BlobSource,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  StreamTarget,
  WebMOutputFormat,
} from 'mediabunny';
import type { ProjectDoc } from '../core/project';

export type ExportJob = {
  cancel: () => Promise<void>;
  result: Promise<{ file: File; cleanup: () => Promise<void> }>;
};

export async function exportVideo(
  file: File,
  doc: ProjectDoc,
  onProgress: (value: number) => void,
): Promise<ExportJob> {
  const range = doc.edit.trims[0];
  if (
    !range ||
    range.end <= range.start ||
    doc.edit.trims.length !== 1 ||
    doc.edit.speed.length ||
    doc.edit.zooms.length
  )
    throw new Error(
      'Export requires one retained range without speed or camera effects.',
    );
  const root = await navigator.storage.getDirectory();
  const key = `export-${crypto.randomUUID()}.${doc.export.container}`;
  const handle = await root.getFileHandle(key, { create: true });
  const writable = await handle.createWritable();
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });
  const output = new Output({
    format:
      doc.export.container === 'mp4'
        ? new Mp4OutputFormat({ fastStart: false })
        : new WebMOutputFormat(),
    target: new StreamTarget(writable, { chunked: true }),
  });
  try {
    const conversion = await Conversion.init({
      input,
      output,
      trim: range,
      tags: {},
      video: {
        codec: doc.export.videoCodec === 'h264' ? 'avc' : doc.export.videoCodec,
        height: Math.min(doc.source.height, doc.export.resolution),
        quality: QUALITY_HIGH,
        forceTranscode: true,
      },
      audio: { codec: doc.export.audioCodec, forceTranscode: true },
    });
    if (!conversion.isValid || conversion.discardedTracks.length)
      throw new Error(
        'This browser cannot encode all tracks in this format. Try WebM or download the original.',
      );
    let canceled = false;
    conversion.onProgress = (progress) => onProgress(progress);
    const result = (async () => {
      try {
        await conversion.execute();
        if (canceled) throw new Error('Export canceled.');
        return {
          file: await handle.getFile(),
          cleanup: () => root.removeEntry(key),
        };
      } catch (error) {
        await conversion.cancel().catch(() => undefined);
        await writable.abort().catch(() => undefined);
        await root.removeEntry(key).catch(() => undefined);
        throw error;
      } finally {
        input.dispose();
      }
    })();
    return {
      cancel: async () => {
        canceled = true;
        await conversion.cancel();
      },
      result,
    };
  } catch (error) {
    input.dispose();
    await output.cancel().catch(() => undefined);
    await writable.abort().catch(() => undefined);
    await root.removeEntry(key).catch(() => undefined);
    throw error;
  }
}

export function downloadFile(file: Blob, name: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
