# CLAUDE.md

Entry point for Claude Code sessions on this repository.

## Commands

- `npm run build` — bundle to `dist/card.js` (unminified)
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

## Workflow

- **Always work on a branch** — never commit directly to `main`. Create a descriptive branch
  (`git checkout -b feature/...` or `fix/...`), push it, and open a PR.
- **Every feature or fix needs a test file** — new source modules must have a corresponding
  `test/<path>.test.ts`. Tests live in the same directory structure under `test/` as the source
  under `src/`.

## Releasing

Push a semver tag — the release workflow fires automatically:

```bash
git tag v2.0.11
git push origin v2.0.11
```

The workflow validates the tag is strictly greater than the previous release, runs `npm test`,
builds `dist/card.js` with the version injected from the tag, and publishes a GitHub Release with
`dist/card.js` as an asset that HACS downloads.

`package.json` version is a permanent `0.0.0-dev` placeholder and is never changed. The tag is the
single source of truth for the version. Always run `gh release list --limit 5` before tagging to
confirm the current latest and increment from there.

`dist/` is not committed to git — it is built by CI on every release and attached as a GitHub
Release asset.

## Known Issues & Gaps

Active issues and open gaps. Update when starting or completing significant work. Status: `open` ·
`in-progress` · `done`

| Status      | Area      | Description                                                       |
| ----------- | --------- | ----------------------------------------------------------------- |
| in-progress | migration | Phase 1: JS → TypeScript (branch: feature/typescript-migration)   |
| in-progress | migration | Phase 2: TypeScript → Lit (PR #37, branch: feature/lit-migration) |

See [TODO.md](./TODO.md) for the full itemised checklist.
