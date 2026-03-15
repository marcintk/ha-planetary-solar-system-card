# CLAUDE.md

**This file is the single source of truth for all project information.** Update project overview,
TODO, and tool rules here — not in Serena memory or OpenSpec config.

Full architecture, source/test layout, conventions, and detailed context are in
[`openspec/config.yaml`](openspec/config.yaml).

## Tool Ecosystem

All tools must use each other by default — do not implement separately what another tool already
provides.

| Tool                            | Role                      | Use for                                                                                                   |
| ------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Serena MCP**                  | Code navigation & editing | ALL code reads/edits: `get_symbols_overview`, `find_symbol`, `replace_symbol_body`, `insert_after_symbol` |
| **Context7 MCP**                | Library documentation     | ANY external/browser API lookup before implementing — `resolve-library-id` then `query-docs`              |
| **OpenSpec skills** (`/opsx:*`) | Spec-driven workflow      | Proposals, design docs, specs, tasks — use before jumping to implementation                               |
| **Claude Code**                 | Orchestration             | Runs commands, coordinates tools, is the entry point for all sessions                                     |

### Cross-tool rules

- When **editing code**: always use Serena MCP tools, not raw file writes
- When **looking up APIs or libraries**: always use Context7 MCP first, not web search
- When **planning a feature**: always use `/opsx:explore` or `/opsx:new` first, then implement
- When **Serena memory** needs updating: reflect only Serena-specific operational notes; project
  info stays here
- When **OpenSpec config** (`openspec/config.yaml`) needs updating: keep architecture details there,
  point back to this file for project overview and TODO

## Commands

- `npm run build` — bundle to `dist/ha-solar-view-card.js` (unminified)
- `npm run build:prod` — production bundle (minified with terser)
- `npm test` — run all tests once
- `npm run test:watch` — run tests in watch mode
- `npx vitest run test/some-file.test.js` — run a single test file

## Architecture Notes

- Custom elements must be registered via `customElements.define()` before instantiation in tests
  (use `document.createElement()`, not `new`)
- Internal logic is split into small classes/files for testability
- Build system works independently of Home Assistant (standalone testing)

## Key Visual Requirements

- Planets enlarged for visibility; Sun smaller to avoid interference with orbits
- Earth and Moon larger than other objects to show relative positioning
- Each orbit displays AU distance from Sun
- Visibility cone at Earth's orbit level
- Dark slate theme matching Home Assistant dark mode colors
- Buttons to move back or forward (by 1 day and 1 month) and extra button to back to today

## TODO

### Features

- add some other object like comets i.e. Halley
- add Earth centric view (every update should move all objects except Earth)
- add zodiac constellations
- add information if this Northern or Southern hemisphere
- add auto zoom level to fit all planets in view

### Fixes

- sometimes Moon is on Venus position
