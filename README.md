# OpenTake

OpenTake is a local-first browser extension for recording browser tabs and editing screen videos without an account, backend, or upload path.

<p>
  <a href="https://github.com/isaaccorley/opentake/releases"><img alt="Download developer build" src="https://img.shields.io/badge/Download-developer_build-D4F36A?style=for-the-badge&logo=github&logoColor=101112"></a>
  <a href="#install-locally"><img alt="Install locally" src="https://img.shields.io/badge/Install-load_unpacked-303438?style=for-the-badge&logo=googlechrome&logoColor=white"></a>
</p>

> [!IMPORTANT]
> OpenTake is a local developer build with a working single-clip studio: Chromium tab recording, video import, playback, trim, saved edits, and MP4/WebM export. It is not yet a reviewed browser-store release.

## Use the studio

1. Open the extension on a normal web page and choose **Record this tab**. A three-second countdown gives you time to close the popup. Tab audio is included; microphone and webcam are not captured.
2. Reopen the extension and choose **Stop recording**. The finished clip opens in the editor. Or choose **Open editor → Import video** to edit an existing local file.
3. Play the actual video, seek with the timeline, and use **Start video here / End video here** at the playhead. Open **Precise timing** when you need exact start/end seconds. Undo/redo restores earlier edits.
4. Choose **Export video** to use the saved settings. **Advanced export options** reveals WebM/MP4, maximum height and original-file download. Output preserves proportions and never upscales. Keep the editor tab open during export; progress and cancellation are available.
5. Reopen **Your videos** to continue an edit. Wait for **Saved on this device** before closing. Download the original or edited file for a backup; clearing extension data or uninstalling removes the local library.

Exports use device codecs. Unsupported tracks produce an error instead of silently dropping audio. Audio encoders can add a small amount of trailing padding to the selected range. Files and edits stay on-device; there is no upload path.

## Principles

- Preserve source media. Trimming never rewrites the original.
- Store trim boundaries in source time. Preview and export use the same selected range.
- Store media and project documents in OPFS; recording session metadata stays in extension storage.
- Only expose working tools. Automatic zoom, cursor effects, speed editing and presentation backgrounds are not part of this studio yet.
- Never collect key values, page text, or browsing URLs as interaction metadata. Recorded pixels and tab audio naturally contain what is visible and audible in the chosen tab.

See [Architecture](docs/architecture.md), [Privacy](docs/privacy.md), [Contributing](CONTRIBUTING.md), and [Releasing](docs/RELEASING.md).

## Install locally

Chrome only permits [one-click extension installation through the Chrome Web Store](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions). Until OpenTake has an approved listing, install it as an unpacked extension.

### From a developer build

1. Download a ZIP from [Releases](https://github.com/isaaccorley/opentake/releases) and extract it. If the page is empty, build from source instead.
2. Open `chrome://extensions` in Chrome, Edge, or Brave.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.

Unpacked extensions do not update automatically. Download and load a newer build when a release is published.

### From source

Requirements: Bun 1.4 or newer and Node.js 22.12 or newer.

```sh
bun install
bun run build
```

Then follow steps 2–4 above and select `dist/`.

For the Firefox package, run `bun run build:firefox`, open `about:debugging`, choose **This Firefox**, and load `dist-firefox/manifest.json` as a temporary add-on. Temporary add-ons are removed when Firefox restarts.

## Development

Requirements: Bun 1.4 or newer, Node.js 22.12 or newer, Chrome 116 or newer, or Firefox 140 or newer.

```sh
bun install
bun run dev
```

Run the full local gate with:

```sh
bun run check
bun run test:e2e
```

Browser tests need Playwright Chromium and `ffprobe` (from FFmpeg). Run `bunx playwright install chromium` first. They cover import, playback, persistence, export tracks and duration, accessibility, recording handoff, and worker restart.

## Scope

The first release targets Chrome, Edge, Brave, and Firefox through their Manifest V3-compatible extension APIs. The repository produces and lints separate Chromium and Firefox packages. Chromium tab recording is implemented; Firefox tab capture still needs its browser-specific capture adapter before release. Cloud sync, accounts, webcam overlays, multi-clip timelines, and desktop capture are outside the v1 scope.

## License

[MIT](LICENSE)
