import { defineManifest } from '@crxjs/vite-plugin';

import packageJson from './package.json' with { type: 'json' };

export default defineManifest(({ mode }) => ({
  manifest_version: 3,
  name: 'OpenTake',
  description: 'Record and edit polished browser videos entirely on-device.',
  version: packageJson.version,
  ...(mode === 'firefox'
    ? {
        browser_specific_settings: {
          gecko: {
            id: 'opentake@isaaccorley.dev',
            strict_min_version: '140.0',
            data_collection_permissions: {
              required: ['none'],
            },
          },
        },
      }
    : { minimum_chrome_version: '116' }),
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';",
  },
  permissions:
    mode === 'firefox'
      ? ['activeTab', 'scripting', 'storage', 'unlimitedStorage']
      : [
          'activeTab',
          'offscreen',
          'scripting',
          'storage',
          'tabCapture',
          'unlimitedStorage',
        ],
  ...(mode === 'e2e' ? { host_permissions: ['http://127.0.0.1/*'] } : {}),
  action: {
    default_popup: 'popup.html',
    default_title: 'OpenTake',
  },
  commands: {
    _execute_action: {
      suggested_key: {
        default: 'Ctrl+Shift+9',
        mac: 'Command+Shift+9',
      },
      description: 'Open OpenTake',
    },
  },
  background:
    mode === 'firefox'
      ? {
          scripts: ['src/platform/background.ts'],
          type: 'module',
        }
      : {
          service_worker: 'src/platform/background.ts',
          type: 'module',
        },
}));
