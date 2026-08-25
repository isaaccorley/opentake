import { describe, expect, it } from 'vitest';
import {
  validateBuiltFile,
  validateManifest,
} from '../../scripts/check-extension';

const validManifest = {
  manifest_version: 3,
  permissions: [
    'activeTab',
    'offscreen',
    'scripting',
    'storage',
    'tabCapture',
    'unlimitedStorage',
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';",
  },
};

describe('extension package policy', () => {
  it('accepts the intended least-privilege manifest', () => {
    expect(validateManifest(validManifest)).toEqual([]);
  });

  it('rejects permission drift and host access', () => {
    expect(
      validateManifest({
        ...validManifest,
        permissions: [...validManifest.permissions, 'tabs'],
        host_permissions: ['<all_urls>'],
      }),
    ).toHaveLength(2);
  });

  it('rejects remote executable code and packaged media fixtures', () => {
    expect(
      validateBuiltFile(
        'assets/background.js',
        "importScripts('https://example.test/code.js')",
      ),
    ).toHaveLength(1);
    expect(validateBuiltFile('fixtures/sample.webm', '')).toHaveLength(1);
  });
});
