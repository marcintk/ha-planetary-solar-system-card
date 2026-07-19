@node_modules/ha-card-shared/CLAUDE-SHARED.md @package.json

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

| Status | Area     | Description                              |
| ------ | -------- | ---------------------------------------- |
| open   | renderer | Moon sometimes renders at Venus position |
