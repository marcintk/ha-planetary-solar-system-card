import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SolarViewCard } from "../../../src/card/card.js";
import { urlCache } from "../../../src/card/gallery/url-cache.js";

// End-to-end companion to backoff.test.ts's unit coverage: drives the real card, its
// refresh_mins timer, and gallery-controller/resolve() plumbing through a sustained outage,
// rather than calling Backoff or SourceResolver directly — confirms the cooldown actually
// suppresses network calls at the boundary a user's browser would hit, not just at the
// class-under-test boundary.
describe("gallery backoff integration", () => {
  beforeAll(() => {
    if (!customElements.get("ha-planetary-solar-system-card-test")) {
      customElements.define("ha-planetary-solar-system-card-test", SolarViewCard);
    }
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch not stubbed for this test")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    urlCache.clear();
  });

  function createAndMount(config) {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ gallery: { mode: "both", sun: true }, ...config });
    document.body.appendChild(card);
    return card;
  }

  it("a sustained sun-source outage backs off instead of retrying every refresh_mins tick", async () => {
    // Real network attempts only, not decode-gate hits: every Image() construction is one
    // real probe of a candidate URL (the primary guess plus, on failure, every probe the
    // recovery search spends doubling toward the 30-day ceiling) — the number backoff
    // exists to bound.
    let imageAttempts = 0;
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        constructor() {
          imageAttempts++;
        }
        decode() {
          return Promise.reject(new Error("decode failed"));
        }
      }
    );
    vi.useFakeTimers();
    // 30-minute ticks, not the card's likelier 1-minute default: Backoff's cooldown is
    // Date.now()-based (backoff.ts), not tick-count-based, so a coarser tick reaches the
    // same 6h MAX_BACKOFF_MS ceiling in 12 real timer firings instead of 360 — 30x less
    // real Image()/decode work for an identical assertion. The doubling/cap math itself is
    // exhaustively unit-tested in backoff.test.ts; this only has to prove the wiring holds.
    const card = createAndMount({ refresh_mins: 30 });
    await vi.advanceTimersByTimeAsync(0); // mount's own background fetch fails

    const attemptsAfterMount = imageAttempts;
    expect(attemptsAfterMount).toBeGreaterThan(0);

    // 6 hours of 30-minute ticks (12 of them). Without backoff, each tick re-attempts
    // (primary + retries). With it, cooldown skips ticks that land inside the current
    // backoff window, so this stays a small, capped number.
    await vi.advanceTimersByTimeAsync(6 * 3600000);

    expect(imageAttempts).toBeGreaterThan(attemptsAfterMount); // it did keep trying...
    expect(imageAttempts).toBeLessThan(200); // ...but nowhere near the naive per-tick retry
    // count: four sources probing on every tick, sun costing up to 12 probes each time to
    // double from its floor out to the 30-day ceiling. Each source backs off on its own
    // cooldown, so the ceiling scales with source count and per-attempt search depth, not
    // tick count — which is exactly why fewer, coarser ticks still exercise it faithfully.
    expect(urlCache.inCooldown("sun")).toBe(true); // still backed off at the end of the outage

    card.remove();
    vi.useRealTimers();
  });
});
