import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

// Bundle name is pinned to card.js (not the package name) — HACS's resource URL would break
// for existing installs otherwise. hacs.json "filename" points HACS at this exact file.
const version = process.env.VERSION ?? "0.0.0-dev";

export default {
  input: "src/index.ts",
  output: {
    file: "dist/card.js",
    format: "es",
    banner: `/* card v${version} */`,
    intro: `const __CARD_VERSION__ = '${version}';`,
  },
  plugins: [
    nodeResolve(),
    typescript(),
    ...(process.env.NODE_ENV === "production" ? [terser()] : []),
  ],
};
