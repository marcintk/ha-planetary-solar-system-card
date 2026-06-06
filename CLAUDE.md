# CLAUDE.md

Entry point for Claude Code sessions on this repository.

## Commands

- `npm run build` — bundle to `dist/ha-solar-view-card.js` (unminified)
- `npm run build:prod` — production bundle (minified with terser)
- `npm test` — run all tests once
- `npm run test:watch` — run tests in watch mode
- `npx vitest run test/some-file.test.js` — run a single test file
- `npm run check` — biome lint + format check

## Design Invariants

Durable visual/UX constraints. Preserve unless the user explicitly changes them.

- Planets enlarged for visibility; Sun smaller to avoid interference with orbits
- Earth and Moon larger than other objects to show relative positioning
- Each orbit displays AU distance from Sun
- Visibility cone at Earth's orbit level
- Dark slate theme matching Home Assistant dark mode colors
- Buttons to move back/forward (by 1 day, 1 month) plus a "back to today" button

## Releasing

Trigger the **Release** workflow in GitHub Actions with a version number (e.g. `1.0.1`). It builds,
tags, and attaches `dist/ha-solar-view-card.js` to the GitHub Release automatically. HACS users get
the update on the next store refresh.
