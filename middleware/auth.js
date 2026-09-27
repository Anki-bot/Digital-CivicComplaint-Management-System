const jwt = require('jsonwebtoken');
const { get } = require('../config/db');
const SECRET = process.env.JWT_SECRET || 'janseva_super_secret_change_me';

function sign(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}
async function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    const p = jwt.verify(token, SECRET);
    const u = await get('SELECT id,name,email,phone,role,active,created_at FROM users WHERE id=?', [p.id]);
    if (!u || !u.active) return res.status(401).json({ error: 'Account disabled' });
    req.user = u;
    next();
  } catch { return res.status(401).json({ error: 'Session expired. Please login again.' }); }
}
function adminOnly(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'staff'))
    return res.status(403).json({ error: 'Admin access required' });
  next();
}
module.exports = { sign, auth, adminOnly };
