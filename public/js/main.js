/* Global UI Pro — server stats first, fallback local */
function showToast(msg, type = 'info') {
  let root = document.getElementById('toast-root');
  if (!root) { root = document.createElement('div'); root.id = 'toast-root'; document.body.appendChild(root); }
  const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = msg; root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 3200);
}
function setupNavbar() {
  const toggle = document.getElementById('menuToggle'), links = document.getElementById('navLinks');
  if (toggle && links && !toggle.dataset.bound) { toggle.dataset.bound = '1'; toggle.addEventListener('click', () => links.classList.toggle('open')); }
  const u = (typeof currentUser === 'function') ? currentUser() : null;
  document.querySelectorAll('[data-auth]').forEach(el => {
    const mode = el.getAttribute('data-auth'); let show = true;
    if (mode === 'guest') show = !u; if (mode === 'user') show = !!u;
    if (mode === 'citizen') show = !!(u && u.role === 'citizen'); if (mode === 'admin') show = !!(u && (u.role === 'admin' || u.role === 'staff'));
    el.style.display = show ? '' : 'none';
  });
  const nameEl = document.getElementById('navUser'); if (nameEl) nameEl.textContent = u ? `Hi, ${u.name.split(' ')[0]}` : '';
  document.querySelectorAll('[data-logout]').forEach(b => { if (!b.dataset.bound) { b.dataset.bound = '1'; b.addEventListener('click', e => { e.preventDefault(); doLogout(); }); } });
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('#navLinks a').forEach(a => { if (a.getAttribute('href') === page) a.classList.add('active'); });
  document.querySelectorAll('#year').forEach(y => y.textContent = new Date().getFullYear());
}
function counts() {
  const all = (typeof getComplaints === 'function') ? getComplaints() : [];
  return { all, total: all.length, pending: all.filter(c => c.status === 'Pending').length, progress: all.filter(c => c.status === 'In Progress').length, resolved: all.filter(c => c.status === 'Resolved').length };
}
function updateHomeStats() { renderHome(); }
async function renderHome() {
  let all = [];
  try {
    if (typeof API !== 'undefined' && API.serverMode) {
      const d = await API.req('/api/complaints/public');
      all = d.complaints || [];
      all.forEach(c => { c.createdAt = c.created_at || c.createdAt; c.photo = c.photo_path || c.photo || ''; });
    } else all = counts().all;
  } catch { all = counts().all; }
  const total = all.length, pending = all.filter(c => c.status === 'Pending').length,
    progress = all.filter(c => c.status === 'In Progress').length, resolved = all.filter(c => c.status === 'Resolved').length;
  const set = (id, v) => { const e = document.getElementById(id); if (e) { e.setAttribute('data-count', v); e.textContent = v; } };
  set('statTotal', total); set('statPending', pending); set('statProgress', progress); set('statResolved', resolved);
  if (typeof animateCounters === 'function') animateCounters();
  const recent = document.getElementById('recentList');
  if (recent) {
    const items = [...all].sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)).slice(0, 6);
    const labels = (typeof CATEGORY_LABELS !== 'undefined' ? CATEGORY_LABELS : {});
    recent.innerHTML = items.length ? items.map(c => {
      const v = c.upvotesCount ?? c.upvotes_count ?? ((c.upvotes || []).length);
      return `<div class="card hover reveal in">
        <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="badge ${statusClass(c.status)}">${escapeHTML(c.status)}</span><span class="badge ${typeof priorityClass === 'function' ? priorityClass(c.priority || 'Medium') : 'b-default'}">${escapeHTML(c.priority || 'Medium')}</span><span class="badge b-default">👍 ${v}</span></div>
        <h3 style="margin:8px 0 4px">${escapeHTML(c.title)}</h3>
        <p>${escapeHTML(labels[c.category] || c.category)} • ${escapeHTML(c.location)}</p>
        <p style="font-size:.8rem">${escapeHTML(c.id)} • ${formatDate(c.createdAt || c.created_at)}</p>
        <div style="margin-top:10px;display:flex;gap:8px"><a class="btn btn-ghost btn-sm" href="track.html?id=${encodeURIComponent(c.id)}">Track</a><button class="btn btn-outline btn-sm" onclick="toggleUpvote('${c.id}')">👍 Upvote</button></div>
      </div>`;
    }).join('') : '<div class="card"><p>No complaints yet. Be the first to file one.</p></div>';
  }
  const ann = document.getElementById('announceList');
  if (ann) {
    try {
      if (typeof API !== 'undefined' && API.serverMode) {
        const d = await API.req('/api/announcements');
        ann.innerHTML = (d.announcements || []).slice(0, 3).map(x => `<div class="announce"><b>📢 ${escapeHTML(x.title)}</b><br>${escapeHTML(x.body)}</div>`).join('');
      } else if (typeof getAnnouncements === 'function') {
        ann.innerHTML = getAnnouncements().slice(0, 3).map(x => `<div class="announce"><b>📢 ${escapeHTML(x.title)}</b><br>${escapeHTML(x.body)}</div>`).join('');
      }
    } catch {}
  }
  if (document.getElementById('publicMap') && typeof initPublicMap === 'function') {
    try {
      if (typeof API !== 'undefined' && API.serverMode) {
        const d = await API.req('/api/complaints/map');
        const box = document.getElementById('publicMap');
        if (typeof L === 'undefined') initPublicMap('publicMap');
        else {
          const { defaultCenter, leafletJS } = { defaultCenter: () => [28.6139, 77.2090], leafletJS: null };
          initPublicMap('publicMap');
        }
        void d;
      } else initPublicMap('publicMap');
    } catch { try { initPublicMap('publicMap'); } catch {} }
  }
  const heroSearch = document.getElementById('heroSearchForm');
  if (heroSearch && !heroSearch.dataset.bound) { heroSearch.dataset.bound = '1'; heroSearch.addEventListener('submit', e => { e.preventDefault(); const v = document.getElementById('heroSearch').value.trim(); if (v) location.href = 'track.html?id=' + encodeURIComponent(v.toUpperCase()); }); }
}
document.addEventListener('DOMContentLoaded', () => { setupNavbar(); renderHome(); });
