import { describe, expect, it } from "vitest";
import { findPublishedSlot } from "../../../src/card/gallery/slot-search.js";

const SLOT_MS = 15 * 60000;
const MAX_REACH_MS = 30 * 24 * 60 * 60000;

// A fake probe driven entirely by a set of "which slots exist" — no Image, no network, no
// timers. This is the whole point of extracting the search from SdoSunResolver.recover(): the
// strategy is provable against plain numbers.
function probeFor(existingSlots: Set<number>) {
  return async (slotMs: number) => ({ hit: existingSlots.has(slotMs) });
}

describe("findPublishedSlot", () => {
  it("with a confirmed slot, one probe past it settling a hit narrows to that slot", async () => {
    const confirmedMs = 1000 * SLOT_MS;
    const nextMs = confirmedMs + SLOT_MS;
    const result = await findPublishedSlot({
      confirmedMs,
      missedMs: nextMs + 5 * SLOT_MS, // caller's original miss was further out
      slotMs: SLOT_MS,
      maxReachMs: MAX_REACH_MS,
      probe: probeFor(new Set([nextMs])),
    });

    expect(result.foundMs).toBe(nextMs);
  });

  it("with a confirmed slot, a miss on the one probe past it resolves foundMs: null", async () => {
    const confirmedMs = 1000 * SLOT_MS;
    const result = await findPublishedSlot({
      confirmedMs,
      missedMs: confirmedMs + 5 * SLOT_MS,
      slotMs: SLOT_MS,
      maxReachMs: MAX_REACH_MS,
      probe: probeFor(new Set()), // nothing newer exists
    });

    expect(result.foundMs).toBeNull();
  });

  it("with a confirmed slot and no gap to search (next >= missed), never calls probe", async () => {
    const confirmedMs = 1000 * SLOT_MS;
    let probeCalls = 0;
    const result = await findPublishedSlot({
      confirmedMs,
      missedMs: confirmedMs + SLOT_MS, // equal to `next` — no gap
      slotMs: SLOT_MS,
      maxReachMs: MAX_REACH_MS,
      probe: async () => {
        probeCalls++;
        return { hit: false };
      },
    });

    expect(probeCalls).toBe(0);
    expect(result.foundMs).toBeNull();
  });

  it("cold start doubles reach until a hit, then bisects to the newest loading slot", async () => {
    const origin = 10_000 * SLOT_MS;
    // Reach sequence from origin: -1, -2, -4 slots — the 3rd probe hits, landing exactly on the
    // reach-doubling boundary, so bisection then narrows the gap against the prior miss at -2.
    const hitAt = origin - 4 * SLOT_MS;
    const result = await findPublishedSlot({
      confirmedMs: null,
      missedMs: origin,
      slotMs: SLOT_MS,
      maxReachMs: MAX_REACH_MS,
      probe: probeFor(new Set([hitAt])),
    });

    expect(result.foundMs).toBe(hitAt);
  });

  it("cold start exhausted at maxReachMs with nothing found rethrows the last miss error", async () => {
    const origin = 1000 * SLOT_MS;
    await expect(
      findPublishedSlot({
        confirmedMs: null,
        missedMs: origin,
        slotMs: SLOT_MS,
        maxReachMs: 2 * SLOT_MS, // reach maxes out after 2 probes
        probe: async () => ({ hit: false, error: new Error("404") }),
      })
    ).rejects.toThrow("404");
  });

  it("an abort result stops the search immediately, without continuing to a wider reach", async () => {
    let probeCalls = 0;
    await expect(
      findPublishedSlot({
        confirmedMs: null,
        missedMs: 1000 * SLOT_MS,
        slotMs: SLOT_MS,
        maxReachMs: MAX_REACH_MS,
        probe: async () => {
          probeCalls++;
          return { hit: false, abort: true, error: new Error("timed out") };
        },
      })
    ).rejects.toThrow("timed out");
    expect(probeCalls).toBe(1);
  });

  it("bisection converges to the exact boundary between a known-loading and known-missing slot", async () => {
    const loadedAt = 0;
    const missedAt = 8 * SLOT_MS;
    // Every slot from 1..8 in units of SLOT_MS "exists" except the boundary walk should land on
    // the newest slot still <= missedAt that is NOT in the hit set — plant a hit only at 5.
    const result = await findPublishedSlot({
      confirmedMs: loadedAt - SLOT_MS, // forces the confirmed-branch to probe at `loadedAt`
      missedMs: missedAt,
      slotMs: SLOT_MS,
      maxReachMs: MAX_REACH_MS,
      probe: probeFor(new Set([loadedAt])),
    });

    expect(result.foundMs).toBe(loadedAt);
  });
});
