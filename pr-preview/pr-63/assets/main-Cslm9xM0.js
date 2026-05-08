import"./modulepreload-polyfill-B5Qt9EMX.js";const n=[{slug:"apriltag-scout",title:"AprilTag Scout",blurb:"Live camera with tag outlines, IDs, and pose hints.",icon:"🎯",href:"apps/apriltag-scout/index.html",accent:"#ff914d"},{slug:"create-dot-to-dot-designer",title:"Dot-to-Dot Designer",blurb:"Place numbered dots; preview lines while you drag.",icon:"🔢",href:"apps/create-dot-to-dot-designer/index.html",accent:"#7ad7ff"},{slug:"morse-code-studio",title:"Morse Code Studio",blurb:"Tap, speak, or type Morse; decode live with playback.",icon:"📡",href:"apps/morse-code-studio/index.html",accent:"#ffd166"},{slug:"camera-filter-lab",title:"FilterCam Playground",blurb:"Webcam filters with presets and short live captions.",icon:"📷",href:"apps/camera-filter-lab/index.html",accent:"#ff5f6d"},{slug:"scan-vector-lab",title:"Dimension Scan Lab",blurb:"Print a board, lock tags, export mm-accurate outlines.",icon:"📐",href:"apps/scan-vector-lab/index.html",accent:"#1f7a8c"},{slug:"screen-shape-measurement-tool",title:"Screen Shape Measurement Tool",blurb:"Calibrate scale and preview real shapes on screen.",icon:"📏",href:"apps/screen-shape-measurement-tool/index.html",accent:"#5cf7c1"},{slug:"clean-url-tracker-remover",title:"Clean URL Trimmer",blurb:"Paste a link; strip trackers and junk query params.",icon:"🧼",href:"apps/clean-url-tracker-remover/index.html",accent:"#48cae4"},{slug:"quick-diff",title:"Quick Diff",blurb:"Compare two snippets with character-level highlights.",icon:"📝",href:"apps/quick-diff/index.html",accent:"#3a86ff"},{slug:"quick-list-tools",title:"Quick List Tools",blurb:"Sort, dedupe, count, quote, and reshape pasted lists.",icon:"📋",href:"apps/quick-list-tools/index.html",accent:"#7ee8fa"},{slug:"reverse-engineering-lab",title:"Protocol Decoder Lab",blurb:"Decode mystery blobs: encodings, bytes, common protocols.",icon:"🕵️",href:"apps/reverse-engineering-lab/index.html",accent:"#9d4edd"},{slug:"roman-numeral-translator",title:"Roman Numeral Translator",blurb:"Roman ↔ Arabic numerals with checks and history.",icon:"🏛️",href:"apps/roman-numeral-translator/index.html",accent:"#f08c4a"},{slug:"slope-intercept-calculator",title:"Slope-Intercept Calculator",blurb:"Two points → slope m and intercept c for y = mx + c.",icon:"📈",href:"apps/slope-intercept-calculator/index.html",accent:"#4cc9f0"},{slug:"vibe-palette",title:"Aura Gradient Mixer",blurb:"Blend gradients and copy ready-to-paste CSS.",icon:"🌈",href:"apps/vibe-palette/index.html",accent:"#ff7ee7"},{slug:"clipboard-alchemist",title:"Clipboard Alchemist",blurb:"Format JSON, minify, encode, or rewrite clipboard text.",icon:"🧪",href:"apps/clipboard-alchemist/index.html",accent:"#5ae4a7"},{slug:"text-case-studio",title:"Text Case Studio",blurb:"Clipboard in; title, sentence, lower, and other cases out.",icon:"🔤",href:"apps/text-case-studio/index.html",accent:"#2dd4bf"},{slug:"palette-maker",title:"Palette Maker",blurb:"Build palettes with theory tips and contrast checks.",icon:"🎨",href:"apps/palette-maker/index.html",accent:"#f6b44e"},{slug:"qr-code-generator",title:"Local QR Studio",blurb:"Text to QR; PNG or SVG and pick redundancy level.",icon:"🔳",href:"apps/qr-code-generator/index.html",accent:"#64d7ff"},{slug:"random-name-selector",title:"Random Name Selector",blurb:"Shuffle a name list and reveal entries one at a time.",icon:"🎲",href:"apps/random-name-selector/index.html",accent:"#7ee8fa"},{slug:"browser-diagnostic",title:"Browser Systems Diagnostic",blurb:"Probe features, permissions, and APIs from one console.",icon:"🧰",href:"apps/browser-diagnostic/index.html",accent:"#b7410e"},{slug:"nesting-algorithm-visualizer",title:"Nesting Algorithm Lab",blurb:"Pack polygons on a sheet; change settings and rerun.",icon:"🧩",href:"apps/nesting-algorithm-visualizer/index.html",accent:"#ff6f61"},{slug:"sokoban-vault",title:"Sokoban Vault",blurb:"Hundreds of Sokoban levels with progress and quick jumps.",icon:"🧱",href:"apps/sokoban-vault/index.html",accent:"#f8961e"},{slug:"score-taking-app",title:"Scorecard Studio",blurb:"Score grids: players, rounds, and running totals.",icon:"📊",href:"apps/score-taking-app/index.html",accent:"#ff7b54"},{slug:"task-tracker",title:"Task Tracker",blurb:"Local Kanban: columns, backlog, sprints, story points.",icon:"📋",href:"apps/task-tracker/index.html",accent:"#4f46e5"},{slug:"pdf-forensic-analysis",title:"PDF Forensic Analysis",blurb:"Inspect PDF internals—fonts, streams, images—all offline.",icon:"🔍",href:"apps/pdf-forensic-analysis/index.html",accent:"#e07a5f"},{slug:"markdown-repair",title:"Markdown Repair",blurb:"Tidy broken markdown: lists, tables, breaks, spacing.",icon:"📝",href:"apps/markdown-repair/index.html",accent:"#6ee7b7"},{slug:"piano-and-stave",title:"Piano Stave Studio",blurb:"Play keys; hear tones and see notes on a treble staff.",icon:"🎹",href:"apps/piano-and-stave/index.html",accent:"#6f6bff"},{slug:"audio-spectrum-analyser",title:"Audio Spectrum Analyser",blurb:"Mic spectrum, scrolling heatmap, and tunable level readout.",icon:"📊",href:"apps/audio-spectrum-analyser/index.html",accent:"#00d4aa"},{slug:"polyrhythm-drum-sequencer",title:"Polyrhythm Drum Sequencer",blurb:"Layer loops with different beat splits in one shared bar.",icon:"🥁",href:"apps/polyrhythm-drum-sequencer/index.html",accent:"#e8a838"}],a=document.getElementById("app-root");function r(){const e=document.createElement("header");return e.className="hero",e.innerHTML=`
    <span class="hero-eyebrow">Matt Presents</span>
    <h1>Vibe-Coded App Hub</h1>
    <p>Small, focused web tools I ship as static pages—open a card to try one; each runs entirely in your browser.</p>
  `,e}function s(e){const t=document.createElement("a");return t.className="app-card",t.href=e.href,t.dataset.slug=e.slug,t.setAttribute("style",`--accent:${e.accent};`),t.setAttribute("aria-label",`${e.title}. ${e.blurb}`),t.innerHTML=`
    <span class="app-icon" aria-hidden="true">${e.icon}</span>
    <span class="app-title">${e.title}</span>
    <span class="app-blurb">${e.blurb}</span>
  `,t}function i(){const e=document.createElement("section");return e.className="app-grid",e.setAttribute("aria-label","Available vibe-coded applications"),n.forEach(t=>{e.appendChild(s(t))}),e}function l(){const e=document.createElement("section");return e.className="about",e.innerHTML=`
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
  `,e}function o(){if(!a)return;const e=document.createElement("div");e.className="page-shell",e.appendChild(r()),e.appendChild(i()),e.appendChild(l()),a.innerHTML="",a.appendChild(e)}o();
