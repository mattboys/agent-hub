import"./modulepreload-polyfill-B5Qt9EMX.js";import{c as S}from"./appShell-h7smw2uj.js";const{body:E}=S({title:"Clipboard Alchemist",description:"Grant access once, then remix whatever text you have copied. Every action reads the clipboard, transforms it, and writes back the result instantly.",accent:"#5ae4a7"});if(navigator.clipboard)R();else{const a=document.createElement("p");a.textContent="Clipboard APIs are not available in this browser. Try the latest version of Chrome, Edge, or Safari.",a.className="warning-banner",E.appendChild(a)}function R(){const a=document.createElement("div");a.className="clipboard-layout";const m=document.createElement("div");m.className="actions-panel";const f=document.createElement("div");f.className="preview-panel";const r=document.createElement("div");r.className="status-toast",r.setAttribute("role","status"),r.setAttribute("aria-live","polite");const l=document.createElement("div");l.className="action-list";const o=document.createElement("div");o.className="action-card",o.innerHTML=`
    <header>
      <h3>Find &amp; replace</h3>
      <p>Swap all instances of a string with something new.</p>
    </header>
    <div class="find-replace-inputs">
      <label>
        <span>Find</span>
        <input type="text" placeholder="Text to find" />
      </label>
      <label>
        <span>Replace with</span>
        <input type="text" placeholder="Replacement" />
      </label>
      <button type="button" class="action-btn primary">Run replace</button>
    </div>
  `;const[C,x]=o.querySelectorAll("input");o.querySelector("button").addEventListener("click",()=>{const e=C.value;if(!e){c("Type something to find first.",!0);return}y({label:"Find & replace",transform:t=>t.split(e).join(x.value)})}),[{id:"json-prettify",label:"Beautify JSON",description:"Parse and pretty-print clipboard JSON with 2-space indentation.",transform:e=>{const t=JSON.parse(e);return JSON.stringify(t,null,2)}},{id:"json-minify",label:"Minify JSON",description:"Strip whitespace from JSON without changing its meaning.",transform:e=>{const t=JSON.parse(e);return JSON.stringify(t)}},{id:"url-encode",label:"URL encode",description:"Turns your text into a URL-safe string using encodeURIComponent.",transform:e=>encodeURIComponent(e)},{id:"url-decode",label:"URL decode",description:"Reverses URL encoding and restores readable characters.",transform:e=>decodeURIComponent(e)}].forEach(e=>{const t=document.createElement("article");t.className="action-card",t.innerHTML=`
      <header>
        <h3>${e.label}</h3>
        <p>${e.description}</p>
      </header>
    `;const n=document.createElement("button");n.type="button",n.className="action-btn",n.textContent="Run on clipboard",n.addEventListener("click",()=>y(e)),t.appendChild(n),l.appendChild(t)}),l.appendChild(o);const s=document.createElement("button");s.type="button",s.className="refresh-btn",s.textContent="Peek at clipboard",s.addEventListener("click",async()=>{await w()});const d=document.createElement("header");d.className="preview-header",d.innerHTML=`
    <div>
      <h3>Clipboard preview</h3>
      <p>We never send data anywhere—everything you see is rendered locally.</p>
    </div>
  `,d.appendChild(s);const b=g("Before","Source clipboard text"),v=g("After","Result written back");f.append(d,b.container,v.container),m.append(l),a.append(m,f,r),E.appendChild(a);let p=!1,h;async function y(e){if(!p){p=!0,u(!0);try{const t=await navigator.clipboard.readText();b.textarea.value=t;const n=e.transform(t);await navigator.clipboard.writeText(n),v.textarea.value=n,c(`✅ ${e.label} completed and copied back.`)}catch(t){console.error(t),c(N(e.label,t),!0)}finally{p=!1,u(!1)}}}async function w(){if(!p){u(!0);try{const e=await navigator.clipboard.readText();b.textarea.value=e,c("📋 Clipboard captured for preview.")}catch(e){console.error(e),c("Could not read from the clipboard. Ensure the page has permission.",!0)}finally{u(!1)}}}function g(e,t){const n=document.createElement("section");n.className="preview-field",n.innerHTML=`<div class="preview-label">${e}</div>`;const i=document.createElement("textarea");return i.readOnly=!0,i.rows=6,i.spellcheck=!1,i.setAttribute("aria-label",t),n.appendChild(i),{container:n,textarea:i}}function u(e){a.querySelectorAll("button").forEach(n=>{n.disabled=e,n.classList.toggle("is-busy",e)})}function c(e,t=!1){r.textContent=e,r.dataset.state=t?"error":"ok",r.classList.add("visible"),h&&clearTimeout(h),h=setTimeout(()=>{r.classList.remove("visible")},2600)}function N(e,t){if(t instanceof SyntaxError)return`⚠️ ${e} failed: clipboard data was not valid JSON.`;if(typeof DOMException<"u"&&t instanceof DOMException){if(t.name==="NotAllowedError")return"Permission denied. Click the page, grant clipboard access, then try again.";if(t.name==="DataError")return`⚠️ ${e} failed: decoding error. Is the text URL encoded?`}return`Something went sideways while running ${e}. Check the console for details.`}w()}
