import './styles/main.css';
import { apps } from './data/apps.js';

const root = document.getElementById('app-root');

function createHero() {
  const hero = document.createElement('header');
  hero.className = 'hero';
  hero.innerHTML = `
    <span class="hero-eyebrow">Matt Presents</span>
    <h1>Vibe-Coded App Shelf</h1>
    <p>Micro web experiments with big feelings. Tap an icon to open a focused tool in a new page.</p>
  `;
  return hero;
}

function createAppCard(app) {
  const card = document.createElement('a');
  card.className = 'app-card';
  card.href = app.href;
  card.dataset.slug = app.slug;
  card.setAttribute('style', `--accent:${app.accent};`);
  card.innerHTML = `
    <span class="app-icon" aria-hidden="true">${app.icon}</span>
    <span class="app-title">${app.title}</span>
    <span class="app-blurb">${app.blurb}</span>
    <span class="app-link">Launch ↗</span>
  `;
  return card;
}

function createAppGrid() {
  const section = document.createElement('section');
  section.className = 'app-grid';
  section.setAttribute('aria-label', 'App selection');
  apps.forEach((app) => {
    section.appendChild(createAppCard(app));
  });
  return section;
}

function createAbout() {
  const section = document.createElement('section');
  section.className = 'about';
  section.innerHTML = `
    <div class="about-card">
      <h2>What is this place?</h2>
      <p>
        This shelf is a living collection of pocket-sized webapps built by Matt and delivered via GitHub Pages.
        Each tool runs entirely in your browser—no accounts, no tracking, just playful utility.
      </p>
      <p>
        Updates ship through an automated Vite build. That means tweaks land fast: edit with Cursor AI Agents, run a build, push to GitHub, and Pages handles the rest.
      </p>
      <p class="about-meta">Stay tuned as new vibe-coded experiments appear here over time.</p>
    </div>
  `;
  return section;
}

function init() {
  if (!root) {
    return;
  }

  const page = document.createElement('div');
  page.className = 'page-shell';

  page.appendChild(createHero());
  page.appendChild(createAppGrid());
  page.appendChild(createAbout());

  root.innerHTML = '';
  root.appendChild(page);
}

init();
