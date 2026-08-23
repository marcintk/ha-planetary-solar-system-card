import { describe, expect, it, vi } from "vitest";
import { createAndMount, setupCardTest } from "./helpers.js";

setupCardTest();

// The furniture around the view: status bar layout, the version badge, and the debug overlay.
describe("SolarViewCard status bar", () => {
  describe("status bar layout", () => {
    // London at midday: sun is up, next transition (sunset) exists within 24h
    function createCardWithLocation(
      lat = 51.5,
      lon = -0.1,
      date = new Date("2026-03-05T12:00:00Z")
    ) {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.hass = {
        config: {
          latitude: lat,
          longitude: lon,
          time_zone: "Europe/London",
          location_name: "London",
        },
      };
      card._dateNav.currentDate = date;
      document.body.appendChild(card);
      return card;
    }

    it("renders two child spans when location and next transition are available", () => {
      const card = createCardWithLocation();
      const bar = card.shadowRoot.querySelector(".status-bar");
      const spans = bar.querySelectorAll("span");
      expect(spans).toHaveLength(2);
      card.remove();
    });

    it("left span contains location name, mode, and elevation", () => {
      const card = createCardWithLocation();
      const bar = card.shadowRoot.querySelector(".status-bar");
      const leftSpan = bar.querySelector("span:first-child");
      expect(leftSpan.textContent).toMatch(/London \| .+ \(-?\d+°\)/);
      card.remove();
    });

    it("right span contains Next: <mode-name> (<HH:MM>)", () => {
      const card = createCardWithLocation();
      const bar = card.shadowRoot.querySelector(".status-bar");
      const spans = bar.querySelectorAll("span");
      expect(spans[1].textContent).toMatch(/^Next: .+ \(\d{2}:\d{2}\)$/);
      card.remove();
    });

    // The clock in the "Next:" readout must follow the *observed* location, not the box Home
    // Assistant runs on. Every case below mounts a card whose HA is in America/Chicago, so any
    // leak of HA's zone shows up as a Chicago clock. Expected offsets are facts about each
    // country, independent of anything the card computes: Poland is UTC+1 / UTC+2 under DST,
    // Uruguay is UTC-3 year-round, India is UTC+5:30 and never shifts.
    function nextSpan(location, date) {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ location });
      card.hass = {
        config: {
          latitude: 41.8781,
          longitude: -87.6298,
          time_zone: "America/Chicago",
          location_name: "Chicago",
        },
      };
      card._dateNav.currentDate = date;
      document.body.appendChild(card);
      card._render();
      const spans = card.shadowRoot.querySelectorAll(".status-bar span");
      const text = spans[1].textContent;
      card.remove();
      const m = /\((\d{2}):(\d{2}) (.+)\)$/.exec(text);
      if (!m) throw new Error(`unexpected Next span: ${text}`);
      return { text, minutes: Number(m[1]) * 60 + Number(m[2]), zone: m[3] };
    }

    const KRAKOW = { name: "Krakow, Poland", latitude: 50.0614, longitude: 19.9366 };
    const MONTEVIDEO = { name: "Montevideo, Uruguay", latitude: -34.9011, longitude: -56.1645 };
    const BANGALORE = { name: "Bangalore, India", latitude: 12.9716, longitude: 77.5946 };
    const SUMMER = new Date("2026-08-20T18:00:00Z");
    const WINTER = new Date("2026-01-20T15:00:00Z");

    it("Krakow with timezone: Europe/Warsaw follows Poland's DST, not HA's Chicago clock", () => {
      expect(nextSpan({ ...KRAKOW, timezone: "Europe/Warsaw" }, SUMMER).zone).toBe("GMT+2");
      expect(nextSpan({ ...KRAKOW, timezone: "Europe/Warsaw" }, WINTER).zone).toBe("GMT+1");
    });

    it("Krakow without a timezone estimates UTC+1 — right in winter, an hour off in summer", () => {
      const summerEstimate = nextSpan(KRAKOW, SUMMER);
      const summerTruth = nextSpan({ ...KRAKOW, timezone: "Europe/Warsaw" }, SUMMER);
      expect(summerEstimate.zone).toBe("GMT+1");
      expect(summerTruth.minutes - summerEstimate.minutes).toBe(60);

      const winterEstimate = nextSpan(KRAKOW, WINTER);
      const winterTruth = nextSpan({ ...KRAKOW, timezone: "Europe/Warsaw" }, WINTER);
      expect(winterEstimate.zone).toBe("GMT+1");
      expect(winterTruth.minutes - winterEstimate.minutes).toBe(0);
    });

    it("Montevideo without a timezone estimates UTC-4, an hour behind Uruguay's fixed UTC-3", () => {
      const estimate = nextSpan(MONTEVIDEO, SUMMER);
      const truth = nextSpan({ ...MONTEVIDEO, timezone: "America/Montevideo" }, SUMMER);
      expect(estimate.zone).toBe("GMT-4");
      expect(truth.zone).toBe("GMT-3");
      expect(truth.minutes - estimate.minutes).toBe(60);
    });

    it("Bangalore needs the explicit zone — a longitude offset cannot express UTC+5:30", () => {
      const estimate = nextSpan(BANGALORE, SUMMER);
      const truth = nextSpan({ ...BANGALORE, timezone: "Asia/Kolkata" }, SUMMER);
      expect(estimate.zone).toBe("GMT+5");
      expect(truth.zone).toBe("GMT+5:30");
      expect(truth.minutes - estimate.minutes).toBe(30);
    });

    it("names a US zone by its abbreviation rather than a bare offset", () => {
      expect(nextSpan({ ...KRAKOW, timezone: "America/Chicago" }, SUMMER).zone).toBe("CDT");
      expect(nextSpan({ ...KRAKOW, timezone: "America/Chicago" }, WINTER).zone).toBe("CST");
    });

    it("only one span rendered when no transition found within 24h (polar night)", () => {
      // 89°N in deep winter: sun stays at ~-22° all day, no threshold crossing
      const card = createCardWithLocation(89, 0, new Date("2026-12-21T12:00:00Z"));
      const bar = card.shadowRoot.querySelector(".status-bar");
      const spans = bar.querySelectorAll("span");
      expect(spans).toHaveLength(1);
      card.remove();
    });
  });

  describe("version display", () => {
    it("hides version by default", () => {
      const card = createAndMount();
      expect(card.shadowRoot.querySelector(".card-version")).toBeNull();
      card.remove();
    });

    it("shows version when show_version is true", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 51.5, longitude: -0.1 } };
      card.setConfig({ show_version: true });
      card._render();
      const el = card.shadowRoot.querySelector(".card-version");
      expect(el).toBeTruthy();
      expect(el.textContent).toMatch(/^v/);
      card.remove();
    });

    it("hides version when show_version is false", () => {
      const card = createAndMount();
      card.setConfig({ show_version: false });
      card._render();
      expect(card.shadowRoot.querySelector(".card-version")).toBeNull();
      card.remove();
    });
  });

  describe("debug overlay", () => {
    it("hides by default", () => {
      const card = createAndMount();
      expect(card.shadowRoot.querySelector(".debug-overlay")).toBeNull();
      card.remove();
    });

    it("shows a row per source with cumulative stats when debug is true", async () => {
      const card = createAndMount({
        debug: true,
        gallery: { mode: "both", mymoon: true, moon: true, earth: true, sun: true },
      });
      await vi.waitFor(() => expect(card._gallery.debugStats.sun.elapsed).not.toBeNull());
      card._render();
      const overlay = card.shadowRoot.querySelector(".debug-overlay");
      const rowText = [...overlay.querySelectorAll("tr")].map((tr) => tr.textContent);
      expect(rowText[1]).toContain("SVS/M");
      expect(rowText[2]).toContain("SDO/S");
      expect(rowText[3]).toContain("DSCOVR/E");
      expect(overlay.textContent).toContain("source");
      expect(overlay.textContent).toContain("refresh");
      expect(overlay.textContent).toContain("fetch");
      expect(overlay.textContent).toContain("expire");
      expect(overlay.textContent).toMatch(/\d+ms/);
      expect(overlay.textContent).toContain("since ");
      card.remove();
    });

    it("hides when debug is false", () => {
      const card = createAndMount();
      card.setConfig({ debug: false });
      card._render();
      expect(card.shadowRoot.querySelector(".debug-overlay")).toBeNull();
      card.remove();
    });

    it("re-renders every second so the overlay's 'last' column ages live", () => {
      vi.useFakeTimers();
      const card = createAndMount({ debug: true, gallery: { mode: "both" } });
      const renderSpy = vi.spyOn(card, "_render");
      vi.advanceTimersByTime(3000);
      expect(renderSpy).toHaveBeenCalledTimes(3);
      card.remove();
      vi.useRealTimers();
    });

    it("stops the 1s refresh once debug is turned off while mounted", () => {
      vi.useFakeTimers();
      const card = createAndMount({ debug: true, gallery: { mode: "both" } });
      card.setConfig({ debug: false });
      const renderSpy = vi.spyOn(card, "_render");
      vi.advanceTimersByTime(3000);
      expect(renderSpy).not.toHaveBeenCalled();
      card.remove();
      vi.useRealTimers();
    });
  });
});
