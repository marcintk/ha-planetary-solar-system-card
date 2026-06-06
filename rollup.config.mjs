import { readFileSync } from "fs";
import { resolve } from "path";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const versionModulePath = resolve("./src/card/version.js");

const cardVersion = {
  name: "card-version",
  load(id) {
    if (id === versionModulePath) {
      return `export const CARD_VERSION = ${JSON.stringify(pkg.version)};`;
    }
  },
};

export default {
  input: "src/index.js",
  output: {
    file: "dist/card.js",
    format: "es",
  },
  plugins: [
    cardVersion,
    nodeResolve(),
    ...(process.env.NODE_ENV === "production" ? [terser()] : []),
  ],
};
