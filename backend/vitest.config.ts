import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    // Unitários (sem banco). A suíte de integração roda em vitest.integration.config.ts.
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
