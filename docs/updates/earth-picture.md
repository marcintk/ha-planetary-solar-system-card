# earth-picture

# Earth gallery thumbnail: lower the size ceiling

Task: "gallery, earth, while earth move to winter zone, it is shown bigger, can we scale better?"

## Summary

The gallery's Earth thumbnail is a live DSCOVR photo, and its disc size changes with the satellite's
distance from Earth. The card scales every photo by one fixed constant, so on the widest days Earth
fills 0.87 of the tile. We lower that ceiling to 0.83. Earth can then only be at or below 0.83, and
the narrowest sampled day lands at about 0.75.

## Changes

- `src/card/gallery/sources.ts:180`: Earth `target` goes from 0.87 to 0.83.
- `src/card/gallery/sources.ts:109`: update the "Earth's is 0.87" number in the comment. Leave the
  Moon and Sun wording as it is.
- `test/card/gallery/sources.test.ts:53`: change the expected value from 0.87 to 0.83.

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

## Seam and behavior to pin

The seam is `SOURCES.earth.target` in `test/card/gallery/sources.test.ts`. The behavior pinned is
that Earth's ceiling is 0.83.

## Impact

- Earth's thumbnail shrinks by about 5% at its widest and about 5% at its narrowest.
- Moon and Sun, the shapes, and the full-screen view are unchanged.
- `docs/card.js` is a built copy for the demo page. Not checked whether it should be rebuilt as part
  of this change.
- Earth is not clipped at the limb, because the disc and scale pair is unchanged.

## Decisions

- Keep the per-image logic as it is and only lower the ceiling.
- No per-image scaling and no seasonal scaling.

## Assumptions

- The change is for the gallery thumbnail, not the main orbit view.
- The four sampled dates represent the real range of disc sizes. Real images were not measured.
- 0.83 is a judgment call chosen to try. It can be adjusted later.

## Revisions

- Human changed Earth's target from 0.83 to 0.80 after seeing the 0.83 result; the earlier "0.83 is
  a judgment call" was a try-it value.
- Human asked for Earth, Moon and MyMoon targets all at 0.75 (Earth 0.80 -> 0.75, Moon and MyMoon
  0.79 -> 0.75); the Sun stays at 0.80. This widens scope from Earth only to the Moon sources, at
  the human's explicit request.
