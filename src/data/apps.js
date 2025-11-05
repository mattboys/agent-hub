const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const withBase = (path) => `${base}${path}`;

export const apps = [
  {
    slug: 'vibe-palette',
    title: 'Aura Gradient Mixer',
    blurb: 'Blend colors into dreamy gradients and copy CSS-ready code in a snap.',
    icon: '🌈',
    href: withBase('/apps/vibe-palette/index.html'),
    accent: '#ff7ee7'
  },
  {
    slug: 'clipboard-alchemist',
    title: 'Clipboard Alchemist',
    blurb: 'Transform whatever is on your clipboard—format JSON, minify, encode, or replace text.',
    icon: '🧪',
    href: withBase('/apps/clipboard-alchemist/index.html'),
    accent: '#5ae4a7'
  }
];
