import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Testes da lógica pura do app (sem React Native): src/**/*.test.ts.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
