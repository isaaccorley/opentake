import { describe, expect, it, vi } from 'vitest';
import { probeExportCapabilities } from '../../src/platform/export-capabilities';

describe('export capability probing', () => {
  it('reports each codec from the browser probe rather than assuming support', async () => {
    vi.stubGlobal('VideoEncoder', {
      isConfigSupported: vi.fn((config: VideoEncoderConfig) =>
        Promise.resolve({ supported: config.codec.includes('avc') }),
      ),
    });
    vi.stubGlobal('AudioEncoder', {
      isConfigSupported: vi.fn(() => Promise.resolve({ supported: true })),
    });
    const result = await probeExportCapabilities();
    expect(result.map((item) => [item.codec, item.supported])).toEqual([
      ['h264-mp4', true],
      ['vp9-webm', false],
      ['av1-webm', false],
    ]);
    vi.unstubAllGlobals();
  });
});
