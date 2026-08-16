// Built-in background+text pairs for `theme: "dark" | "light"` — forces every currentColor-
// derived accent (orbit, labels, twilight cones, needle, ...) to a consistent palette
// regardless of the HA theme actually installed. `colors.background` still overrides the
// background half, matching how colors.* already layers on top elsewhere.
const THEME_PALETTES: Record<"dark" | "light", { background: string; color: string }> = {
  dark: { background: "#1c1c1c", color: "#e1e1e1" },
  light: { background: "#ffffff", color: "#212121" },
};

// card-styles.ts leans on these HA custom properties (status-bar/nav backgrounds, borders)
// with a currentColor-based fallback for when HA doesn't define them. But HA always defines
// them — from whichever theme is actually installed — and custom properties pierce the shadow
// boundary, so a forced dark/light `theme:` only overriding :host's plain background/color
// still left every var(--secondary-background-color, ...) etc. resolving to the real (possibly
// mismatched) HA theme's value instead of the intended fallback. Setting each to the CSS-wide
// keyword "initial" makes it the custom property's guaranteed-invalid value, which is exactly
// what makes var()'s fallback kick in.
export const THEME_OVERRIDE_VARS = [
  "--ha-card-background",
  "--card-background-color",
  "--primary-background-color",
  "--primary-text-color",
  "--secondary-background-color",
  "--divider-color",
];

export interface ResolvedTheme {
  background: string;
  color: string;
  // null = clear the property (auto theme); "initial" = force it, per THEME_OVERRIDE_VARS above.
  vars: Record<string, string | null>;
}

// Pure mapping from a card's theme + colors.background override to what should actually be
// painted — computed once and shared by render() (inline style attribute) and updated()
// (this.style.* + custom properties), instead of re-deriving the same palette in both places.
export function resolveTheme(
  theme: "auto" | "dark" | "light",
  colorsBackground: string | undefined
): ResolvedTheme {
  const palette = theme === "auto" ? null : THEME_PALETTES[theme];
  const vars: Record<string, string | null> = {};
  for (const name of THEME_OVERRIDE_VARS) {
    vars[name] = palette ? "initial" : null;
  }
  return {
    background: colorsBackground ?? palette?.background ?? "",
    color: palette?.color ?? "",
    vars,
  };
}
