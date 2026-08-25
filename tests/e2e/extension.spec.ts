import { expect, test, chromium, type BrowserContext } from '@playwright/test';
import { resolve } from 'node:path';

const chromePath = process.env.OPENTAKE_CHROME_PATH;
const extensionPath = resolve(import.meta.dirname, '../../dist');

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName;
  context = await chromium.launchPersistentContext(
    testInfo.outputPath('chrome-profile'),
    {
      headless: false,
      ...(chromePath
        ? { executablePath: chromePath }
        : { channel: 'chromium' as const }),
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    },
  );
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => context.close());

test('loads the popup and editor from the unpacked extension', async ({
  browserName,
}, testInfo) => {
  void browserName;
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 320 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('OpenTake', { exact: true })).toBeVisible();
  await expect(
    popup.getByRole('button', { name: 'Record this tab' }),
  ).toBeVisible();
  await expect(
    popup.getByText('No page text, URLs, or key values'),
  ).toBeVisible();
  if (process.env.OPENTAKE_CAPTURE_SCREENSHOTS === '1') {
    await popup.screenshot({ path: testInfo.outputPath('popup.png') });
  }

  const editor = await context.newPage();
  await editor.setViewportSize({ width: 1440, height: 900 });
  await editor.goto(`chrome-extension://${extensionId}/editor.html`);
  await expect(editor.getByText('OpenTake', { exact: true })).toBeVisible();
  await editor
    .getByRole('button', { name: 'Export', exact: true })
    .first()
    .click();
  await editor.getByLabel('Container').selectOption('webm');
  await expect(editor.getByLabel('Codec / audio')).toContainText('AV1 / Opus');
  await expect(
    editor.getByRole('button', { name: 'Export renderer not wired yet' }),
  ).toBeDisabled();
  if (process.env.OPENTAKE_CAPTURE_SCREENSHOTS === '1') {
    await editor.screenshot({ path: testInfo.outputPath('editor.png') });
  }
});
