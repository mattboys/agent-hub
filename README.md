# Matt's Vibe-Coded App Shelf

A lightweight, all-static showcase for Matt's growing collection of vibe-coded web experiments. Each app is its own page, built with Vite and vanilla JavaScript so everything runs directly in the browser—perfect for GitHub Pages hosting.

## ✨ What's here
- `index.html` renders the landing grid with big tappable cards for every app.
- `apps/` holds each standalone webapp entry point.
- `src/` contains shared styling, the landing page logic, and per-app modules.
- GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys to Pages on push to `main` (plus manual triggers via the Actions tab).

## 🧑‍💻 Local development
1. Install Node.js 18+ (Node 20 is used in CI).
2. Install dependencies once:
   ```bash
   npm install
   ```
3. Start the Vite dev server with hot module reloading:
   ```bash
   npm run dev
   ```
   Vite will print a local URL (usually `http://localhost:5173`). Open it to explore the hub and each app.

## 🚀 Build & deploy
- Production build:
  ```bash
  npm run build
  ```
  Outputs static assets to `dist/`.
- Preview the production bundle locally:
  ```bash
  npm run preview
  ```

### GitHub Pages automation
1. Push to `main` (or use *Run workflow* in Actions) to trigger `.github/workflows/deploy.yml`.
2. The workflow installs dependencies, runs `npm run build`, and publishes the `dist/` folder to the `github-pages` environment.
3. In repository settings → Pages, pick *GitHub Actions* as the source the first time.

> If your repo uses a different default branch, update the `branches:` list in `deploy.yml` accordingly.

## ➕ Adding another app
1. Create a new folder under `apps/<slug>/index.html` with a `<script type="module" src="/src/apps/<slug>/main.js"></script>` tag.
2. Add the module and styles under `src/apps/<slug>/` (import `../shared/appShell.js` for the consistent frame).
3. Register the new app in `src/data/apps.js` so it appears on the landing grid.
4. Update `vite.config.js` to include the new HTML entry in `rollupOptions.input`.
5. Run `npm run dev` to verify and commit the changes.

## 🧰 Working with Cursor AI Agents
- Keep the dev server running (`npm run dev`) for instant local previews while editing with Cursor.
- Use `npm run build` before pushing significant updates to catch bundle-time issues.
- The project sticks to vanilla JS + CSS, so no extra build steps are needed for agents to modify or extend features.