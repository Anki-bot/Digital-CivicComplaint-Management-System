/* JanSeva API bridge — talks to Express backend, falls back to localStorage demo when opened via file:// */
const API = {
  base: '',
  get token() { try { return localStorage.getItem('civic_token') || ''; } catch { return ''; } },
  set token(t) { try { t ? localStorage.setItem('civic_token', t) : localStorage.removeItem('civic_token'); } catch {} },
  get cachedUser() { try { return JSON.parse(localStorage.getItem('civic_current_user') || 'null'); } catch { return null; } },
  set cachedUser(u) { try { u ? localStorage.setItem('civic_current_user', JSON.stringify(u)) : localStorage.removeItem('civic_current_user'); } catch {} },
  async req(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {});
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const url = this.base + path;
    let res;
    try { res = await fetch(url, Object.assign({}, opts, { headers })); }
    catch { throw new Error('OFFLINE'); }
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },
  get serverMode() {
    return location.protocol.startsWith('http') && !location.href.includes('file://');
  }
};
async function apiRefreshMe() {
  if (!API.serverMode || !API.token) return API.cachedUser;
  try {
    const d = await API.req('/api/auth/me');
    API.cachedUser = d.user;
    return d.user;
  } catch { return API.cachedUser; }
}
