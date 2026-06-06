import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/index.js",
  output: {
    file: "dist/card.js",
    format: "es",
  },
  plugins: [resolve(), ...(process.env.NODE_ENV === "production" ? [terser()] : [])],
};
