# ha-planetary-solar-system-card — Serena Operational Notes

**Project info, TODO, and tool rules are in `CLAUDE.md` — read it first.**
**Architecture, source layout, and conventions are in `openspec/config.yaml`.**

Do not duplicate that content here. This memory contains only Serena-specific operational notes.

## Tool Ecosystem (summary)

- **Serena MCP** — all code navigation and edits (this tool)
- **Context7 MCP** — library documentation before implementing
- **OpenSpec skills** (`/opsx:*`) — spec/design/task workflow before coding
- **Claude Code** — orchestrates everything; CLAUDE.md is the single source of truth

## Source Layout (as of Mar 2026 refactor)

```
src/index.js                        ← entry (stays at top)
src/card/{solar-view-card, card-template, card-styles, view-state}.js
src/astronomy/{planet-data, orbital-mechanics, solar-position}.js
src/renderer/{index, bodies, observer, seasons, svg-utils}.js
test/card/, test/astronomy/, test/renderer/   ← mirrors src/
```
- `src/renderer/index.js` is the main compositor (was `renderer.js`)
- `test/renderer/index.test.js` is the integration test (was `renderer.test.js`)

## Code Style (needed for symbol editing)

- camelCase functions/variables, PascalCase classes, UPPER_SNAKE constants
- JSDoc comments on public functions
- JavaScript ES modules (no TypeScript); semicolons at statement ends
- SVG elements via `createSvgElement(tag, attrs)` from `src/renderer/svg-utils.js`

## Key Serena Rules

- Always call `get_symbols_overview` before editing an unfamiliar file
- Use `find_symbol` with `include_body=true` to read a symbol before replacing it
- Use `replace_symbol_body` for modifying existing functions/classes
- Use `insert_after_symbol` / `insert_before_symbol` to add new top-level code
- After editing, verify with `npm test`
