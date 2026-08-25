import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const allowedPermissions = [
  'activeTab',
  'offscreen',
  'scripting',
  'storage',
  'tabCapture',
  'unlimitedStorage',
];
const expectedCsp = "script-src 'self'; object-src 'self';";
const forbiddenExtensions = new Set(['.map', '.mp4', '.opentake', '.webm']);

type Manifest = {
  manifest_version?: number;
  permissions?: string[];
  host_permissions?: string[];
  content_security_policy?: { extension_pages?: string };
};

export function validateManifest(manifest: Manifest): string[] {
  const failures: string[] = [];
  if (manifest.manifest_version !== 3) {
    failures.push('manifest_version must be 3');
  }
  const actualPermissions = [...(manifest.permissions ?? [])].sort();
  if (
    actualPermissions.join('\0') !== [...allowedPermissions].sort().join('\0')
  ) {
    failures.push(
      `permissions must exactly match the allowlist: ${allowedPermissions.join(', ')}`,
    );
  }
  if ((manifest.host_permissions ?? []).length > 0) {
    failures.push('host_permissions must remain empty');
  }
  if (manifest.content_security_policy?.extension_pages !== expectedCsp) {
    failures.push(`extension CSP must be exactly: ${expectedCsp}`);
  }
  return failures;
}

export function validateBuiltFile(path: string, source: string): string[] {
  const failures: string[] = [];
  const extension = extname(path);
  if (forbiddenExtensions.has(extension)) {
    failures.push(`${path}: forbidden packaged file type ${extension}`);
  }
  if (extension === '.js') {
    const remoteCodePatterns = [
      /importScripts\s*\(\s*['"]https?:\/\//,
      /import\s*\(\s*['"]https?:\/\//,
      /\bnew\s+Function\s*\(/,
      /\beval\s*\(/,
    ];
    if (remoteCodePatterns.some((pattern) => pattern.test(source))) {
      failures.push(`${path}: remote or dynamically evaluated code detected`);
    }
  }
  if (
    extension === '.html' &&
    /<script\b[^>]*\bsrc\s*=\s*['"]https?:\/\//i.test(source)
  ) {
    failures.push(`${path}: remote script detected`);
  }
  return failures;
}

async function walk(directory: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(path)));
    if (entry.isFile()) paths.push(path);
  }
  return paths;
}

export async function checkExtension(directory: string): Promise<string[]> {
  const manifestPath = join(directory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
  const failures = validateManifest(manifest);
  for (const path of await walk(directory)) {
    const extension = extname(path);
    const source =
      extension === '.js' || extension === '.html'
        ? await readFile(path, 'utf8')
        : '';
    failures.push(...validateBuiltFile(relative(directory, path), source));
  }
  return failures;
}

async function main(): Promise<void> {
  const directory = resolve(process.argv[2] ?? 'dist');
  const directoryStat = await stat(directory).catch(() => undefined);
  if (!directoryStat?.isDirectory()) {
    throw new Error(`extension directory does not exist: ${directory}`);
  }
  const failures = await checkExtension(directory);
  if (failures.length > 0) {
    throw new Error(`extension policy failed:\n- ${failures.join('\n- ')}`);
  }
  console.log(
    'Extension policy passed: permissions, CSP, and package contents.',
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
