# JanSeva Pro — Full-Stack Civic Complaint Management System

<p align="left">
  <a href="https://digital-civiccomplaint-management-s.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo on Vercel" />
  </a>
  <img src="https://img.shields.io/badge/Node.js-0D1117?style=for-the-badge&logo=nodedotjs&logoColor=339933" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-0D1117?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/SQLite_%2F_Postgres-0D1117?style=for-the-badge&logo=postgresql&logoColor=4169E1" alt="Database" />
  <img src="https://img.shields.io/badge/JWT_Auth-0D1117?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT" />
</p>

**JanSeva Pro** is an end-to-end civic grievance and SLA management platform built with **Node.js**, **Express**, and a **dual-mode SQLite/PostgreSQL database engine**. Citizens can file geo-tagged complaints with photo evidence, upvote community issues, and track real-time resolution timelines, while administrators triage, assign departments, and audit SLA compliance.

- **Live Deployment:** [digital-civiccomplaint-management-s.vercel.app](https://digital-civiccomplaint-management-s.vercel.app)

---

## 🚀 Quick Start (Local Development)

```bash
git clone [https://github.com/Anki-bot/Digital-CivicComplaint-Management-System.git](https://github.com/Anki-bot/Digital-CivicComplaint-Management-System.git)
cd Digital-CivicComplaint-Management-System
npm install
npm start
```
Open **http://localhost:3000**. Data persists automatically in `database.db` across restarts in local SQLite mode.

### Demo Credentials (Pre-seeded with bcrypt hashes)
| Role | Email | Password |
| :--- | :--- | :--- |
| **Citizen Portal** | `demo@citizen.com` | `Demo123!` |
| **Admin Dashboard** | `admin@civic.com` | `Admin123!` |

---

## 🏗️ Architecture & Core Capabilities

- **Backend & Security:** Express.js REST API with dual-mode persistence (SQLite locally, PostgreSQL when `DATABASE_URL` is configured), JWT authentication, `bcryptjs` password hashing, Base64 database photo persistence, `helmet` security headers, request rate-limiting, and full admin audit logging.
- **REST API Surface:**
  - `/api/auth/*` — Registration, JWT login, session verification, profile management, password reset.
  - `/api/complaints/*` — Multipart photo submission, public tracking, community upvoting, comments, and citizen star ratings.
  - `/api/admin/*` — Real-time KPI analytics, multi-filter triage, department routing, mandatory rejection remarks, user management, and CSV export.
  - `/api/announcements`, `/api/contact`, `/api/departments`, `/api/health`.
- **Responsive 14-Page Client (`public/`):** Features interactive map views, automated SLA countdowns, printable complaint receipts, dark mode, and Progressive Web App (PWA) manifest + service worker support.

---

## ⏱️ SLA Governance Matrix

- **Urgent:** 24 Hours
- **High:** 48 Hours
- **Medium:** 96 Hours
- **Low:** 168 Hours

Overdue tickets are automatically flagged and highlighted in the administrative triage queue.

---

## 📡 API Reference

| Module | Endpoints |
| :--- | :--- |
| **Health** | `GET /api/health` |
| **Authentication** | `POST /api/auth/register, /login` · `GET /api/auth/me` · `PUT /api/auth/profile` · `POST /api/auth/forgot, /reset` |
| **Complaints** | `POST /api/complaints` (multipart photo) · `GET /api/complaints/mine, /public, /map, /track/:id` · `PUT/DELETE /api/complaints/:id` · `POST /api/complaints/:id/upvote, /comments, /rating` |
| **Administration** | `GET /api/admin/stats, /complaints, /users, /audit` · `PUT /api/admin/complaints/:id, /users/:id` · `DELETE /api/admin/complaints/:id` · `GET /api/admin/export.csv` |
| **Public Services** | `GET /api/announcements, /departments` · `POST /api/announcements (admin), /api/contact` |

---

## ⚙️ Environment Variables

All environment variables are optional for local development:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP server listening port | `3000` |
| `JWT_SECRET` | Secret key for signing JWT tokens | Development fallback |
| `JWT_EXPIRES` | Token expiration window | `7d` |
| `DATABASE_URL` | PostgreSQL connection string (uses local SQLite if unset) | Unset |

---

## 📂 Project Structure

```text
├── config/db.js          # Dual-mode SQLite / PostgreSQL database adapter & schema init
├── middleware/           # JWT authentication guards & Multer image upload validation
├── routes/               # Modular Express routers (auth, complaints, admin, public)
├── public/               # 14-page responsive UI, dark-mode CSS, API client bridge & PWA
├── server.js             # Express application entry point & serverless export
├── seed.js               # Database seeding script for demo accounts and sample tickets
└── vercel.json           # Serverless routing configuration
```

## 📄 License
Distributed under the **MIT License**. See `LICENSE` for details.
