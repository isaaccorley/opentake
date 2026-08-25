import { readdir, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const mib = 1024 * 1024;
const limits = {
  totalBytes: 10 * mib,
  largestJavaScriptBytes: 4 * mib,
  serviceWorkerBytes: 1 * mib,
};

async function walk(directory: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(path)));
    if (entry.isFile()) paths.push(path);
  }
  return paths;
}

function format(bytes: number): string {
  return `${(bytes / mib).toFixed(2)} MiB`;
}

async function main(): Promise<void> {
  const directory = resolve(process.argv[2] ?? 'dist');
  const files = await walk(directory);
  const sizes = await Promise.all(
    files.map(async (path) => ({ path, bytes: (await stat(path)).size })),
  );
  const totalBytes = sizes.reduce((sum, file) => sum + file.bytes, 0);
  const javascript = sizes.filter((file) => extname(file.path) === '.js');
  const largestJavaScript = javascript.sort((a, b) => b.bytes - a.bytes)[0];
  const serviceWorker = sizes.find((file) =>
    relative(directory, file.path).startsWith('service-worker-loader.js'),
  );
  const failures: string[] = [];
  if (totalBytes > limits.totalBytes) {
    failures.push(
      `total ${format(totalBytes)} exceeds ${format(limits.totalBytes)}`,
    );
  }
  if (
    largestJavaScript &&
    largestJavaScript.bytes > limits.largestJavaScriptBytes
  ) {
    failures.push(
      `${relative(directory, largestJavaScript.path)} is ${format(largestJavaScript.bytes)}; limit ${format(limits.largestJavaScriptBytes)}`,
    );
  }
  if (serviceWorker && serviceWorker.bytes > limits.serviceWorkerBytes) {
    failures.push(
      `service worker is ${format(serviceWorker.bytes)}; limit ${format(limits.serviceWorkerBytes)}`,
    );
  }
  if (failures.length > 0) {
    throw new Error(`bundle budget failed:\n- ${failures.join('\n- ')}`);
  }
  console.log(
    `Bundle budget passed: ${format(totalBytes)} total / ${format(limits.totalBytes)}, ` +
      `${format(largestJavaScript?.bytes ?? 0)} largest JS / ${format(limits.largestJavaScriptBytes)}.`,
  );
}

await main();
