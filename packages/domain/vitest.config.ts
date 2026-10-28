import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    // O CI roda `npm test` em qualquer commit; sem testes ainda, não deve falhar.
    passWithNoTests: true,
  },
});
