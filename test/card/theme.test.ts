import { describe, expect, it } from "vitest";
import { resolveTheme, THEME_OVERRIDE_VARS } from "../../src/card/theme.js";

describe("resolveTheme", () => {
  it("auto leaves background/color empty and clears override vars", () => {
    const t = resolveTheme("auto", undefined);
    expect(t.background).toBe("");
    expect(t.color).toBe("");
    for (const name of THEME_OVERRIDE_VARS) {
      expect(t.vars[name]).toBeNull();
    }
  });

  it("dark forces a dark background/text pair and sets override vars to 'initial'", () => {
    const t = resolveTheme("dark", undefined);
    expect(t.background).toBe("#1c1c1c");
    expect(t.color).toBe("#e1e1e1");
    for (const name of THEME_OVERRIDE_VARS) {
      expect(t.vars[name]).toBe("initial");
    }
  });

  it("light forces a light background/text pair", () => {
    const t = resolveTheme("light", undefined);
    expect(t.background).toBe("#ffffff");
    expect(t.color).toBe("#212121");
  });

  it("colors.background overrides the forced theme's background but not color", () => {
    const t = resolveTheme("dark", "#ff00ff");
    expect(t.background).toBe("#ff00ff");
    expect(t.color).toBe("#e1e1e1");
  });
});
