# OpenTake

OpenTake is a local-first Chromium extension for recording browser tabs and editing polished screen videos without an account, backend, or upload path.

> [!IMPORTANT]
> OpenTake is an early scaffold. The project model, time-remapping core, extension surfaces, and editor shell are under active construction; recording and export are not production-ready yet.

## Principles

- Record raw media and a timestamped interaction log. Never bake zoom, trim, speed, cursor, or styling effects into captured pixels.
- Store every edit and interaction in source time. Output time is derived by one exact, testable time map.
- Keep media in OPFS and project metadata in extension storage. No network service is required.
- Make preview and export use the same deterministic compositor.
- Offer a compatibility export and better-compression choices: H.264/AAC in MP4, plus VP9 or AV1 with Opus in WebM when WebCodecs reports support.
- Never record key values, page text, or browsing URLs.

See [Architecture](docs/architecture.md), [Privacy](docs/privacy.md), and [Contributing](CONTRIBUTING.md).

## Development

Requirements: Node.js 22.12 or newer, pnpm 11, and Chrome 116 or newer.

```sh
pnpm install
pnpm dev
```

For a loadable production build:

```sh
pnpm build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`.

Run the full local gate with:

```sh
pnpm check
```

## Scope

The first release targets Chrome, Edge, and Brave through Manifest V3. Firefox, cloud sync, accounts, webcam overlays, multi-clip timelines, and desktop capture are outside the v1 scope.

## License

[MIT](LICENSE)
