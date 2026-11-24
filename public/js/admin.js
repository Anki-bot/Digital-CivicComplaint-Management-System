/* Admin Pro — API first, fallback demo */
const serverModeA = () => (typeof API !== 'undefined' && API.serverMode && API.token);

/* Form modal without auto-appended close button */
function openFormModal(html) {
  let b = document.getElementById('modalBack');
  if (!b) {
    b = document.createElement('div'); b.id = 'modalBack'; b.className = 'modal-back';
    b.innerHTML = '<div class="modal" id="modalBox"></div>';
    document.body.appendChild(b);
    b.addEventListener('click', e => { if (e.target === b) closeModal(); });
  }
  document.getElementById('modalBox').innerHTML = html;
  b.classList.add('open');
}

function initAdmin() {
  if (!document.getElementById('adminBody')) return;
  if (!requireAdmin()) return;
  renderAdmin();
  ['adminSearch', 'adminStatus', 'adminCategory', 'adminWard', 'adminPriority'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderAdminTable);
    document.getElementById(id)?.addEventListener('change', renderAdminTable);
  });
  document.getElementById('exportBtn')?.addEventListener('click', () => exportCSV(adminCache));
  document.getElementById('announceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = document.getElementById('annTitle').value.trim(), b = document.getElementById('annBody').value.trim();
    if (!t || !b) { showToast('Fill announcement title + body.', 'error'); return; }
    try {
      if (serverModeA()) await API.req('/api/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t, body: b }) });
      else { const a = getAnnouncements(); a.unshift({ title: t, body: b, date: new Date().toISOString() }); saveAnnouncements(a); }
      e.target.reset(); renderAdmin(); showToast('Announcement published.', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  });
}

let adminCache = [];

function normA(c) {
  c.createdAt = c.createdAt || c.created_at;
  c.updatedAt = c.updatedAt || c.updated_at;
  c.slaDue = c.slaDue || c.sla_due;
  c.userEmail = c.userEmail || c.user_email;
  c.userName = c.userName || c.user_name;
  c.photo = c.photo_data || c.photo || c.photo_path || '';
  c.hasPhoto = !!(c.has_photo || c.photo);
  c.assignedDept = c.assignedDept || c.assigned_dept || '';
  c.assignedStaff = c.assignedStaff || c.assigned_staff || '';
  c.upvotesCount = c.upvotesCount ?? c.upvotes_count ?? ((c.upvotes || []).length);
  return c;
}

async function adminFiltered() {
  if (serverModeA()) {
    const p = new URLSearchParams({
      q: document.getElementById('adminSearch')?.value || '',
      status: document.getElementById('adminStatus')?.value || 'All',
      category: document.getElementById('adminCategory')?.value || 'All',
      ward: document.getElementById('adminWard')?.value || 'All',
      priority: document.getElementById('adminPriority')?.value || 'All'
    });
    const d = await API.req('/api/admin/complaints?' + p.toString());
    return (d.complaints || []).map(normA);
  }
  const q = (document.getElementById('adminSearch')?.value || '').toLowerCase();
  const s = document.getElementById('adminStatus')?.value || 'All';
  const cat = document.getElementById('adminCategory')?.value || 'All';
  const ward = document.getElementById('adminWard')?.value || 'All';
  const pri = document.getElementById('adminPriority')?.value || 'All';
  let all = getComplaints().map(normA);
  if (s === 'Overdue') all = all.filter(c => typeof isOverdue === 'function' ? isOverdue({ status: c.status, slaDue: c.slaDue, createdAt: c.createdAt, priority: c.priority }) : false);
  else if (s !== 'All') all = all.filter(c => c.status === s);
  if (cat !== 'All') all = all.filter(c => c.category === cat);
  if (ward !== 'All') all = all.filter(c => (c.ward || '') === ward);
  if (pri !== 'All') all = all.filter(c => (c.priority || '') === pri);
  if (q) all = all.filter(c => (c.id + c.title + c.location + c.userEmail + (c.assignedStaff || '')).toLowerCase().includes(q));
  return all;
}

async function renderAdmin() {
  try {
    if (serverModeA()) {
      const d = await API.req('/api/admin/stats');
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      set('aTotal', d.total); set('aPending', d.pending); set('aProgress', d.progress); set('aResolved', d.resolved);
      set('aOverdue', d.overdue); set('aAvg', d.avgHrs + 'h'); set('aSat', d.sat ? d.sat + '★' : '—');
      const rows = await adminFiltered(); adminCache = rows;
      drawCharts(rows); renderRows(rows); renderAnnManage(); renderUsers(); renderAudit(); return;
    }
  } catch (e) { showToast(e.message, 'error'); }
  const all = getComplaints().map(normA);
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('aTotal', all.length); set('aPending', all.filter(c => c.status === 'Pending').length);
  set('aProgress', all.filter(c => c.status === 'In Progress').length); set('aResolved', all.filter(c => c.status === 'Resolved').length);
  set('aOverdue', all.filter(c => { try { return isOverdue({ status: c.status, slaDue: c.slaDue, createdAt: c.createdAt, priority: c.priority }); } catch { return false; } }).length);
  set('aAvg', '0h'); set('aSat', '—');
  const rows = await adminFiltered(); adminCache = rows;
  drawCharts(rows); renderRows(rows); renderAnnManage(); renderUsers(); renderAudit();
}

function drawCharts(all) {
  const counts = ['Pending', 'In Progress', 'Resolved', 'Rejected'].map(s => all.filter(c => c.status === s).length);
  const cats = (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).map(c => all.filter(x => x.category === c).length);
  const pris = (typeof PRIORITIES !== 'undefined' ? PRIORITIES : ['Low', 'Medium', 'High', 'Urgent']).map(p => all.filter(x => (x.priority || 'Medium') === p).length);
  try {
    if (typeof Chart !== 'undefined') {
      ['_ch1', '_ch2', '_ch3'].forEach(k => { if (window[k]) window[k].destroy(); });
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const tc = dark ? '#e5e7eb' : '#1f2937';
      window._ch1 = new Chart(document.getElementById('chartStatus'), { type: 'doughnut', data: { labels: ['Pending', 'In Progress', 'Resolved', 'Rejected'], datasets: [{ data: counts, backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'] }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tc } } } } });
      window._ch2 = new Chart(document.getElementById('chartCat'), { type: 'bar', data: { labels: (typeof CATEGORY_LABELS !== 'undefined' ? Object.values(CATEGORY_LABELS) : []), datasets: [{ data: cats, backgroundColor: '#1a56db' }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0, color: tc } }, x: { ticks: { color: tc } } } } });
      const c3 = document.getElementById('chartPri'); if (c3) window._ch3 = new Chart(c3, { type: 'pie', data: { labels: ['Low', 'Medium', 'High', 'Urgent'], datasets: [{ data: pris, backgroundColor: ['#818cf8', '#facc15', '#fb923c', '#ef4444'] }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tc } } } } });
      return;
    }
  } catch (e) {}
  const f1 = document.getElementById('chartFallback1');
  if (f1) f1.innerHTML = ['Pending', 'In Progress', 'Resolved', 'Rejected'].map((s, i) => `<p style="font-size:.85rem;margin:6px 0"><b>${s}</b> — ${counts[i]}</p>`).join('');
}

async function renderAdminTable() {
  try { const rows = await adminFiltered(); adminCache = rows; renderRows(rows); }
  catch (e) { showToast(e.message, 'error'); }
}

function renderRows(rows) {
  const body = document.getElementById('adminBody'); if (!body) return;
  rows = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  document.getElementById('adminCount').textContent = `${rows.length} record(s)`;
  const labels = (typeof CATEGORY_LABELS !== 'undefined' ? CATEGORY_LABELS : {});
  const icons = (typeof CATEGORY_ICONS !== 'undefined' ? CATEGORY_ICONS : {});
  const deptName = (id) => { try { return (typeof DEPARTMENTS !== 'undefined' ? (DEPARTMENTS.find(d => d.id === id) || {}).name : null) || id || '—'; } catch { return id || '—'; } };
  body.innerHTML = rows.length ? rows.map(c => {
    const od = (() => { try { return isOverdue({ status: c.status, slaDue: c.slaDue, createdAt: c.createdAt, priority: c.priority }); } catch { return false; } })();
    return `<tr class="${od ? 'sla-overdue' : ''}">
    <td><b>${escapeHTML(c.id)}</b><br><small>${formatDate(c.createdAt)}</small><br><small>SLA: ${formatDate(c.slaDue || c.createdAt)}</small></td>
    <td><b>${escapeHTML(c.title)}</b><br><small>${icons[c.category] || ''} ${escapeHTML(labels[c.category] || c.category)} • ${escapeHTML(c.ward || '')}</small><br><small>${escapeHTML(c.userName)} (${escapeHTML(c.userEmail)})</small><br><small>Dept: ${escapeHTML(deptName(c.assignedDept))}${c.assignedStaff ? ` • ${escapeHTML(c.assignedStaff)}` : ''}</small></td>
    <td><span class="badge ${statusClass(c.status)}">${escapeHTML(c.status)}</span><br><span class="badge ${priorityClass(c.priority || 'Medium')}" style="margin-top:4px">${escapeHTML(c.priority || 'Medium')}</span><br><small>👍 ${c.upvotesCount ?? 0}${c.rating ? ` • ⭐${c.rating}` : ''}</small></td>
    <td>${c.photo ? `<img class="thumb" src="${c.photo}" alt="proof">` : (c.hasPhoto ? '📷' : '—')}</td>
    <td style="white-space:nowrap"><button class="btn btn-primary btn-sm" onclick="adminView('${c.id}')">View</button><br><br><button class="btn btn-accent btn-sm" onclick="adminStatus('${c.id}')">Status</button> <button class="btn btn-ghost btn-sm" onclick="adminAssign('${c.id}')">Assign</button><br><br><button class="btn btn-danger btn-sm" onclick="adminDelete('${c.id}')">Delete</button></td></tr>`;
  }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:26px">No records match your filters.</td></tr>';
}

/* Complaint detail view — fetches full data including photo from track endpoint */
async function adminView(id) {
  let c = null;
  try {
    if (serverModeA()) {
      const d = await API.req('/api/complaints/track/' + encodeURIComponent(id));
      c = normA(d.complaint || {});
    }
  } catch {}
  if (!c || !c.id) c = adminCache.find(x => x.id === id) || normA({});
  if (!c.id) return;
  openModal(`<h3>${escapeHTML(c.title)}</h3><p style="font-size:.87rem;color:var(--muted)">${escapeHTML(c.id)} • ${escapeHTML(c.userEmail)} • 👍 ${c.upvotesCount ?? 0}</p>
    <p style="margin-top:10px">${escapeHTML(c.description)}</p><p style="font-size:.9rem"><b>Location:</b> ${escapeHTML(c.location)} (${escapeHTML(c.ward || '')}) ${c.lat ? `• <a target="_blank" href="https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=16/${c.lat}/${c.lng}">Open map</a>` : ''}</p>
    ${c.photo ? `<img src="${c.photo}" style="width:100%;border-radius:10px;margin-top:10px" alt="proof">` : ''}
    ${c.remark ? `<p style="margin-top:8px"><b>Remark:</b> ${escapeHTML(c.remark)}</p>` : ''}
    <div><b>Comments:</b>${(c.comments || []).map(m => `<div class="comment"><b>${escapeHTML(m.by)}</b><br>${escapeHTML(m.text)}</div>`).join('') || '<p style="color:var(--muted)">None</p>'}</div>
    <div class="timeline">${(c.history || []).map(h => `<div class="timeline-item"><b>${escapeHTML(h.status)}</b><br><small>${formatDate(h.date)}</small><p style="font-size:.9rem">${escapeHTML(h.remark || '')}</p></div>`).join('')}</div>`);
}

/* Status update via modal with select dropdown (F12) */
async function adminStatus(id) {
  const c = adminCache.find(x => x.id === id);
  const cur = c ? c.status : 'Pending';
  openFormModal(`<h3>Update Status — ${escapeHTML(id)}</h3>
    <label for="modalStatus">New Status</label>
    <select id="modalStatus">
      <option${cur === 'Pending' ? ' selected' : ''}>Pending</option>
      <option${cur === 'In Progress' ? ' selected' : ''}>In Progress</option>
      <option${cur === 'Resolved' ? ' selected' : ''}>Resolved</option>
      <option${cur === 'Rejected' ? ' selected' : ''}>Rejected</option>
    </select>
    <label for="modalRemark">Official Remark <small style="color:var(--muted)">(required for Rejected)</small></label>
    <textarea id="modalRemark" placeholder="Officer remarks…">${escapeHTML(c && c.remark ? c.remark : '')}</textarea>
    <div class="modal-actions" style="margin-top:14px">
      <button class="btn btn-primary btn-sm" onclick="submitStatus('${id}')">Save</button>
      <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    </div>`);
}
async function submitStatus(id) {
  const status = document.getElementById('modalStatus').value;
  const remark = document.getElementById('modalRemark').value.trim();
  try {
    if (serverModeA()) await API.req('/api/admin/complaints/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, remark }) });
    else {
      const all = getComplaints(); const c = all.find(x => x.id === id);
      c.status = status; c.remark = remark; c.updatedAt = new Date().toISOString();
      c.history.push({ status, date: c.updatedAt, remark: remark || status }); saveComplaints(all);
    }
    closeModal(); showToast(`${id} → ${status}`, 'success'); renderAdmin();
  } catch (e) { showToast(e.message, 'error'); }
}

/* Assignment via modal with dept dropdown — auto-moves to In Progress (F10 + F12) */
async function adminAssign(id) {
  const c = adminCache.find(x => x.id === id);
  const depts = typeof DEPARTMENTS !== 'undefined' ? DEPARTMENTS : [];
  const curDept = c ? c.assignedDept : '';
  openFormModal(`<h3>Assign — ${escapeHTML(id)}</h3>
    <label for="modalDept">Department</label>
    <select id="modalDept">
      ${depts.map(d => `<option value="${d.id}"${curDept === d.id ? ' selected' : ''}>${escapeHTML(d.name)}</option>`).join('')}
    </select>
    <label for="modalStaff">Staff Name <small style="color:var(--muted)">(optional)</small></label>
    <input id="modalStaff" placeholder="e.g. Inspector Sharma" value="${escapeHTML(c && c.assignedStaff ? c.assignedStaff : '')}">
    <div class="modal-actions" style="margin-top:14px">
      <button class="btn btn-primary btn-sm" onclick="submitAssign('${id}')">Assign &amp; Move to In Progress</button>
      <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    </div>`);
}
async function submitAssign(id) {
  const dept = document.getElementById('modalDept').value;
  const staff = document.getElementById('modalStaff').value.trim();
  try {
    if (serverModeA()) await API.req('/api/admin/complaints/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignedDept: dept, assignedStaff: staff, status: 'In Progress', remark: `Assigned to ${dept}${staff ? ' / ' + staff : ''}` }) });
    else { const all = getComplaints(); const c = all.find(x => x.id === id); c.assignedDept = dept; c.assignedStaff = staff; c.status = 'In Progress'; c.updatedAt = new Date().toISOString(); c.history.push({ status: 'In Progress', date: c.updatedAt, remark: `Assigned to ${dept}${staff ? ' / ' + staff : ''}` }); saveComplaints(all); }
    closeModal(); showToast('Assigned — moved to In Progress.', 'success'); renderAdmin();
  } catch (e) { showToast(e.message, 'error'); }
}

async function adminDelete(id) {
  if (!confirm(`Delete ${id}?`)) return;
  try {
    if (serverModeA()) await API.req('/api/admin/complaints/' + encodeURIComponent(id), { method: 'DELETE' });
    else saveComplaints(getComplaints().filter(c => c.id !== id));
    showToast('Record deleted.', 'info'); renderAdmin();
  } catch (e) { showToast(e.message, 'error'); }
}

/* Announcement management */
async function renderAnnManage() {
  const box = document.getElementById('annManage'); if (!box) return;
  try {
    if (serverModeA()) {
      const d = await API.req('/api/announcements');
      box.innerHTML = (d.announcements || []).map(a => `<div class="announce"><b>${escapeHTML(a.title)}</b><br>${escapeHTML(a.body)}<br><button class="btn btn-danger btn-sm" style="margin-top:6px" onclick="delAnn(${a.id})">Remove</button></div>`).join('') || '<p style="color:var(--muted)">None</p>';
      return;
    }
  } catch {}
  box.innerHTML = getAnnouncements().map((a, i) => `<div class="announce"><b>${escapeHTML(a.title)}</b><br>${escapeHTML(a.body)}<br><button class="btn btn-danger btn-sm" style="margin-top:6px" onclick="delAnn('${i}')">Remove</button></div>`).join('') || '<p style="color:var(--muted)">None</p>';
}
async function delAnn(id) {
  try {
    if (serverModeA() && !isNaN(Number(id))) await API.req('/api/announcements/' + id, { method: 'DELETE' });
    else { const a = getAnnouncements(); a.splice(Number(id), 1); saveAnnouncements(a); }
    renderAdmin();
  } catch (e) { showToast(e.message, 'error'); }
}

/* User Management (F8) */
async function renderUsers() {
  const body = document.getElementById('usersBody'); if (!body) return;
  try {
    let users = [];
    if (serverModeA()) {
      const d = await API.req('/api/admin/users');
      users = d.users || [];
    } else {
      users = typeof getUsers === 'function' ? getUsers() : [];
    }
    const me = currentUser();
    const isSup = me && me.role === 'admin';
    body.innerHTML = users.length ? users.map(u => {
      const roleOpts = ['citizen', 'staff', 'admin'].map(r => `<option value="${r}"${u.role === r ? ' selected' : ''}>${r}</option>`).join('');
      return `<tr>
        <td>${escapeHTML(u.name)}</td>
        <td>${escapeHTML(u.email)}</td>
        <td>${escapeHTML(u.phone || '—')}</td>
        <td>${isSup ? `<select onchange="updateUserRole(${u.id},this.value)" style="padding:4px 8px;border-radius:6px;font-size:.85rem">${roleOpts}</select>` : escapeHTML(u.role)}</td>
        <td>${isSup ? `<button class="btn ${u.active ? 'btn-ghost' : 'btn-danger'} btn-sm" onclick="toggleUserActive(${u.id},${u.active ? 0 : 1})">${u.active ? '✅ Active' : '🚫 Disabled'}</button>` : (u.active ? '✅' : '🚫')}</td>
        <td><small>${formatDate(u.created_at || u.createdAt)}</small></td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No users found.</td></tr>';
  } catch (e) { body.innerHTML = `<tr><td colspan="6" style="color:var(--danger)">${escapeHTML(e.message)}</td></tr>`; }
}
async function updateUserRole(userId, role) {
  try {
    if (serverModeA()) await API.req('/api/admin/users/' + userId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    showToast(`Role → ${role}`, 'success'); renderUsers();
  } catch (e) { showToast(e.message, 'error'); renderUsers(); }
}
async function toggleUserActive(userId, active) {
  try {
    if (serverModeA()) await API.req('/api/admin/users/' + userId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !!active }) });
    showToast(active ? 'User enabled.' : 'User disabled.', 'success'); renderUsers();
  } catch (e) { showToast(e.message, 'error'); renderUsers(); }
}

/* Audit Log (F9) */
async function renderAudit() {
  const body = document.getElementById('auditBody'); if (!body) return;
  try {
    let rows = [];
    if (serverModeA()) {
      const d = await API.req('/api/admin/audit');
      rows = d.audit || [];
    }
    body.innerHTML = rows.length ? rows.map(a => `<tr>
      <td><small>${formatDate(a.date)}</small></td>
      <td>${escapeHTML(a.actor)}</td>
      <td><span class="badge b-default">${escapeHTML(a.action)}</span></td>
      <td>${a.complaint_id ? `<a href="track.html?id=${encodeURIComponent(a.complaint_id)}" style="color:var(--primary)">${escapeHTML(a.complaint_id)}</a>` : '—'}</td>
      <td><small>${escapeHTML(a.detail || '')}</small></td>
    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No audit entries yet.</td></tr>';
  } catch (e) { body.innerHTML = `<tr><td colspan="5" style="color:var(--danger)">${escapeHTML(e.message)}</td></tr>`; }
}

document.addEventListener('DOMContentLoaded', initAdmin);
