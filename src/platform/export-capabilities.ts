export type ExportCodec = 'h264-mp4' | 'vp9-webm' | 'av1-webm';

export type ExportCapability = {
  codec: ExportCodec;
  container: 'mp4' | 'webm';
  videoCodec: 'h264' | 'vp9' | 'av1';
  audioCodec: 'aac' | 'opus';
  supported: boolean;
  videoConfig: VideoEncoderConfig;
  audioConfig: AudioEncoderConfig;
  reason?: string;
};

type ExportPreset = Omit<ExportCapability, 'supported' | 'reason'>;

const AUDIO_CONFIGS: Record<'aac' | 'opus', AudioEncoderConfig> = {
  aac: {
    codec: 'mp4a.40.2',
    sampleRate: 48_000,
    numberOfChannels: 2,
    bitrate: 192_000,
  },
  opus: {
    codec: 'opus',
    sampleRate: 48_000,
    numberOfChannels: 2,
    bitrate: 160_000,
  },
};

export const EXPORT_PRESETS: Record<ExportCodec, ExportPreset> = {
  'h264-mp4': {
    codec: 'h264-mp4',
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    videoConfig: {
      codec: 'avc1.640028',
      width: 1920,
      height: 1080,
      bitrate: 8_000_000,
      framerate: 30,
      hardwareAcceleration: 'prefer-hardware',
      latencyMode: 'quality',
    },
    audioConfig: AUDIO_CONFIGS.aac,
  },
  'vp9-webm': {
    codec: 'vp9-webm',
    container: 'webm',
    videoCodec: 'vp9',
    audioCodec: 'opus',
    videoConfig: {
      codec: 'vp09.00.10.08',
      width: 1920,
      height: 1080,
      bitrate: 6_000_000,
      framerate: 30,
      hardwareAcceleration: 'prefer-hardware',
      latencyMode: 'quality',
    },
    audioConfig: AUDIO_CONFIGS.opus,
  },
  'av1-webm': {
    codec: 'av1-webm',
    container: 'webm',
    videoCodec: 'av1',
    audioCodec: 'opus',
    videoConfig: {
      codec: 'av01.0.08M.08',
      width: 1920,
      height: 1080,
      bitrate: 4_500_000,
      framerate: 30,
      hardwareAcceleration: 'prefer-hardware',
      latencyMode: 'quality',
    },
    audioConfig: AUDIO_CONFIGS.opus,
  },
};

export async function probeExportCapabilities(): Promise<ExportCapability[]> {
  const presets = Object.values(EXPORT_PRESETS);
  if (
    typeof VideoEncoder === 'undefined' ||
    typeof VideoEncoder.isConfigSupported !== 'function' ||
    typeof AudioEncoder === 'undefined' ||
    typeof AudioEncoder.isConfigSupported !== 'function'
  ) {
    return presets.map((preset) => ({
      ...preset,
      supported: false,
      reason: 'WebCodecs audio and video encoders are required',
    }));
  }

  return Promise.all(
    presets.map(async (preset) => {
      try {
        const [video, audio] = await Promise.all([
          VideoEncoder.isConfigSupported(preset.videoConfig),
          AudioEncoder.isConfigSupported(preset.audioConfig),
        ]);
        const supported = video.supported === true && audio.supported === true;
        return {
          ...preset,
          supported,
          ...(supported
            ? {}
            : { reason: 'One or more encoder configurations are unavailable' }),
        };
      } catch (error) {
        return {
          ...preset,
          supported: false,
          reason:
            error instanceof Error
              ? error.message
              : 'Encoder capability probe failed',
        };
      }
    }),
  );
}
