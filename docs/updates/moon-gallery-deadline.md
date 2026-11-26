# moon-gallery-deadline

# Task: the moon gallery has a date deadline, check if we fall into it already

## Summary

The Moon tiles (MY MOON and MOON) only know NASA's 2026 images, so they would break on 2027-01-01
UTC. We add the 2027 product ID, 5691, to the table and pin it with a test. NASA published product
5691 ("Moon Phase and Libration, 2027", north-up) on 2026-11-20.

## Changes

1. `src/card/gallery/source-resolver-svs-moon.ts`: add `2027: 5691` to `MOON_PRODUCT_IDS`.
2. `test/card/gallery/source-resolver-svs-moon.test.ts`: add a 2027 URL case next to the 2026 one
   (lines 60-68).
3. `README.md:223`: the `[svs]` link points at the 2026 page (5587); left as is.

## Checklist

- [x] A date in 2027 builds the 5691 URL under `a005600/a005691`, with the right frame number, for
      the thumbnail and the full size.
- [x] The first hour of 2027 maps to frame 0001, and the last hour (2027-12-31T23:00Z) maps to
      frame 8760.
- [x] The year-with-no-product test still throws (it uses 2019, so nothing needs to move).
- [ ] `npm run check:ci`, `npm run build` and `npm run test:coverage` pass.

## Seam and behavior to pin

`moonFrameUrl` in `source-resolver-svs-moon.ts`: given a 2027 time, it returns the 5691 address.

## Impact

Moon tiles keep working past 2027-01-01 UTC. Nothing else changes. HACS users only get this after a
release, which is not part of this task.

## Decisions

- Use 5691 (north-up), not 5692 (south-up, would render upside down).
- Code-only fix: no fallback when a year is unmapped, no yearly CI check.

## Assumptions

- The 5691 images follow the same address pattern as earlier years. NASA's page shows it, but no
  image was fetched (the NASA server returns 403 to requests from the dev machine).

## Revisions
