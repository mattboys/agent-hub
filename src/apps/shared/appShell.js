import '../../styles/app-base.css';

export function createAppShell({ title, description, accent, status }) {
  const mount = document.getElementById('app');
  if (!mount) {
    throw new Error('Missing #app mount element');
  }

  document.title = `${title} • Matt's Vibe Apps`;

  if (accent) {
    document.documentElement.style.setProperty('--accent', accent);
  }

  mount.innerHTML = '';
  mount.className = 'app-shell';

  const header = document.createElement('header');
  header.className = 'app-header';

  const backLink = document.createElement('a');
  backLink.href = '../../';
  backLink.className = 'back-link';
  backLink.setAttribute('aria-label', 'Back to the hub');
  backLink.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 6l-6 6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter"/>
    </svg>
    <span class="visually-hidden">Back to the hub</span>
  `;
  header.appendChild(backLink);

  const h1 = document.createElement('h1');
  h1.textContent = title;
  header.appendChild(h1);

  if (description) {
    const descriptionEl = document.createElement('p');
    descriptionEl.textContent = description;
    header.appendChild(descriptionEl);
  }

  mount.appendChild(header);

  const body = document.createElement('section');
  body.className = 'app-body';

  if (status) {
    const pill = document.createElement('span');
    pill.className = 'status-pill';
    pill.textContent = status;
    body.appendChild(pill);
  }

  mount.appendChild(body);

  return { body, mount, header };
}
