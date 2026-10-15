# Usable recording studio

## Delivery plan

1. Replace the sample editor with a local library, video import, real playback and recording handoff.
2. Wire a retained source range, seek controls, undo/redo and automatic project persistence. Show only implemented editing tools.
3. Add local MP4 and WebM conversion with trim, proportional resize, progress, cancellation and original-file download. Use Mediabunny's verified conversion API and stream output to disk.
4. Harden recording lifecycle: duplicate starts, acquisition cancellation, ended tracks and local-library preservation.
5. Verify real media import, edited export metadata, reload persistence, recording handoff, accessibility and responsive layouts; run repository gates.

## Acceptance

A user can import or record a clip, view its actual pixels, select a valid range, export that range, reopen their saved edit and download the original. Empty states and failures explain the next action. No fabricated waveform, preview or camera controls.

## Scope

This delivery is a single-clip Chromium studio. Firefox capture, automatic zoom, cursor rendering, speed ramps and styled backgrounds remain future work. Preview plays the retained source range; export uses that same range with proportional resize and no visual effects. Store submission remains subject to docs/RELEASING.md.

## Verification notes

Browser tests use Chromium's test-only extension allowlist to grant capture permission for a local fixture tab; they exercise real tabCapture acquisition as well as synthetic media. They do not automate Chrome's toolbar permission gesture. Production still requires invoking the extension on the tab. Do not use the fake-camera UI flag in this test: it redirects capture requests to nonexistent devices.

Export tests inspect downloaded files with ffprobe: the selected 1.1-second interval contains exactly 33 video frames, both outputs retain audio, and no upscaling occurs. AAC/Opus encoder padding is checked separately from video frame count. Desktop/mobile screenshots and axe checks cover the actual loaded editor.

## Completed local gate (2026-09-06)

- `bun run check`: formatting/lint, types, 13 unit tests, dead-code, production build, permission/CSP and bundle budgets, Firefox build and extension lint passed.
- `bun run test:e2e`: 8 browser tests passed, including real capture and synthetic worker restart.
- Export failure/cancellation tests check partial-file cleanup; successful files remain available until the download consumer releases them.
- Desktop and 390px editor screenshots inspected; no horizontal overflow or automated axe violations.

Load `dist/` as an unpacked Chromium extension. No commit, push or browser-store submission was performed.
