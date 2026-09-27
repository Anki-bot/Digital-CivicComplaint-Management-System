const express = require('express');
const { body, validationResult } = require('express-validator');
const { run, get, all, slaDue, deptForCategory, complaintId } = require('../config/db');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const r = express.Router();
const CATS = ['roads', 'water', 'electricity', 'sanitation', 'streetlight', 'other'];
const PRIS = ['Low', 'Medium', 'High', 'Urgent'];

async function fullComplaint(id, viewerId) {
  const c = await get('SELECT * FROM complaints WHERE id=?', [id]);
  if (!c) return null;
  c.anonymous = !!c.anonymous;
  c.photo = c.photo_path || '';
  const comments = await all('SELECT user_name AS by, text, created_at AS date FROM comments WHERE complaint_id=? ORDER BY id', [id]);
  const history = await all('SELECT status, remark, date FROM history WHERE complaint_id=? ORDER BY id', [id]);
  const ups = await all('SELECT user_id FROM upvotes WHERE complaint_id=?', [id]);
  c.comments = comments; c.history = history;
  c.upvotes = ups.map(x => x.user_id);
  c.upvotesCount = ups.length;
  c.voted = viewerId ? ups.some(x => x.user_id === viewerId) : false;
  return c;
}

// Public: recent + map + track
r.get('/public', async (req, res) => {
  const rows = await all('SELECT * FROM complaints ORDER BY created_at DESC LIMIT 6');
  for (const c of rows) { c.photo = c.photo_path || ''; }
  res.json({ complaints: rows });
});
r.get('/map', async (req, res) => {
  const rows = await all("SELECT id,title,status,lat,lng FROM complaints WHERE lat<>'' AND lng<>'' ORDER BY created_at DESC LIMIT 100");
  res.json({ points: rows });
});
r.get('/track/:id', async (req, res) => {
  const c = await fullComplaint(req.params.id.toUpperCase());
  if (!c) return res.status(404).json({ error: 'Complaint not found' });
  res.json({ complaint: c });
});

// Citizen: mine
r.get('/mine', auth, async (req, res) => {
  const rows = await all('SELECT * FROM complaints WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
  const q = (req.query.q || '').toLowerCase(), f = req.query.status || 'All';
  let out = rows;
  if (f !== 'All') out = out.filter(c => c.status === f);
  if (q) out = out.filter(c => (c.title + c.id + c.location).toLowerCase().includes(q));
  for (const c of out) {
    c.photo = c.photo_path || '';
    const ups = await all('SELECT user_id FROM upvotes WHERE complaint_id=?', [c.id]);
    c.upvotesCount = ups.length; c.voted = ups.some(x => x.user_id === req.user.id);
    c.comments = await all('SELECT user_name AS by, text, created_at AS date FROM comments WHERE complaint_id=? ORDER BY id', [c.id]);
    c.history = await all('SELECT status, remark, date FROM history WHERE complaint_id=? ORDER BY id', [c.id]);
  }
  res.json({ complaints: out });
});

// Citizen: file
r.post('/', auth, upload.single('photo'), body('title').isLength({ min: 5 }),
  body('description').isLength({ min: 10 }), async (req, res) => {
    const e = validationResult(req);
    if (!e.isEmpty()) return res.status(400).json({ error: 'Title 5+, description 10+ chars required.' });
    const { category, title, description, location, ward, priority, lat, lng, anonymous } = req.body;
    if (!CATS.includes(category)) return res.status(400).json({ error: 'Invalid category' });
    if (priority && !PRIS.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
    if (!location || location.trim().length < 3) return res.status(400).json({ error: 'Location required' });
    const now = new Date().toISOString();
    let id = complaintId();
    for (let i = 0; i < 5; i++) {
      const ex = await get('SELECT id FROM complaints WHERE id=?', [id]);
      if (!ex) break;
      id = complaintId();
    }
    const anon = anonymous === '1' || anonymous === true || anonymous === 'true' ? 1 : 0;
    const uname = anon ? 'Anonymous Citizen' : req.user.name;
    const photo = req.file ? `/uploads/${req.file.filename}` : '';
    await run(`INSERT INTO complaints(id,user_id,user_email,user_name,category,title,description,location,ward,priority,lat,lng,anonymous,photo_path,status,assigned_dept,sla_due,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, req.user.id, req.user.email, uname, category, title.trim(), description.trim(), location.trim(),
       ward || 'Ward 4', priority || 'Medium', lat || '', lng || '', anon, photo, 'Pending',
       deptForCategory(category), slaDue(now, priority || 'Medium'), now, now]);
    await run('INSERT INTO history(complaint_id,status,remark,date) VALUES(?,?,?,?)', [id, 'Pending', 'Complaint registered', now]);
    await run('INSERT INTO audit(actor,action,complaint_id,detail,date) VALUES(?,?,?,?,?)', [req.user.email, 'FILE', id, `${category}/${priority || 'Medium'}`, now]);
    res.json({ id });
  });

// Owner edit/delete while Pending
r.put('/:id', auth, async (req, res) => {
  const c = await get('SELECT * FROM complaints WHERE id=?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.user_id !== req.user.id && req.user.role === 'citizen') return res.status(403).json({ error: 'Not yours' });
  if (c.status !== 'Pending') return res.status(400).json({ error: 'Only Pending complaints can be edited' });
  const { title, description } = req.body;
  if ((title && title.trim().length < 5) || (description && description.trim().length < 10))
    return res.status(400).json({ error: 'Title 5+, description 10+ required' });
  await run('UPDATE complaints SET title=COALESCE(?,title), description=COALESCE(?,description), updated_at=? WHERE id=?',
    [title || null, description || null, new Date().toISOString(), c.id]);
  res.json({ ok: true });
});
r.delete('/:id', auth, async (req, res) => {
  const c = await get('SELECT * FROM complaints WHERE id=?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const owner = c.user_id === req.user.id;
  if (!(owner && c.status === 'Pending') && req.user.role === 'citizen')
    return res.status(403).json({ error: 'Only Pending own complaints can be deleted' });
  await run('DELETE FROM complaints WHERE id=?', [c.id]);
  await run('DELETE FROM comments WHERE complaint_id=?', [c.id]);
  await run('DELETE FROM upvotes WHERE complaint_id=?', [c.id]);
  await run('DELETE FROM history WHERE complaint_id=?', [c.id]);
  res.json({ ok: true });
});

// Upvote / comment / rating
r.post('/:id/upvote', auth, async (req, res) => {
  const c = await get('SELECT id FROM complaints WHERE id=?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const ex = await get('SELECT * FROM upvotes WHERE complaint_id=? AND user_id=?', [c.id, req.user.id]);
  if (ex) await run('DELETE FROM upvotes WHERE complaint_id=? AND user_id=?', [c.id, req.user.id]);
  else await run('INSERT INTO upvotes(complaint_id,user_id,created_at) VALUES(?,?,?)', [c.id, req.user.id, new Date().toISOString()]);
  const n = await get('SELECT COUNT(*) n FROM upvotes WHERE complaint_id=?', [c.id]);
  await run('UPDATE complaints SET upvotes_count=? WHERE id=?', [n.n, c.id]);
  res.json({ upvotes: n.n, voted: !ex });
});
r.post('/:id/comments', auth, body('text').isLength({ min: 2 }), async (req, res) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(400).json({ error: 'Write a comment first' });
  const c = await get('SELECT id FROM complaints WHERE id=?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  await run('INSERT INTO comments(complaint_id,user_name,text,created_at) VALUES(?,?,?,?)',
    [c.id, req.user.name, req.body.text.trim(), new Date().toISOString()]);
  res.json({ ok: true });
});
r.post('/:id/rating', auth, async (req, res) => {
  const v = Number(req.body.rating);
  if (!(v >= 1 && v <= 5)) return res.status(400).json({ error: 'Rating 1-5' });
  const c = await get('SELECT * FROM complaints WHERE id=?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.status !== 'Resolved') return res.status(400).json({ error: 'Rate only after Resolved' });
  await run('UPDATE complaints SET rating=?, updated_at=? WHERE id=?', [v, new Date().toISOString(), c.id]);
  res.json({ ok: true });
});

module.exports = r;
