/* Engagement Pro — API first, fallback demo */
async function toggleUpvote(id) {
  const u = (typeof currentUser === 'function' ? currentUser() : null);
  if (!u) { showToast('Login to upvote.', 'error'); window.location.href = 'login.html'; return; }
  try {
    if (typeof API !== 'undefined' && API.serverMode && API.token) {
      const d = await API.req(`/api/complaints/${encodeURIComponent(id)}/upvote`, { method: 'POST' });
      showToast(d.voted ? 'Upvoted!' : 'Upvote removed.', 'success');
      if (document.getElementById('trackResult')?.dataset.id === id) doTrack(id);
      else if (document.getElementById('myList')) renderMyComplaints();
      else if (typeof renderHome === 'function') renderHome();
      return;
    }
  } catch (e) { showToast(e.message, 'error'); return; }
  const all = getComplaints(); const c = all.find(x => x.id === id); if (!c) return;
  c.upvotes = c.upvotes || [];
  c.upvotes = c.upvotes.includes(u.email) ? c.upvotes.filter(x => x !== u.email) : [...c.upvotes, u.email];
  saveComplaints(all);
  if (document.getElementById('myList')) renderMyComplaints();
  if (document.getElementById('trackResult')?.dataset.id === id) doTrack(id);
  if (typeof renderHome === 'function') renderHome();
}
async function addComment(id) {
  const u = currentUser();
  if (!u) { showToast('Login to comment.', 'error'); return; }
  const box = document.getElementById('commentBox-' + id) || document.getElementById('commentBox');
  const text = (box?.value || '').trim();
  if (text.length < 2) { showToast('Write a comment first.', 'error'); return; }
  try {
    if (typeof API !== 'undefined' && API.serverMode && API.token) {
      await API.req(`/api/complaints/${encodeURIComponent(id)}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      showToast('Comment posted.', 'success');
      if (document.getElementById('trackResult')) doTrack(id);
      else renderMyComplaints();
      return;
    }
  } catch (e) { showToast(e.message, 'error'); return; }
  const all = getComplaints(); const c = all.find(x => x.id === id); if (!c) return;
  c.comments = c.comments || []; c.comments.push({ by: u.name, text, date: new Date().toISOString() });
  saveComplaints(all);
  showToast('Comment posted.', 'success');
  if (document.getElementById('trackResult')) doTrack(id);
  else renderMyComplaints();
}
async function submitRating(id, val) {
  try {
    if (typeof API !== 'undefined' && API.serverMode && API.token) {
      await API.req(`/api/complaints/${encodeURIComponent(id)}/rating`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: val }) });
      showToast(`Thanks! Rated ${val}/5.`, 'success');
      if (document.getElementById('trackResult')) doTrack(id); else renderMyComplaints();
      return;
    }
  } catch (e) { showToast(e.message, 'error'); return; }
  const all = getComplaints(); const c = all.find(x => x.id === id); if (!c) return;
  c.rating = val; c.updatedAt = new Date().toISOString(); saveComplaints(all);
  showToast(`Thanks! Rated ${val}/5.`, 'success');
  if (document.getElementById('trackResult')) doTrack(id);
}
function shareComplaint(id) {
  const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}track.html?id=${encodeURIComponent(id)}`;
  if (navigator.share) navigator.share({ title: 'JanSeva complaint ' + id, text: 'Track my civic complaint ' + id, url }).catch(() => {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(`Track my complaint ${id}: ${url}`), '_blank');
}
async function printReceipt(id) {
  let c = null;
  try {
    if (typeof API !== 'undefined' && API.serverMode) {
      const d = await API.req('/api/complaints/track/' + encodeURIComponent(id));
      c = d.complaint;
      c.photo = c.photo_path || c.photo || ''; c.createdAt = c.created_at || c.createdAt;
    }
  } catch {}
  if (!c) c = getComplaints().find(x => x.id === id);
  if (!c) return;
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Receipt ${escapeHTML(id)}</title><style>body{font-family:Arial;padding:30px}h1{color:#0f2a5c}.box{border:2px solid #0f2a5c;border-radius:12px;padding:20px}</style></head><body><h1>🏛️ JanSeva — Complaint Receipt</h1><div class="box"><p><b>ID:</b> ${escapeHTML(c.id)}</p><p><b>Title:</b> ${escapeHTML(c.title)}</p><p><b>Category:</b> ${escapeHTML(c.category)}</p><p><b>Status:</b> ${escapeHTML(c.status)}</p><p><b>Filed:</b> ${formatDate(c.createdAt || c.created_at)}</p><p><b>Location:</b> ${escapeHTML(c.location)}</p></div><p>Track at track.html?id=${escapeHTML(c.id)}</p><script>window.print()<\/script></body></html>`);
  w.document.close();
}
function exportCSV(rows) {
  if (typeof API !== 'undefined' && API.serverMode && API.token) {
    fetch('/api/admin/export.csv', { headers: { Authorization: 'Bearer ' + API.token } })
      .then(r => { if (!r.ok) throw new Error('Export failed'); return r.blob(); })
      .then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'janseva-complaints.csv'; a.click(); })
      .catch(e => showToast(e.message, 'error'));
    return;
  }
  const head = ['ID', 'Title', 'Category', 'Ward', 'Priority', 'Status', 'Location', 'User', 'Created'];
  const lines = [head.join(',')].concat(rows.map(c => [c.id, `"${(c.title || '').replace(/"/g, '""')}"`, c.category, c.ward || '', c.priority || '', c.status, `"${(c.location || '').replace(/"/g, '""')}"`, c.userEmail || c.user_email, c.createdAt || c.created_at].join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = 'janseva-complaints.csv'; a.click();
}
function renderNotifs() {
  const box = document.getElementById('notifList'); if (!box) return;
  box.innerHTML = '<p style="color:var(--muted)">Notifications arrive as status remarks on each complaint timeline (server-backed).</p>';
}
document.addEventListener('DOMContentLoaded', renderNotifs);
