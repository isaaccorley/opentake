import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const { stdout } = await run(process.execPath, [
  'x',
  '--bun',
  'web-ext@10.6.0',
  'lint',
  '--source-dir',
  'dist-firefox',
  '--output',
  'json',
]);

type LintMessage = { code: string; file?: string; message: string };
const report = JSON.parse(stdout) as {
  errors: LintMessage[];
  warnings: LintMessage[];
};
const allowedWarnings = new Set([
  'KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION',
  'UNSAFE_VAR_ASSIGNMENT',
]);
const actionable = [
  ...report.errors,
  ...report.warnings.filter((warning) => !allowedWarnings.has(warning.code)),
];
if (actionable.length > 0) {
  throw new Error(
    `Firefox extension lint failed:\n${actionable
      .map(
        (item) =>
          `- ${item.code} in ${item.file ?? 'manifest'}: ${item.message}`,
      )
      .join('\n')}`,
  );
}
console.log(
  'Firefox extension lint passed (desktop-only and React implementation warnings ignored).',
);
