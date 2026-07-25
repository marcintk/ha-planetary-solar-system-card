# Component Diagram (before)

**Base:** `904637a` — chore(deps-dev): bump prettier from 3.9.5 to 3.9.6 (dependabot[bot],
2026-07-25) **Head:** `edf53db` — fix(observer): align horizon with accurate elevation at high
latitudes (marcintk, 2026-07-25)

```mermaid
C4Component
  title Before — renderer/observer at 904637a

  Container_Boundary(renderer, "src/renderer") {
    Component(observer, "observer", "TS", "Day/night split, visibility cone, horizon line, observer needle")
    Component(rendererIndex, "index", "TS", "Orchestrates SVG render pass")
  }

  Container_Boundary(astronomy, "src/astronomy") {
    Component(solarPosition, "solar-position", "TS", "Spherical solar elevation (computeSolarElevationDeg)")
    Component(orbitalMechanics, "orbital-mechanics", "TS", "Planetary orbital positions (calculatePlanetPosition)")
  }

  Rel(rendererIndex, observer, "calls", "renderDayNightSplit, renderObserverNeedle, calculateObserverAngle")
  Rel(observer, solarPosition, "calls", "computeSolarElevationDeg — cone colour only")
  Rel(observer, orbitalMechanics, "calls", "calculatePlanetPosition")
```

## Evidence

- `observer` — `src/renderer/observer.ts`: exports `rayCircleDistance`,
  `calculateSolarElevationDeg`, `calculateObserverAngle`, `renderDayNightSplit`,
  `renderObserverNeedle`.
- `rendererIndex` → `observer` — `src/renderer/index.ts:12`:
  `import { calculateObserverAngle, renderDayNightSplit, renderObserverNeedle }`.
- `observer` → `solarPosition` — `src/renderer/observer.ts:3,155`: `computeSolarElevationDeg` called
  inside `renderDayNightSplit` to determine cone colour; does **not** influence cone direction.
- `observer` → `orbitalMechanics` — `src/renderer/observer.ts:1,130`:
  `calculatePlanetPosition(EARTH, date)`.
