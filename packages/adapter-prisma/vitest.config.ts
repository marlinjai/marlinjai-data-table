import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Schema reset is intentionally isolated and may include cold CLI startup.
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 60_000,
    testTimeout: 15_000,
  },
});
