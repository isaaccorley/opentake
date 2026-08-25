import type { ProjectDoc } from '../../src/core/project';

export const syntheticProjectDoc: ProjectDoc = {
  version: 1,
  id: 'synthetic-fixture',
  createdAt: 1,
  source: {
    mediaKey: 'synthetic.webm',
    durationSec: 2.008,
    width: 1280,
    height: 720,
    fps: 30,
    devicePixelRatio: 2,
    hasAudio: true,
  },
  events: {
    epochMs: 2,
    cursor: new Float32Array([0, 0.1, 0.2]),
    clicks: [{ t: 0.5, x: 0.1, y: 0.2, button: 0 }],
    keyMarks: [1],
    scroll: [{ t: 0, x: 0, y: 0 }],
    viewport: [{ t: 0, w: 1280, h: 720 }],
    blurIntervals: [],
  },
  edit: {
    trims: [{ start: 0, end: 2.008 }],
    speed: [{ start: 0.5, end: 1.5, rate: 2 }],
    zooms: [
      {
        t: 0.25,
        scale: 1.5,
        mode: 'fixed',
        center: { x: 0.5, y: 0.5 },
        easing: 'linear',
      },
    ],
  },
  look: {
    background: { kind: 'none' },
    padding: 0.1,
    cornerRadius: 8,
    shadow: null,
    cursor: { scale: 1, smoothing: 0.5, clickRipple: true },
  },
  export: {
    aspect: '16:9',
    resolution: 1080,
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    rateControl: { mode: 'quality', quality: 80 },
  },
};
