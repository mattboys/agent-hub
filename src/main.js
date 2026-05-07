import './styles/main.css';
import { apps } from './data/apps.js';

const root = document.getElementById('app-root');

function createHero() {
  const hero = document.createElement('header');
  hero.className = 'hero';
  hero.innerHTML = `
    <span class="hero-eyebrow">Matt Presents</span>
    <h1>Vibe-Coded App Hub</h1>
    <p>Micro web experiments with big feelings. Click any card to open a focused tool in a new page.</p>
  `;
  return hero;
}

function createAppCard(app) {
  const card = document.createElement('a');
  card.className = 'app-card';
  card.href = app.href;
  card.dataset.slug = app.slug;
  card.setAttribute('style', `--accent:${app.accent};`);
  card.setAttribute('aria-label', `${app.title}. ${app.blurb}`);
  card.innerHTML = `
    <span class="app-icon" aria-hidden="true">${app.icon}</span>
    <span class="app-title">${app.title}</span>
    <span class="app-blurb">${app.blurb}</span>
    <span class="app-link" aria-hidden="true"></span>
  `;
  return card;
}

function createAppGrid() {
  const section = document.createElement('section');
  section.className = 'app-grid';
  section.setAttribute('aria-label', 'Available vibe-coded applications');
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
        This hub is a living collection of pocket-sized webapps built by Matt and delivered via GitHub Pages.
        Each tool runs entirely in your browser—no accounts, no tracking, just playful utility.
      </p>
      <p>
        Built with AI assistance and deployed automatically. When ideas are submitted, AI agents write the code, and updates go live within minutes.
      </p>
      <p class="about-meta">New experiments launch regularly—check back often or submit your own idea!</p>
    </div>
  `;
  return section;
}

function createTimeline() {
  const section = document.createElement('section');
  section.className = 'timeline';
  section.innerHTML = `
      <div class="timeline-card">
        <h2>From Idea to Live App</h2>
        <ol class="timeline-steps">
          <li>
            <span class="timeline-duration">30s</span>
            <span class="timeline-description">
              User submits an idea via <a href="https://cursor.com/agents" target="_blank" rel="noopener noreferrer">Cursor Agents</a>
              or <a href="https://github.com/mattboys/agent-hub/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>.
            </span>
          </li>
          <li>
            <span class="timeline-duration">60s</span>
            <span class="timeline-description">AI agents implement the request and open a pull request with the code changes.</span>
          </li>
          <li>
            <span class="timeline-duration">5s</span>
            <span class="timeline-description">The site admin reviews and approves the update.</span>
          </li>
          <li>
            <span class="timeline-duration">40s</span>
            <span class="timeline-description">GitHub Actions spins up a fresh VM to rebuild the site.</span>
          </li>
        </ol>
        <p class="timeline-total">
          <span class="timeline-total-label">Total:</span>
          2min 15s — changes go live on <a href="https://mattboys.github.io/agent-hub/" target="_blank" rel="noopener noreferrer">GitHub Pages</a>.
        </p>
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
  page.appendChild(createTimeline());
  page.appendChild(createAbout());

  root.innerHTML = '';
  root.appendChild(page);
}

init();
