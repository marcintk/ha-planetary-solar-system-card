import type { TemplateResult } from "lit";
import { html } from "lit";
import type { ImageSource } from "../card-template.js";
import { formatDate } from "../card-template.js";
import { formatDuration } from "../relative-time.js";

// Earth's own resolve() makes two independent network calls (the EPIC JSON lookup for the
// latest URL, then the image-byte preload/decode) that used to share one set of counters,
// making it impossible to tell which one a spike came from. Split into two debug rows; sun
// has no separate URL-discovery network call (its candidate URL is pure math), so it stays a
// single row — ImageResolver passes the same accumulator as both url and img debug for sun.
export type DebugRowId = "mymoon" | "moon" | "sun" | "earth-url" | "earth-img";

export const DEBUG_ROWS: DebugRowId[] = ["mymoon", "moon", "sun", "earth-url", "earth-img"];

export const DEBUG_ROW_LABELS: Record<DebugRowId, string> = {
  mymoon: "SVS/M sky",
  moon: "SVS/M obj",
  sun: "SDO/S",
  "earth-url": "DSCOVR/E url",
  "earth-img": "DSCOVR/E img",
};

// Which debug row(s) a given gallery source's resolve() call reports into — see the
// DebugRowId comment above for why sun collapses both roles into one row.
export const DEBUG_ROW_KEYS: Record<ImageSource, { url: DebugRowId; img: DebugRowId }> = {
  mymoon: { url: "mymoon", img: "mymoon" },
  moon: { url: "moon", img: "moon" },
  sun: { url: "sun", img: "sun" },
  earth: { url: "earth-url", img: "earth-img" },
};

// Cumulative, since the card was mounted — not a rolling window. Lets debug:true answer "is
// this source's own cache actually saving anything" at a glance: `refreshes` vs. network calls
// equal means every refresh is hitting the network regardless of cache state. `cacheHits` is the
// direct answer to that question — it counts every refresh SourceResolver.resolve() served straight
// from that source's own cache, checked before any fetch is even attempted, so it should
// climb steadily while `fetches` stays flat between a source's real TTL windows. `expired`
// counts a resolved candidate whose URL turned out identical to the image already displayed,
// found only after the TTL cache had already expired and forced a real fetchCandidateUrl()
// call that ended up confirming nothing changed (for earth this still cost one real EPIC API
// request; for sun it's free, since its candidate URL is pure math) — the far more common case
// (cache still fresh AND URL unchanged) needs no counter of its own, since `cacheHits` already
// answers that question. `fetches` vs. `failures` separates "tried" from "failed", since a
// failed preload (sun's retry path) previously vanished from the count entirely instead of
// showing up as a real network cost. `retries` counts how often sun's primary 15-min-slot guess
// missed and fell back to the previous slot — a rising rate here means SUN_PUBLISH_BUFFER_MS
// (source-resolver-sdo-sun.ts) needs widening. `lastAttemptAt` is the raw timestamp of the most
// recent preload attempt, formatted at render time.
// Field order matches the overlay's column order (buildDebugOverlay below).
export interface SourceDebugStats {
  refreshes: number;
  cacheHits: number;
  expired: number;
  fetches: number;
  failures: number;
  retries: number;
  elapsed: number | null;
  lastAttemptAt: number | null;
}

export interface DebugAccumulator {
  refreshes: number;
  cacheHits: number;
  expired: number;
  fetches: number;
  failures: number;
  retries: number;
  fetchMsTotal: number;
  lastAttemptAt: number | null;
}

export function emptyDebugAccumulator(): DebugAccumulator {
  return {
    refreshes: 0,
    cacheHits: 0,
    expired: 0,
    fetches: 0,
    failures: 0,
    retries: 0,
    fetchMsTotal: 0,
    lastAttemptAt: null,
  };
}

export function toDebugStats(acc: DebugAccumulator): SourceDebugStats {
  // Successful fetches = fetches - failures (timedAttempt only ever bumps one or the other),
  // derived here rather than tracked as its own accumulator field since this average is its
  // only consumer.
  const succeeded = acc.fetches - acc.failures;
  return {
    refreshes: acc.refreshes,
    cacheHits: acc.cacheHits,
    expired: acc.expired,
    fetches: acc.fetches,
    failures: acc.failures,
    retries: acc.retries,
    elapsed: succeeded > 0 ? acc.fetchMsTotal / succeeded : null,
    lastAttemptAt: acc.lastAttemptAt,
  };
}

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
