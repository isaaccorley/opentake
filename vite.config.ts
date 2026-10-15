import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import manifest from './manifest.config.ts';

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: 'zod-csp',
      enforce: 'pre',
      transform(code, id) {
        // Zod's interpreter is CSP-safe. Remove its optional JIT from extension packages.
        if (/[/\\]zod[/\\]v4[/\\]core[/\\](schemas|util)\.js$/.test(id)) {
          return code
            .replaceAll('core.globalConfig.jitless', 'true')
            .replaceAll('globalConfig.jitless', 'true');
        }
      },
    },
    react(),
    crx({ manifest }),
  ],
  build: {
    outDir:
      mode === 'e2e'
        ? 'dist-e2e'
        : mode === 'firefox'
          ? 'dist-firefox'
          : 'dist',
    rollupOptions: {
      input: {
        editor: 'editor.html',
        popup: 'popup.html',
        ...(mode === 'firefox' ? {} : { offscreen: 'offscreen.html' }),
      },
    },
  },
}));
