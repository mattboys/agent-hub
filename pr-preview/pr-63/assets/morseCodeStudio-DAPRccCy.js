import"./modulepreload-polyfill-B5Qt9EMX.js";import{c as I}from"./appShell-BcLert21.js";const $="#ffd166",x=150,N=80,A=320,{body:R}=I({title:"Morse Code Studio",description:"Tap, speak, or paste Morse code, watch it decode live, then flip any text back into dots, dashes, and tone-perfect playback.",accent:$}),w=W({unit:x,onUpdate:j}),T=document.createElement("div");T.className="morse-studio";const M=F({decoder:w}),E=document.createElement("div");E.className="input-grid";const H=O(w),z=_(w),U=G(w);E.append(H.card,z.card,U.card);const B=V();T.append(M.card,E,B.section);R.appendChild(T);function j(a){M.update(a)}function F({decoder:a}){const t=document.createElement("section");t.className="morse-card telemetry-card",t.innerHTML=`
    <header class="card-header">
      <div>
        <p class="eyebrow">Live monitor</p>
        <h2>Signal + decoded message</h2>
      </div>
      <div class="header-actions">
        <button type="button" class="ghost-button" data-role="reset">Clear</button>
      </div>
    </header>
    <div class="telemetry-grid">
      <article>
        <p class="mini-label">Transmission status</p>
        <p class="status-value" data-field="state">Idle</p>
      </article>
      <article>
        <p class="mini-label">Last input source</p>
        <p class="status-value" data-field="source">—</p>
      </article>
      <article>
        <p class="mini-label">Dit length</p>
        <div class="dit-control">
          <input type="range" min="80" max="260" value="${x}" step="10" />
          <span data-field="dit-readout">${x} ms</span>
        </div>
      </article>
    </div>
    <div class="live-readout">
      <p class="mini-label">Dots & dashes</p>
      <p class="morse-text" data-field="morse">Waiting…</p>
      <p class="mini-label">Current character</p>
      <p class="symbol-text" data-field="symbol">—</p>
    </div>
    <div class="decoded-output">
      <p class="mini-label">Decoded message</p>
      <p data-field="decoded">Start tapping to build a message.</p>
    </div>
  `,t.querySelector('[data-role="reset"]').addEventListener("click",()=>a.reset());const e=t.querySelector('input[type="range"]'),o=t.querySelector('[data-field="dit-readout"]');return e.addEventListener("input",l=>{const r=Number(l.target.value);o.textContent=`${r} ms`,a.setUnit(r)}),{card:t,update({liveMorse:l,decodedText:r,currentSymbol:i,isTransmitting:s,unit:c,lastSource:f}){const u=t.querySelector('[data-field="morse"]'),d=t.querySelector('[data-field="decoded"]'),p=t.querySelector('[data-field="state"]'),h=t.querySelector('[data-field="symbol"]'),S=t.querySelector('[data-field="source"]');u.textContent=l||"Waiting…",d.textContent=r||"—",h.textContent=i||"—",p.textContent=s?"Transmitting":"Listening",S.textContent=f||"—",c!==Number(e.value)&&(e.value=c,o.textContent=`${c} ms`),t.dataset.state=s?"active":"idle"}}}function O(a){const t=document.createElement("section");t.className="morse-card control-card",t.innerHTML=`
    <header class="card-header">
      <div>
        <p class="eyebrow">Key input</p>
        <h2>Hold to transmit</h2>
      </div>
    </header>
    <p class="card-description">
      Use the button (or hold the space bar) to tap dots and dashes. Release to finish each pulse.
    </p>
  `;const n=document.createElement("button");n.type="button",n.className="transmit-button",n.textContent="Hold to send";const e=document.createElement("p");e.className="micro-hint",e.textContent="Keyboard shortcut: press and hold Space or Enter.",t.append(n,e);let o=0;const l=new Set;function r(s="key"){o===0&&(a.signalStart(s),t.dataset.active="true"),o+=1}function i(s="key"){o!==0&&(o=Math.max(0,o-1),o===0&&(a.signalEnd(s),t.dataset.active="false"))}return n.addEventListener("pointerdown",s=>{s.preventDefault(),n.setPointerCapture(s.pointerId),r("button")}),n.addEventListener("pointerup",s=>{s.preventDefault(),n.hasPointerCapture&&n.hasPointerCapture(s.pointerId)&&n.releasePointerCapture(s.pointerId),i("button")}),["pointercancel","pointerleave"].forEach(s=>{n.addEventListener(s,c=>{c.pointerId!=null&&n.hasPointerCapture&&n.hasPointerCapture(c.pointerId)&&n.releasePointerCapture(c.pointerId),i("button")})}),window.addEventListener("keydown",s=>{s.repeat||(s.code==="Space"||s.code==="Enter")&&(s.preventDefault(),l.add(s.code),r("keyboard"))}),window.addEventListener("keyup",s=>{l.has(s.code)&&(l.delete(s.code),i("keyboard"))}),{card:t}}function _(a){const t=document.createElement("section");t.className="morse-card control-card mic-card",t.innerHTML=`
    <header class="card-header">
      <div>
        <p class="eyebrow">Microphone</p>
        <h2>Listen for real taps</h2>
      </div>
    </header>
    <p class="card-description">
      Let your mic hear real beeps or taps. Set a threshold so background noise stays ignored.
    </p>
    <div class="mic-actions">
      <button type="button" class="ghost-button" data-role="mic-start">Start listening</button>
      <button type="button" class="ghost-button" data-role="mic-stop" disabled>Stop</button>
    </div>
    <div class="mic-meter" aria-live="polite">
      <span class="mini-label">Input level</span>
      <div class="level-bar" data-role="level-bar">
        <span></span>
      </div>
      <span class="level-value" data-role="level-value">0%</span>
    </div>
    <label class="threshold-field">
      <span>Activation threshold</span>
      <input type="range" min="5" max="60" value="18" step="1" />
      <span class="threshold-readout" data-role="threshold-readout">18%</span>
    </label>
    <p class="micro-hint" data-role="mic-status">Idle — click start to request permission.</p>
  `;const n=t.querySelector('[data-role="mic-start"]'),e=t.querySelector('[data-role="mic-stop"]'),o=t.querySelector('[data-role="level-bar"] span'),l=t.querySelector('[data-role="level-value"]'),r=t.querySelector('[data-role="mic-status"]'),i=t.querySelector('input[type="range"]'),s=t.querySelector('[data-role="threshold-readout"]');let c=null;function f(){return c||(c=K({decoder:a,getThreshold:()=>Number(i.value)/100,onLevel:u=>{const d=Math.min(100,Math.round(u*100));l.textContent=`${d}%`,o.style.setProperty("--level",`${d}%`)},onStateChange:u=>{t.dataset.hearing=u?"tone":"silence"}}),c)}return n.addEventListener("click",async()=>{const u=f();n.disabled=!0,r.textContent="Requesting microphone…";try{await u.start(),r.textContent="Listening. Tap or whistle short vs long pulses.",e.disabled=!1}catch(d){console.error(d),r.textContent="Microphone error. Check permissions and try again.",n.disabled=!1,c?.stop(),c=null}}),e.addEventListener("click",()=>{c&&(c.stop(),c=null,n.disabled=!1,e.disabled=!0,r.textContent="Stopped listening.",t.dataset.hearing="silence",l.textContent="0%",o.style.setProperty("--level","0%"))}),i.addEventListener("input",u=>{const d=Number(u.target.value);s.textContent=`${d}%`}),{card:t}}function G(a){const t=document.createElement("section");t.className="morse-card control-card ascii-card",t.innerHTML=`
    <header class="card-header">
      <div>
        <p class="eyebrow">ASCII input</p>
        <h2>Paste dots & dashes</h2>
      </div>
    </header>
    <p class="card-description">
      Type or paste text like <code>.... . .-.. .-.. ---</code>. Use <code>/</code> between words.
    </p>
  `;const n=document.createElement("textarea");n.rows=4,n.placeholder="..-. --- --- / -... .- .-.";const e=document.createElement("p");e.className="mini-label",e.textContent="Preview decode";const o=document.createElement("p");o.className="preview-text",o.textContent="—";const l=document.createElement("p");l.className="micro-hint",l.textContent="Normalized pulses: —";const r=document.createElement("button");r.type="button",r.className="ghost-button",r.textContent="Send to live decoder",t.append(n,e,o,l,r);function i(){const s=P(n.value),c=s.join(" ");l.textContent=s.length?`Normalized pulses: ${c}`:"Normalized pulses: —";const f=Y(s);o.textContent=f||"—"}return n.addEventListener("input",i),i(),r.addEventListener("click",()=>{a.injectSequence(n.value,"ascii")?(n.value="",i(),r.textContent="Sent!",setTimeout(()=>{r.textContent="Send to live decoder"},1200)):(r.textContent="Nothing to send",setTimeout(()=>{r.textContent="Send to live decoder"},1200))}),{card:t}}function V(){const a=document.createElement("section");a.className="morse-card encoder-card",a.innerHTML=`
    <header class="card-header">
      <div>
        <p class="eyebrow">Encoder</p>
        <h2>Text → Morse + tone</h2>
      </div>
    </header>
    <p class="card-description">
      Type a message to see its dots and dashes. Generate matching audio beeps for playback drills.
    </p>
  `;const t=document.createElement("textarea");t.rows=4,t.placeholder="sos crew ready in five minutes";const n=document.createElement("div");n.className="encoder-stats",n.innerHTML=`
    <span data-role="char-count">0 chars</span>
    <label>
      <span>Dit length</span>
      <input type="range" min="80" max="240" value="${x}" step="10" />
      <strong data-role="tempo">${x} ms</strong>
    </label>
  `;const e=document.createElement("p");e.className="mini-label",e.textContent="Dots & dashes";const o=document.createElement("pre");o.className="morse-output",o.textContent="—";const l=document.createElement("div");l.className="encoder-actions";const r=document.createElement("button");r.type="button",r.className="ghost-button",r.textContent="Copy code";const i=document.createElement("button");i.type="button",i.className="ghost-button",i.textContent="Play tone",l.append(r,i),a.append(t,n,e,o,l);const s=n.querySelector('[data-role="char-count"]'),c=n.querySelector('[data-role="tempo"]'),f=n.querySelector('input[type="range"]'),u=Q();function d(){const p=t.value,h=J(p);o.textContent=h||"—",s.textContent=`${p.length} ${p.length===1?"char":"chars"}`}return t.addEventListener("input",d),f.addEventListener("input",p=>{const h=Number(p.target.value);c.textContent=`${h} ms`}),r.addEventListener("click",async()=>{const p=o.textContent;if(!(!p||p==="—"))try{await navigator.clipboard.writeText(p),r.textContent="Copied!",setTimeout(()=>{r.textContent="Copy code"},1200)}catch(h){console.error(h),r.textContent="Copy failed",setTimeout(()=>{r.textContent="Copy code"},1400)}}),i.addEventListener("click",async()=>{const p=o.textContent;if(!p||p==="—"){i.textContent="Nothing to play",setTimeout(()=>{i.textContent="Play tone"},1200);return}if(u.isPlaying()){u.stop(),i.textContent="Play tone";return}i.textContent="Playing…",await u.play(p,Number(f.value)),i.textContent="Play tone"}),d(),{section:a}}function K({decoder:a,getThreshold:t,onLevel:n,onStateChange:e}){let o,l,r,i,s,c=!1,f=!1,u=0,d=0,p=0;async function h(){if(c)return;r=await navigator.mediaDevices.getUserMedia({audio:!0}),o=new(window.AudioContext||window.webkitAudioContext);const g=o.createMediaStreamSource(r);l=o.createAnalyser(),l.fftSize=2048,i=new Uint8Array(l.fftSize),g.connect(l),c=!0,d=0,p=0,y()}function S(){s&&(cancelAnimationFrame(s),s=null),f&&(f=!1,a.signalEnd("mic"),e(!1)),r&&r.getTracks().forEach(g=>g.stop()),o&&(o.close(),o=null),l=null,i=null,r=null,d=0,p=0,c=!1}function y(){if(!c)return;l.getByteTimeDomainData(i);const g=X(i);n(g);const m=t();if(g>=m)d+=1,p=0,!f&&d>=2&&(f=!0,u=performance.now(),a.signalStart("mic"),e(!0));else if(p+=1,d=0,f&&p>=3){f=!1;const v=performance.now()-u;a.signalEnd("mic",v),e(!1)}s=requestAnimationFrame(y)}return{start:h,stop:S}}function W({unit:a,onUpdate:t}){const n=q(),e={unit:a,history:[],decoded:"",currentSymbol:"",signalActive:!1,signalStart:null,letterTimeout:null,wordTimeout:null,lastSource:"—"};function o(m="manual"){e.signalActive||(e.signalActive=!0,e.signalStart=performance.now(),e.lastSource=m,d(),y())}function l(m="manual",v){if(!e.signalActive&&v==null)return;const b=performance.now(),C=v??(e.signalStart?b-e.signalStart:e.unit);e.signalActive=!1,e.signalStart=null;const L=r(C,e.unit);L&&(e.currentSymbol+=L),u(),y()}function r(m,v){if(!m||Number.isNaN(m))return null;const b=v*1.6;return m<=b?".":"-"}function i(m){const v=m??e.currentSymbol,b=k(v);if(!b){e.currentSymbol="";return}const C=n[b]??"?";c(b),f(C),m||(e.currentSymbol="")}function s(){i(),c("/"),f(" ")}function c(m){m&&(e.history.push(m),e.history.length>N&&(e.history=e.history.slice(-N)))}function f(m){m===" "?e.decoded.endsWith(" ")||(e.decoded+=" "):e.decoded+=m,e.decoded.length>A&&(e.decoded=e.decoded.slice(-A))}function u(){d(),e.letterTimeout=setTimeout(()=>{i(),y()},e.unit*3),e.wordTimeout=setTimeout(()=>{s(),y()},e.unit*7)}function d(){e.letterTimeout&&(clearTimeout(e.letterTimeout),e.letterTimeout=null),e.wordTimeout&&(clearTimeout(e.wordTimeout),e.wordTimeout=null)}function p(){const m=e.history.join(" ");return e.currentSymbol?`${m?`${m} `:""}${e.currentSymbol}`.trim():m.trim()}function h(m){e.unit=m,!e.signalActive&&e.currentSymbol&&u(),y()}function S(){d(),e.history=[],e.decoded="",e.currentSymbol="",e.signalActive=!1,y()}function y(){t({liveMorse:p(),decodedText:e.decoded.trimStart(),currentSymbol:e.currentSymbol,isTransmitting:e.signalActive,unit:e.unit,lastSource:e.lastSource})}function g(m,v="ascii"){const b=P(m);return b.length?(b.forEach(C=>{C==="/"?s():i(C)}),e.lastSource=v,y(),!0):!1}return y(),{signalStart:o,signalEnd:l,setUnit:h,reset:S,injectSequence:g}}function X(a){let t=0;for(let n=0;n<a.length;n+=1){const e=(a[n]-128)/128;t+=e*e}return Math.sqrt(t/a.length)}function P(a){return a?a.trim().split(/\s+/).map(t=>t==="/"||t==="|"?"/":k(t)).filter(t=>t==="/"||t.length):[]}function Y(a){if(!a.length)return"";const t=q();return a.map(n=>n==="/"?" ":t[n]??"?").join("").replace(/\s+/g," ").trim()}function k(a){return a?a.replace(/[·•]/g,".").replace(/[\u2010-\u2015\u2212_]/g,"-").replace(/[^.\-]/g,""):""}function J(a){if(!a)return"";const t=a.toUpperCase(),n=[];for(const e of t){if(e===" "){n.push("/");continue}const o=D[e];o&&n.push(o)}return n.join(" ")}function q(){const a={};return Object.entries(D).forEach(([t,n])=>{a[n]=t}),a}function Q(){let a,t,n,e=!1,o=null;async function l(u,d){if(!u.trim())return;if(e){c();return}a||(a=new(window.AudioContext||window.webkitAudioContext)),a.state==="suspended"&&await a.resume(),n=a.createOscillator(),t=a.createGain(),t.gain.value=0,n.type="sine",n.frequency.value=620,n.connect(t),t.connect(a.destination),n.start(),e=!0,o={stop:!1,timeout:null,waitResolver:null};const p=Z(u);try{for(const h of p)if(o.stop||(h.type==="tone"?r():i(),await s(h.units*d),o.stop))break}finally{i(),n&&(n.stop(),n.disconnect(),n=null),t&&(t.disconnect(),t=null),e=!1,o=null}}function r(){!t||!a||(t.gain.cancelScheduledValues(a.currentTime),t.gain.setTargetAtTime(.35,a.currentTime,.01))}function i(){!t||!a||(t.gain.cancelScheduledValues(a.currentTime),t.gain.setTargetAtTime(0,a.currentTime,.01))}function s(u){return!u||u<=0?Promise.resolve():new Promise(d=>{if(!o){d();return}o.waitResolver=d,o.timeout=setTimeout(()=>{o&&(o.timeout=null,o.waitResolver=null),d()},u)})}function c(){!e||!o||(o.stop=!0,o.timeout&&(clearTimeout(o.timeout),o.timeout=null),o.waitResolver&&(o.waitResolver(),o.waitResolver=null),i())}function f(){return e}return{play:l,stop:c,isPlaying:f}}function Z(a){const t=a.trim().split(/\s+/).filter(Boolean),n=[];for(let e=0;e<t.length;e+=1){const o=t[e];if(o==="/"){n.push({type:"gap",units:7});continue}const l=o.split("");l.forEach((i,s)=>{n.push({type:"tone",units:i==="-"?3:1}),s<l.length-1&&n.push({type:"gap",units:1})});const r=t[e+1];r&&r!=="/"&&n.push({type:"gap",units:3})}return n}const D={A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",J:".---",K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",S:"...",T:"-",U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--..",0:"-----",1:".----",2:"..---",3:"...--",4:"....-",5:".....",6:"-....",7:"--...",8:"---..",9:"----.",".":".-.-.-",",":"--..--","?":"..--..","!":"-.-.--","'":".----.",'"':".-..-.","&":".-...",":":"---...",";":"-.-.-.","/":"-..-.","+":".-.-.","-":"-....-","=":"-...-",_:"..--.-",$:"...-..-","@":".--.-."};
