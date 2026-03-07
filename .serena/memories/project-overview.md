# ha-planetary-solar-system-card

## Purpose
Home Assistant custom Lovelace card (`ha-solar-view-card`) — planetary solar system visualization showing alignment of all 8 planets and Moon around the Sun for a given date.

## Tech Stack
- JavaScript (ES modules), no TypeScript
- Rollup for bundling → `dist/ha-solar-view-card.js`
- Vitest + jsdom for tests
- Web Components / Custom Elements

## Commands
- `npm run build` — dev bundle
- `npm run build:prod` — prod bundle (minified)
- `npm test` — run all tests
- `npx vitest run test/some-file.test.js` — single file

## Source Structure
- `src/index.js` — entry, registers custom element
- `src/solar-view-card.js` — SolarViewCard HTMLElement (rendering, navigation, zoom, pan)
- `src/planet-data.js` — PLANETS, MOON, SUN static data
- `src/orbital-mechanics.js` — calculatePlanetPosition, calculateMoonPosition
- `src/renderer.js` — renderSolarSystem (main renderer)
- `src/view-state.js` — ViewState class (pan/zoom state)
- `src/solar-position.js` — real astronomical calculations (computeSolarElevationDeg, getSkyMode, computeNextTransitionTime, getLocalTimeInZone)
- `src/card-styles.js` — CARD_STYLES CSS string
- `src/card-template.js` — buildStatusBarHtml, buildCardHtml
- `src/renderer/bodies.js` — renderBody, renderOrbit, renderSaturnRings
- `src/renderer/observer.js` — renderDayNightSplit, renderObserverNeedle, calculateObserverAngle, calculateSolarElevationDeg, cone constants
- `src/renderer/seasons.js` — renderSeasonOverlay
- `src/renderer/svg-utils.js` — createSvgElement, auToRadius, expandBounds, constants

## Test Structure
- `test/planet-data.test.js` — planet data + orbital mechanics (split needed)
- `test/renderer.test.js` — renderSolarSystem, observer angle/elevation tests
- `test/solar-view-card.test.js` — SolarViewCard integration
- `test/solar-position.test.js` — solar-position.js

## Code Style
- JSDoc comments on public functions
- camelCase for functions/variables, PascalCase for classes, UPPER_SNAKE for constants
- No TypeScript, no semicolons-only style (uses semicolons at statement ends)
