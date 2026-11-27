# Learnings

- Run mutation testing with the repo's `stryker.config.json` (Vitest runner), and outside the Claude
  sandbox. Stryker fails copying the sandbox's masked dotfiles into its temp dir, so a sandboxed run
  errors before testing anything (#311). Delete the `.stryker-tmp/sandbox-*` copy a failed run
  leaves behind, because it is a full repo copy that makes vitest run every test twice (#312).
- Do not rely on a fake-resolver test that stubs `failureCount` or `isPermanentlyUnavailable` with a
  constant to prove gallery availability wiring; drive the real `SourceResolver`. A constant stub
  passes while the real path is wrong, which hid a sun-thumbnail bug in review (#312).
- Remember `mymoon` and `moon` share one failure count (one cache key) but each `SourceResolver`
  instance keeps its own permanent-unavailability flag. Availability logic that assumes either
  all-shared or all-separate will be wrong for these two (#312).
- In the sandbox `.git/config` is protected, so `git push -u` pushes but cannot record upstream
  tracking; set it outside the sandbox if needed (#312).
- Treat a source's `disc` in `src/card/gallery/sources.ts` as a sampled ceiling to re-measure, not a
  constant. DSCOVR's Earth disc measured 83.7% against a 0.82 ceiling, so the circle clip cut the
  limb until `disc` was widened to 0.84 (#313).
- Stub Earth's fetch (`stubEarthFetch()`) in any test that mounts the card with Earth enabled. A
  source hides after its first failure with no image, so an unstubbed fetch now removes the tile and
  breaks thumbnail assertions (#313).
