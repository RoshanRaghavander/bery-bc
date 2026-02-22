import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/v1': { target: 'http://localhost:8080' },
      '/wallet': { target: 'http://localhost:8080' },
      '/balance': { target: 'http://localhost:8080' },
      '/status': { target: 'http://localhost:8080' },
      '/health': { target: 'http://localhost:8080' },
      '/rpc': { target: 'http://localhost:8080' },
      '/tx': { target: 'http://localhost:8080' },
      '/faucet': { target: 'http://localhost:8080' },
      '/mempool': { target: 'http://localhost:8080' },
      '/block': { target: 'http://localhost:8080' },
    },
  },
});
