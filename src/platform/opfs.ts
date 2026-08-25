export class OpfsQuotaError extends Error {
  readonly code = 'QUOTA' as const;

  constructor(message = 'OpenTake storage quota exceeded') {
    super(message);
    this.name = 'OpfsQuotaError';
  }
}

export type StreamInput =
  | Blob
  | ArrayBuffer
  | Uint8Array
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>;

export type StorageRoot = {
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemFileHandle>;
  removeEntry: (name: string) => Promise<void>;
  values: () => AsyncIterable<FileSystemFileHandle>;
};

export type OpfsWriter = {
  write: (chunk: Blob | ArrayBuffer | Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
};

function isQuotaError(error: unknown): boolean {
  return (
    (error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.code === 22)) ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'QuotaExceededError')
  );
}

function normalizeStorageError(error: unknown): never {
  if (isQuotaError(error)) throw new OpfsQuotaError();
  throw error;
}

function validateKey(key: string): void {
  if (!key || key.includes('/') || key.includes('\\')) {
    throw new TypeError('OPFS keys must be non-empty file names');
  }
}

async function* chunks(input: StreamInput): AsyncGenerator<Uint8Array> {
  if (input instanceof Blob) {
    yield new Uint8Array(await input.arrayBuffer());
  } else if (input instanceof ArrayBuffer) {
    yield new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    yield input;
  } else if (input instanceof ReadableStream) {
    const reader = input.getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        yield next.value;
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    yield* input;
  }
}

function defaultRoot(): Promise<StorageRoot> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
    throw new Error('OPFS is unavailable in this context');
  }
  return navigator.storage.getDirectory() as Promise<StorageRoot>;
}

export class OpfsStore {
  private readonly root: StorageRoot | Promise<StorageRoot>;

  constructor(root?: StorageRoot | Promise<StorageRoot>) {
    this.root = root ?? defaultRoot();
  }

  private async directory(): Promise<StorageRoot> {
    return this.root;
  }

  async openWriter(key: string): Promise<OpfsWriter> {
    validateKey(key);
    try {
      const handle = await (
        await this.directory()
      ).getFileHandle(key, {
        create: true,
      });
      const writable = await handle.createWritable();
      return {
        write: async (chunk) => {
          try {
            if (chunk instanceof Uint8Array) {
              const copy = new Uint8Array(chunk.byteLength);
              copy.set(chunk);
              await writable.write(copy);
            } else {
              await writable.write(chunk);
            }
          } catch (error) {
            normalizeStorageError(error);
          }
        },
        close: async () => {
          try {
            await writable.close();
          } catch (error) {
            normalizeStorageError(error);
          }
        },
        abort: async () => writable.abort(),
      };
    } catch (error) {
      normalizeStorageError(error);
    }
  }

  async putStream(key: string, input: StreamInput): Promise<void> {
    const writer = await this.openWriter(key);
    try {
      for await (const chunk of chunks(input)) await writer.write(chunk);
      await writer.close();
    } catch (error) {
      await writer.abort().catch(() => undefined);
      throw error;
    }
  }

  async getFile(key: string): Promise<File> {
    validateKey(key);
    return (await (await this.directory()).getFileHandle(key)).getFile();
  }

  async delete(key: string): Promise<void> {
    validateKey(key);
    await (await this.directory()).removeEntry(key);
  }

  async list(): Promise<string[]> {
    const names: string[] = [];
    for await (const entry of (await this.directory()).values()) {
      if (entry.kind === 'file') names.push(entry.name);
    }
    return names.sort();
  }
}

export function createOpfsStore(root?: StorageRoot): OpfsStore {
  return new OpfsStore(root);
}
