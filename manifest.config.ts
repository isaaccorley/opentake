import { defineManifest } from '@crxjs/vite-plugin';

import packageJson from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'OpenTake',
  description: 'Record and edit polished browser videos entirely on-device.',
  version: packageJson.version,
  minimum_chrome_version: '116',
  permissions: [
    'activeTab',
    'offscreen',
    'scripting',
    'storage',
    'tabCapture',
    'unlimitedStorage',
  ],
  action: {
    default_popup: 'popup.html',
    default_title: 'OpenTake',
  },
  background: {
    service_worker: 'src/platform/background.ts',
    type: 'module',
  },
});
