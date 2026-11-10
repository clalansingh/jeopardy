import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base path ensures assets work on GitHub Pages under any repo name (e.g. /jeopardy/)
  base: './',
  plugins: [
    react(),
    {
      name: 'copy-board-yaml',
      writeBundle(options) {
        const outDir = options.dir || path.resolve(process.cwd(), 'dist');
        const srcYaml = path.resolve(process.cwd(), 'board.yaml');
        const destYaml = path.resolve(outDir, 'board.yaml');
        if (fs.existsSync(srcYaml)) {
          fs.copyFileSync(srcYaml, destYaml);
        }
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
