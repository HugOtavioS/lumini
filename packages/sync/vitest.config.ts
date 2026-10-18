import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // O node:sqlite (banco dos testes) avisa que é experimental a cada processo; o aviso só polui a saída.
    execArgv: ['--disable-warning=ExperimentalWarning'],
    passWithNoTests: true,
  },
});
