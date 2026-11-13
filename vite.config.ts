import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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

        const srcBoardsDir = path.resolve(process.cwd(), 'boards');
        const destBoardsDir = path.resolve(outDir, 'boards');
        if (fs.existsSync(srcBoardsDir)) {
          fs.mkdirSync(destBoardsDir, { recursive: true });
          for (const file of fs.readdirSync(srcBoardsDir)) {
            if (file.endsWith('.yaml') || file.endsWith('.yml')) {
              fs.copyFileSync(
                path.join(srcBoardsDir, file),
                path.join(destBoardsDir, file)
              );
            }
          }
        }
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
