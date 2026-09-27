/* Citizen Pro — real API first, localStorage fallback */
let pendingPhotoBase64 = '';
let pendingPhotoFile = null;
const serverMode = () => (typeof API !== 'undefined' && API.serverMode && API.token);

/* Normalize server (snake_case) vs legacy (camelCase) shapes */
function N(c) {
  if (!c) return c;
  c.createdAt = c.createdAt || c.created_at;
  c.updatedAt = c.updatedAt || c.updated_at;
  c.slaDue = c.slaDue || c.sla_due;
  c.userEmail = c.userEmail || c.user_email;
  c.userName = c.userName || c.user_name;
  c.photo = c.photo || c.photo_path || '';
  c.assignedDept = c.assignedDept || c.assigned_dept || '';
  c.assignedStaff = c.assignedStaff || c.assigned_staff || '';
  c.upvotesCount = (c.upvotesCount !== undefined) ? c.upvotesCount : (c.upvotes_count !== undefined ? c.upvotes_count : ((c.upvotes || []).length));
  if (c.voted === undefined && c.upvotes && currentUser()) c.voted = c.upvotes.includes(currentUser().email);
  c.comments = c.comments || []; c.history = c.history || [];
  return c;
}
function votesOf(c) { return c.upvotesCount !== undefined ? c.upvotesCount : ((c.upvotes || []).length); }
function votedOf(c) {
  if (c.voted !== undefined) return c.voted;
  const u = (typeof currentUser === 'function' ? currentUser() : null);
  return !!(u && (c.upvotes || []).includes(u.email));
}
async function apiListMine(q, status) {
  const p = new URLSearchParams();
  if (q) p.set('q', q); if (status && status !== 'All') p.set('status', status);
  const d = await API.req('/api/complaints/mine?' + p.toString());
  return (d.complaints || []).map(N);
}
async function apiTrack(id) {
  const d = await API.req('/api/complaints/track/' + encodeURIComponent(id));
  return N(d.complaint);
}

function initFilePage() {
  const form = document.getElementById('complaintForm'); if (!form) return;
  if (!requireAuth()) return;
  if (typeof initPicker === 'function') initPicker('pickMap', 'lat', 'lng');
  const photoInput = document.getElementById('photo'), preview = document.getElementById('photoPreview');
  if (photoInput) photoInput.addEventListener('change', () => {
    const f = photoInput.files[0];
    if (!f) { pendingPhotoBase64 = ''; pendingPhotoFile = null; preview.style.display = 'none'; return; }
    if (!f.type.startsWith('image/')) { showToast('Only image files allowed.', 'error'); photoInput.value = ''; return; }
    if (f.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB.', 'error'); photoInput.value = ''; return; }
    pendingPhotoFile = f;
    const r = new FileReader(); r.onload = () => { pendingPhotoBase64 = r.result; preview.src = r.result; preview.style.display = 'block'; }; r.readAsDataURL(f);
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = currentUser();
    const category = document.getElementById('category').value;
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const locationV = document.getElementById('location').value.trim();
    const ward = document.getElementById('ward')?.value || 'Ward 4';
    const priority = document.getElementById('priority')?.value || 'Medium';
    const lat = document.getElementById('lat')?.value || '', lng = document.getElementById('lng')?.value || '';
    const anonymous = document.getElementById('anonymous')?.checked || false;
    if (!category || title.length < 5 || description.length < 10 || locationV.length < 3) { showToast('Fill all fields correctly (title 5+, description 10+).', 'error'); return; }
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      if (serverMode()) {
        const fd = new FormData();
        fd.append('category', category); fd.append('title', title); fd.append('description', description);
        fd.append('location', locationV); fd.append('ward', ward); fd.append('priority', priority);
        fd.append('lat', lat); fd.append('lng', lng); fd.append('anonymous', anonymous ? '1' : '0');
        if (pendingPhotoFile) fd.append('photo', pendingPhotoFile);
        const headers = {}; if (API.token) headers.Authorization = 'Bearer ' + API.token;
        const res = await fetch('/api/complaints', { method: 'POST', headers, body: fd });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Submit failed');
        showToast(`Filed! ID: ${d.id}`, 'success');
        setTimeout(() => window.location.href = 'track.html?id=' + encodeURIComponent(d.id), 900);
        return;
      }
      // Fallback demo
      const all = getComplaints(); const id = generateComplaintId(all); const now = new Date().toISOString();
      all.unshift({ id, userEmail: u.email, userName: anonymous ? 'Anonymous Citizen' : u.name, category, title, description, location: locationV, ward, priority, lat, lng, anonymous, photo: pendingPhotoBase64 || '', status: 'Pending', remark: '', assignedDept: deptForCategory(category), assignedStaff: '', upvotes: [], comments: [], rating: 0, slaDue: slaDueFor(now, priority), history: [{ status: 'Pending', date: now, remark: 'Complaint registered' }], createdAt: now, updatedAt: now });
      saveComplaints(all);
      try { pushNotif(u.email, 'Complaint filed', `${id} registered.`); } catch {}
      showToast(`Filed! ID: ${id}`, 'success');
      form.reset(); pendingPhotoBase64 = ''; pendingPhotoFile = null; if (preview) preview.style.display = 'none';
      setTimeout(() => window.location.href = 'dashboard.html', 900);
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Submit Complaint'; }
  });
}

function stepperHTML(status) {
  const steps = ['Pending', 'In Progress', 'Resolved'];
  let idx = status === 'Resolved' ? 3 : status === 'In Progress' ? 2 : 1;
  if (status === 'Rejected') return `<div class="stepper"><div class="step done" data-n="✓">Pending</div><div class="step now" data-n="!">Rejected</div></div>`;
  return `<div class="stepper">${steps.map((s, i) => `<div class="step ${i + 1 < idx ? 'done' : i + 1 === idx ? (status === 'Resolved' && s === 'Resolved' ? 'done' : 'now') : ''}" data-n="${i + 1}">${s}</div>`).join('')}</div>`;
}
function cardActions(c) {
  const u = (typeof currentUser === 'function' ? currentUser() : null);
  const ownerEmail = c.userEmail || c.user_email;
  return `<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap" class="no-print">
    <button class="vote-btn ${votedOf(c) ? 'voted' : ''}" onclick="toggleUpvote('${c.id}')">👍 ${votesOf(c)} Upvote</button>
    <button class="btn btn-outline btn-sm" onclick="viewTimeline('${c.id}')">Timeline</button>
    <button class="btn btn-ghost btn-sm" onclick="shareComplaint('${c.id}')">Share</button>
    <button class="btn btn-ghost btn-sm" onclick="printReceipt('${c.id}')">Receipt</button>
    ${c.status === 'Pending' && u && ownerEmail === u.email ? `<button class="btn btn-primary btn-sm" onclick="editComplaint('${c.id}')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteComplaint('${c.id}')">Delete</button>` : ''}
  </div>`;
}
function commentsHTML(c) {
  return `<div style="margin-top:12px"><b>💬 Comments (${(c.comments || []).length})</b>
    ${(c.comments || []).map(m => `<div class="comment"><b>${escapeHTML(m.by)}</b> <small style="color:var(--muted)">${formatDate(m.date)}</small><br>${escapeHTML(m.text)}</div>`).join('') || '<p style="font-size:.85rem;color:var(--muted)">No comments yet.</p>'}
    <div style="display:flex;gap:8px;margin-top:8px" class="no-print"><input id="commentBox-${c.id}" placeholder="Write a comment…" style="flex:1"><button class="btn btn-primary btn-sm" onclick="addComment('${c.id}')">Post</button></div></div>`;
}
function ratingHTML(c) {
  if (c.status !== 'Resolved') return '';
  return `<div style="margin-top:10px"><b>⭐ Rate resolution:</b> <span class="stars">${[1, 2, 3, 4, 5].map(i => `<span onclick="submitRating('${c.id}',${i})">${i <= (c.rating || 0) ? '★' : '☆'}</span>`).join('')}</span> ${c.rating ? `<small>(${c.rating}/5)</small>` : ''}</div>`;
}
function overdueOf(c) {
  try { if (typeof isOverdue === 'function' && (c.slaDue || c.sla_due)) return isOverdue({ status: c.status, slaDue: c.slaDue || c.sla_due, createdAt: c.createdAt, priority: c.priority }); } catch {}
  if (c.status === 'Resolved' || c.status === 'Rejected') return false;
  const due = c.slaDue || c.sla_due; if (!due) return false;
  return new Date() > new Date(due);
}

async function renderMyComplaints() {
  const wrap = document.getElementById('myList'); if (!wrap) return;
  if (!requireAuth()) return;
  const u = currentUser();
  const q = (document.getElementById('searchMine')?.value || '').toLowerCase();
  const f = document.getElementById('filterMine')?.value || 'All';
  let mine = [];
  try {
    if (serverMode()) mine = await apiListMine('', 'All');
    else mine = getComplaints().filter(c => (c.userEmail || c.user_email) === u.email).map(N);
  } catch (e) { mine = getComplaints().filter(c => (c.userEmail || c.user_email) === u.email).map(N); }
  if (f !== 'All') mine = mine.filter(c => c.status === f);
  if (q) mine = mine.filter(c => (c.title + c.id + c.location).toLowerCase().includes(q));
  const res = mine.filter(c => c.status === 'Resolved').length;
  document.getElementById('mineCount').textContent = `${mine.length} complaint(s) • ${res} resolved`;
  const prof = document.getElementById('profileStats');
  if (prof) prof.innerHTML = `<div class="grid-4"><div class="stat"><b>${mine.length}</b><span>Filed</span></div><div class="stat"><b>${mine.filter(c => c.status === 'Pending').length}</b><span>Pending</span></div><div class="stat"><b>${res}</b><span>Resolved</span></div><div class="stat"><b>${mine.reduce((s, c) => s + votesOf(c), 0)}</b><span>Upvotes earned</span></div></div>`;
  wrap.innerHTML = mine.length ? mine.map(c => `
    <div class="card" style="margin-bottom:14px;${overdueOf(c) ? 'border-color:var(--danger);' : ''}">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="badge ${statusClass(c.status)}">${escapeHTML(c.status)}</span><span class="badge ${priorityClass(c.priority || 'Medium')}">${escapeHTML(c.priority || 'Medium')}</span>${overdueOf(c) ? '<span class="badge b-urgent">⏰ Overdue</span>' : ''}<small style="margin-left:auto;color:var(--muted)">${escapeHTML(c.id)} • ${formatDate(c.createdAt)}</small></div>
      <h3 style="margin:8px 0 4px">${(typeof CATEGORY_ICONS !== 'undefined' ? CATEGORY_ICONS[c.category] : '') || ''} ${escapeHTML(c.title)}</h3>
      <p>${escapeHTML((typeof CATEGORY_LABELS !== 'undefined' ? CATEGORY_LABELS[c.category] : null) || c.category)} • ${escapeHTML(c.ward || '')} • ${escapeHTML(c.location)}</p>
      <p style="font-size:.9rem;color:var(--muted)">${escapeHTML((c.description || '').slice(0, 160))}${(c.description || '').length > 160 ? '…' : ''}</p>
      ${c.photo ? `<img class="thumb" style="width:100%;height:170px;margin-top:10px" src="${c.photo}" alt="proof">` : ''}
      ${c.remark ? `<p style="margin-top:8px;font-size:.88rem"><b>Official remark:</b> ${escapeHTML(c.remark)}${c.assignedStaff ? ` — <i>${escapeHTML(c.assignedStaff)}</i>` : ''}</p>` : ''}
      ${stepperHTML(c.status)}${cardActions(c)}${commentsHTML(c)}${ratingHTML(c)}
    </div>`).join('')
    : '<div class="empty"><div>📭</div><h3>No complaints found</h3><p>File your first complaint and track it here.</p><br><a class="btn btn-primary" href="file-complaint.html">File Complaint</a></div>';
  if (typeof renderNotifs === 'function') renderNotifs();
}

async function viewTimeline(id) {
  let c = null;
  try { c = serverMode() ? await apiTrack(id) : N(getComplaints().find(x => x.id === id)); }
  catch { c = N(getComplaints().find(x => x.id === id)); }
  if (!c) return;
  openModal(`<h3>${escapeHTML(c.title)}</h3><p style="color:var(--muted);font-size:.88rem">${escapeHTML(c.id)} • ${escapeHTML(c.status)} • SLA: ${formatDate(c.slaDue || c.createdAt)}</p>${stepperHTML(c.status)}<div class="timeline">${(c.history || []).map(h => `<div class="timeline-item"><b>${escapeHTML(h.status)}</b><br><small>${formatDate(h.date)}</small><p style="font-size:.9rem">${escapeHTML(h.remark || '')}</p></div>`).join('')}</div>`);
}
async function deleteComplaint(id) {
  if (!confirm('Delete this complaint?')) return;
  try {
    if (serverMode()) await API.req('/api/complaints/' + encodeURIComponent(id), { method: 'DELETE' });
    else saveComplaints(getComplaints().filter(c => c.id !== id));
    showToast('Complaint deleted.', 'info'); renderMyComplaints();
  } catch (e) { showToast(e.message, 'error'); }
}
async function editComplaint(id) {
  let c = null;
  try { c = serverMode() ? await apiTrack(id) : N(getComplaints().find(x => x.id === id)); }
  catch { c = N(getComplaints().find(x => x.id === id)); }
  if (!c || c.status !== 'Pending') { showToast('Only Pending complaints can be edited.', 'error'); return; }
  const t = prompt('Edit title:', c.title); if (t === null) return;
  const d = prompt('Edit description:', c.description); if (d === null) return;
  if (t.trim().length < 5 || d.trim().length < 10) { showToast('Title 5+, description 10+ chars required.', 'error'); return; }
  try {
    if (serverMode()) await API.req('/api/complaints/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t.trim(), description: d.trim() }) });
    else { const all = getComplaints(); const x = all.find(v => v.id === id); x.title = t.trim(); x.description = d.trim(); x.updatedAt = new Date().toISOString(); saveComplaints(all); }
    showToast('Complaint updated.', 'success'); renderMyComplaints();
  } catch (e) { showToast(e.message, 'error'); }
}

function initTrackPage() {
  const form = document.getElementById('trackForm'); if (!form) return;
  const params = new URLSearchParams(location.search);
  if (params.get('id')) { document.getElementById('trackId').value = params.get('id'); doTrack(params.get('id')); }
  form.addEventListener('submit', e => { e.preventDefault(); doTrack(document.getElementById('trackId').value.trim().toUpperCase()); });
}
async function doTrack(id) {
  const out = document.getElementById('trackResult'); if (!out) return;
  if (!id) { showToast('Enter a complaint ID.', 'error'); return; }
  out.innerHTML = '<div class="card"><p>Loading…</p></div>';
  let c = null;
  try {
    if (serverMode()) c = await apiTrack(id);
    else c = N(getComplaints().find(x => x.id.toUpperCase() === id.toUpperCase()));
  } catch (e) {
    try { c = N(getComplaints().find(x => x.id.toUpperCase() === id.toUpperCase())); } catch {}
    if (!c) { out.innerHTML = `<div class="card"><p style="color:var(--danger)">${escapeHTML(e.message)}</p></div>`; return; }
  }
  if (!c) { out.innerHTML = '<div class="empty"><div>🔍</div><h3>Not found</h3><p>Check the ID, e.g. CIV-2026-1001</p></div>'; return; }
  out.dataset.id = c.id;
  const labels = (typeof CATEGORY_LABELS !== 'undefined' ? CATEGORY_LABELS : {});
  const icons = (typeof CATEGORY_ICONS !== 'undefined' ? CATEGORY_ICONS : {});
  out.innerHTML = `<div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap"><span class="badge ${statusClass(c.status)}">${escapeHTML(c.status)}</span><span class="badge ${priorityClass(c.priority || 'Medium')}">${escapeHTML(c.priority || 'Medium')}</span>${overdueOf(c) ? '<span class="badge b-urgent">⏰ SLA overdue</span>' : ''}</div>
    <h3 style="margin:8px 0">${icons[c.category] || ''} ${escapeHTML(c.title)}</h3>
    <p>${escapeHTML(labels[c.category] || c.category)} • ${escapeHTML(c.ward || '')} • ${escapeHTML(c.location)}</p>
    <p style="font-size:.88rem;color:var(--muted)">${escapeHTML(c.id)} • Filed ${formatDate(c.createdAt)} • SLA due ${formatDate(c.slaDue || c.createdAt)}</p>
    <p style="margin-top:8px">${escapeHTML(c.description)}</p>
    ${c.photo ? `<img src="${c.photo}" style="width:100%;border-radius:10px;margin-top:10px;max-height:300px;object-fit:cover" alt="proof">` : ''}
    ${c.remark ? `<p style="margin-top:8px"><b>Official remark:</b> ${escapeHTML(c.remark)}</p>` : ''}
    ${stepperHTML(c.status)}${cardActions(c)}${commentsHTML(c)}${ratingHTML(c)}
    <div class="timeline">${(c.history || []).map(h => `<div class="timeline-item"><b>${escapeHTML(h.status)}</b><br><small>${formatDate(h.date)}</small><p style="font-size:.9rem">${escapeHTML(h.remark || '')}</p></div>`).join('')}</div></div>`;
}

function openModal(html) {
  let b = document.getElementById('modalBack');
  if (!b) { b = document.createElement('div'); b.id = 'modalBack'; b.className = 'modal-back'; b.innerHTML = '<div class="modal" id="modalBox"></div>'; document.body.appendChild(b); b.addEventListener('click', e => { if (e.target === b) closeModal(); }); }
  document.getElementById('modalBox').innerHTML = html + '<div class="modal-actions"><button class="btn btn-primary btn-sm" onclick="closeModal()">Close</button></div>';
  b.classList.add('open');
}
function closeModal() { document.getElementById('modalBack')?.classList.remove('open'); }

document.addEventListener('DOMContentLoaded', () => {
  initFilePage(); initTrackPage();
  if (document.getElementById('myList')) {
    renderMyComplaints();
    document.getElementById('searchMine')?.addEventListener('input', renderMyComplaints);
    document.getElementById('filterMine')?.addEventListener('change', renderMyComplaints);
  }
});
