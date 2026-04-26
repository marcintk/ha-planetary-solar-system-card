# ha-planetary-solar-system-card — Serena Operational Notes

This memory contains only Serena-specific operational notes. For everything else:

- **Project entry point and tool ecosystem rules**: `CLAUDE.md`
- **Architecture, source layout, conventions, testing, concerns**: `.planning/codebase/*.md`
- **Backlog (features + fixes)**: `.planning/BACKLOG.md`
- **User-facing docs**: `README.md`

Do not duplicate that content here.

## Key Serena Rules

- Always call `get_symbols_overview` before editing an unfamiliar file
- Use `find_symbol` with `include_body=true` to read a symbol before replacing it
- Use `replace_symbol_body` for modifying existing functions/classes
- Use `insert_after_symbol` / `insert_before_symbol` to add new top-level code
- After editing, verify with `npm test`
