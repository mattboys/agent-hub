const { defineConfig } = require('vite');
const { resolve } = require('path');

const prNumber = process.env.PR_NUMBER;

// Base URL configuration:
// - Local dev: './'
// - Main site (main branch): '/agent-hub/'
// - PR preview: '/agent-hub/pr-preview/pr-<number>/'
const base = prNumber
  ? `/agent-hub/pr-preview/pr-${prNumber}/`
  : '/agent-hub/';

if (process.env.GITHUB_ACTIONS) {
  console.log('PR preview build detected.');
  console.log('PR_NUMBER:', prNumber ?? '(not set)');
  console.log('Building with base:', base);
}

module.exports = defineConfig({
  base: process.env.GITHUB_ACTIONS ? base : './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        clipboard: resolve(__dirname, 'apps/clipboard-alchemist/index.html'),
        palette: resolve(__dirname, 'apps/vibe-palette/index.html'),
        paletteMaker: resolve(__dirname, 'apps/palette-maker/index.html'),
        aprilTagScout: resolve(__dirname, 'apps/apriltag-scout/index.html'),
        cameraFilterLab: resolve(__dirname, 'apps/camera-filter-lab/index.html'),
        qr: resolve(__dirname, 'apps/qr-code-generator/index.html'),
        cleanUrlTrackerRemover: resolve(__dirname, 'apps/clean-url-tracker-remover/index.html'),
        browserDiagnostic: resolve(__dirname, 'apps/browser-diagnostic/index.html'),
        romanNumeralTranslator: resolve(__dirname, 'apps/roman-numeral-translator/index.html'),
        reverseEngineeringLab: resolve(__dirname, 'apps/reverse-engineering-lab/index.html'),
        quickDiff: resolve(__dirname, 'apps/quick-diff/index.html'),
        nestingAlgorithmVisualizer: resolve(__dirname, 'apps/nesting-algorithm-visualizer/index.html'),
        dimensionScanLab: resolve(__dirname, 'apps/scan-vector-lab/index.html'),
        sokobanVault: resolve(__dirname, 'apps/sokoban-vault/index.html'),
        scoreTakingApp: resolve(__dirname, 'apps/score-taking-app/index.html')
      }
    }
  },
  server: {
    open: '/'
  }
});
