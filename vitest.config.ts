import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/__tests__/**/*.test.ts", "eval/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Network-touching adapter.status()/test() probes run 7 adapters sequentially;
    // the 5s default flakes on slow CI runners. 30s ceiling makes CI deterministic.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
