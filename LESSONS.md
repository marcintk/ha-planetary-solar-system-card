# Lessons log

Root cause + guardrail per shipped change, newest first. Consulted before new work — grep the
symptom before reproducing. Per-issue detail lives in `docs/design-notes/`; this is the by-symptom
index.

<!-- ponytail: single file; split by area if it outgrows one screen-scroll -->

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
