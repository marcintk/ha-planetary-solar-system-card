# CLAUDE.md

Entry point for Claude Code sessions on this repository.

- Deep architecture, source layout, conventions, testing, and known concerns: see
  `.planning/codebase/*.md` (written by `/gsd-map-codebase`; refresh with `/gsd-scan` or rerun
  `/gsd-map-codebase`).
- User-facing install and config: see [README.md](README.md).
- Feature backlog and known fixes: see [.planning/BACKLOG.md](.planning/BACKLOG.md).

Do not duplicate that content here.

## Tool Ecosystem

All tools must use each other by default — do not implement separately what another tool already
provides.

| Tool                      | Role                      | Use for                                                                                                   |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Serena MCP**            | Code navigation & editing | ALL code reads/edits: `get_symbols_overview`, `find_symbol`, `replace_symbol_body`, `insert_after_symbol` |
| **Context7 MCP**          | Library documentation     | ANY external/browser API lookup before implementing — `resolve-library-id` then `query-docs`              |
| **GSD skills** (`/gsd-*`) | Spec-driven workflow      | Planning, executing, reviewing, and tracking phases — see `/gsd-help`                                     |
| **Claude Code**           | Orchestration             | Runs commands, coordinates tools, is the entry point for all sessions                                     |

### Cross-tool rules

- When **editing code**: always use Serena MCP tools, not raw file writes
- When **looking up APIs or libraries**: always use Context7 MCP first, not web search
- When **planning a feature**: route through GSD (`/gsd-do`, `/gsd-plan-phase`, or `/gsd-quick`)
  before implementing
- When **Serena memory** needs updating: reflect only Serena-specific operational notes; project
  info stays here
- When **architecture facts change**: update `.planning/codebase/*.md` (or refresh via
  `/gsd-map-codebase`), then point to it from here

## Commands

- `npm run build` — bundle to `dist/ha-solar-view-card.js` (unminified)
- `npm run build:prod` — production bundle (minified with terser)
- `npm test` — run all tests once
- `npm run test:watch` — run tests in watch mode
- `npx vitest run test/some-file.test.js` — run a single test file

## Design Invariants

Durable visual/UX constraints. Any visual change should preserve them unless the user explicitly
says otherwise.

- Planets enlarged for visibility; Sun smaller to avoid interference with orbits
- Earth and Moon larger than other objects to show relative positioning
- Each orbit displays AU distance from Sun
- Visibility cone at Earth's orbit level
- Dark slate theme matching Home Assistant dark mode colors
- Buttons to move back/forward (by 1 day, 1 month) plus a "back to today" button
