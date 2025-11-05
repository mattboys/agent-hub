const { defineConfig } = require('vite');
const { resolve } = require('path');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = defineConfig({
  base: isProduction ? '/agent-hub/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        clipboard: resolve(__dirname, 'apps/clipboard-alchemist/index.html'),
        palette: resolve(__dirname, 'apps/vibe-palette/index.html')
      }
    }
  },
  server: {
    open: '/'
  }
});
