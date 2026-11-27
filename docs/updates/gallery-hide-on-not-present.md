# gallery-hide-on-not-present

# Task: hide unavailable gallery sources and recover on their own

Request: the moon picture can't load (NASA page broken); hide the gallery when the moon picture is
unavailable after a few attempts, and restore it when the picture becomes available.

## Summary

When a gallery source has no image and can't get one, the card now hides that source. A source is
"unavailable" after 5 real load failures in a row with no image to show. A moon year that NASA
hasn't published counts as unavailable right away. If every configured source is unavailable, the
gallery nav button is disabled with the tooltip "No images available", and the strip isn't shown.
The card keeps collecting, even when the strip is closed, but only for sources that have no image. A
healthy closed strip makes no requests. When an image arrives, the gallery goes back to its
configured default: `show` or `slide` opens the strip, and `off` stays closed. A source that still
has an older good image stays visible.

## Changes

- `src/card/gallery/backoff.ts`, `url-cache.ts`, `source-resolver.ts`, `image-resolver.ts`: expose
  the per-source consecutive failure count. The count resets on success, and cooldown ticks aren't
  counted.
- `source-resolver-svs-moon.ts` and `source-resolver.ts`: a moon year with no published product
  marks the moon unavailable immediately.
- `src/card/gallery/gallery-controller.ts`:
  - Derive "unavailable" per source: no image and (5 or more failures, or a permanent failure).
  - Filter unavailable sources out of `thumbnails` and `displaySources`.
  - Skip them in `_advanceSlide`, and keep `_slideIndex` valid.
  - Add `nothingDrawable` to `viewModel()` (every configured source unavailable), separate from
    `_open`.
  - `tick()` and `start()` also refresh the sources with no image while the strip is closed.
  - When `nothingDrawable` ends, restore the configured default open or closed state.
  - Treat `onSunThumbError` as a failure for the count.
- `src/card/card.ts` (~265): the nav button is `disabled` with the title "No images available" while
  `nothingDrawable`.
- Docs and tests: update README or docs if they describe the gallery states (not checked yet).

## Checklist

- [x] The failure count per source goes up on a real preload failure, resets on success, and doesn't
      go up during a cooldown.
- [x] A source with no image and 5 failures is unavailable. At 4 failures it is still visible.
- [x] A source with an older good image is never unavailable.
- [x] An unpublished moon year is unavailable at once, and recovers when the year is mapped.
- [x] Unavailable sources are left out of the thumbnails. `mymoon` and `moon` hide and recover
      together.
- [x] Slide mode skips unavailable sources and keeps a valid index when the list shrinks.
- [x] `nothingDrawable` is true only when every configured source is unavailable, and doesn't change
      `_open`.
- [x] A closed strip refreshes only sources with no image. A closed strip with all images present
      makes no request.
- [x] On recovery from `nothingDrawable`, the strip returns to the configured default (`show` or
      `slide` opens it, `off` stays closed).
- [x] The nav button is disabled with "No images available" while `nothingDrawable`, and enabled
      again after recovery.
- [x] The sun thumbnail's `@error` counts as a failure.
- [x] Rename or scope the existing "closed means no refresh" tests (`gallery-controller.test.ts`
      ~169, ~178, ~185), and keep 100% coverage.

## Seam and behavior to pin

`GalleryController` through `viewModel()` with a fake resolver and the existing `stubImagePreload`.
Pin what is visible and what refreshes for each combination of failures, images, and open or closed.
One DOM check in `test/card/card.gallery.test.ts` for the disabled button.

## Impact

A moon outage hides the moon tiles. Before, they showed a blank "loading…". A closed strip with a
missing image makes extra NASA requests, bounded by the backoff (about 4 a day per source at the 6 h
cap). The debug counters rise while the strip is closed. The config schema is unchanged. The
threshold of 5 is hard-coded. The panel's error banner is unchanged.

## Decisions

- Hide per source, not the whole strip.
- 5 failures, counted only when no image is available.
- Recover through the existing backoff (60 s doubling, 6 h cap).
- The open or closed choice is kept apart from "nothing drawable".
- Recovery returns to the configured default and ignores manual toggles made during the outage.
- The nav button is disabled, with no placeholder strip.

## Assumptions

- The cause is a NASA outage or a bad URL. The live URL was not tested.
- The `Backoff` failure count can be exposed without changing its behavior.
- "Disabled" meant the nav button state while nothing is drawable, not a new config value.
- A panel open on a source that becomes unavailable closes or shows the existing error banner. That
  detail is left to the implementation.

## Revisions
