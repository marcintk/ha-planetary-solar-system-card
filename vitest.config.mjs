import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
    },
  },
});
