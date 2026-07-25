import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globals: false,
  },
  esbuild: {
    // Enable legacy decorator parsing for NestJS-decorated classes.
    target: 'es2022',
  },
});
