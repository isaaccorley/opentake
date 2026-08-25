# OpenTake

OpenTake is a local-first Chromium extension for recording browser tabs and editing polished screen videos without an account, backend, or upload path.

<p>
  <a href="https://github.com/isaaccorley/opentake/releases"><img alt="Download developer build" src="https://img.shields.io/badge/Download-developer_build-D4F36A?style=for-the-badge&logo=github&logoColor=101112"></a>
  <a href="#install-locally"><img alt="Install locally" src="https://img.shields.io/badge/Install-load_unpacked-303438?style=for-the-badge&logo=googlechrome&logoColor=white"></a>
</p>

> [!IMPORTANT]
> OpenTake is an early scaffold. The project model, time-remapping core, extension surfaces, and editor shell are under active construction; recording and export are not production-ready yet.

## Principles

- Record raw media and a timestamped interaction log. Never bake zoom, trim, speed, cursor, or styling effects into captured pixels.
- Store every edit and interaction in source time. Output time is derived by one exact, testable time map.
- Keep media in OPFS and project metadata in extension storage. No network service is required.
- Make preview and export use the same deterministic compositor.
- Offer a compatibility export and better-compression choices: H.264/AAC in MP4, plus VP9 or AV1 with Opus in WebM when WebCodecs reports support.
- Never record key values, page text, or browsing URLs.

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

Requirements: Node.js 22.12 or newer and pnpm 11.

```sh
pnpm install
pnpm build
```

Then follow steps 2–4 above and select `dist/`.

## Development

Requirements: Node.js 22.12 or newer, pnpm 11, and Chrome 116 or newer.

```sh
pnpm install
pnpm dev
```

Run the full local gate with:

```sh
pnpm check
```

## Scope

The first release targets Chrome, Edge, and Brave through Manifest V3. Firefox, cloud sync, accounts, webcam overlays, multi-clip timelines, and desktop capture are outside the v1 scope.

## License

[MIT](LICENSE)
