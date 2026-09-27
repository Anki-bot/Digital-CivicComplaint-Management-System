const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { run, get } = require('../config/db');
const { sign, auth } = require('../middleware/auth');

const r = express.Router();

r.post('/register',
  body('name').isLength({ min: 3 }), body('email').isEmail().normalizeEmail(),
  body('phone').matches(/^[0-9]{10}$/), body('password').isLength({ min: 6 }),
  async (req, res) => {
    const e = validationResult(req);
    if (!e.isEmpty()) return res.status(400).json({ error: e.array()[0].msg });
    const { name, email, phone, password } = req.body;
    try {
      const exists = await get('SELECT id FROM users WHERE email=?', [email.toLowerCase()]);
      if (exists) return res.status(400).json({ error: 'Email already registered. Please login.' });
      const hash = bcrypt.hashSync(password, 10);
      const out = await run('INSERT INTO users(name,email,phone,pass_hash,role,created_at) VALUES(?,?,?,?,?,?)',
        [name.trim(), email.toLowerCase(), phone, hash, 'citizen', new Date().toISOString()]);
      const user = await get('SELECT id,name,email,phone,role,created_at FROM users WHERE id=?', [out.lastID]);
      res.json({ token: sign(user), user });
    } catch (err) { res.status(500).json({ error: 'Registration failed' }); }
  });

r.post('/login', body('email').isEmail(), async (req, res) => {
  const { email, password } = req.body;
  const u = await get('SELECT * FROM users WHERE email=?', [String(email || '').toLowerCase()]);
  if (!u || !bcrypt.compareSync(password || '', u.pass_hash))
    return res.status(401).json({ error: 'Invalid email or password.' });
  if (!u.active) return res.status(403).json({ error: 'Account disabled. Contact admin.' });
  const safe = { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, created_at: u.created_at };
  res.json({ token: sign(safe), user: safe });
});

r.get('/me', auth, (req, res) => res.json({ user: req.user }));

r.put('/profile', auth,
  body('name').optional().isLength({ min: 3 }), body('phone').optional().matches(/^[0-9]{10}$/),
  async (req, res) => {
    const e = validationResult(req);
    if (!e.isEmpty()) return res.status(400).json({ error: e.array()[0].msg });
    const { name, phone } = req.body;
    await run('UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone) WHERE id=?',
      [name || null, phone || null, req.user.id]);
    const u = await get('SELECT id,name,email,phone,role,created_at FROM users WHERE id=?', [req.user.id]);
    res.json({ user: u });
  });

r.post('/forgot', body('email').isEmail(), async (req, res) => {
  const u = await get('SELECT id FROM users WHERE email=?', [req.body.email.toLowerCase()]);
  if (!u) return res.json({ ok: true }); // don't leak
  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  await run('UPDATE users SET reset_token=? WHERE id=?', [token, u.id]);
  // Demo: return token directly (production would email it)
  res.json({ ok: true, resetToken: token });
});

r.post('/reset', async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password min 6 chars' });
  const u = await get('SELECT * FROM users WHERE email=?', [String(email || '').toLowerCase()]);
  if (!u || u.reset_token !== token) return res.status(400).json({ error: 'Invalid reset code' });
  await run('UPDATE users SET pass_hash=?, reset_token=NULL WHERE id=?', [bcrypt.hashSync(newPassword, 10), u.id]);
  res.json({ ok: true });
});

module.exports = r;
