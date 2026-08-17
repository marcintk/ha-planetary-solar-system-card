import type { TemplateResult } from "lit";
import { html } from "lit";
import type { ImageSource } from "./card-template.js";
import { formatDate } from "./card-template.js";
import { formatDuration } from "./relative-time.js";

// Earth's own resolve() makes two independent network calls (the EPIC JSON lookup for the
// latest URL, then the image-byte preload/decode) that used to share one set of counters,
// making it impossible to tell which one a spike came from. Split into two debug rows; sun
// has no separate URL-discovery network call (its candidate URL is pure math), so it stays a
// single row — ImageResolver passes the same accumulator as both url and img debug for sun.
export type DebugRowId = "sun" | "earth-url" | "earth-img";

export const DEBUG_ROWS: DebugRowId[] = ["sun", "earth-url", "earth-img"];

export const DEBUG_ROW_LABELS: Record<DebugRowId, string> = {
  sun: "SDO/S",
  "earth-url": "DSCOVR/E url",
  "earth-img": "DSCOVR/E img",
};

// Which debug row(s) a given gallery source's resolve() call reports into — see the
// DebugRowId comment above for why sun collapses both roles into one row.
export const DEBUG_ROW_KEYS: Record<ImageSource, { url: DebugRowId; img: DebugRowId }> = {
  sun: { url: "sun", img: "sun" },
  earth: { url: "earth-url", img: "earth-img" },
};

// Cumulative, since the card was mounted — not a rolling window. Lets debug:true answer "is
// this source's own cache actually saving anything" at a glance: ticks vs. network
// equal means every tick is hitting the network regardless of cache state. `cacheHits` is the
// direct answer to that question — it counts every tick SourceResolver.resolve() served straight
// from that source's own cache, checked before any fetch is even attempted, so it should
// climb steadily while `attempts` stays flat between a source's real TTL windows. `redundant`
// and `expired` both count a resolved candidate whose URL turned out identical to the image
// already displayed (bytes that would've been re-decoded for nothing, avoided by the
// URL-identity gate) — split by whether the cache was still fresh (`redundant`, the cheap
// common case) or had just expired, forcing a real fetchCandidateUrl() call that only
// confirmed nothing changed (`expired` — for earth this still cost one real EPIC API request;
// for sun it's free, since its candidate URL is pure math). `attempts` vs. `network`+`failures` separates
// "tried" from "succeeded", since a failed preload (sun's retry path) previously vanished from
// the count entirely instead of showing up as a real network cost. `retries` counts how often
// sun's primary 15-min-slot guess missed and fell back to the previous slot — a rising rate
// here means SUN_PUBLISH_BUFFER_MS (source-resolver-sdosun.ts) needs widening. `lastAttemptAt` is the
// raw timestamp of the most recent preload attempt, formatted at render time.
export interface SourceDebugStats {
  ticks: number;
  cacheHits: number;
  attempts: number;
  network: number;
  failures: number;
  retries: number;
  redundant: number;
  expired: number;
  elapsed: number | null;
  lastAttemptAt: number | null;
}

export interface DebugAccumulator {
  ticks: number;
  cacheHits: number;
  attempts: number;
  network: number;
  failures: number;
  retries: number;
  redundant: number;
  expired: number;
  fetchMsTotal: number;
  lastAttemptAt: number | null;
}

export function emptyDebugAccumulator(): DebugAccumulator {
  return {
    ticks: 0,
    cacheHits: 0,
    attempts: 0,
    network: 0,
    failures: 0,
    retries: 0,
    redundant: 0,
    expired: 0,
    fetchMsTotal: 0,
    lastAttemptAt: null,
  };
}

export function toDebugStats(acc: DebugAccumulator): SourceDebugStats {
  return {
    ticks: acc.ticks,
    cacheHits: acc.cacheHits,
    attempts: acc.attempts,
    network: acc.network,
    failures: acc.failures,
    retries: acc.retries,
    redundant: acc.redundant,
    expired: acc.expired,
    elapsed: acc.network > 0 ? acc.fetchMsTotal / acc.network : null,
    lastAttemptAt: acc.lastAttemptAt,
  };
}

function formatMs(ms: number | null): string {
  return ms == null ? "—" : `${Math.round(ms)}ms`;
}

// ticks max()s rather than sum()s: sun/earth-url tick in lockstep for "both"/"slide" modes
// (one refresh() increments both), so summing would double-count — max reads right there and
// still reports correctly for a single-source mode, where the other rows stay 0 (earth-img
// never ticks at all — see the DebugRowId comment). elapsed avg()s each row's own average (not
// a token-weighted mean — kept simple since this overlay is already an approximation, not a
// billing report). last has no sane combination of several different timestamps, so it's
// dropped rather than showing a misleading one.
function summarizeDebugStats(stats: Record<DebugRowId, SourceDebugStats>): SourceDebugStats {
  const rows = DEBUG_ROWS.map((id) => stats[id]);
  const elapsedValues = rows.map((row) => row.elapsed).filter((ms): ms is number => ms != null);
  const sum = (pick: (row: SourceDebugStats) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  return {
    ticks: Math.max(...rows.map((row) => row.ticks)),
    cacheHits: sum((row) => row.cacheHits),
    attempts: sum((row) => row.attempts),
    network: sum((row) => row.network),
    failures: sum((row) => row.failures),
    retries: sum((row) => row.retries),
    redundant: sum((row) => row.redundant),
    expired: sum((row) => row.expired),
    elapsed: elapsedValues.length
      ? elapsedValues.reduce((total, ms) => total + ms, 0) / elapsedValues.length
      : null,
    lastAttemptAt: null,
  };
}

// debug:true overlay — sun/earth's cumulative check vs. network-call counts, so ticks ===
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
        <th>time</th>
        <th>ago</th>
      </tr>
      ${DEBUG_ROWS.map((rowId) => {
        const s = stats[rowId];
        return html`<tr>
          <td>${DEBUG_ROW_LABELS[rowId]}</td>
          <td>${s.ticks}</td>
          <td>${s.cacheHits}</td>
          <td>${s.expired}</td>
          <td>${s.attempts}</td>
          <td>${s.failures}</td>
          <td>${s.retries}</td>
          <td>${formatMs(s.elapsed)}</td>
          <td>${s.lastAttemptAt == null ? "—" : formatDuration(Date.now() - s.lastAttemptAt)}</td>
        </tr>`;
      })}
      ${(() => {
        const total = summarizeDebugStats(stats);
        return html`<tr class="debug-total">
          <td>total</td>
          <td>${total.ticks}</td>
          <td>${total.cacheHits}</td>
          <td>${total.expired}</td>
          <td>${total.attempts}</td>
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
