import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.ts'],
    exclude: ['test/setup.ts', 'test/types.d.ts', 'test/helpers/**', 'test/teardown/**', '**/node_modules/**'],
    setupFiles: ['./test/setup.ts'],
  },
});
