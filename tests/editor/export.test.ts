import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportVideo } from '../../src/editor/export';
import { syntheticProjectDoc } from '../fixtures/project';

const state = vi.hoisted(() => ({
  execute: vi.fn<() => Promise<void>>(),
  cancel: vi.fn<() => Promise<void>>(),
  dispose: vi.fn(),
  discardedTracks: [] as unknown[],
}));
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [],
  QUALITY_HIGH: 1,
  BlobSource: class {},
  Input: class {
    dispose = state.dispose;
  },
  Output: class {
    cancel = state.cancel;
  },
  StreamTarget: class {},
  Mp4OutputFormat: class {},
  WebMOutputFormat: class {},
  Conversion: {
    init: async () => ({
      isValid: true,
      discardedTracks: state.discardedTracks,
      execute: state.execute,
      cancel: state.cancel,
    }),
  },
}));

function setup() {
  const removeEntry = vi.fn(async () => undefined);
  const abort = vi.fn(async () => undefined);
  const file = new File(['video'], 'clip.webm');
  vi.stubGlobal('navigator', {
    storage: {
      getDirectory: async () => ({
        removeEntry,
        getFileHandle: async () => ({
          createWritable: async () => ({ abort }),
          getFile: async () => file,
        }),
      }),
    },
  });
  const doc = {
    ...syntheticProjectDoc,
    edit: { trims: [{ start: 0, end: 1 }], speed: [], zooms: [] },
  };
  state.discardedTracks = [];
  state.execute.mockResolvedValue();
  state.cancel.mockResolvedValue();
  return { file, doc, removeEntry, abort };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('export cleanup', () => {
  it('preserves completed output until the download consumer releases it', async () => {
    const { file, doc, removeEntry } = setup();
    const job = await exportVideo(file, doc, vi.fn());
    const result = await job.result;
    expect(result.file).toBe(file);
    expect(removeEntry).not.toHaveBeenCalled();
    await result.cleanup();
    expect(removeEntry).toHaveBeenCalledOnce();
    expect(state.dispose).toHaveBeenCalledOnce();
  });

  it('rejects track loss and cleans up the partial file', async () => {
    const { file, doc, removeEntry, abort } = setup();
    state.discardedTracks = [{ reason: 'unsupported codec' }];
    await expect(exportVideo(file, doc, vi.fn())).rejects.toThrow(
      'cannot encode all tracks',
    );
    expect(state.execute).not.toHaveBeenCalled();
    expect(removeEntry).toHaveBeenCalledOnce();
    expect(abort).toHaveBeenCalledOnce();
  });

  it('cancels without returning a partial download', async () => {
    const { file, doc, removeEntry, abort } = setup();
    let finish = () => {};
    state.execute.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    state.cancel.mockImplementation(async () => {
      finish();
    });
    const job = await exportVideo(file, doc, vi.fn());
    const rejected = expect(job.result).rejects.toThrow('Export canceled');
    await job.cancel();
    await rejected;
    expect(removeEntry).toHaveBeenCalledOnce();
    expect(abort).toHaveBeenCalledOnce();
    expect(state.dispose).toHaveBeenCalledOnce();
  });
});
