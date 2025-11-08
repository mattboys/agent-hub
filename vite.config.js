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
        browserDiagnostic: resolve(__dirname, 'apps/browser-diagnostic/index.html'),
        romanNumeralTranslator: resolve(__dirname, 'apps/roman-numeral-translator/index.html'),
        reverseEngineeringLab: resolve(__dirname, 'apps/reverse-engineering-lab/index.html'),
        quickDiff: resolve(__dirname, 'apps/quick-diff/index.html')
      }
    }
  },
  server: {
    open: '/'
  }
});
