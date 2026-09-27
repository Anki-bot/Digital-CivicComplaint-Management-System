/* Memory upload: file buffer → Base64 data-URL stored in DB (photo_data).
   Zero cloud keys, persists wherever the DB persists (SQLite file, Postgres, Vercel). */
const multer = require('multer');

function fileFilter(req, file, cb) {
  if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files allowed'));
}
module.exports = multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

/* Build a data-URL from a multer memory file. Returns '' when no file. */
function toDataURL(file) {
  if (!file || !file.buffer) return '';
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}
module.exports.toDataURL = toDataURL;
