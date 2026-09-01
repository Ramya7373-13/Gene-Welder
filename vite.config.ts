import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig(() => {
  return {
      server: {
        port: 3001,
        host: '0.0.0.0',
      },
      plugins: [react(), svgr()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        environment: 'jsdom',
        setupFiles: './vitest.setup.ts',
        include: ['services/**/*.test.ts', 'components/**/*.test.ts', 'components/**/*.test.tsx'],
      }
    };
});
