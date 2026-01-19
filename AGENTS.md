# AI Agent Conventions

This repo ships a Vite multi-page build to GitHub Pages. Only HTML entry
points listed in `vite.config.js` are published. Missing entries cause 404s.

## Adding or renaming an app
- Create `apps/<slug>/index.html` with a module script to
  `/src/apps/<slug>/main.js`.
- Add `src/apps/<slug>/main.js` and `src/apps/<slug>/styles.css`, importing
  `../shared/appShell.js` as needed.
- Register the app in `src/data/apps.js` so it appears on the landing grid.
- Add the HTML entry to `vite.config.js` under `build.rollupOptions.input`.
  Convention: use a camelCase key derived from the slug.
- Run `npm run dev` for quick validation or `npm run build` before release.

## Fixing a GitHub Pages 404
- Confirm the app's `apps/<slug>/index.html` path is present in
  `vite.config.js`.
- Ensure production uses the `/agent-hub/` base path for URLs.
