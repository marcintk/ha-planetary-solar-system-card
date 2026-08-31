# Lessons log

Root cause + guardrail per shipped change, newest first. Consulted before new work — grep the
symptom before reproducing. Per-issue detail lives in `docs/design-notes/`; this is the by-symptom
index.

<!-- ponytail: single file; split by area if it outgrows one screen-scroll -->

## Don't fold two visual switches into one enum — and keep the sphere look off the Sun vector

- **Root cause:** #199 grew a `display: 2d|3d` and a `shading: on|off` control. Slices 5–7 built the
  3d look as a Sun-facing gradient and collapsed both switches into one `ShadeMode`
  (`none|flat|sphere`). That (a) tied `display` to `shading` — you couldn't have a flat disc with
  day/night, or a 3d ball with no terminator — and (b) forced a per-body directional gradient: slice
  5's offset `<radialGradient fx="0.72">` read as a lopsided crescent, slice 6's rotated
  `<linearGradient>` needed a per-body `<g transform="rotate(atan2(CENTER−y,CENTER−x))">`.
- **Guardrail:** the two switches are orthogonal — model them as
  `ShadeOptions { sphere: boolean; dayNight: boolean }`, derived independently
  (`sphere = display !== "2d"`, `dayNight = shading !== false`), and let each renderer do
  `if (shade.sphere) …; if (shade.dayNight) …`. The `3d` ball look has no reason to track the Sun: a
  **centred** `<radialGradient cx=.5 cy=.5 r=.5>` (bright centre → dark rim) is radially symmetric,
  so it drops the per-body id, the `userSpaceOnUse` maths, and the rotation `<g>` entirely — one
  def, a plain `<circle fill="url(#sphere-3d)">`. The Sun-dependent part (day/night) stays the flat
  translucent `darkD` half-disc.
- **Salvage:** if you ever _do_ need a per-body directional gradient, the cheap way is still one
  shared `objectBoundingBox` gradient + a wrapper `<g transform="rotate(θ x y)">` — the gradient is
  painted in the element's pre-transform box, so the group rotation carries it. Just don't reach for
  it when a symmetric gradient will do.
- **Ref:** [#199](https://github.com/marcintk/ha-planetary-solar-system-card/issues/199) ·
  2026-08-30

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
  tint (`.gallery-thumb-tint`). Lone bodies use the translucent `darkD` half-disc path (slices 5–6
  briefly tried a gradient, slice 8 reverted — see the entry above); Saturn is a `<clipPath>` band
  over body + rings. When a shading/tint effect keeps reading wrong, reach for an overlay wash
  before iterating the geometry again.
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
