import { defineConfig } from 'vite';

/** Trang quản trị build riêng (không nằm trong gói của người chơi), triển khai ở origin riêng. */
export default defineConfig({
  root: 'admin',
  base: './',
  envDir: '..',
  build: { target: 'es2022', sourcemap: false, outDir: '../dist-admin', emptyOutDir: true },
  server: { port: 5174 },
});
