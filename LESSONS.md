# Lessons log

Root cause + guardrail per shipped change, newest first. Consulted before new work — grep the
symptom before reproducing. Per-issue detail lives in `docs/design-notes/`; this is the by-symptom
index.

<!-- ponytail: single file; split by area if it outgrows one screen-scroll -->

## "Looks round" can't be separated from "looks lit" with an SVG gradient overlay — bake the sphere

- **Root cause:** #199's `display: 3d` tried to make a flat disc read as a 3-D planet with a
  translucent `#sphere-3d` overlay gradient, ~10 tunings over as many rounds: centred bright core
  (read as top-lit — the eye's light-from-above prior), Sun-directional offset focal + a per-body
  rotate-`<g>` (rotation was exact, every stop tune still read as a hot spot or a flat wash),
  limb-darkening only (read as flat, or blurry at the edge), opaque in-hue radial fill (still
  "lit"). A translucent radial can't give volume without implying a light source and a direction.
- **Guardrail:** when a "make it look 3-D" effect keeps reading wrong, stop tuning the gradient and
  **pre-bake a real shaded sphere**. `scripts/gen-sphere-sprites.mjs` renders two 128px Lambert
  spheres (a `soft` viewer-lit one for `shading: off`, a `lit` in-plane one for `shading: on`) to
  grayscale+alpha PNGs — with its own tiny PNG encoder, no deps — inlined into `bodies.ts` as
  `data:` URIs. Runtime is pure SVG: `<image href=SPRITE_*>` + a per-colour `<feColorMatrix>`
  multiply tints it, `transform="rotate(sunBearing)"` aims the lit one. **No runtime `<canvas>`**
  (jsdom has none), and the light params live in a re-runnable script, not guessed hex stops. The
  `lit` sprite's terminator is the day/night for 3d (no separate wash); 2d keeps
  `terminatorShadowPath`, and one `shadeFill()` (`color-mix(color 28%, black)`) makes both modes'
  dark sides the same in-hue tone.
- **Ref:** [#199](https://github.com/marcintk/ha-planetary-solar-system-card/issues/199) ·
  2026-09-01

## A multi-command SVG path test passes but the rendered shape is wrong

- **Root cause:** #199's `terminatorShadowPath` builds `M p1  A r r … p2  A (bow·r) r … p1  Z`. The
  slice-1 test checked "does the terminator arc bow into the dark side?" with a hand-rolled
  heuristic — chord direction + sweep flag → bulge offset — copied from the `sunwardHalfDiscPaths`
  tests, where the arc's start _is_ the `M` point. Here the second `A` chains from the **first arc's
  endpoint** (`p2`), not `M` (`p1`), which flips the `sweep`→bulge rule. The test passed with
  `sweep 1` while the arc actually bowed **toward** the Sun (lit hemisphere shrank instead of
  bulging). Only numeric SVG arc sampling / the render snapshot caught it.
- **Guardrail:** for geometry on a multi-command SVG path, assert against a real endpoint→centre arc
  parameterisation (SVG spec F.6.5) **or** pin the literal `d` string plus the render snapshot —
  never a bespoke "which way does it bulge" heuristic keyed to the `M` point. Each `A` starts where
  the previous command ended.
- **Ref:** [#199](https://github.com/marcintk/ha-planetary-solar-system-card/issues/199) ·
  2026-08-31

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
- **Superseded (2026-09-01):** #199 was reopened and `display: 3d` was reworked several times. The
  _enum_ half of this guardrail still holds — `ShadeOptions { sphere, dayNight }` stays two
  independent booleans. But "the 3d ball never tracks the Sun" no longer does: an SVG gradient
  _can't_ give convincing volume without reading as lit, so `display: 3d` is now a **pre-baked
  Lambert sphere sprite** (see the "bake the sphere" entry at the top), and when `shading: true` its
  `lit` variant is rotated toward the Sun — the sprite carries the day/night. Don't try to revive
  the `#sphere-3d` _gradient_ for the ball; that's the dead end this entry documents.
- **Follow-on (slice 9):** the `#sphere-3d` gradient shape was originally dialed in on the card via
  a slider harness (`docs/sphere-tune.html`, since removed with the gradient), not guessed. Key
  constraint that outlived it: an `objectBoundingBox` gradient scales with the body, so any _wide_
  dark ramp fogs the big outer planets — keep the darkening pinned to the outermost sliver. Whatever
  draws the ball, dial it on the real card at real radii before committing numbers (the sprite is
  now tuned via `docs/shade-compare.html`).
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
- **Recurred hard (2026-09-01):** `display: 3d` moved from `<circle fill="url(#sphere-3d-…)">` to a
  pre-baked Lambert `<image filter="url(#tint-…)">` — ~24 tests broke on `circle[fill]` locators
  again. Fix pattern held: `bodyCircle(svg, hex[, extra])` now tries `circle[fill]` **or**
  `image[filter="url(#tint-<hex>)"]`, `bodyPos` derives an image body's centre from `x + width/2`,
  and `sphere3dCount` counts `image[filter^="url(#tint-"]`. When you change how a body is drawn,
  expect the whole `circle[fill]` locator surface to move and route it through one resolver.
- **Ref:** [#199](https://github.com/marcintk/ha-planetary-solar-system-card/issues/199) ·
  2026-08-30, 2026-09-01
