import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Painel do gestor. A API local roda em http://localhost:3000 (apps/api);
// para outro endereço, defina VITE_API_URL no arquivo .env.local.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 5173 },
});
