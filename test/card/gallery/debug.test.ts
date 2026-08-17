import { render } from "lit";
import { describe, expect, it } from "vitest";
import { formatDate } from "../../../src/card/card-template.js";
import type { SourceDebugStats } from "../../../src/card/gallery/debug.js";
import { buildDebugOverlay } from "../../../src/card/gallery/debug.js";

const zeroDebugStats: SourceDebugStats = {
  refreshes: 0,
  cacheHits: 0,
  fetches: 0,
  failures: 0,
  retries: 0,
  expired: 0,
  elapsed: null,
  lastAttemptAt: null,
};

function renderToDOM(result) {
  const div = document.createElement("div");
  render(result, div);
  return div;
}

describe("buildDebugOverlay", () => {
  const stats = {
    "earth-url": zeroDebugStats,
    "earth-img": zeroDebugStats,
    sun: {
      refreshes: 4,
      cacheHits: 2,
      fetches: 3,
      failures: 1,
      retries: 2,
      expired: 5,
      elapsed: 123.4,
      lastAttemptAt: Date.now() - 5 * 60_000,
    },
  };

  it("shows 0s on the very first render, right at startedAt", () => {
    const startedAt = Date.now();
    const root = renderToDOM(buildDebugOverlay(stats, startedAt));
    expect(root.querySelector(".debug-caption").textContent).toBe(
      `since ${formatDate(new Date(startedAt))} (0s)`
    );
  });

  it("shows seconds under a minute after startedAt", () => {
    const startedAt = Date.now() - 30_000;
    const root = renderToDOM(buildDebugOverlay(stats, startedAt));
    expect(root.querySelector(".debug-caption").textContent).toBe(
      `since ${formatDate(new Date(startedAt))} (30s)`
    );
  });

  it("shows minutes only under an hour", () => {
    const startedAt = Date.now() - 5 * 60_000;
    const root = renderToDOM(buildDebugOverlay(stats, startedAt));
    expect(root.querySelector(".debug-caption").textContent).toBe(
      `since ${formatDate(new Date(startedAt))} (5m)`
    );
  });

  it("shows hours and minutes when both are non-zero", () => {
    const startedAt = Date.now() - (2 * 60 + 5) * 60_000;
    const root = renderToDOM(buildDebugOverlay(stats, startedAt));
    expect(root.querySelector(".debug-caption").textContent).toBe(
      `since ${formatDate(new Date(startedAt))} (2h 5m)`
    );
  });

  it("shows whole hours with no minutes remainder", () => {
    const startedAt = Date.now() - 3 * 60 * 60_000;
    const root = renderToDOM(buildDebugOverlay(stats, startedAt));
    expect(root.querySelector(".debug-caption").textContent).toBe(
      `since ${formatDate(new Date(startedAt))} (3h)`
    );
  });

  it("renders a row per source with its stats, formatting a null elapsed as '—'", () => {
    const root = renderToDOM(buildDebugOverlay(stats, Date.now()));
    const rows = root.querySelectorAll("tbody tr, table tr");
    const cells = [...rows].slice(1).map((row) => [...row.children].map((td) => td.textContent));
    expect(cells).toEqual([
      ["SDO/S", "4", "2", "5", "3", "1", "2", "123ms", "5m"],
      // Neither earth row can retry (only sun's resolver ever does) — retry shows "—".
      ["DSCOVR/E url", "0", "0", "0", "0", "0", "—", "—", "—"],
      // earth-img also has no cache/URL-identity step of its own — those columns show "—" too.
      ["DSCOVR/E img", "0", "—", "—", "0", "0", "—", "—", "—"],
      // total: refreshes max()s (4 vs. 0 vs. 0) rather than summing, cacheHits/others sum
      // the raw underlying values (not the dashed display), elapsed avg()s the non-null
      // values (just sun's 123.4 here), last is always "—" — see summarizeDebugStats.
      ["total", "4", "2", "5", "3", "1", "2", "123ms", "—"],
    ]);
  });

  it("shows seconds in the last column under a minute, not a floored 'just now'", () => {
    const recent = {
      "earth-url": zeroDebugStats,
      "earth-img": zeroDebugStats,
      sun: { ...zeroDebugStats, lastAttemptAt: Date.now() - 45_000 },
    };
    const root = renderToDOM(buildDebugOverlay(recent, Date.now()));
    const sunRow = [...root.querySelectorAll("table tr")[1].children].map((td) => td.textContent);
    expect(sunRow[sunRow.length - 1]).toBe("45s");
  });

  it("sums the total row's refreshes with max() instead of add(), for lockstep both/slide modes", () => {
    const lockstep = {
      sun: { ...zeroDebugStats, refreshes: 5, elapsed: 100 },
      "earth-url": { ...zeroDebugStats, refreshes: 5, elapsed: 200 },
      "earth-img": zeroDebugStats,
    };
    const root = renderToDOM(buildDebugOverlay(lockstep, Date.now()));
    const rows = [...root.querySelectorAll("table tr")].slice(1);
    const totalRow = [...rows[rows.length - 1].children].map((td) => td.textContent);
    // max(5, 5, 0) = 5, not 10 — and elapsed averages the two non-null values,
    // (100 + 200) / 2 = 150ms.
    expect(totalRow).toEqual(["total", "5", "0", "0", "0", "0", "0", "150ms", "—"]);
  });
});
