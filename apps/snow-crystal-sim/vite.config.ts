import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/physics-simulators/' : '/',
  server: {
    port: 5174,
  },
  test: {
    include: [
      'tests/**/*.test.ts',
      'src/simulators/snow-crystal-sim/domain/__tests__/**/*.test.ts',
    ],
    environment: 'node',
    passWithNoTests: true,
  },
}));
