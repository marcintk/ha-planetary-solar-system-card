@node_modules/ha-shared/CLAUDE-SHARED.md @package.json @TODO.md

# ha-planetary-solar-system-card

## Design Invariants

Durable visual/UX constraints. Preserve unless the user explicitly changes them.

- Planets enlarged for visibility; Sun smaller to avoid interference with orbits
- Earth and Moon larger than other objects to show relative positioning
- Each orbit displays AU distance from Sun
- Visibility cone at Earth's orbit level
- Dark slate theme matching Home Assistant dark mode colors
- Buttons to move back/forward (by 1 day, 1 month) plus a "back to today" button

## Known Issues & Gaps

Active issues and open gaps. Update when starting or completing significant work. Status: `open` ·
`in-progress` · `done`

| Status | Area      | Description                                   |
| ------ | --------- | --------------------------------------------- |
| done   | migration | Phase 1: JS → TypeScript (merged via PR #37)  |
| done   | migration | Phase 2: TypeScript → Lit (merged via PR #37) |

See [TODO.md](./TODO.md) for the full itemised checklist.
