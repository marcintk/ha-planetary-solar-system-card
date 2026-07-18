# Plan: Centralize snapshot tests into snapshot.test.ts

## Goal

Create `test/snapshot.test.ts` and move all 4 `toMatchSnapshot()` calls there. Currently they are
scattered across `test/card/card-styles.test.ts` (1) and `test/card/card-template.test.ts` (3).

## Reference pattern

See `ha-yahoofinance-board-card/test/snapshot.test.ts` — all snapshots in one file, each describe
block groups by function/component, helpers imported or inlined.

## Steps

### 1. Create test/snapshot.test.ts

New file. Pull in the 4 snapshot assertions with their full setup.

#### From test/card/card-styles.test.ts (line 9)

Source block:

```ts
import { describe, expect, it } from "vitest";
import { cardStyles } from "../../src/card/card-styles.js";

describe("cardStyles", () => {
  it("matches snapshot", () => {
    expect(cardStyles.cssText).toMatchSnapshot();
  });
});
```

Add as-is to `snapshot.test.ts` (adjust import path: `../src/card/card-styles.js`).

#### From test/card/card-template.test.ts (lines 115, 127, 139)

These are inside `describe("buildStatusBar") > describe("rendered structure snapshots")`:

```ts
describe("rendered structure snapshots", () => {
  it("full status bar with Next transition", () => {
    expect(
      doc(
        buildStatusBar(
          { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
          "London",
          new Date("2026-03-05T12:00:00Z"),
        ),
      ),
    ).toMatchSnapshot();
  });

  it("single span (polar night, no transition)", () => {
    expect(
      doc(
        buildStatusBar(
          { lat: 89, lon: 0, timezone: "UTC" },
          "Arctic",
          new Date("2026-12-21T12:00:00Z"),
        ),
      ),
    ).toMatchSnapshot();
  });

  it("null location name (empty before pipe)", () => {
    expect(
      doc(
        buildStatusBar({ lat: 0, lon: 0, timezone: "UTC" }, null, new Date("2026-03-20T12:00:00Z")),
      ),
    ).toMatchSnapshot();
  });
});
```

The `doc()` helper used here strips non-deterministic Lit marker IDs:

```ts
function doc(result) {
  return renderToDOM(result)
    .innerHTML.replace(/<!--\?lit\$\d+\$-->/g, "<!--?-->")
    .replace(/lit\$\d+\$/g, "lit$$$$");
}

function renderToDOM(result) {
  const div = document.createElement("div");
  render(result, div);
  return div;
}
```

Copy `renderToDOM` and `doc` into `snapshot.test.ts` (or inline). Import `buildStatusBar` from
`../src/card/card-template.js` and `render` from `lit`.

Wrap in `describe("buildStatusBar snapshots")`.

### 2. Remove snapshot assertions from source test files

#### test/card/card-styles.test.ts

Remove the entire `describe("cardStyles")` block (lines 1–11 — the whole file is only this). Delete
the file entirely since nothing remains.

#### test/card/card-template.test.ts

Remove the `describe("rendered structure snapshots")` block (lines 110–141). Leave all other tests
(the 7 non-snapshot `it()` blocks in the outer `describe("buildStatusBar")`) intact.

Also remove the `renderToDOM` and `doc` helpers if they are only used by the snapshot tests. Check —
if `renderToDOM` is used by the remaining tests, keep it; if only `doc` used it and `doc` is gone,
remove both.

### 3. Delete stale snapshots and regenerate

```bash
rm -rf test/__snapshots__
npm test -- --update-snapshots
```

### 4. Verify

```bash
npm test && npm run test:coverage && npm run check:ci
```

All tests green, coverage stays at 100%.

## Files touched

- `test/snapshot.test.ts` → created (new file)
- `test/card/card-styles.test.ts` → deleted entirely (only contained the snapshot)
- `test/card/card-template.test.ts` → remove `describe("rendered structure snapshots")` block +
  unused helpers
- `test/__snapshots__/` → delete and regenerate

## Workflow

Follow CLAUDE-SHARED.md phases 2–5. Work on branch `chore/centralize-snapshots`. No new tests needed
— moving existing ones. Skip phase 1 (already clarified).
