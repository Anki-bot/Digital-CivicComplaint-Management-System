try { require('dotenv').config(); } catch {}
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { init } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));

// Uploads + frontend
const upDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(upDir)) fs.mkdirSync(upDir, { recursive: true });
app.use('/uploads', express.static(upDir));
app.use(express.static(path.join(__dirname, 'public')));

// APIs
app.use('/api/auth', require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// CSV export (admin/staff)
app.get('/api/admin/export.csv', async (req, res) => {
  const { auth, adminOnly } = require('./middleware/auth');
  await new Promise((resolve) => auth(req, res, resolve));
  if (!req.user) return;
  if (req.user.role !== 'admin' && req.user.role !== 'staff') return res.status(403).send('forbidden');
  const { all } = require('./config/db');
  const rows = await all('SELECT * FROM complaints ORDER BY created_at DESC');
  const head = 'ID,Title,Category,Ward,Priority,Status,Location,User,Created,Rating,Upvotes';
  const lines = rows.map(c => [c.id, `"${(c.title || '').replace(/"/g, '""')}"`, c.category, c.ward, c.priority, c.status, `"${(c.location || '').replace(/"/g, '""')}"`, c.user_email, c.created_at, c.rating || 0, c.upvotes_count || 0].join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=janseva-complaints.csv');
  res.send([head, ...lines].join('\n'));
});

// Central error handler: clean 400 JSON for upload/validation errors (not 500 HTML)
const multer = require('multer');
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image must be under 2MB.' });
    return res.status(400).json({ error: err.message });
  }
  if (err && /Only image files allowed/.test(err.message || '')) return res.status(400).json({ error: 'Only image files allowed.' });
  if (err) return res.status(400).json({ error: err.message || 'Request failed' });
  next();
});

// SPA fallback to public HTML
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  const f = path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return res.sendFile(f);
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

init().then(() => {
  app.listen(PORT, () => console.log(`✅ JanSeva full-stack live at http://localhost:${PORT}`));
}).catch(err => { console.error('DB init failed', err); process.exit(1); });
