import { afterEach, describe, expect, it, vi } from "vitest";
import { Backoff } from "../../../src/card/gallery/backoff.js";

describe("Backoff", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getStale returns the last confirmed image regardless of elapsed time", () => {
    const backoff = new Backoff();
    const image = { url: "https://example.com/a.jpg", date: new Date() };
    vi.spyOn(Date, "now").mockReturnValue(1000);
    backoff.recordSuccess("earth", image);

    vi.spyOn(Date, "now").mockReturnValue(1000 + 999999999);
    expect(backoff.getStale("earth")).toEqual(image);
  });

  it("getStale returns null for a key that was never confirmed", () => {
    const backoff = new Backoff();
    expect(backoff.getStale("earth")).toBeNull();
  });

  it("is not in cooldown until a failure is recorded", () => {
    const backoff = new Backoff();
    expect(backoff.inCooldown("sun")).toBe(false);
  });

  it("enters cooldown after a recorded failure, for at least the base backoff", () => {
    const backoff = new Backoff();
    vi.spyOn(Date, "now").mockReturnValue(0);
    backoff.recordFailure("sun");
    expect(backoff.inCooldown("sun")).toBe(true);

    vi.spyOn(Date, "now").mockReturnValue(60000);
    expect(backoff.inCooldown("sun")).toBe(false);
  });

  it("doubles the cooldown for each additional consecutive failure", () => {
    const backoff = new Backoff();
    vi.spyOn(Date, "now").mockReturnValue(0);
    backoff.recordFailure("sun");
    backoff.recordFailure("sun");

    vi.spyOn(Date, "now").mockReturnValue(60000);
    expect(backoff.inCooldown("sun")).toBe(true); // 1st backoff (1min) would've expired, 2nd (2min) hasn't

    vi.spyOn(Date, "now").mockReturnValue(120000 + 1);
    expect(backoff.inCooldown("sun")).toBe(false);
  });

  it("caps the cooldown at the maximum backoff", () => {
    const backoff = new Backoff();
    vi.spyOn(Date, "now").mockReturnValue(0);
    for (let i = 0; i < 20; i++) backoff.recordFailure("sun");

    vi.spyOn(Date, "now").mockReturnValue(6 * 3600000);
    expect(backoff.inCooldown("sun")).toBe(false);
  });

  it("a Retry-After longer than the computed backoff wins", () => {
    const backoff = new Backoff();
    vi.spyOn(Date, "now").mockReturnValue(0);
    backoff.recordFailure("earth", 3600000); // 1 hour, far past the 1-minute base backoff

    vi.spyOn(Date, "now").mockReturnValue(60000);
    expect(backoff.inCooldown("earth")).toBe(true);

    vi.spyOn(Date, "now").mockReturnValue(3600000 + 1);
    expect(backoff.inCooldown("earth")).toBe(false);
  });

  it("a Retry-After shorter than the computed backoff does not shorten it", () => {
    const backoff = new Backoff();
    vi.spyOn(Date, "now").mockReturnValue(0);
    backoff.recordFailure("earth", 1); // 1ms, far under the 1-minute base backoff

    vi.spyOn(Date, "now").mockReturnValue(59999);
    expect(backoff.inCooldown("earth")).toBe(true);
  });

  it("recordSuccess clears an active cooldown", () => {
    const backoff = new Backoff();
    vi.spyOn(Date, "now").mockReturnValue(0);
    backoff.recordFailure("sun");
    expect(backoff.inCooldown("sun")).toBe(true);

    backoff.recordSuccess("sun", { url: "https://example.com/x.jpg", date: new Date() });
    expect(backoff.inCooldown("sun")).toBe(false);
  });

  it("recordSuccess resets the failure count so the next failure starts at the base backoff", () => {
    const backoff = new Backoff();
    vi.spyOn(Date, "now").mockReturnValue(0);
    backoff.recordFailure("sun");
    backoff.recordFailure("sun");
    backoff.recordSuccess("sun", { url: "https://example.com/x.jpg", date: new Date() });

    backoff.recordFailure("sun");
    vi.spyOn(Date, "now").mockReturnValue(60000);
    expect(backoff.inCooldown("sun")).toBe(false); // back to the 1-minute base, not the doubled value
  });

  it("cooldown state is independent per key", () => {
    const backoff = new Backoff();
    vi.spyOn(Date, "now").mockReturnValue(0);
    backoff.recordFailure("sun");
    expect(backoff.inCooldown("earth")).toBe(false);
  });

  it("clear resets failure, cooldown, and confirmed-image state", () => {
    const backoff = new Backoff();
    vi.spyOn(Date, "now").mockReturnValue(0);
    backoff.recordFailure("sun");
    backoff.recordSuccess("earth", { url: "https://example.com/x.jpg", date: new Date() });
    backoff.clear();
    expect(backoff.inCooldown("sun")).toBe(false);
    expect(backoff.getStale("earth")).toBeNull();
  });
});
