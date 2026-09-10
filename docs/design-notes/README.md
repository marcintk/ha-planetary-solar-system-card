# Design notes

Standalone, self-contained HTML reference pages — rendered explorations of a design or
implementation question, kept for future reference. Not ADRs (no decision log), not user-facing
docs.

The Deploy Demo Page workflow publishes this folder to GitHub Pages alongside the demo, so each page
has a rendered URL — link to that, since GitHub shows `.html` as source, not rendered.

- [Mymoon tile color](https://marcintk.github.io/ha-planetary-solar-system-card/design-notes/mymoon-tint-model.html)
  — the `mix-blend-mode: color` tint mechanism behind the `mymoon` gallery tile: the sun-elevation ×
  moon-altitude matrix, the extinction falloff formula, the contrast-fade coupling that lets a
  bright sky wash out the extinction tint (toggleable on the page to compare with/without), and the
  achromatic-blend pitfall found while researching
  [#177](https://github.com/marcintk/ha-planetary-solar-system-card/issues/177)/[#178](https://github.com/marcintk/ha-planetary-solar-system-card/issues/178).
- [Body shading & Sun halo](https://marcintk.github.io/ha-planetary-solar-system-card/design-notes/issue-199-sphere-shading.html)
  — _approved_ ([#199](https://github.com/marcintk/ha-planetary-solar-system-card/issues/199)) — two
  independent body-render switches. `display: 2d|3d` — flat disc vs. a **pre-baked Lambert sphere
  sprite** (two 128px grayscale PNGs inlined as data URIs by `scripts/gen-sphere-sprites.mjs`,
  tinted per colour by `<feColorMatrix>`; a `soft` variant with `shading` off, a `lit` one rotated
  toward the Sun with it on — the sprite carries the day/night); the Sun stays a flat disc.
  `shading: true|false` — for `2d` bodies, an elliptical `terminatorShadowPath` wash filled by
  `shadeFill()` = `color-mix(colour 28%, black)` so 2d and 3d dark sides match; plus the clipped
  band across Saturn's rings and the zoom-aware Sun halo. Also the screen-space reason day/night
  needs no `eclipticViewDirection`, why an SVG gradient couldn't do the 3d ball (the "bake the
  sphere" LESSON), and a palette nudge toward real tones.
  [Explain-diff](https://marcintk.github.io/ha-planetary-solar-system-card/design-notes/issue-199-explain-diff.html)
  · [PR #208](https://github.com/marcintk/ha-planetary-solar-system-card/pull/208). _The `lit`
  sprite / `sunBearing` rotation is superseded by
  [#211](https://github.com/marcintk/ha-planetary-solar-system-card/issues/211)._
- [One shading path for 2D and 3D](https://marcintk.github.io/ha-planetary-solar-system-card/design-notes/issue-211-unified-body-shading.html)
  — _approved_ ([#211](https://github.com/marcintk/ha-planetary-solar-system-card/issues/211)) —
  drop `SPRITE_LIT` and the per-body `rotate(sunBearing)`. `display: 3d` always blits the round
  `SPRITE_SOFT`; when `shading: true` it gets the **same** `renderBodyShadow` →
  `terminatorShadowPath` + `shadeFill` wash the `2d` branch already uses, so 2D and 3D share one
  day/night call site. Removes `sunBearing`, `renderSphereSprite`'s `sunDeg` param,
  `renderBodyShadow`'s `coreShaded` param, and the `lit` half of `gen-sphere-sprites.mjs`; fixes the
  stale gradient wording in `src/types.ts` and `README.md`.
  [Explain-diff](https://marcintk.github.io/ha-planetary-solar-system-card/design-notes/issue-211-explain-diff.html)
  · [PR #212](https://github.com/marcintk/ha-planetary-solar-system-card/pull/212).
- [Ping-pong the zoom auto-cycle](https://marcintk.github.io/ha-planetary-solar-system-card/design-notes/issue-222-zoom-cycle-pingpong.html)
  — _approved_ ([#222](https://github.com/marcintk/ha-planetary-solar-system-card/issues/222)) — the
  periodic zoom cycle steps `1→2→3→4` then hard-snaps back to `1` (one 2 s tween over three ladder
  rungs, never revisiting `default_zoom`). Replace the wrap in `ZoomController.advancePeriodic()`
  with a ping-pong between `default_zoom` (near) and `periodic_zoom_max` (far) — `1→2→3→4→3→2→1→2…`,
  one rung per tick, a stored `_periodicDirection` that flips at each end and resets outward on
  "Now"; `default_zoom >= periodic_zoom_max` holds still. Plus `easeInOutCubic → easeInOutSine` in
  `zoom-animator.ts` (no velocity spike), duration and 60 s cadence unchanged.
  [Explain-diff](https://marcintk.github.io/ha-planetary-solar-system-card/design-notes/issue-222-explain-diff.html)
  · [PR #223](https://github.com/marcintk/ha-planetary-solar-system-card/pull/223).
- [AU labels from data, not pixels](https://marcintk.github.io/ha-planetary-solar-system-card/design-notes/issue-239-orbit-au-labels.html)
  — _approved_ ([#239](https://github.com/marcintk/ha-planetary-solar-system-card/issues/239)) — the
  orbit AU labels read too high (Earth 1.5, Mars ~3.0) because `renderOrbit()` reconstructs each
  ring's distance from its **drawn** pixel radius, which `packOrbitRadii()` has pushed outward to
  keep orbits from colliding. Fix: a new `src/renderer/orbit-labels.ts` precomputes, once at module
  load, the true heliocentric distance `au·(1 − e·cos E)` at each ring's two vertical-axis crossings
  from the **natural** ellipse (`E` from the shared `verticalAxisIntersections` solver);
  `renderOrbit` drops the `radiusFromAU(hypot(…))` inversion and just places the two given values,
  smaller next to the crossing nearer the Sun. Comets and ring/marker geometry untouched.
  Explain-diff `—` · PR `—`.
