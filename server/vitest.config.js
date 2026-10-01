import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    setupFiles: ["tests/setup.js"],
    // Each test file gets its own process, and so its own in-memory DB
    pool: "forks",
  },
});
