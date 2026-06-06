import { afterEach, describe, expect, it, vi } from "vitest";

describe("src/index.js bootstrap", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete window.customCards;
  });

  it("defines ha-solar-view-card as a custom element", async () => {
    const define = vi.fn();
    vi.stubGlobal("customElements", { define, get: vi.fn(() => undefined) });
    await import("../src/index.js");
    expect(define).toHaveBeenCalledWith("ha-solar-view-card", expect.any(Function));
  });

  it("creates window.customCards when absent and pushes card metadata", async () => {
    vi.stubGlobal("customElements", { define: vi.fn(), get: vi.fn(() => undefined) });
    // window.customCards is undefined — exercises the `|| []` branch
    await import("../src/index.js");
    expect(Array.isArray(window.customCards)).toBe(true);
    const entry = window.customCards.find((c) => c.type === "ha-solar-view-card");
    expect(entry).toBeDefined();
    expect(entry.name).toBe("Solar View Card");
    expect(typeof entry.description).toBe("string");
  });

  it("appends to a pre-existing window.customCards array", async () => {
    vi.stubGlobal("customElements", { define: vi.fn(), get: vi.fn(() => undefined) });
    window.customCards = [{ type: "pre-existing-card" }];
    await import("../src/index.js");
    // Must have kept the pre-existing entry and added the new one
    expect(window.customCards.length).toBeGreaterThan(1);
    expect(window.customCards[0].type).toBe("pre-existing-card");
  });
});
