@package.json @TODO.md

# CLAUDE.md

Entry point for Claude Code sessions on this repository.

## Commands

```bash
npm install
npm run build          # bundle src/ → dist/card.js
npm run build:prod     # minified production build
npm test               # run tests
npm run test:watch     # run tests in watch mode
npm run test:coverage  # run tests with coverage report
npm run typecheck      # tsc --noEmit (type check only)
npm run check          # biome lint + format (auto-fix)
npm run format:md      # prettier for markdown files
```

## Design Invariants

Durable visual/UX constraints. Preserve unless the user explicitly changes them.

- Planets enlarged for visibility; Sun smaller to avoid interference with orbits
- Earth and Moon larger than other objects to show relative positioning
- Each orbit displays AU distance from Sun
- Visibility cone at Earth's orbit level
- Dark slate theme matching Home Assistant dark mode colors
- Buttons to move back/forward (by 1 day, 1 month) plus a "back to today" button

## Contributing

> **Never commit directly to `main`.** Every change — features, bug fixes, docs, config — must go
> through a pull request. Create a branch first, then open a PR against `main`.

```bash
git checkout -b feat/my-feature   # or fix/, docs/, chore/ as appropriate
# ... make changes ...
git push -u origin feat/my-feature
gh pr create
```

CI runs build, lint, and tests automatically on every PR.

Every new feature or bug fix must include associated tests. Coverage thresholds are enforced at 100%
for statements, branches, functions, and lines — `npm run test:coverage` will fail (and block CI) if
coverage drops below that. New source modules must have a corresponding `test/<path>.test.ts`.

### PR discipline

- **One concern per PR.** A refactor PR must not bundle feature changes; a feature PR must not
  include unrelated refactors.
- **Never push or merge without explicit permission.** Do not run `git push`, `gh pr create`, or
  merge a PR unless the user explicitly asks.
- **Verify docs before every PR.** Check that `README.md` and `CLAUDE.md` reflect any behavior
  changes — updated option defaults, new config keys, changed architecture.
- **Always wait for GHA before closing a topic.** After a PR is merged (or a tag is pushed), run
  `gh run list --limit 5` and wait for all triggered workflows to complete before declaring done.
- **Release cadence.** After three to five merged PRs, recommend cutting a release. Never trigger
  the release workflow autonomously.

## TDD Workflow

For every fix or feature: **write the failing test first**, confirm it fails (`npm test`), then
implement the fix/feature until it passes.

**Why:** A test written after the fact tends to mirror the implementation rather than specify
behaviour — red-first keeps tests honest.

**How to apply:** Before touching `src/`, add the test to the matching `test/*.test.ts`. Run
`npm test` and confirm the new assertion fails. Only then write the implementation.

## Releasing

Before tagging, verify `main` CI is green:

```bash
gh run list --branch main --limit 5   # all runs must show ✓
```

Push a semver tag — the release workflow fires automatically:

```bash
git tag v2.0.11
git push origin v2.0.11
```

Pre-release tags (`v2.0.11-beta.1`) are also supported and are published as GitHub pre-releases (not
shown to HACS users by default).

The workflow validates the tag is strictly greater than the previous release (skipped for
pre-releases), runs `npm test`, builds `dist/card.js` with the version injected from the tag, and
publishes a GitHub Release with `dist/card.js` as an asset that HACS downloads.

`package.json` version is a permanent `0.0.0-dev` placeholder and is never changed. The tag is the
single source of truth for the version. Always run `gh release list --limit 5` before tagging to
confirm the current latest and increment from there.

`dist/` is not committed to git — it is built by CI on every release and attached as a GitHub
Release asset.

## Known Issues & Gaps

Active issues and open gaps. Update when starting or completing significant work. Status: `open` ·
`in-progress` · `done`

| Status | Area      | Description                                   |
| ------ | --------- | --------------------------------------------- |
| done   | migration | Phase 1: JS → TypeScript (merged via PR #37)  |
| done   | migration | Phase 2: TypeScript → Lit (merged via PR #37) |

See [TODO.md](./TODO.md) for the full itemised checklist.
