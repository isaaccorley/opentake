import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import manifest from './manifest.config.ts';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), crx({ manifest })],
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
