# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Home Assistant custom Lovelace card (`ha-solar-view-card`) that displays a planetary solar system visualization. Shows alignment of all 8 planets and Moon centered on the Sun for a given date, with interactive navigation (day/month forward/back, return to today).

## Commands

- `npm run build` — bundle to `dist/ha-solar-view-card.js` (unminified)
- `npm run build:prod` — production bundle (minified with terser)
- `npm test` — run all tests once
- `npm run test:watch` — run tests in watch mode
- `npx vitest run test/some-file.test.js` — run a single test file

## Technical Stack

- **Language**: JavaScript (ES modules)
- **Build**: Rollup → single ES module bundle in `dist/`
- **Tests**: Vitest with jsdom environment
- **Runtime**: Home Assistant Lovelace custom card (Web Components / Custom Elements)

## Architecture

- `src/index.js` — entry point; registers the custom element and card metadata
- `src/solar-view-card.js` — main card class extending HTMLElement (shadow DOM)
- `test/` — test files mirroring src structure; custom elements must be registered via `customElements.define()` before instantiation in tests (use `document.createElement()`, not `new`)
- `dist/ha-solar-view-card.js` — built output deployed to Home Assistant

## Architecture Goals

- Internal logic split into small classes/files for testability
- Build system works independently of Home Assistant (standalone testing)
- Multi-agent workflow: Architect (spec), Developer (implementation), Tester (verification)

## Key Visual Requirements

- Planets enlarged for visibility; Sun smaller to avoid interference with orbits
- Earth and Moon larger than other objects to show relative positioning
- Each orbit displays AU distance from Sun
- Day/night split at Earth's orbit level (lighter background for night sky viewing)
- Dark slate theme matching Home Assistant dark mode colors
- Buttons to move back or forward (by 1 day and 1 month) and extra button to back to today
