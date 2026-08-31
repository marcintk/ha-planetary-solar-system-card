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
  — _approved_ ([#199](https://github.com/marcintk/ha-planetary-solar-system-card/issues/199)) — a
  translucent anti-sunward shadow layer (`renderBodyShadow`) applied the same way to every planet,
  the Moon, comet heads and Saturn's rings, then resolved into a spherical read: one shared
  `#sphere-shade` linear-terminator gradient (slice 6; slice 5's offset radial gave a crescent)
  rotated per body toward the Sun, Saturn included; the screen-space reason it needs no
  `eclipticViewDirection`; a static radial Sun halo (retuned tighter/dimmer) with a
  `docs/halo-tune.html` slider harness; a subtle palette nudge toward real planet tones; and
  (slice 7) `shading: true|false` + `display: 2d|3d` config, collapsed to one `ShadeMode` enum.
  Explain-diff: —.
