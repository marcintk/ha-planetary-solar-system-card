import type { TemplateResult } from "lit";
import { html } from "lit";
import { formatDate, formatDuration } from "../relative-time.js";
import type { SourceDebugStats } from "./debug-stats.js";
import type { DebugRowId } from "./sources.js";

// The overlay's own row order and column headings. Which source reports into which row is
// each source's own fact — see SourceSpec.debugRow in sources.ts, and the DebugRowId comment
// there for why sun collapses both roles into one row and mymoon/moon collapse into each other.
export const DEBUG_ROWS: DebugRowId[] = ["moon", "sun", "earth-url", "earth-img"];

export const DEBUG_ROW_LABELS: Record<DebugRowId, string> = {
  moon: "SVS/M",
  sun: "SDO/S",
  "earth-url": "DSCOVR/E url",
  "earth-img": "DSCOVR/E img",
};

function formatMs(ms: number | null): string {
  return ms == null ? "—" : `${Math.round(ms)}ms`;
}

// refreshes max()s rather than sum()s: sun/earth-url tick in lockstep for "both"/"slide" modes
// (one refresh() call bumps both), so summing would double-count — max reads right there and
// still reports correctly for a single-source mode, where the other rows stay 0. elapsed
// avg()s each row's own average (not a token-weighted mean — kept simple since this overlay is
// already an approximation, not a billing report). last has no sane combination of several
// different timestamps, so it's dropped rather than showing a misleading one.
function summarizeDebugStats(stats: Record<DebugRowId, SourceDebugStats>): SourceDebugStats {
  const rows = DEBUG_ROWS.map((id) => stats[id]);
  const elapsedValues = rows.map((row) => row.elapsed).filter((ms): ms is number => ms != null);
  const sum = (pick: (row: SourceDebugStats) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  return {
    refreshes: Math.max(...rows.map((row) => row.refreshes)),
    cacheHits: sum((row) => row.cacheHits),
    expired: sum((row) => row.expired),
    fetches: sum((row) => row.fetches),
    failures: sum((row) => row.failures),
    retries: sum((row) => row.retries),
    elapsed: elapsedValues.length
      ? elapsedValues.reduce((total, ms) => total + ms, 0) / elapsedValues.length
      : null,
    lastAttemptAt: null,
  };
}

// debug:true overlay — sun/earth's cumulative check vs. network-call counts, so refreshes ===
// network is visible at a glance as "this source's cache isn't actually skipping the
// network call". Cumulative since mount, not a rolling window — this card's timers are
// coarse (minutes, not events-per-second) so a running total reads better than a windowed rate.
// No image-size column: neither NASA host sends Timing-Allow-Origin or CORS headers on its
// image path, so the browser withholds transfer size from JS for both — nothing to show.
export function buildDebugOverlay(
  stats: Record<DebugRowId, SourceDebugStats>,
  startedAt: number
): TemplateResult {
  return html`<div class="debug-overlay">
    <table>
      <tr>
        <th>source</th>
        <th>refresh</th>
        <th>cache</th>
        <th>expire</th>
        <th>fetch</th>
        <th>fail</th>
        <th>retry</th>
        <th>elapsed</th>
        <th>ago</th>
      </tr>
      ${DEBUG_ROWS.map((rowId) => {
        const s = stats[rowId];
        // The img row has no cache/URL-identity step of its own (that's the url row's job —
        // see the DebugRowId comment) — showing 0 there would misleadingly imply "checked
        // and found nothing", when really the question never applies to this row at all.
        const hasCacheStep = rowId !== "earth-img";
        // Only sun's resolver ever retries (recover()'s one-slot-back fallback — see
        // source-resolver-sdo-sun.ts) — earth's and moon's default recover() just rethrows, so 0 there
        // would misleadingly suggest "checked, never needed one" rather than "not a thing
        // that can happen on this row".
        const canRetry = rowId === "sun";
        return html`<tr>
          <td>${DEBUG_ROW_LABELS[rowId]}</td>
          <td>${s.refreshes}</td>
          <td>${hasCacheStep ? s.cacheHits : "—"}</td>
          <td>${hasCacheStep ? s.expired : "—"}</td>
          <td>${s.fetches}</td>
          <td>${s.failures}</td>
          <td>${canRetry ? s.retries : "—"}</td>
          <td>${formatMs(s.elapsed)}</td>
          <td>${s.lastAttemptAt == null ? "—" : formatDuration(Date.now() - s.lastAttemptAt)}</td>
        </tr>`;
      })}
      ${(() => {
        const total = summarizeDebugStats(stats);
        return html`<tr class="debug-total">
          <td>total</td>
          <td>${total.refreshes}</td>
          <td>${total.cacheHits}</td>
          <td>${total.expired}</td>
          <td>${total.fetches}</td>
          <td>${total.failures}</td>
          <td>${total.retries}</td>
          <td>${formatMs(total.elapsed)}</td>
          <td>—</td>
        </tr>`;
      })()}
    </table>
    <div class="debug-caption">since ${formatDate(new Date(startedAt))} (${formatDuration(Date.now() - startedAt)})</div>
  </div>`;
}
