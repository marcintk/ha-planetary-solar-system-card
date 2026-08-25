import { floorToGrid } from "./pad.js";

// Pure "which slot to try next" engine for a source published on a fixed time grid with
// unknown publish lag (sun's 15-min SDO slots — see source-resolver-sdo-sun.ts). Knows nothing
// about network, decoding, or images: the caller supplies a `probe` that answers "does this slot
// exist" and gets back which slot to serve. That split is what makes the search strategy
// (reach-doubling cold start, bisection narrowing) testable with a synchronous fake probe instead
// of mocking Image.decode() per candidate slot.
export interface SlotProbeResult {
  hit: boolean;
  // true aborts the whole search immediately (a dead host, not a missing slot) — see this
  // module's caller for what "abort" means concretely. Ignored when hit is true.
  abort?: boolean;
  // Carried through to the exhausted-cold-start throw below; ignored when hit is true or the
  // confirmed-branch's single probe misses (that path resolves with foundMs: null instead).
  error?: unknown;
}

export type SlotProbe = (slotMs: number) => Promise<SlotProbeResult>;

export interface SlotSearchResult {
  // The newest slot confirmed to exist, or null when a confirmed frame was supplied and the one
  // probe past it missed — nothing newer exists, the caller already has the right answer.
  foundMs: number | null;
  // The newest slot still known not to exist — only meaningful when foundMs is non-null, as the
  // bisection's own upper bound.
  missedMs: number;
}

export interface SlotSearchOptions {
  // Last confirmed-good slot, or null for a cold start with nothing to anchor to.
  confirmedMs: number | null;
  // The candidate slot that was just tried and found missing — the search's starting point.
  missedMs: number;
  // Grid spacing (sun: 15 minutes).
  slotMs: number;
  // Cold-start reach ceiling — past this, the feed is treated as dead rather than lagging.
  maxReachMs: number;
  probe: SlotProbe;
}

export async function findPublishedSlot(opts: SlotSearchOptions): Promise<SlotSearchResult> {
  const { confirmedMs, slotMs, maxReachMs, probe } = opts;
  let missed = opts.missedMs;
  let lastError: unknown;

  async function tryProbe(atMs: number): Promise<boolean> {
    const result = await probe(atMs);
    if (result.hit) return true;
    if (result.abort) throw result.error;
    lastError = result.error;
    return false;
  }

  let loaded: number;
  if (confirmedMs != null) {
    // Everything at or below the confirmed slot is already answered — one probe past it settles
    // whether anything newer has published.
    const next = confirmedMs + slotMs;
    const found = next < missed ? await tryProbe(next) : false;
    if (!found) return { foundMs: null, missedMs: missed };
    loaded = next;
  } else {
    // Cold start: double the reach each miss until something loads, or the ceiling is hit.
    const origin = missed;
    let reach = slotMs;
    let found: number | null = null;
    for (;;) {
      const candidate = origin - reach;
      if (await tryProbe(candidate)) {
        found = candidate;
        break;
      }
      missed = candidate;
      if (reach === maxReachMs) break;
      reach = Math.min(reach * 2, maxReachMs);
    }
    if (found == null) throw lastError;
    loaded = found;
  }

  // Bisect the gap between a slot known to load and one known not to — logarithmic in the gap.
  while (missed - loaded > slotMs) {
    const mid = floorToGrid(loaded + (missed - loaded) / 2, slotMs);
    if (await tryProbe(mid)) {
      loaded = mid;
    } else {
      missed = mid;
    }
  }
  return { foundMs: loaded, missedMs: missed };
}
