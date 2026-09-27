const express = require('express');
const { run, get, all } = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

const r = express.Router();

r.get('/announcements', async (req, res) => {
  res.json({ announcements: await all('SELECT * FROM announcements ORDER BY id DESC') });
});
r.post('/announcements', auth, adminOnly, async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Title + body required' });
  await run('INSERT INTO announcements(title,body,date) VALUES(?,?,?)', [title.trim(), body.trim(), new Date().toISOString()]);
  res.json({ ok: true });
});
r.delete('/announcements/:id', auth, adminOnly, async (req, res) => {
  await run('DELETE FROM announcements WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});
r.post('/contact', async (req, res) => {
  const { email, message } = req.body;
  if (!email || !message) return res.status(400).json({ error: 'Email + message required' });
  await run('INSERT INTO contacts(email,message,date) VALUES(?,?,?)', [email, message, new Date().toISOString()]);
  res.json({ ok: true });
});
r.get('/departments', (req, res) => {
  res.json({ departments: [
    { id: 'pwd', name: 'Public Works (Roads)', icon: '🛣️', head: 'Er. R. Verma', phone: '1800-111-001' },
    { id: 'water', name: 'Water Supply Board', icon: '💧', head: 'S. Iyer', phone: '1800-111-002' },
    { id: 'power', name: 'Electricity Dept', icon: '⚡', head: 'K. Rao', phone: '1800-111-003' },
    { id: 'sanitation', name: 'Sanitation & Health', icon: '🧹', head: 'Dr. M. Khan', phone: '1800-111-004' },
    { id: 'lighting', name: 'Streetlighting Cell', icon: '💡', head: 'P. Nair', phone: '1800-111-005' },
    { id: 'general', name: 'Grievance Cell (Other)', icon: '🏛️', head: 'Admin Officer', phone: '1800-111-000' }
  ]});
});

module.exports = r;
