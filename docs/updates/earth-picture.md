# earth-picture

# Earth gallery thumbnail: lower the size ceiling

Task: "gallery, earth, while earth move to winter zone, it is shown bigger, can we scale better?"

## Summary

The gallery's Earth thumbnail is a live DSCOVR photo whose disc size changes with the satellite's
distance, and the card scales every photo by one fixed constant. This branch shrinks the Earth, Moon
and MyMoon thumbnails (`target` 0.75; the Sun stays 0.80) and widens Earth's `disc` to 0.84 so the
circular clip stops cutting its limb. It also makes a source that cannot load disappear after its
first failure, and retry within 5 minutes while it has no image, instead of sitting on "loading…".
That rule moves out of `GalleryController` into a new `SourceAvailability` class.

## Changes

- `src/card/gallery/sources.ts`: `target` 0.75 for Earth, Moon and MyMoon; Earth `disc` 0.84; doc
  comments updated.
- `src/card/gallery/backoff.ts`: while a key has no confirmed image, the retry wait is capped at 5
  minutes; with an image it still doubles up to 6 hours.
- `src/card/gallery/source-availability.ts` (new): `SourceAvailability` decides which sources are
  unavailable (no image and at least one failure, or a permanent failure) and when the strip
  recovers.
- `src/card/gallery/gallery-controller.ts`: delegates to `SourceAvailability`.
- Tests for each of the above, and `card.gallery.test.ts` now stubs Earth's fetch where it relied on
  the old five-failure rule.

## Checklist

- [x] Earth's `target` is 0.83 in `SOURCES.earth`. The test fails first, then the one-line change
      makes it pass.
- [x] The comment at `sources.ts:109` names 0.83.
- [x] `npm run check:ci` and `npm run test:coverage` pass.
- [x] Revision: Earth's `target` is 0.80 in `SOURCES.earth` (the comment at `sources.ts:109` and
      `EXPECTED_TARGET.earth` in `test/card/card-template.test.ts` follow, 40).
- [x] Revision: `target` is 0.75 for `SOURCES.earth`, `SOURCES.moon` and `SOURCES.mymoon`; the Sun
      stays 0.80 (comments in `sources.ts` and `EXPECTED_TARGET` in
      `test/card/card-template.test.ts` follow).
- [x] Revision: Earth's `disc` is 0.84 in `SOURCES.earth`, so the clip no longer cuts the limb (the
      `disc` comment in `sources.ts` names the new measurement).
- [x] Revision: a source with no image is unavailable after its first failure
      (`UNAVAILABLE_AFTER_FAILURES` is 1 in `gallery-controller.ts`); a source with an image is
      never unavailable.
- [x] Revision: while a source has no confirmed image, `Backoff` caps the retry wait at 5 minutes;
      with a confirmed image the wait still doubles up to 6 hours.
- [x] Revision: a new `SourceAvailability` class (`src/card/gallery/source-availability.ts`) answers
      `isUnavailable(source)` (no image and a permanent failure or at least one failure; an image
      always wins) and `nothingDrawable(sources)`; the threshold constant moves into it.
- [x] Revision: `SourceAvailability` reports once when nothing-drawable ends
      (`recoveredFromNothingDrawable(sources)`) and resets with `reset(sources)`.
- [x] Revision: `GalleryController` delegates to `SourceAvailability` and its own unavailability
      code is gone; behavior unchanged, every existing test still passes.

## Seam and behavior to pin

`SOURCES.<source>.target` and `SOURCES.earth.disc` in `test/card/gallery/sources.test.ts`;
`Backoff.recordFailure` in `backoff.test.ts`; `SourceAvailability` in `source-availability.test.ts`.

## Impact

- Earth's thumbnail tops out at 0.75 of the tile instead of 0.87 and is no longer clipped at the
  limb on today's photo; the Moon tiles drop from 0.79 to 0.75.
- A tile that cannot load is hidden after one failure and retried at most every 5 minutes; a source
  that already has an image keeps the slow backoff.
- `docs/card.js` is a built copy for the demo page. Not checked whether it should be rebuilt.
- `disc` 0.84 is a guess from one new measurement; a wider day could cut the limb again.
- Not reproduced in a browser; a curl probe of the Moon frame got 403 from NASA.

## Decisions

- Keep the per-image logic as it is and only lower the ceilings.
- No per-image scaling and no seasonal scaling.

## Assumptions

- The change is for the gallery thumbnail, not the main orbit view.
- The four sampled dates represent the real range of disc sizes. Real images were not measured.
- The targets and Earth's disc are judgment calls and can be adjusted later.

## Revisions

- Human changed Earth's target from 0.83 to 0.80 after seeing the 0.83 result; the earlier "0.83 is
  a judgment call" was a try-it value.
- Human asked for Earth, Moon and MyMoon targets all at 0.75 (Earth 0.80 -> 0.75, Moon and MyMoon
  0.79 -> 0.75); the Sun stays at 0.80. This widens scope from Earth only to the Moon sources, at
  the human's explicit request.
- Human found Earth's thumbnail cut on all four sides; today's EPIC photo (2026-11-24 22:13 UTC)
  measures 83.6-83.7% of the frame against disc 0.82. Human asked to raise Earth's disc to 0.84.
  0.84 is a guess at the ceiling from one new sample.
- Human reported the Moon tile randomly stuck on "loading…" while NASA is failing. Cause from the
  code: a source with no image only hides after 5 failures (about 15 min of growing cooldowns) and
  retries back off up to 6 h. Human asked to fix it on this branch: hide after the first failure
  when there is no image, and cap the retry wait at 5 minutes while there is no image. Not
  reproduced in a browser; a curl probe got 403 from NASA.
- Human asked to move the "image is not available" logic out of GalleryController into its own class
  on this branch, instead of after the PR. Behavior-preserving refactor: threshold, backoff and
  strip behavior stay as they are.
