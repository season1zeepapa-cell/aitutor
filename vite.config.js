import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// PWA — vite-plugin-pwa 제거 (REBUILD16, 2026-04-25).
// Service Worker 미사용 정책상 플러그인이 manifest 생성기 역할만 하고 있었으므로,
// public/manifest.webmanifest 정적 파일 + index.html <link rel="manifest"> 방식으로 단순화.
// Chrome 87+/iOS Safari 의 PWA 설치(홈 화면 추가)는 동일하게 유지된다.

export default defineConfig({
  plugins: [
    react(),
  ],
  root: path.resolve(__dirname, 'src'),
  publicDir: path.resolve(__dirname, 'public'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
});
