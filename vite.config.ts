import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(async ({ mode }) => {
  // HTTPS dev server (npm run dev:https): browsers only allow microphone access on https:// or
  // http://localhost, so use this when opening the app from a phone / another PC on the LAN.
  const httpsPlugins = mode === 'https'
    ? [(await import('@vitejs/plugin-basic-ssl')).default()]
    : [];
  return {
    plugins: [react(), tailwindcss(), ...httpsPlugins],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
