# JanSeva Pro — Full-Stack Civic Complaint Management (Node + Express + SQLite)

Complete website: real server, real database, real auth, real uploads. Same premium UI you approved, now backed by APIs.

## Run (2 commands)
```bash
cd civic-complaint-system
npm install
npm start
```
Open **http://localhost:3000**. Data persists in `database.db` across restarts.

## Demo logins (seeded in SQLite with bcrypt hashes)
- Citizen: `demo@citizen.com` / `Demo123!`
- Admin: `admin@civic.com` / `Admin123!`

## What makes it full-stack (not just frontend)
- **Backend:** Express + SQLite (`database.db` auto-created), JWT auth, bcrypt passwords, multer photo uploads in `uploads/`, validation, rate-limit, helmet, audit log
- **APIs:** `/api/auth/*` (register/login/me/profile/forgot/reset), `/api/complaints/*` (file w/ photo, mine, track public, upvote, comment, rate, edit/delete), `/api/admin/*` (stats, filtered list, status+remark w/ reject-reason rule, assign, users, CSV export), `/api/announcements`, `/api/contact`, `/api/departments`, `/api/health`
- **Frontend in `public/`:** all 14 pages unchanged in look; `js/api.js` bridge uses JWT + fetch when served over HTTP, falls back to localStorage demo when opened via `file://`
- **Complete website things:** navbar/footer everywhere, about/departments/contact (saved to DB)/faq/privacy/404, SEO meta, PWA manifest+SW, dark mode, maps, SLA, receipts, share, contact helpline

## Key flows (all verified)
Register → login (JWT) → file with photo/map → track by ID → upvote/comment → admin assign → resolve+remark → star rating → CSV export. Rejected status requires a reason. Only Pending own complaints editable/deletable.

## Files
`server.js, seed.js, package.json, .env(.example), config/db.js, middleware/auth.js, middleware/upload.js, routes/auth|complaints|admin|public.js, public/* (UI: 14 pages + css + js + assets), uploads/, database.db (gitignored, auto-created)`

## SLA
Urgent 24h • High 48h • Medium 96h • Low 168h. Overdue cases highlight red for admins.

## API quick table
| Area | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/register, /login` · `GET /api/auth/me` · `PUT /api/auth/profile` · `POST /api/auth/forgot, /reset` |
| Complaints | `POST /api/complaints` (multipart photo) · `GET /api/complaints/mine, /public, /map, /track/:id` · `PUT/DELETE /api/complaints/:id` · `POST /api/complaints/:id/upvote, /comments, /rating` |
| Admin | `GET /api/admin/stats, /complaints, /users, /audit` · `PUT /api/admin/complaints/:id, /users/:id` · `DELETE /api/admin/complaints/:id` · `GET /api/admin/export.csv` |
| Public | `GET /api/announcements, /departments` · `POST /api/announcements (admin), /api/contact` |

## Screenshots
Add `docs/*.png` (home, file form, track timeline, admin dashboard) before sharing the repo link.

## License
MIT — see `LICENSE`.
