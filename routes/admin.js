const express = require('express');
const { run, get, all } = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

const r = express.Router();
r.use(auth, adminOnly);

r.get('/stats', async (req, res) => {
  const t = await get('SELECT COUNT(*) n FROM complaints');
  const p = await get("SELECT COUNT(*) n FROM complaints WHERE status='Pending'");
  const ip = await get("SELECT COUNT(*) n FROM complaints WHERE status='In Progress'");
  const rs = await get("SELECT COUNT(*) n FROM complaints WHERE status='Resolved'");
  const od = await all("SELECT sla_due,status FROM complaints WHERE status NOT IN ('Resolved','Rejected')");
  const overdue = od.filter(x => new Date() > new Date(x.sla_due)).length;
  const resRows = await all("SELECT created_at,updated_at FROM complaints WHERE status='Resolved'");
  const avg = resRows.length ? Math.round(resRows.reduce((s, x) => s + (new Date(x.updated_at) - new Date(x.created_at)) / 36e5, 0) / resRows.length) : 0;
  const sat = await get('SELECT AVG(rating) a FROM complaints WHERE rating>0');
  res.json({ total: t.n, pending: p.n, progress: ip.n, resolved: rs.n, overdue, avgHrs: avg, sat: sat.a ? Number(sat.a).toFixed(1) : null });
});

r.get('/complaints', async (req, res) => {
  const { q = '', status = 'All', category = 'All', ward = 'All', priority = 'All' } = req.query;
  let rows = await all('SELECT * FROM complaints ORDER BY created_at DESC');
  if (status === 'Overdue') rows = rows.filter(c => c.status !== 'Resolved' && c.status !== 'Rejected' && new Date() > new Date(c.sla_due));
  else if (status !== 'All') rows = rows.filter(c => c.status === status);
  if (category !== 'All') rows = rows.filter(c => c.category === category);
  if (ward !== 'All') rows = rows.filter(c => (c.ward || '') === ward);
  if (priority !== 'All') rows = rows.filter(c => (c.priority || '') === priority);
  if (q) { const s = q.toLowerCase(); rows = rows.filter(c => (c.id + c.title + c.location + c.user_email + (c.assigned_staff || '')).toLowerCase().includes(s)); }
  for (const c of rows) {
    c.photo = c.photo_path || '';
    const ups = await get('SELECT COUNT(*) n FROM upvotes WHERE complaint_id=?', [c.id]);
    c.upvotesCount = ups.n;
    c.comments = await all('SELECT user_name AS by, text, created_at AS date FROM comments WHERE complaint_id=? ORDER BY id', [c.id]);
    c.history = await all('SELECT status, remark, date FROM history WHERE complaint_id=? ORDER BY id', [c.id]);
  }
  res.json({ complaints: rows });
});

r.put('/complaints/:id', async (req, res) => {
  const c = await get('SELECT * FROM complaints WHERE id=?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const { status, remark, assignedDept, assignedStaff } = req.body;
  const ok = ['Pending', 'In Progress', 'Resolved', 'Rejected'];
  const now = new Date().toISOString();
  let ns = c.status;
  if (status) {
    if (!ok.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status === 'Rejected' && !(remark || '').trim()) return res.status(400).json({ error: 'Rejection needs a reason' });
    ns = status;
  }
  await run('UPDATE complaints SET status=?, remark=COALESCE(?,remark), assigned_dept=COALESCE(?,assigned_dept), assigned_staff=COALESCE(?,assigned_staff), updated_at=? WHERE id=?',
    [ns, remark ?? null, assignedDept ?? null, assignedStaff ?? null, now, c.id]);
  if (status && status !== c.status)
    await run('INSERT INTO history(complaint_id,status,remark,date) VALUES(?,?,?,?)', [c.id, status, remark || status, now]);
  await run('INSERT INTO audit(actor,action,complaint_id,detail,date) VALUES(?,?,?,?,?)',
    [req.user.email, 'STATUS:' + ns, c.id, remark || '', now]);
  res.json({ ok: true });
});

r.delete('/complaints/:id', async (req, res) => {
  await run('DELETE FROM complaints WHERE id=?', [req.params.id]);
  await run('DELETE FROM comments WHERE complaint_id=?', [req.params.id]);
  await run('DELETE FROM upvotes WHERE complaint_id=?', [req.params.id]);
  await run('DELETE FROM history WHERE complaint_id=?', [req.params.id]);
  res.json({ ok: true });
});

r.get('/users', async (req, res) => {
  const users = await all('SELECT id,name,email,phone,role,active,created_at FROM users ORDER BY created_at DESC');
  res.json({ users });
});
r.put('/users/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { role, active } = req.body;
  if (role && !['citizen', 'staff', 'admin'].includes(role)) return res.status(400).json({ error: 'Bad role' });
  await run('UPDATE users SET role=COALESCE(?,role), active=COALESCE(?,active) WHERE id=?', [role || null, active === undefined ? null : (active ? 1 : 0), req.params.id]);
  res.json({ ok: true });
});

r.get('/audit', async (req, res) => {
  const rows = await all('SELECT * FROM audit ORDER BY id DESC LIMIT 100');
  res.json({ audit: rows });
});

module.exports = r;
