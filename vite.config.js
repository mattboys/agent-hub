const { defineConfig } = require('vite');
const { resolve } = require('path');

module.exports = defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        clipboard: resolve(__dirname, 'apps/clipboard-alchemist/index.html'),
        palette: resolve(__dirname, 'apps/vibe-palette/index.html'),
        paletteMaker: resolve(__dirname, 'apps/palette-maker/index.html'),
        qr: resolve(__dirname, 'apps/qr-code-generator/index.html'),
        browserDiagnostic: resolve(__dirname, 'apps/browser-diagnostic/index.html')
      }
    }
  },
  server: {
    open: '/'
  }
});
