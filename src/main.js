import './styles/main.css';
import { apps } from './data/apps.js';

const root = document.getElementById('app-root');

function createHero() {
  const hero = document.createElement('header');
  hero.className = 'hero';
  hero.innerHTML = `
    <span class="hero-eyebrow">Matt Presents</span>
    <h1>Vibe-Coded App Hub</h1>
    <p>Small, focused web tools I ship as static pages—open a card to try one; each runs entirely in your browser.</p>
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
        This is my living gallery of pocket-sized web apps on GitHub Pages—no accounts, no tracking, just the tool in front of you.
      </p>
      <p>
        I use AI-assisted workflows to turn ideas into code quickly; everything here is open and deployed automatically.
      </p>
      <p class="about-meta">New experiments appear often—drop by again or suggest something you’d like built.</p>

      <h3 class="about-subheading">From idea to live app</h3>
      <ol class="timeline-steps">
        <li>
          <span class="timeline-duration">Step 1</span>
          <span class="timeline-description">
            You send an idea through <a href="https://cursor.com/agents" target="_blank" rel="noopener noreferrer">Cursor Agents</a>
            or a <a href="https://github.com/mattboys/agent-hub/issues" target="_blank" rel="noopener noreferrer">GitHub issue</a>.
          </span>
        </li>
        <li>
          <span class="timeline-duration">Step 2</span>
          <span class="timeline-description">
            Cloud agents run the work and open a pull request. GitHub Actions builds a preview of the site and shares a link so you can verify the change; when it looks right, I merge into <strong>main</strong>.
          </span>
        </li>
        <li>
          <span class="timeline-duration">Step 3</span>
          <span class="timeline-description">
            The production site updates on <a href="https://mattboys.github.io/agent-hub/" target="_blank" rel="noopener noreferrer">GitHub Pages</a>—usually within minutes of merge.
          </span>
        </li>
      </ol>
      <p class="timeline-total">
        <span class="timeline-total-label">Typical turnaround:</span>
        minutes from idea to preview; merge when ready.
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
  page.appendChild(createAbout());

  root.innerHTML = '';
  root.appendChild(page);
}

init();
