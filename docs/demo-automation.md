# Demo automation

OpenTake will support reusable demo recipes for browser applications. A recipe names an HTTP or HTTPS target, a viewport, semantic UI actions, pointer actions in normalized coordinates, and export settings. Recipes do not allow arbitrary JavaScript.

The first acceptance recipe covers the [FMoW Atlas](https://data.source.coop/geospatialml/fmow/index.html). It waits for the 409k-sample dataset to load, switches the Class and Split controls, zooms into the globe, clicks the map, toggles boxes, advances the sample, and pauses for inspection. The requested export is 2560 x 1440 WebM at 1.5x speed using VP9 quality 80.

The recipe structure and FMoW fixture are implemented and validated. The automation runner, compositor, and exporter are not implemented yet, so this scenario is an acceptance contract rather than a passing end-to-end export test. The test should become a live opt-in Playwright run after those three components exist.

Target URLs belong to user-authored recipe configuration. OpenTake must not copy a URL into a recording's event log or project metadata during ordinary manual capture.
