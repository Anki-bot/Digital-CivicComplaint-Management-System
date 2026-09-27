const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
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
  await run(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    phone TEXT, pass_hash TEXT NOT NULL, role TEXT DEFAULT 'citizen',
    active INTEGER DEFAULT 1, reset_token TEXT, created_at TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS complaints(
    id TEXT PRIMARY KEY, user_id INTEGER, user_email TEXT, user_name TEXT,
    category TEXT, title TEXT, description TEXT, location TEXT, ward TEXT,
    priority TEXT DEFAULT 'Medium', lat TEXT DEFAULT '', lng TEXT DEFAULT '',
    anonymous INTEGER DEFAULT 0, photo_path TEXT DEFAULT '',
    status TEXT DEFAULT 'Pending', remark TEXT DEFAULT '',
    assigned_dept TEXT DEFAULT '', assigned_staff TEXT DEFAULT '',
    rating INTEGER DEFAULT 0, upvotes_count INTEGER DEFAULT 0,
    sla_due TEXT, created_at TEXT, updated_at TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS comments(
    id INTEGER PRIMARY KEY AUTOINCREMENT, complaint_id TEXT, user_name TEXT,
    text TEXT, created_at TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS upvotes(
    complaint_id TEXT, user_id INTEGER, created_at TEXT,
    UNIQUE(complaint_id, user_id))`);
  await run(`CREATE TABLE IF NOT EXISTS history(
    id INTEGER PRIMARY KEY AUTOINCREMENT, complaint_id TEXT,
    status TEXT, remark TEXT, date TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS announcements(
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, body TEXT, date TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS contacts(
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, message TEXT, date TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS audit(
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, action TEXT,
    complaint_id TEXT, detail TEXT, date TEXT)`);

  // Seed users
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
  if (!count || count.c === 0) {
    const samples = [
      ['roads', 'Potholes on MG Road', 'Multiple deep potholes near bus stop causing accidents.', 'MG Road, Ward 4', 'Ward 4', 'High', '28.6139', '77.2090', 'In Progress', 'Work order issued to PWD.'],
      ['streetlight', 'Streetlight not working', 'Streetlight pole 12B not working for 5 days.', 'Gandhi Nagar Lane 2', 'Ward 2', 'Medium', '', '', 'Pending', ''],
      ['sanitation', 'Garbage not collected', 'Garbage bin overflowing near market.', 'Central Market', 'Ward 1', 'Urgent', '', '', 'Resolved', 'Cleared by sanitation team.']
    ];
    for (let i = 0; i < samples.length; i++) {
      const [cat, title, desc, loc, ward, pri, lat, lng, status, remark] = samples[i];
      const id = `CIV-${new Date().getFullYear()}-${1001 + i}`;
      const created = new Date(Date.now() - (i + 1) * 86400000).toISOString();
      const updated = new Date(Date.now() - i * 86400000).toISOString();
      await run(`INSERT OR IGNORE INTO complaints(id,user_id,user_email,user_name,category,title,description,location,ward,priority,lat,lng,status,remark,assigned_dept,sla_due,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, demoId, 'demo@citizen.com', 'Demo Citizen', cat, title, desc, loc, ward, pri, lat, lng, status, remark, deptForCategory(cat), slaDue(created, pri), created, updated]);
      await run('INSERT INTO history(complaint_id,status,remark,date) VALUES(?,?,?,?)', [id, 'Pending', 'Complaint registered', created]);
      await run('INSERT INTO history(complaint_id,status,remark,date) VALUES(?,?,?,?)', [id, status, remark || status, updated]);
    }
  }
  const ac = await get('SELECT COUNT(*) c FROM announcements');
  if (!ac || ac.c === 0) {
    const now = new Date().toISOString();
    await run('INSERT INTO announcements(title,body,date) VALUES(?,?,?)', ['Monsoon helpline active', 'Report waterlogging on priority — SLA reduced to 24 hrs during rains.', now]);
    await run('INSERT INTO announcements(title,body,date) VALUES(?,?,?)', ['Mega sanitation drive Saturday', 'Ward 1–4 garbage backlog clearance this weekend.', now]);
  }
}

module.exports = { db, run, get, all, slaDue, deptForCategory, complaintId, init };
