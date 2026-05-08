import"./modulepreload-polyfill-B5Qt9EMX.js";import{c as N}from"./appShell-h7smw2uj.js";const{body:E}=N({title:"Random Name Selector",description:"Paste a list of names, then click Next. The first click shuffles once, and every subsequent click reveals the next name (no duplicates).",accent:"#7ee8fa"}),e={draftText:"",committedFingerprint:"",shuffled:[],index:0,lastShown:""},s=w();E.append(s.layout);p();function w(){const t=document.createElement("div");t.className="name-selector";const a=document.createElement("section");a.className="card",a.innerHTML=`
    <header class="card-header">
      <h2>Names</h2>
      <p>One per line (commas also work). Blank lines are ignored.</p>
    </header>
  `;const n=document.createElement("label");n.className="field",n.innerHTML=`
    <span class="field-label">Name list</span>
    <textarea rows="9" spellcheck="false" placeholder="Alex
Bri
Casey
Devon"></textarea>
    <div class="field-meta">
      <span><strong data-role="count">0</strong> names detected</span>
      <span class="muted" data-role="hint">Press Next to start</span>
    </div>
  `;const r=n.querySelector("textarea"),m=n.querySelector('[data-role="count"]'),i=n.querySelector('[data-role="hint"]');r.addEventListener("input",()=>{e.draftText=r.value,p()}),a.append(n);const c=document.createElement("div");c.className="actions";const l=document.createElement("button");l.type="button",l.className="primary",l.textContent="Next";const o=document.createElement("button");o.type="button",o.className="ghost",o.textContent="Reset",l.addEventListener("click",()=>{S(),p()}),o.addEventListener("click",()=>{f(),p()}),c.append(l,o);const h=document.createElement("section");h.className="card reveal",h.innerHTML=`
    <header class="card-header">
      <h2>Reveal</h2>
      <p>The list is shuffled exactly once per run.</p>
    </header>
  `;const d=document.createElement("div");d.className="name-plate",d.setAttribute("role","status"),d.setAttribute("aria-live","polite"),d.textContent="—";const u=document.createElement("div");u.className="progress",u.innerHTML=`
    <div class="progress-row">
      <span class="progress-label" data-role="progress-label">0 / 0</span>
      <span class="progress-remaining muted" data-role="progress-remaining">0 remaining</span>
    </div>
    <div class="bar">
      <div class="bar-fill" data-role="bar-fill"></div>
    </div>
  `;const b=u.querySelector('[data-role="progress-label"]'),v=u.querySelector('[data-role="progress-remaining"]'),y=u.querySelector('[data-role="bar-fill"]');return h.append(d,c,u),t.append(a,h),{layout:t,textarea:r,countEl:m,hintEl:i,nextButton:l,resetButton:o,namePlate:d,progressLabel:b,progressRemaining:v,barFill:y}}function p(){const t=g(e.draftText);s.countEl.textContent=String(t.length);const a=x(t),n=e.committedFingerprint===a&&e.shuffled.length>0,r=n&&e.index>0,m=n&&e.index<e.shuffled.length;t.length?n?m?s.hintEl.textContent=`Ready • ${e.shuffled.length-e.index} left in this run`:s.hintEl.textContent="Done • press Reset to reshuffle":s.hintEl.textContent="Press Next to start (this will shuffle once)":s.hintEl.textContent="Add at least one name",s.nextButton.disabled=t.length===0||!m&&r,s.resetButton.disabled=!t.length&&!n&&!e.lastShown,s.namePlate.textContent=e.lastShown||"—";const i=n?e.shuffled.length:t.length,c=n?Math.min(e.index,i):0,l=Math.max(0,i-c);s.progressLabel.textContent=`${c} / ${i}`,s.progressRemaining.textContent=`${l} remaining`;const o=i>0?c/i:0;s.barFill.style.width=`${Math.round(o*100)}%`}function S(){const t=g(e.draftText);if(t.length===0){e.lastShown="",f();return}const a=x(t);(e.committedFingerprint!==a||e.shuffled.length===0)&&(e.committedFingerprint=a,e.shuffled=C(t),e.index=0,e.lastShown=""),!(e.index>=e.shuffled.length)&&(e.lastShown=e.shuffled[e.index],e.index+=1)}function f(){e.committedFingerprint="",e.shuffled=[],e.index=0,e.lastShown=""}function g(t){return t?t.split(/[\n,]+/g).map(a=>a.trim()).filter(Boolean):[]}function x(t){return t.join("")}function C(t){const a=[...t];for(let n=a.length-1;n>0;n-=1){const r=Math.floor(Math.random()*(n+1));[a[n],a[r]]=[a[r],a[n]]}return a}
