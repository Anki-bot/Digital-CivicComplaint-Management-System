/* UI Pro: theme, language EN/HI, reveal, counters, FAQ, PWA */
const STR = {
  en:{file:'File a Complaint',track:'Track by ID',my:'My Complaints',admin:'Admin',login:'Login',register:'Register',logout:'Logout',searchPh:'Search complaint ID, e.g. CIV-2026-1001…'},
  hi:{file:'शिकायत दर्ज करें',track:'आईडी से ट्रैक करें',my:'मेरी शिकायतें',admin:'प्रशासन',login:'लॉगिन',register:'रजिस्टर',logout:'लॉगआउट',searchPh:'शिकायत आईडी खोजें…'}
};
function prefs(){ try{ return JSON.parse(localStorage.getItem('civic_prefs')||'{}'); }catch{ return {}; } }
function savePrefs(p){ localStorage.setItem('civic_prefs',JSON.stringify(p)); }
function applyTheme(){ const t=prefs().theme||'light'; document.documentElement.setAttribute('data-theme',t); const b=document.getElementById('themeBtn'); if(b) b.textContent=t==='dark'?'☀️':'🌙'; }
function toggleTheme(){ const p=prefs(); p.theme=(p.theme||'light')==='dark'?'light':'dark'; savePrefs(p); applyTheme(); }
function applyLang(){ const l=prefs().lang||'en'; document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if(STR[l]&&STR[l][k]){ if(el.tagName==='INPUT') el.placeholder=STR[l][k]; else el.textContent=STR[l][k]; } }); const lb=document.getElementById('langBtn'); if(lb) lb.textContent=l==='hi'?'EN':'हिं'; document.documentElement.lang=l==='hi'?'hi':'en'; }
function toggleLang(){ const p=prefs(); p.lang=(p.lang||'en')==='en'?'hi':'en'; savePrefs(p); applyLang(); }
function initReveal(){ const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} }),{threshold:.12}); document.querySelectorAll('.reveal').forEach(el=>io.observe(el)); }
function animateCounters(){ document.querySelectorAll('[data-count]').forEach(el=>{ const target=+el.getAttribute('data-count')||0; let cur=0; const step=Math.max(1,Math.ceil(target/40)); const t=setInterval(()=>{ cur+=step; if(cur>=target){cur=target;clearInterval(t);} el.textContent=cur; },30); }); }
function initFaq(){ document.querySelectorAll('.faq-q').forEach(q=>q.addEventListener('click',()=>q.parentElement.classList.toggle('open'))); }
function renderTicker(){ const t=document.getElementById('tickerText'); if(!t) return; const a=(typeof getAnnouncements==='function'?getAnnouncements():[]); t.textContent=(a.length?a.map(x=>`📢 ${x.title} — ${x.body}`):['Welcome to JanSeva']).join('   •   '); }
function initPWA(){ if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); } }
document.addEventListener('DOMContentLoaded',()=>{ applyTheme(); applyLang(); initReveal(); initFaq(); renderTicker(); initPWA(); document.getElementById('themeBtn')?.addEventListener('click',toggleTheme); document.getElementById('langBtn')?.addEventListener('click',toggleLang); });
