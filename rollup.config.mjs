import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/index.js",
  output: {
    file: "dist/ha-solar-view-card.js",
    format: "es",
  },
  plugins: [resolve(), ...(process.env.NODE_ENV === "production" ? [terser()] : [])],
};
