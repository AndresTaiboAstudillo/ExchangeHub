import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    // El límite de intentos se prueba aparte, activándolo en la propia prueba.
    env: { RATE_LIMIT_DISABLED: 'true' },
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
