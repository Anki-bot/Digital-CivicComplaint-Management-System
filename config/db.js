/* Dual-mode DB: Postgres (pg) when DATABASE_URL is set, SQLite file otherwise.
   Same exported API: run/get/all/slaDue/deptForCategory/complaintId/init.
   run() resolves { lastID } in both modes. `?` placeholders auto-convert to $n for pg. */
const path = require('path');
const bcrypt = require('bcryptjs');

const USE_PG = !!process.env.DATABASE_URL;
let pgPool = null;
let sqliteDb = null;

if (USE_PG) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  const sqlite3 = require('sqlite3').verbose();
  sqliteDb = new sqlite3.Database(path.join(__dirname, '..', 'database.db'));
}

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function run(sql, params = []) {
  if (USE_PG) {
    return (async () => {
      let q = toPg(sql);
      let wantId = /^\s*insert/i.test(sql) && !/returning/i.test(sql) && !/\bupvotes\b/i.test(sql);
      if (wantId) q += ' RETURNING id';
      const r = await pgPool.query(q, params);
      const row = r.rows && r.rows[0];
      return { lastID: row && row.id !== undefined ? row.id : undefined, changes: r.rowCount };
    })();
  }
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
  });
}
function get(sql, params = []) {
  if (USE_PG) return pgPool.query(toPg(sql), params).then(r => r.rows[0] || null);
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function all(sql, params = []) {
  if (USE_PG) return pgPool.query(toPg(sql), params).then(r => r.rows);
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

const SLA_HOURS = { Low: 168, Medium: 96, High: 48, Urgent: 24 };
function slaDue(createdAt, priority) {
  const h = SLA_HOURS[priority] || 96;
  return new Date(new Date(createdAt).getTime() + h * 36e5).toISOString();
}
function deptForCategory(cat) {
  return cat === 'roads' ? 'pwd' : cat === 'water' ? 'water'
    : cat === 'electricity' ? 'power' : cat === 'sanitation' ? 'sanitation'
    : cat === 'streetlight' ? 'lighting' : 'general';
}
function complaintId() {
  const y = new Date().getFullYear();
  return `CIV-${y}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function init() {
  const AI = USE_PG ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  await run(`CREATE TABLE IF NOT EXISTS users(
    id ${AI}, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    phone TEXT, pass_hash TEXT NOT NULL, role TEXT DEFAULT 'citizen',
    active INTEGER DEFAULT 1, reset_token TEXT, created_at TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS complaints(
    id TEXT PRIMARY KEY, user_id INTEGER, user_email TEXT, user_name TEXT,
    category TEXT, title TEXT, description TEXT, location TEXT, ward TEXT,
    priority TEXT DEFAULT 'Medium', lat TEXT DEFAULT '', lng TEXT DEFAULT '',
    anonymous INTEGER DEFAULT 0, photo_path TEXT DEFAULT '', photo_data TEXT DEFAULT '',
    status TEXT DEFAULT 'Pending', remark TEXT DEFAULT '',
    assigned_dept TEXT DEFAULT '', assigned_staff TEXT DEFAULT '',
    rating INTEGER DEFAULT 0, upvotes_count INTEGER DEFAULT 0,
    sla_due TEXT, created_at TEXT, updated_at TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS comments(
    id ${AI}, complaint_id TEXT, user_name TEXT,
    text TEXT, created_at TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS upvotes(
    complaint_id TEXT, user_id INTEGER, created_at TEXT,
    UNIQUE(complaint_id, user_id))`);
  await run(`CREATE TABLE IF NOT EXISTS history(
    id ${AI}, complaint_id TEXT,
    status TEXT, remark TEXT, date TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS announcements(
    id ${AI}, title TEXT, body TEXT, date TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS contacts(
    id ${AI}, email TEXT, message TEXT, date TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS audit(
    id ${AI}, actor TEXT, action TEXT,
    complaint_id TEXT, detail TEXT, date TEXT)`);
  // photo_data migration for DBs created before this column existed
  try {
    if (USE_PG) await run('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS photo_data TEXT DEFAULT ?', ['']);
    else {
      const cols = await all('PRAGMA table_info(complaints)');
      if (!cols.some(c => c.name === 'photo_data')) await run('ALTER TABLE complaints ADD COLUMN photo_data TEXT DEFAULT ?', ['']);
    }
  } catch {}

  const admin = await get('SELECT * FROM users WHERE email=?', ['admin@civic.com']);
  if (!admin) {
    await run('INSERT INTO users(name,email,phone,pass_hash,role,created_at) VALUES(?,?,?,?,?,?)',
      ['Admin Officer', 'admin@civic.com', '9999999999', bcrypt.hashSync('Admin123!', 10), 'admin', new Date().toISOString()]);
  }
  const demo = await get('SELECT * FROM users WHERE email=?', ['demo@citizen.com']);
  let demoId;
  if (!demo) {
    const r = await run('INSERT INTO users(name,email,phone,pass_hash,role,created_at) VALUES(?,?,?,?,?,?)',
      ['Demo Citizen', 'demo@citizen.com', '9876543210', bcrypt.hashSync('Demo123!', 10), 'citizen', new Date().toISOString()]);
    demoId = r.lastID;
  } else demoId = demo.id;

  const count = await get('SELECT COUNT(*) c FROM complaints');
  if (!count || Number(count.c) === 0) {
    const samples = [
      ['roads', 'Potholes on MG Road', 'Multiple deep potholes near bus stop causing accidents.', 'MG Road, Ward 4', 'Ward 4', 'High', '28.6139', '77.2090', 'In Progress', 'Work order issued to PWD.'],
      ['streetlight', 'Streetlight not working', 'Streetlight pole 12B not working for 5 days.', 'Gandhi Nagar Lane 2', 'Ward 2', 'Medium', '', '', 'Pending', ''],
      ['sanitation', 'Garbage not collected', 'Garbage bin overflowing near market.', 'Central Market', 'Ward 1', 'Urgent', '', '', 'Resolved', 'Cleared by sanitation team.']
    ];
    const ignoreInto = (cols, placeholders) => USE_PG
      ? `INSERT INTO complaints(${cols}) VALUES(${placeholders}) ON CONFLICT(id) DO NOTHING`
      : `INSERT OR IGNORE INTO complaints(${cols}) VALUES(${placeholders})`;
    for (let i = 0; i < samples.length; i++) {
      const [cat, title, desc, loc, ward, pri, lat, lng, status, remark] = samples[i];
      const id = `CIV-${new Date().getFullYear()}-${1001 + i}`;
      const created = new Date(Date.now() - (i + 1) * 86400000).toISOString();
      const updated = new Date(Date.now() - i * 86400000).toISOString();
      await run(ignoreInto('id,user_id,user_email,user_name,category,title,description,location,ward,priority,lat,lng,status,remark,assigned_dept,sla_due,created_at,updated_at', '?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?'),
        [id, demoId, 'demo@citizen.com', 'Demo Citizen', cat, title, desc, loc, ward, pri, lat, lng, status, remark, deptForCategory(cat), slaDue(created, pri), created, updated]);
      await run('INSERT INTO history(complaint_id,status,remark,date) VALUES(?,?,?,?)', [id, 'Pending', 'Complaint registered', created]);
      await run('INSERT INTO history(complaint_id,status,remark,date) VALUES(?,?,?,?)', [id, status, remark || status, updated]);
    }
  }
  const ac = await get('SELECT COUNT(*) c FROM announcements');
  if (!ac || Number(ac.c) === 0) {
    const now = new Date().toISOString();
    await run('INSERT INTO announcements(title,body,date) VALUES(?,?,?)', ['Monsoon helpline active', 'Report waterlogging on priority — SLA reduced to 24 hrs during rains.', now]);
    await run('INSERT INTO announcements(title,body,date) VALUES(?,?,?)', ['Mega sanitation drive Saturday', 'Ward 1–4 garbage backlog clearance this weekend.', now]);
  }
}

module.exports = { db: sqliteDb, run, get, all, slaDue, deptForCategory, complaintId, init, USE_PG };
