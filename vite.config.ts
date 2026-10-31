import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2022', sourcemap: true },
  server: { port: 5173 },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'] },
} as any);
