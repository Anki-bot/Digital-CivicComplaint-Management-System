/* Auth Pro — real backend JWT with localStorage fallback for file:// demo */
function currentUser() {
  try {
    if (typeof API !== 'undefined' && API.serverMode) return API.cachedUser;
  } catch {}
  try {
    const s = getSession();
    if (!s) return null;
    return getUsers().find(u => u.email === s.email) || null;
  } catch { return null; }
}
function isAdmin() { const u = currentUser(); return !!(u && (u.role === 'admin' || u.role === 'staff')); }
function isSuperAdmin() { const u = currentUser(); return !!(u && u.role === 'admin'); }

function legacyRegister({ name, email, phone, password }) {
  email = email.trim().toLowerCase();
  const users = getUsers();
  if (users.some(u => u.email === email)) return { ok: false, msg: 'Email already registered. Please login.' };
  users.push({ name: name.trim(), email, phone: phone.trim(), pass: btoa(password), role: 'citizen', createdAt: new Date().toISOString() });
  saveUsers(users); setSession(email);
  return { ok: true, user: users.find(u => u.email === email) };
}
function legacyLogin(email, password) {
  email = email.trim().toLowerCase();
  const u = getUsers().find(x => x.email === email);
  if (!u || u.pass !== btoa(password)) return { ok: false, msg: 'Invalid email or password.' };
  setSession(email);
  return { ok: true, user: u };
}

async function doRegister({ name, email, phone, password }) {
  if (typeof API !== 'undefined' && API.serverMode) {
    try {
      const d = await API.req('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password })
      });
      API.token = d.token; API.cachedUser = d.user;
      return { ok: true, user: d.user };
    } catch (e) {
      if (e.message !== 'OFFLINE') return { ok: false, msg: e.message };
    }
  }
  return legacyRegister({ name, email, phone, password });
}
async function doLogin(email, password) {
  if (typeof API !== 'undefined' && API.serverMode) {
    try {
      const d = await API.req('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      API.token = d.token; API.cachedUser = d.user;
      return { ok: true, user: d.user };
    } catch (e) {
      if (e.message !== 'OFFLINE') return { ok: false, msg: e.message };
    }
  }
  return legacyLogin(email, password);
}
function doLogout() {
  try { if (typeof API !== 'undefined') { API.token = null; API.cachedUser = null; } } catch {}
  try { setSession(null); } catch {}
  window.location.href = 'index.html';
}
function requireAuth() {
  if (!currentUser()) { window.location.href = 'login.html'; return false; }
  return true;
}
function requireAdmin() {
  const u = currentUser();
  if (!u) { window.location.href = 'login.html'; return false; }
  if (u.role !== 'admin' && u.role !== 'staff') { window.location.href = 'dashboard.html'; return false; }
  return true;
}
document.addEventListener('DOMContentLoaded', async () => {
  try { if (typeof apiRefreshMe === 'function') await apiRefreshMe(); } catch {}
  try { if (typeof setupNavbar === 'function') setupNavbar(); } catch {}
});
