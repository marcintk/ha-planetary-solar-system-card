# Component Diagram (after)

**Base:** `904637a` — chore(deps-dev): bump prettier from 3.9.5 to 3.9.6 (dependabot[bot],
2026-07-25) **Head:** `edf53db` — fix(observer): align horizon with accurate elevation at high
latitudes (marcintk, 2026-07-25)

```mermaid
C4Component
  title After — renderer/observer at edf53db

  Container_Boundary(renderer, "src/renderer") {
    Component(observer, "observer", "TS", "Day/night split, visibility cone, horizon line, observer needle + display-angle correction")
    Component(rendererIndex, "index", "TS", "Orchestrates SVG render pass")
  }

  Container_Boundary(astronomy, "src/astronomy") {
    Component(solarPosition, "solar-position", "TS", "Spherical solar elevation (computeSolarElevationDeg)")
    Component(orbitalMechanics, "orbital-mechanics", "TS", "Planetary orbital positions (calculatePlanetPosition)")
  }

  Rel(rendererIndex, observer, "calls", "renderDayNightSplit, renderObserverNeedle, calculateObserverAngle")
  Rel(observer, solarPosition, "calls", "computeSolarElevationDeg — cone colour + display-angle input")
  Rel(observer, orbitalMechanics, "calls", "calculatePlanetPosition")
```

## Evidence

- `observer` — `src/renderer/observer.ts`: now also exports `computeDisplayObserverAngle` (new, line
  48). `renderDayNightSplit` calls it to derive `displayObserverAngle` when `locationData.lat` is
  present (line 183–188), using it for cone direction, horizon, and zenith lines.
- All external edges unchanged — `rendererIndex`, `solarPosition`, `orbitalMechanics`
  callers/callees are identical at both commits.
