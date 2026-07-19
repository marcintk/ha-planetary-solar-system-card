@node_modules/ha-card-shared/CLAUDE-SHARED.md

# ha-planetary-solar-system-card

## Design Invariants

Durable visual/UX constraints. Preserve unless the user explicitly changes them.

- Planets enlarged for visibility; Sun smaller to avoid interference with orbits
- Earth and Moon larger than other objects to show relative positioning
- Each orbit displays AU distance from Sun
- Visibility cone at Earth's orbit level
- Dark slate theme matching Home Assistant dark mode colors
- Buttons to move back/forward (by 1 day, 1 month) plus a "back to today" button

## Architecture Notes

- **SVG imperative rebuild**: solar system renders as raw SVG DOM inside `updated()` — `#solar-view`
  is fully cleared and repopulated each update, not managed by Lit templates. Don't try to patch
  individual SVG elements reactively.
- **Synchronous render**: `_render()` calls `requestUpdate()` + `performUpdate()` back-to-back to
  force a synchronous Lit flush. Lit's default async microtask schedule breaks synchronous tests and
  delays the first frame in HA.
- **Positions from renderer**: `renderSolarSystem()` returns `{ svg, positions }` — `positions` are
  screen coordinates used for SVG hit-testing (click targets), not a rendering side-effect.
