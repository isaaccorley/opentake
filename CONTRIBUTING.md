# Contributing

OpenTake is intentionally early. Please open an issue before starting a large feature so the project document and render contracts remain coherent.

## Ground rules

- Work through the milestones in `docs/architecture.md` order.
- Keep modules under `src/core/` pure and importable in Node. Browser APIs belong under `src/platform/`.
- Keep event logs and edit data in source time.
- Never persist key values, page text, or URLs.
- Add a regression test for bug fixes. Renderer changes require a golden-frame fixture.
- Do not introduce a component library or an FFmpeg WebAssembly dependency.

Before submitting a change, run:

```sh
bun run check
```

Biome owns formatting, import organization, and linting. Apply its safe fixes
with:

```sh
bun run fix
```

The unpacked-extension test also needs Playwright's Chromium build:

```sh
bunx playwright install chromium
bun run test:e2e
```

Commits use Conventional Commits with a short subject, for example `fix: preserve zoom timing across cuts`.
