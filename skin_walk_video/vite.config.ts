import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@frontend': fileURLToPath(new URL('../../entropydrop_frontend/src', import.meta.url)) },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },
  server: {
    host: '127.0.0.1',
    fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] },
  },
});
