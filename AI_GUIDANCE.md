# AI Guidance for Agent Hub Updates

## Avoiding 404s for new apps
When you add a new app, GitHub Pages only publishes HTML files that are listed in `vite.config.js` under `build.rollupOptions.input`. If you forget this step, the app will build locally but the deployed `/apps/<slug>/index.html` will 404.

Checklist for every new app:
1. Create `apps/<slug>/index.html` and point the script tag to `/src/apps/<slug>/main.js`.
2. Create `src/apps/<slug>/main.js` and `src/apps/<slug>/styles.css`.
3. Register the app in `src/data/apps.js` so it appears on the hub.
4. Add the HTML entry to `vite.config.js` (`build.rollupOptions.input`).
5. Run `npm run build` and confirm `dist/apps/<slug>/index.html` exists.

If an app 404s after deploy, check step 4 first.
