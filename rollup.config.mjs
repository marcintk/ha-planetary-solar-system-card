import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

const version = process.env.VERSION ?? "0.0.0-dev";

export default {
  input: "src/index.js",
  output: {
    file: "dist/card.js",
    format: "es",
    banner: `/* ha-planetary-solar-system-card v${version} */`,
    intro: `const __CARD_VERSION__ = '${version}';`,
  },
  plugins: [
    nodeResolve(),
    ...(process.env.NODE_ENV === "production" ? [terser()] : []),
  ],
};
