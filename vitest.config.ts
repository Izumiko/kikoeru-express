import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['backend/test/**/*.ts'],
    exclude: [
      'backend/test/setup.ts',
      'backend/test/types.d.ts',
      'backend/test/helpers/**',
      'backend/test/teardown/**',
      '**/node_modules/**',
    ],
    setupFiles: ['./backend/test/setup.ts'],
  },
});
