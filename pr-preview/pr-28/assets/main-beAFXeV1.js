import"./modulepreload-polyfill-B5Qt9EMX.js";const n=[{slug:"clean-url-tracker-remover",title:"Clean URL Trimmer",blurb:"Paste a sharing link and drop all the ad trackers, redirect junk, and campaign tags in one click.",icon:"🧼",href:"apps/clean-url-tracker-remover/index.html",accent:"#48cae4"},{slug:"quick-diff",title:"Quick Diff",blurb:"Line up two snippets and spot the precise character changes with inline highlights for insertions and deletions.",icon:"📝",href:"apps/quick-diff/index.html",accent:"#3a86ff"},{slug:"reverse-engineering-lab",title:"Protocol Decoder Lab",blurb:"Paste unknown data blobs to detect encodings, decode bytes, and identify common protocols automatically.",icon:"🕵️",href:"apps/reverse-engineering-lab/index.html",accent:"#9d4edd"},{slug:"roman-numeral-translator",title:"Roman Numeral Translator",blurb:"Convert roman numerals to numbers (and back) with instant validation and history.",icon:"🏛️",href:"apps/roman-numeral-translator/index.html",accent:"#f08c4a"},{slug:"vibe-palette",title:"Aura Gradient Mixer",blurb:"Blend colors into dreamy gradients and copy CSS-ready code in a snap.",icon:"🌈",href:"apps/vibe-palette/index.html",accent:"#ff7ee7"},{slug:"clipboard-alchemist",title:"Clipboard Alchemist",blurb:"Transform whatever is on your clipboard—format JSON, minify, encode, or replace text.",icon:"🧪",href:"apps/clipboard-alchemist/index.html",accent:"#5ae4a7"},{slug:"palette-maker",title:"Palette Maker",blurb:"Build harmonious palettes with theory-backed suggestions and accessibility checks.",icon:"🎨",href:"apps/palette-maker/index.html",accent:"#f6b44e"},{slug:"qr-code-generator",title:"Local QR Studio",blurb:"Type or paste text, preview four redundancy levels, and download pristine PNG or SVG QR codes instantly.",icon:"🔳",href:"apps/qr-code-generator/index.html",accent:"#64d7ff"},{slug:"browser-diagnostic",title:"Browser Systems Diagnostic",blurb:"Run a slow, deliberate sweep of browser features, permissions, and experimental APIs from a glowing command console.",icon:"🧰",href:"apps/browser-diagnostic/index.html",accent:"#b7410e"}],t=document.getElementById("app-root");function i(){const e=document.createElement("header");return e.className="hero",e.innerHTML=`
    <span class="hero-eyebrow">Matt Presents</span>
    <h1>Vibe-Coded App Hub</h1>
    <p>Micro web experiments with big feelings. Click any card to open a focused tool in a new page.</p>
  `,e}function s(e){const a=document.createElement("a");return a.className="app-card",a.href=e.href,a.dataset.slug=e.slug,a.setAttribute("style",`--accent:${e.accent};`),a.innerHTML=`
    <span class="app-icon" aria-hidden="true">${e.icon}</span>
    <span class="app-title">${e.title}</span>
    <span class="app-blurb">${e.blurb}</span>
    <span class="app-link">Launch ↗</span>
  `,a}function r(){const e=document.createElement("section");return e.className="app-grid",e.setAttribute("aria-label","Available vibe-coded applications"),n.forEach(a=>{e.appendChild(s(a))}),e}function l(){const e=document.createElement("section");return e.className="about",e.innerHTML=`
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
  `,e}function o(){const e=document.createElement("section");return e.className="timeline",e.innerHTML=`
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
    `,e}function c(){if(!t)return;const e=document.createElement("div");e.className="page-shell",e.appendChild(i()),e.appendChild(r()),e.appendChild(o()),e.appendChild(l()),t.innerHTML="",t.appendChild(e)}c();
