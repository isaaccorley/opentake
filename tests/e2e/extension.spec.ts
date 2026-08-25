import { resolve } from 'node:path';
import {
  type BrowserContext,
  chromium,
  expect,
  type Page,
  test,
} from '@playwright/test';

const chromePath = process.env.OPENTAKE_CHROME_PATH;
const extensionPath = resolve(import.meta.dirname, '../../dist');

let context: BrowserContext;
let extensionId: string;
let sentinelPage: Page;

function extensionUrl(path: string): string {
  return `chrome-extension://${extensionId}/${path}`;
}

async function openExtensionPage(
  path: string,
  viewport: { width: number; height: number },
): Promise<{ page: Page; errors: string[] }> {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewportSize(viewport);
  await page.goto(extensionUrl(path));
  return { page, errors };
}

function expectNoRuntimeErrors(errors: string[]): void {
  expect(errors, 'extension page emitted runtime errors').toEqual([]);
}

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
  sentinelPage = context.pages()[0] ?? (await context.newPage());
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => context.close());

test.afterEach(async () => {
  await Promise.all(
    context
      .pages()
      .filter((page) => page !== sentinelPage && !page.isClosed())
      .map((page) => page.close()),
  );
});

test('loads the MV3 extension and answers recording status', async () => {
  const { page: popup, errors } = await openExtensionPage('popup.html', {
    width: 360,
    height: 320,
  });
  await expect(popup.getByText('OpenTake', { exact: true })).toBeVisible();
  await expect(
    popup.getByText('Ready to record the active tab.'),
  ).toBeVisible();
  await expect(
    popup.getByRole('button', { name: 'Record this tab' }),
  ).toBeEnabled();
  await expect(
    popup.getByText('No page text, URLs, or key values'),
  ).toBeVisible();
  const manifest = await popup.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(
    expect.arrayContaining(['offscreen', 'storage', 'tabCapture']),
  );
  const recordingStatus = await popup.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'RECORDING_STATUS' }),
  );
  expect(recordingStatus).toMatchObject({ ok: true, state: 'idle' });
  expectNoRuntimeErrors(errors);
});

test('opens the editor from the popup', async () => {
  const { page: popup, errors: popupErrors } = await openExtensionPage(
    'popup.html',
    { width: 360, height: 320 },
  );
  const editorPromise = context.waitForEvent('page');
  await popup.getByRole('button', { name: 'Open editor' }).click();
  const editor = await editorPromise;
  await editor.waitForLoadState('domcontentloaded');
  expect(editor.url()).toBe(extensionUrl('editor.html'));
  await expect(editor.getByText('OpenTake', { exact: true })).toBeVisible();
  expectNoRuntimeErrors(popupErrors);
});

test('supports editor transport and timeline keyboard controls', async () => {
  const { page: editor, errors } = await openExtensionPage('editor.html', {
    width: 1440,
    height: 900,
  });
  const playButton = editor.getByRole('button', { name: 'Play' });
  await playButton.click();
  await expect(editor.getByRole('button', { name: 'Pause' })).toBeVisible();
  await editor.keyboard.press('Space');
  await expect(editor.getByRole('button', { name: 'Play' })).toBeVisible();

  const timeline = editor.getByRole('slider', { name: 'Timeline playhead' });
  await editor.getByRole('button', { name: 'Home' }).click();
  await expect(timeline).toHaveAttribute('aria-valuenow', '0');
  await timeline.focus();
  await editor.keyboard.press('ArrowRight');
  await expect(timeline).not.toHaveAttribute('aria-valuenow', '0');
  await editor.getByRole('button', { name: 'End' }).click();
  await expect(timeline).toHaveAttribute('aria-valuenow', '92.4');
  expectNoRuntimeErrors(errors);
});

test('switches editor panels and exposes compression formats', async ({
  browserName,
}, testInfo) => {
  void browserName;
  const { page: editor, errors } = await openExtensionPage('editor.html', {
    width: 1440,
    height: 900,
  });
  await editor.getByRole('button', { name: 'Zoom', exact: true }).click();
  await expect(editor.getByText('Follow-cursor keyframes')).toBeVisible();
  await editor.getByRole('button', { name: 'Speed', exact: true }).click();
  await expect(editor.getByText('Rate at playhead')).toBeVisible();
  await editor
    .getByRole('button', { name: 'Export', exact: true })
    .first()
    .click();
  await editor.getByLabel('Container').selectOption('webm');
  await expect(editor.getByLabel('Codec / audio')).toContainText('VP9 / Opus');
  await expect(editor.getByLabel('Codec / audio')).toContainText('AV1 / Opus');
  await editor.getByLabel('Rate control').selectOption('bitrate');
  await expect(editor.getByText('Bitrate (Mbps)')).toBeVisible();
  await expect(
    editor.getByRole('button', { name: 'Export renderer not wired yet' }),
  ).toBeDisabled();
  if (process.env.OPENTAKE_CAPTURE_SCREENSHOTS === '1') {
    await editor.screenshot({ path: testInfo.outputPath('editor.png') });
  }
  expectNoRuntimeErrors(errors);
});
