import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig(({ mode }) => {
  const rootDir = fileURLToPath(new URL('..', import.meta.url));
  const env = loadEnv(mode, rootDir, '');

  const port = env.PORT?.trim();
  if (!port) {
    throw new Error('PORT belum diisi di .env (root proyek).');
  }
  const target = `http://localhost:${port}`;

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/socket.io': { target, ws: true },
        '/api': target,
        '/media': target,
      },
    },
  };
});