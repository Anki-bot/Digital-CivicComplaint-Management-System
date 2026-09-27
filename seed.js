// npm run seed — (re)initializes SQLite with schema + demo users + sample complaints.
const { init } = require('./config/db');

init()
  .then(() => { console.log('✅ Seed complete (users + sample complaints + announcements).'); process.exit(0); })
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); });
