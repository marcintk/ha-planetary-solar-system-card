# Lessons log

Root cause + guardrail per shipped change, newest first. Consulted before new work — grep the
symptom before reproducing. Per-issue detail lives in `docs/design-notes/`; this is the by-symptom
index.

<!-- ponytail: single file; split by area if it outgrows one screen-scroll -->

## A rendered element needs to respond to pan/zoom without a full SVG rebuild

- **Root cause:** the Sun halo had to fill the visible view at any zoom, but zoom is a `viewBox`
  swap applied by `solar-view.ts` _after_ `renderSolarSystem()` has already built the SVG once.
  Sizing the halo inside `renderSolarSystem` (which only runs on date-change / mount) left it stuck
  at its zoom-1 size; threading the zoom state into `renderSolarSystem` would force a full
  imperative SVG rebuild on every zoom tick.
- **Guardrail:** follow the existing `updateMarkers` pattern — `renderSolarSystem` returns a closure
  over the built `svg` (`updateHalo(viewState)`), and `SolarView.applyViewState()` calls it right
  after `setAttribute("viewBox", …)`, next to `updateMarkers`. Anything that must track pan/zoom is
  a returned `update*` closure, not a render input.
- **Ref:** [#199](https://github.com/marcintk/ha-planetary-solar-system-card/issues/199) ·
  2026-08-30

## A stylised shadow/tint reads wrong through many geometry iterations

- **Root cause:** #199's day/night shadow was built as hard-edged geometry — an opaque half-disc on
  bodies, then stroked lit/dark arcs on Saturn's rings. The ring version went through ~7 rejected
  geometries (`atan2` vs `asin` half-angle, 180° split, point-source umbra, tone tweaks) because a
  hard boundary on a stylised top-down diagram never matched what "a shadow falling across the
  rings" should look like, and the disagreement was about feel, not maths.
- **Guardrail:** the fix that landed and then unified the whole feature was a **translucent overlay
  layer** — one `renderBodyShadow()` that washes the anti-sunward half dark
  (`fill="#05070c" fill-opacity="0.45"`), the SVG cousin of the gallery's `mix-blend-mode: color`
  tint (`.gallery-thumb-tint`). For a lone body it's a translucent `darkD` half-disc path; for
  Saturn a `<clipPath>` band over body + rings. When a shading/tint effect keeps reading wrong,
  reach for an overlay wash before iterating the geometry again.
- **Ref:** [#199](https://github.com/marcintk/ha-planetary-solar-system-card/issues/199) ·
  2026-08-30

## Renderer tests fail on `circle[fill="#hex"]` after a body's SVG shape changes

- **Root cause:** tests located a rendered body by element type + fill
  (`svg.querySelector('circle[fill="#4a90d9"]')`). Changing `renderBody` to emit two `<path>` halves
  instead of a `<circle>` made every such locator return `null` — 6 tests across
  `test/renderer/index.test.ts` and the coarse snapshot broke on a change that was visually correct.
  Recurred one slice later when the comet head switched the same way
  (`test/renderer/comets.test.ts`).
- **Guardrail:** `bodyPos(svg, hex)` helper in `test/renderer/index.test.ts` resolves a body's
  centre from a `circle[fill]` **or** the midpoint of a lit `path[fill]`'s `d`; `comets.test.ts`
  reconstructs the head centre the same way. Rendering changes assert on geometry recomputed from
  `d`, not on the element type.
- **Ref:** [#199](https://github.com/marcintk/ha-planetary-solar-system-card/issues/199) ·
  2026-08-30
