import type { TemplateResult } from "lit";
import { html } from "lit";
import type { SourceDebugStats } from "./gallery/debug-stats.js";
import type { DebugRowId } from "./gallery/sources.js";
import { DEBUG_ROW_SPECS, DEBUG_ROWS } from "./gallery/sources.js";
import { formatDate, formatDuration } from "./relative-time.js";

export const DEBUG_ROW_LABELS: Record<DebugRowId, string> = {
  moon: "SVS/M",
  sun: "SDO/S",
  "earth-url": "DSCOVR/E url",
  "earth-img": "DSCOVR/E img",
};

function formatMs(ms: number | null): string {
  return ms == null ? "—" : `${Math.round(ms)}ms`;
}

// gets max()s rather than sum()s: sun/earth-url tick in lockstep for "both"/"slide" modes
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
    gets: Math.max(...rows.map((row) => row.gets)),
    cacheHits: sum((row) => row.cacheHits),
    backoffs: sum((row) => row.backoffs),
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

// debug:true overlay — sun/earth's cumulative check vs. network-call counts, so gets ===
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
        <th>get</th>
        <th>cache</th>
        <th>back</th>
        <th>expire</th>
        <th>fetch</th>
        <th>fail</th>
        <th>retry</th>
        <th>elapsed</th>
        <th>ago</th>
      </tr>
      ${DEBUG_ROWS.map((rowId) => {
        const s = stats[rowId];
        // Which columns this row can produce a real value for — see DEBUG_ROW_SPECS's own
        // comment for why 0 would misleadingly read as "checked, found nothing" instead of
        // "not a thing that can happen on this row".
        const { hasCacheStep, canRetry } = DEBUG_ROW_SPECS[rowId];
        return html`<tr>
          <td>${DEBUG_ROW_LABELS[rowId]}</td>
          <td>${s.gets}</td>
          <td>${hasCacheStep ? s.cacheHits : "—"}</td>
          <td>${s.backoffs}</td>
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
          <td>${total.gets}</td>
          <td>${total.cacheHits}</td>
          <td>${total.backoffs}</td>
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
