import type { TemplateResult } from "lit";
import { html } from "lit";
import type { ImageSource } from "./card-template.js";
import { formatDate, GALLERY_SOURCE_LABELS } from "./card-template.js";
import { formatDuration } from "./relative-time.js";

// Cumulative, since the card was mounted — not a rolling window. Lets debug:true answer "is
// this source's own cache actually saving anything" at a glance: ticks vs. network
// equal means every tick is hitting the network regardless of cache state. `redundant` is
// the sharper signal for that same question — it counts preloads whose resolved URL turned
// out identical to the image already displayed, i.e. bytes that were re-fetched and
// re-decoded for nothing. `attempts` vs. `network`+`failures` separates "tried" from
// "succeeded", since a failed preload (sun's retry path) previously vanished from the count
// entirely instead of showing up as a real network cost. `retries` counts how often sun's
// primary 15-min-slot guess missed and fell back to the previous slot — a rising rate here
// means SUN_PUBLISH_BUFFER_MS (image-sources.ts) needs widening. `lastAttemptAt` is the raw
// timestamp of the most recent preload attempt, formatted at render time.
export interface SourceDebugStats {
  ticks: number;
  attempts: number;
  network: number;
  failures: number;
  retries: number;
  redundant: number;
  elapsed: number | null;
  lastAttemptAt: number | null;
}

export interface DebugAccumulator {
  ticks: number;
  attempts: number;
  network: number;
  failures: number;
  retries: number;
  redundant: number;
  fetchMsTotal: number;
  lastAttemptAt: number | null;
}

export function emptyDebugAccumulator(): DebugAccumulator {
  return {
    ticks: 0,
    attempts: 0,
    network: 0,
    failures: 0,
    retries: 0,
    redundant: 0,
    fetchMsTotal: 0,
    lastAttemptAt: null,
  };
}

export function toDebugStats(acc: DebugAccumulator): SourceDebugStats {
  return {
    ticks: acc.ticks,
    attempts: acc.attempts,
    network: acc.network,
    failures: acc.failures,
    retries: acc.retries,
    redundant: acc.redundant,
    elapsed: acc.network > 0 ? acc.fetchMsTotal / acc.network : null,
    lastAttemptAt: acc.lastAttemptAt,
  };
}

function formatMs(ms: number | null): string {
  return ms == null ? "—" : `${Math.round(ms)}ms`;
}

// ticks max()s rather than sum()s: sun/earth tick in lockstep for "both"/"slide" modes (one
// refresh() increments both), so summing would double-count — max reads right there and
// still reports correctly for a single-source mode, where the other side stays 0. time
// avg()s the two sources' own averages (not a token-weighted mean — kept simple since this
// overlay is already an approximation, not a billing report). last has no sane combination
// of two different timestamps, so it's dropped rather than showing a misleading one.
function summarizeDebugStats(stats: Record<ImageSource, SourceDebugStats>): SourceDebugStats {
  const { sun, earth } = stats;
  const elapsedValues = [sun.elapsed, earth.elapsed].filter((ms): ms is number => ms != null);
  return {
    ticks: Math.max(sun.ticks, earth.ticks),
    attempts: sun.attempts + earth.attempts,
    network: sun.network + earth.network,
    failures: sun.failures + earth.failures,
    retries: sun.retries + earth.retries,
    redundant: sun.redundant + earth.redundant,
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
  stats: Record<ImageSource, SourceDebugStats>,
  startedAt: number
): TemplateResult {
  const rows: ImageSource[] = ["sun", "earth"];
  return html`<div class="debug-overlay">
    <table>
      <tr>
        <th>source</th>
        <th>ticks</th>
        <th>atmpt</th>
        <th>fetch</th>
        <th>fail</th>
        <th>retry</th>
        <th>dup</th>
        <th>time</th>
        <th>last</th>
      </tr>
      ${rows.map((source) => {
        const s = stats[source];
        return html`<tr>
          <td>${GALLERY_SOURCE_LABELS[source]}</td>
          <td>${s.ticks}</td>
          <td>${s.attempts}</td>
          <td>${s.network}</td>
          <td>${s.failures}</td>
          <td>${s.retries}</td>
          <td>${s.redundant}</td>
          <td>${formatMs(s.elapsed)}</td>
          <td>${s.lastAttemptAt == null ? "—" : formatDuration(Date.now() - s.lastAttemptAt)}</td>
        </tr>`;
      })}
      ${(() => {
        const total = summarizeDebugStats(stats);
        return html`<tr class="debug-total">
          <td>total</td>
          <td>${total.ticks}</td>
          <td>${total.attempts}</td>
          <td>${total.network}</td>
          <td>${total.failures}</td>
          <td>${total.retries}</td>
          <td>${total.redundant}</td>
          <td>${formatMs(total.elapsed)}</td>
          <td>—</td>
        </tr>`;
      })()}
    </table>
    <div class="debug-caption">since ${formatDate(new Date(startedAt))} (${formatDuration(Date.now() - startedAt)})</div>
  </div>`;
}
