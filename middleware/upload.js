const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `proof-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
function fileFilter(req, file, cb) {
  if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files allowed'));
}
module.exports = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });
