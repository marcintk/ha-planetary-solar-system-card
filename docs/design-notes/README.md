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
  [Explain-diff](https://marcintk.github.io/ha-planetary-solar-system-card/design-notes/issue-199-explain-diff.html).
