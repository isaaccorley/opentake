# Architecture

## Non-destructive pipeline

OpenTake records raw media and an interaction log. The editor mutates a versioned `ProjectDoc`; it never rewrites source media. Preview and export both call the same conceptual function:

```text
render(sourceMedia, projectDoc, outputTime) -> frame
```

The renderer is deterministic for a source frame, project document, and output timestamp. Zooms, pans, trims, speed changes, backgrounds, cursor styling, rounding, and shadows are render-time inputs.

## Time domains

All edit data is keyed by source time `tau`. Trims remove source intervals, and speed segments define a piecewise-constant rate over retained source time. `TimeMap` computes both `source -> output` and its exact piecewise inverse. Output frame iteration never numerically searches for a source timestamp.

This boundary is deliberate: storing a zoom or event in output time would make later speed edits silently move it.

## Runtime boundaries

- `src/core/`: project schema, time mapping, camera decisions, and compositor math. Pure TypeScript; no DOM or extension imports.
- `src/platform/`: Manifest V3 routing, tab capture, the offscreen recorder, OPFS, content-script collection, WebCodecs capability probing, and browser adapters.
- `src/editor/`: editor state and UI. It mutates the project document and asks the renderer for preview frames.
- `src/popup/`: user-gesture entry point for starting a tab recording.

The service worker is a stateless message router. The offscreen document owns a recording so MV3 worker suspension cannot destroy live state. A persisted session marker supports recovery after worker restart or an unclean recording stop.

## Export architecture

Container, video codec, audio codec, and rate control are separate project settings. The initial valid combinations are:

| Use                             | Container | Video | Audio |
| ------------------------------- | --------- | ----- | ----- |
| Broad compatibility             | MP4       | H.264 | AAC   |
| Smaller, fast WebM              | WebM      | VP9   | Opus  |
| Best compression when available | WebM      | AV1   | Opus  |

Mediabunny provides one local mux/demux boundary for MP4 and WebM. WebCodecs performs hardware-backed encoding where available. The editor probes each concrete encoder configuration with `VideoEncoder.isConfigSupported()` and disables unavailable choices. No upload fallback and no `ffmpeg.wasm` path are planned.

## Milestone order

1. Skeleton: buildable MV3 surfaces, versioned schema, OPFS, and round-trip tests.
2. Recording: tab capture to OPFS plus aligned interaction events and crash recovery.
3. Renderer: exact `TimeMap`, demux/decode, deterministic compositor, and golden frames.
4. Editor: responsive preview, timeline, waveform cache, keyboard control, and undo/redo.
5. Editing: trims, zoom generation/editing, speed segments, and audio stretching.
6. Look and export: reframing, presentation controls, MP4/WebM encoding, progress, and cancellation.

Each milestone must meet its acceptance checks before the next one expands the surface area.
