import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: true },
  server: { port: 5173 },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts', 'admin/src/**/*.test.ts', 'workers/**/*.test.ts', 'supabase/functions/**/*.test.ts'] },
} as any);
