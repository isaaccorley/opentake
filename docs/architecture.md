# Architecture

## Recording

The popup starts and stops tab recordings. After the user invokes the extension, the Chromium service worker creates a tab-capture stream ID and passes it to an offscreen document. The offscreen document owns the recorder and streams media chunks to OPFS, so recording continues across service-worker restarts.

The content script collects timestamped pointer, click, scroll and key-press markers. It does not collect page text, URLs or key values. Recording-session metadata and the list of completed recordings live in extension storage.

Firefox has a separate package with an event-page background script. Its capture adapter is not implemented; the popup disables recording there.

## Projects and playback

- `src/core/project.ts` defines and validates the versioned project document and its serialization.
- `src/platform/` contains recording, interaction collection and OPFS storage.
- `src/editor/` contains the library, playback, editing state and export.
- `src/popup/` provides recording controls.

Media files and `project-<id>.json` documents live in OPFS. The editor queues saves and reports a document as saved only after its write completes. Undo/redo changes the project document without rewriting the original video.

The editor supports one retained range, stored in source seconds. Native video playback and export use that same range. The version-1 schema retains speed, camera and appearance fields for document compatibility, but the UI does not expose them. Export rejects speed/camera edits it cannot render.

## Export

`src/editor/export.ts` uses Mediabunny Conversion to trim and resize proportionally. It writes to a temporary OPFS file through StreamTarget, then starts a local download. Cancellation or failure removes partial output; completed output remains available until the download consumer releases it.

The UI offers MP4 with H.264/AAC and WebM with VP9/Opus. Conversion checks the actual source tracks and requested output. Unsupported codecs produce an error; audio is never silently dropped. Audio encoder padding can slightly extend container duration beyond the selected video range.

## Build and checks

Vite builds separate Chromium and Firefox packages. Styling uses plain CSS and locally bundled fonts. Zod runs in interpreter mode; the build removes optional JIT branches to satisfy extension CSP and Firefox's static checks.

`bun run check` validates formatting, types, unit tests, unused files/dependencies/exports/types, both browser packages, extension policy and bundle size. `bun run test:e2e` exercises playback, editing, saves, export, accessibility and recording in Chromium. Real tab-capture tests use Chromium's test-only permission allowlist for a local fixture page; they do not automate the toolbar permission gesture.
