import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globals: false,
    // bcrypt work can exceed Vitest's 5s default under normal workstation load.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  esbuild: {
    // Enable legacy decorator parsing for NestJS-decorated classes.
    target: 'es2022',
  },
});
