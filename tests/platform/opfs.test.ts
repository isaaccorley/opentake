import { describe, expect, it } from 'vitest';
import {
  deserializeProjectDoc,
  serializeProjectDoc,
} from '../../src/core/project';
import {
  OpfsQuotaError,
  OpfsStore,
  type StorageRoot,
} from '../../src/platform/opfs';
import { syntheticProjectDoc } from '../fixtures/project';

async function bytes(data: FileSystemWriteChunkType): Promise<Uint8Array> {
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError('FakeRoot only supports sequential binary writes');
}

class FakeRoot implements StorageRoot {
  readonly files = new Map<string, Uint8Array>();

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemFileHandle> {
    if (!this.files.has(name) && !options?.create) {
      throw new DOMException('missing', 'NotFoundError');
    }
    return {
      name,
      kind: 'file',
      getFile: async () => {
        const stored = this.files.get(name) ?? new Uint8Array();
        const copy = new Uint8Array(stored.byteLength);
        copy.set(stored);
        return new File([copy.buffer], name);
      },
      createWritable: async () => ({
        write: async (data: FileSystemWriteChunkType) => {
          const next = await bytes(data);
          const previous = this.files.get(name) ?? new Uint8Array();
          const combined = new Uint8Array(previous.length + next.length);
          combined.set(previous);
          combined.set(next, previous.length);
          this.files.set(name, combined);
        },
        close: async () => undefined,
        abort: async () => undefined,
      }),
    } as unknown as FileSystemFileHandle;
  }

  async removeEntry(name: string): Promise<void> {
    this.files.delete(name);
  }

  async *values(): AsyncGenerator<FileSystemFileHandle> {
    for (const name of this.files.keys()) {
      yield { name, kind: 'file' } as FileSystemFileHandle;
    }
  }
}

describe('OpfsStore', () => {
  it('streams chunks, reads, lists, and deletes through an injected root', async () => {
    const store = new OpfsStore(new FakeRoot());
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hel'));
        controller.enqueue(new TextEncoder().encode('lo'));
        controller.close();
      },
    });
    await store.putStream('clip', input);
    expect(await (await store.getFile('clip')).text()).toBe('hello');
    expect(await store.list()).toEqual(['clip']);
    await store.delete('clip');
    expect(await store.list()).toEqual([]);
  });

  it('round-trips a synthetic ProjectDoc through local file storage', async () => {
    const store = new OpfsStore(new FakeRoot());
    await store.putStream(
      'project.json',
      new Blob([serializeProjectDoc(syntheticProjectDoc)]),
    );
    const restored = deserializeProjectDoc(
      await (await store.getFile('project.json')).text(),
    );
    expect(restored).toEqual(syntheticProjectDoc);
    expect(restored.events.cursor).toBeInstanceOf(Float32Array);
  });

  it('normalizes quota failures', async () => {
    const root = new FakeRoot();
    root.getFileHandle = async () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    await expect(
      new OpfsStore(root).putStream('clip', new Uint8Array([1])),
    ).rejects.toBeInstanceOf(OpfsQuotaError);
  });

  it('rejects path-like keys because the wrapper is intentionally flat', async () => {
    await expect(
      new OpfsStore(new FakeRoot()).putStream(
        'recordings/clip',
        new Uint8Array(),
      ),
    ).rejects.toThrow(/file names/);
  });
});
