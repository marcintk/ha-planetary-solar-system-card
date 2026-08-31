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
  independent body-render switches (slice 8, after slices 5–7 tried a Sun-facing gradient and one
  collapsed enum): `display: 2d|3d` — flat disc vs. a centred `#sphere-3d` ball gradient, no Sun
  involved — and `shading: true|false` — the astronomical day/night as a flat translucent `darkD`
  half-disc (distinct terminator), plus the anti-sunward band across Saturn's rings and the Sun
  halo. Also the screen-space reason day/night needs no `eclipticViewDirection`; a retuned
  tighter/dimmer Sun halo with a `docs/halo-tune.html` slider harness; and a palette nudge toward
  real planet tones. Explain-diff: —.
