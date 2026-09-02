@node_modules/ha-card-shared/CLAUDE-SHARED.md

# ha-planetary-solar-system-card

## Workflow

- **Show every slice.** During `/code-it`, at each slice's `[HUMAN]` review gate, run `/show-it`
  before asking accept-or-grill so the change can be eyeballed in the real card. `/show-it` is a
  local project skill (`.claude/skills/show-it/`, not yet in the shared harness); promote it to
  `ha-card-shared` once it has earned its shape, then this note and the manual step go away.

## Show-It

Repo-specific config for the `/show-it` skill (the skill itself is repo-agnostic):

- kind: web
- build: npm run build
- serve-dir: docs
- entry: index.html

`serve-dir` is `docs/`; `docs/card.js` is a symlink to the built `dist/card.js`, and
`docs/index.html` loads the card from it. The demo is fixed to Chicago — to preview another location
or date, edit the `setConfig` / `hass` block in `docs/index.html` by hand (it is a committed asset;
`/show-it` never touches it).

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
- **Positions from renderer**: `renderSolarSystem()` returns `{ svg, positions, updateMarkers }`.
  `positions` are screen coordinates: `updateMarkers` re-derives which bodies belong offscreen from
  them, and tests read them to assert bodies never visually overlap at conjunction
  (`test/renderer/collision.test.ts`, #62). No `src/` caller reads the field — there is no
  click/hit-testing on the SVG.
- **One mirror**: the ecliptic view is a `±1` (`eclipticViewDirection`), and every point derived
  from an angle goes through `polarOffset()` in `renderer/svg-utils.ts`. Don't write
  `y + dir * dist * Math.sin(angle)` by hand — `orbitTransformComponents()` is built to agree with
  that exact expression (#94), so a second copy is how a marker drifts off its orbit ring.
