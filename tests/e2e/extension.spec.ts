import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import {
  type BrowserContext,
  chromium,
  expect,
  type Page,
  test,
} from '@playwright/test';

const chromePath = process.env.OPENTAKE_CHROME_PATH;
const extensionPath = resolve(import.meta.dirname, '../../dist-e2e');

let context: BrowserContext;
let extensionId: string;
let sentinelPage: Page;
let server: Server;
let targetUrl: string;

const syntheticTarget = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>OpenTake capture fixture</title></head>
  <body style="margin:0;background:#10252c;color:#f4f0df;font:24px sans-serif">
    <main style="padding:48px">
      <h1>Synthetic recording target</h1>
      <button id="action" type="button">Interaction target</button>
      <input aria-label="Synthetic input" value="non-sensitive fixture">
      <canvas id="canvas" width="900" height="480"></canvas>
    </main>
    <script>
      const canvas = document.querySelector('#canvas');
      const context = canvas.getContext('2d');
      let frame = 0;
      function paint() {
        frame += 1;
        context.fillStyle = '#173d45';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#d4f36a';
        context.fillRect((frame * 4) % 760, 160, 140, 140);
        requestAnimationFrame(paint);
      }
      paint();
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      gain.gain.value = 0.01;
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      audio.resume();
    </script>
  </body>
</html>`;

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

async function prepareCapture(): Promise<{
  popup: Page;
  target: Page;
  targetTabId: number;
}> {
  const target = await context.newPage();
  await target.goto(targetUrl);
  await target.bringToFront();
  const worker = context.serviceWorkers()[0];
  const targetTabId = await worker?.evaluate(async () => {
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    return tabs[0]?.id;
  });
  if (targetTabId === undefined)
    throw new Error('Synthetic target tab missing');
  const { page: popup } = await openExtensionPage('popup.html', {
    width: 360,
    height: 320,
  });
  await popup.evaluate(
    (tabId) => chrome.tabs.update(tabId, { active: true }),
    targetTabId,
  );
  await popup.reload();
  await expect(
    popup.getByRole('button', { name: 'Record this tab' }),
  ).toBeEnabled();
  return { popup, target, targetTabId };
}

async function startSyntheticRecording(
  popup: Page,
  targetTabId: number,
): Promise<void> {
  const response = await popup.evaluate(
    ({ tabId }) =>
      chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        targetTabId: tabId,
        streamId: '__opentake_e2e_synthetic_media__',
        countdownMs: 3000,
      }),
    { tabId: targetTabId },
  );
  const diagnostics = await popup.evaluate(async () => ({
    contexts: await chrome.runtime.getContexts({}),
    stored: await chrome.storage.local.get(),
  }));
  expect(response.ok, JSON.stringify({ response, diagnostics })).toBe(true);
  expect(response).toMatchObject({ state: 'starting' });
  await popup.reload();
}

function expectNoRuntimeErrors(errors: string[]): void {
  expect(errors, 'extension page emitted runtime errors').toEqual([]);
}

test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName;
  server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(syntheticTarget);
  });
  await new Promise<void>((resolveListen) => {
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address() as AddressInfo;
  targetUrl = `http://127.0.0.1:${address.port}/`;
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
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-ui-for-media-stream',
      ],
    },
  );
  sentinelPage = context.pages()[0] ?? (await context.newPage());
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context.close();
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
});

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

test('has no automatically detectable accessibility violations', async () => {
  const { page: popup } = await openExtensionPage('popup.html', {
    width: 360,
    height: 320,
  });
  await expect(popup.getByText('OpenTake', { exact: true })).toBeVisible();
  const popupResults = await new AxeBuilder({ page: popup }).analyze();
  expect(popupResults.violations).toEqual([]);

  const { page: editor } = await openExtensionPage('editor.html', {
    width: 1440,
    height: 900,
  });
  await expect(editor.getByText('OpenTake', { exact: true })).toBeVisible();
  const editorResults = await new AxeBuilder({ page: editor }).analyze();
  expect(editorResults.violations).toEqual([]);
});

test('cancels the countdown without leaving a recording session', async () => {
  const { popup, targetTabId } = await prepareCapture();
  await startSyntheticRecording(popup, targetTabId);
  await popup.getByRole('button', { name: 'Cancel countdown' }).click();
  await expect
    .poll(
      () =>
        popup.evaluate(() =>
          chrome.runtime.sendMessage({ type: 'RECORDING_STATUS' }),
        ),
      { timeout: 10_000 },
    )
    .toMatchObject({ ok: true, state: 'idle' });
  await expect(popup.getByText('Recording countdown canceled.')).toBeVisible();
  const state = await popup.evaluate(async () => ({
    status: await chrome.runtime.sendMessage({ type: 'RECORDING_STATUS' }),
    stored: await chrome.storage.local.get('recordingSession'),
  }));
  expect(state.status).toMatchObject({ ok: true, state: 'idle' });
  expect(state.stored.recordingSession).toBeUndefined();
});

test('cleans up a reported media acquisition failure', async () => {
  const { page: popup } = await openExtensionPage('popup.html', {
    width: 360,
    height: 320,
  });
  const response = await popup.evaluate(() =>
    chrome.runtime.sendMessage({
      type: 'START_RECORDING',
      targetTabId: 1,
      streamId: 'invalid-stream-id',
      countdownMs: 60_000,
    }),
  );
  expect(response).toMatchObject({ ok: true, state: 'starting' });
  const status = await popup.evaluate(async () => {
    const active = await chrome.runtime.sendMessage({
      type: 'RECORDING_STATUS',
    });
    await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_FAILED',
      sessionId: active.session.id,
      error: 'Synthetic media acquisition failure',
    });
    return chrome.runtime.sendMessage({ type: 'RECORDING_STATUS' });
  });
  expect(status).toMatchObject({ ok: true, state: 'idle' });
  const stored = await popup.evaluate(() =>
    chrome.storage.local.get(['recordingSession', 'recordingError']),
  );
  expect(stored.recordingSession).toBeUndefined();
  expect(stored.recordingError).toEqual(expect.any(String));
});

test('records synthetic media across a service-worker restart', async () => {
  const { popup, target, targetTabId } = await prepareCapture();
  const worker = context.serviceWorkers()[0];
  expect(worker).toBeDefined();
  await worker?.evaluate(() => {
    Object.assign(globalThis, { __opentakeWorkerMarker: 'before-idle' });
  });

  await startSyntheticRecording(popup, targetTabId);
  await expect
    .poll(
      () =>
        popup.evaluate(async () => ({
          status: await chrome.runtime.sendMessage({
            type: 'RECORDING_STATUS',
          }),
          contexts: await chrome.runtime.getContexts({}),
          stored: await chrome.storage.local.get(),
        })),
      { timeout: 10_000 },
    )
    .toMatchObject({
      status: { ok: true, state: 'recording' },
      stored: { recordingSession: expect.any(Object) },
    });
  await expect(
    popup.getByText('Recording this tab to local storage.'),
  ).toBeVisible();
  await target.bringToFront();
  await target.getByRole('button', { name: 'Interaction target' }).click();
  await target.keyboard.press('KeyA');
  await target.mouse.move(500, 300);

  const cdp = await context.newCDPSession(target);
  const targets = await cdp.send('Target.getTargets');
  const serviceWorkerTarget = targets.targetInfos.find(
    (item) =>
      item.type === 'service_worker' && item.url.startsWith(extensionUrl('')),
  );
  expect(serviceWorkerTarget).toBeDefined();
  await cdp.send('Target.closeTarget', {
    targetId: serviceWorkerTarget?.targetId ?? '',
  });

  await popup.bringToFront();
  await popup.reload();
  const restartedWorker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 5000 }));
  const marker = await restartedWorker.evaluate(
    () =>
      (globalThis as { __opentakeWorkerMarker?: string })
        .__opentakeWorkerMarker,
  );
  expect(marker).toBeUndefined();

  const editorPromise = context.waitForEvent('page');
  await expect(
    popup.getByRole('button', { name: 'Stop recording' }),
  ).toBeVisible();
  await popup.getByRole('button', { name: 'Stop recording' }).click();
  const editor = await editorPromise;
  await editor.waitForLoadState('domcontentloaded');
  const recording = await editor.evaluate(async () => {
    const stored = await chrome.storage.local.get('lastRecording');
    const last = stored.lastRecording as {
      mediaKey: string;
      eventKey: string;
      finalized: boolean;
    };
    const root = await navigator.storage.getDirectory();
    const media = await (await root.getFileHandle(last.mediaKey)).getFile();
    const events = await (await root.getFileHandle(last.eventKey)).getFile();
    return {
      last,
      mediaSize: media.size,
      eventLog: JSON.parse(await events.text()) as {
        clicks: unknown[];
        keyMarks: unknown[];
        viewport: unknown[];
      },
    };
  });
  expect(recording.last.finalized).toBe(true);
  expect(recording.mediaSize).toBeGreaterThan(0);
  expect(recording.eventLog.clicks.length).toBeGreaterThan(0);
  expect(recording.eventLog.keyMarks.length).toBeGreaterThan(0);
  expect(recording.eventLog.viewport.length).toBeGreaterThan(0);
});
