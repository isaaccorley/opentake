import type { DemoRecipe } from '../../src/core/demo-recipe';

export const fmowDemoRecipe = {
  version: 1,
  name: 'FMoW Atlas globe tour',
  targetUrl: 'https://data.source.coop/geospatialml/fmow/index.html',
  viewport: { width: 1920, height: 1080 },
  actions: [
    { type: 'waitForText', text: '409k samples', timeoutMs: 30_000 },
    { type: 'clickRole', role: 'button', name: 'Split', repeat: 1 },
    { type: 'clickRole', role: 'button', name: 'Class', repeat: 1 },
    { type: 'clickRole', role: 'button', name: 'Zoom in', repeat: 10 },
    { type: 'pause', durationMs: 800 },
    { type: 'pointerClick', x: 0.51, y: 0.54 },
    { type: 'keyPress', key: 'b' },
    { type: 'keyPress', key: 'ArrowRight' },
    { type: 'pause', durationMs: 1200 },
  ],
  export: {
    width: 2560,
    height: 1440,
    playbackRate: 1.5,
    container: 'webm',
    codec: 'vp9',
    quality: 80,
  },
} satisfies DemoRecipe;
