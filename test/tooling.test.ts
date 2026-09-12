import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FILES = [
  "package.json",
  "biome.json",
  "tsconfig.json",
  "rollup.config.mjs",
  "vitest.config.mjs",
  "src/index.ts",
  ".github/workflows/card-build-and-test.yml",
  ".github/workflows/hacs-validation.yml",
  ".github/workflows/card-publish-release.yml",
];

describe("no ha-card-shared dependency", () => {
  it.each(FILES)("%s does not reference ha-card-shared", (relativePath) => {
    const contents = readFileSync(`${process.cwd()}/${relativePath}`, "utf-8");
    expect(contents).not.toContain("ha-card-shared");
  });
});
