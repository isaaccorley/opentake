import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

export async function verifyEditorFlow(
  editor: Page,
  testInfo: TestInfo,
): Promise<void> {
  await expect(
    editor.getByRole('heading', { name: 'No videos yet' }),
  ).toBeVisible();
  await editor.screenshot({
    path: testInfo.outputPath('library.png'),
    fullPage: true,
  });
  await editor
    .getByLabel('Import video file')
    .setInputFiles(resolve(import.meta.dirname, '../fixtures/synthetic.webm'));
  await expect(
    editor.getByRole('heading', { name: 'synthetic.webm' }),
  ).toBeVisible();
  const preview = editor.locator('video');
  await expect
    .poll(() =>
      preview.evaluate((element: HTMLVideoElement) => element.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await editor.getByRole('button', { name: 'Play', exact: true }).click();
  await expect
    .poll(() =>
      preview.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0.1);
  await editor.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(editor.getByLabel('Start (seconds)')).not.toBeVisible();
  await expect(editor.getByLabel('Format', { exact: true })).not.toBeVisible();
  await expect(
    editor.getByRole('button', { name: 'Export video' }),
  ).toBeVisible();
  await editor.getByText('Precise timing', { exact: true }).click();
  await editor.getByLabel('Start (seconds)').fill('0.4');
  await editor.getByLabel('End (seconds)').fill('1.5');
  await editor.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(editor.getByLabel('End (seconds)')).not.toHaveValue('1.5');
  await editor.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(editor.getByLabel('End (seconds)')).toHaveValue('1.5');
  await expect(
    editor.getByRole('status').filter({ hasText: 'Saved on this device' }),
  ).toBeVisible();
  await editor.reload();
  await editor.getByRole('button', { name: /synthetic.webm/ }).click();
  await expect(editor.getByLabel('Start (seconds)')).not.toBeVisible();
  await editor.getByText('Precise timing', { exact: true }).click();
  await expect(editor.getByLabel('Start (seconds)')).toHaveValue('0.4');
  await expect(editor.getByLabel('End (seconds)')).toHaveValue('1.5');
  await expect
    .poll(() =>
      preview.evaluate((element: HTMLVideoElement) => element.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  const axe = await new AxeBuilder({ page: editor }).analyze();
  expect(axe.violations).toEqual([]);
  await editor.getByText('Precise timing', { exact: true }).click();
  await editor.screenshot({
    path: testInfo.outputPath('editor.png'),
    fullPage: true,
  });
  await editor.getByText('Advanced export options', { exact: true }).click();
  for (const format of ['webm', 'mp4']) {
    await editor.getByLabel('Format', { exact: true }).selectOption(format);
    const supported =
      format !== 'mp4' ||
      (await editor.evaluate(async () => {
        try {
          const [video, audio] = await Promise.all([
            VideoEncoder.isConfigSupported({
              codec: 'avc1.42001f',
              width: 320,
              height: 180,
              bitrate: 1_000_000,
            }),
            AudioEncoder.isConfigSupported({
              codec: 'mp4a.40.2',
              sampleRate: 48000,
              numberOfChannels: 1,
              bitrate: 128000,
            }),
          ]);
          return video.supported && audio.supported;
        } catch {
          return false;
        }
      }));
    if (!supported) {
      await editor.getByRole('button', { name: 'Export video' }).click();
      await expect(editor.getByRole('alert')).toContainText(
        'cannot encode all tracks',
      );
      await editor.getByRole('button', { name: 'Dismiss error' }).click();
      continue;
    }
    const downloading = editor.waitForEvent('download');
    await editor.getByRole('button', { name: 'Export video' }).click();
    const download = await downloading;
    const path = testInfo.outputPath(`edited.${format}`);
    await download.saveAs(path);
    const { execFileSync } = await import('node:child_process');
    const metadata = JSON.parse(
      execFileSync(
        'ffprobe',
        [
          '-v',
          'quiet',
          '-show_format',
          '-show_streams',
          '-count_frames',
          '-of',
          'json',
          path,
        ],
        { encoding: 'utf8' },
      ),
    ) as {
      format: { duration: string };
      streams: Array<{
        codec_type: string;
        height?: number;
        nb_read_frames?: string;
      }>;
    };
    // AAC/Opus encoder priming can extend the container by a few audio packets.
    expect(Math.abs(Number(metadata.format.duration) - 1.1)).toBeLessThan(0.1);
    expect(
      metadata.streams.find((track) => track.codec_type === 'video')
        ?.nb_read_frames,
    ).toBe('33');
    expect(
      metadata.streams.some(
        (track) => track.codec_type === 'video' && track.height === 180,
      ),
    ).toBe(true);
    expect(metadata.streams.some((track) => track.codec_type === 'audio')).toBe(
      true,
    );
  }
  await editor.getByText('Advanced export options', { exact: true }).click();
  await editor.setViewportSize({ width: 390, height: 844 });
  await editor.screenshot({
    path: testInfo.outputPath('editor-mobile.png'),
    fullPage: true,
  });
  expect(
    await editor.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
