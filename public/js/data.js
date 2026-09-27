/* JanSeva Pro data layer v2 — backward compatible with v1 localStorage */
const DB = { users:'civic_users', complaints:'civic_complaints', session:'civic_session', announce:'civic_announce', notif:'civic_notif', prefs:'civic_prefs' };
const CATEGORIES = ['roads','water','electricity','sanitation','streetlight','other'];
const CATEGORY_LABELS = { roads:'Roads & Potholes', water:'Water Supply', electricity:'Electricity', sanitation:'Sanitation / Garbage', streetlight:'Streetlight', other:'Other' };
const CATEGORY_ICONS = { roads:'🛣️', water:'💧', electricity:'⚡', sanitation:'🧹', streetlight:'💡', other:'📦' };
const STATUSES = ['Pending','In Progress','Resolved','Rejected'];
const PRIORITIES = ['Low','Medium','High','Urgent'];
const DEPARTMENTS = [
  { id:'pwd', name:'Public Works (Roads)', icon:'🛣️', head:'Er. R. Verma', phone:'1800-111-001' },
  { id:'water', name:'Water Supply Board', icon:'💧', head:'S. Iyer', phone:'1800-111-002' },
  { id:'power', name:'Electricity Dept', icon:'⚡', head:'K. Rao', phone:'1800-111-003' },
  { id:'sanitation', name:'Sanitation & Health', icon:'🧹', head:'Dr. M. Khan', phone:'1800-111-004' },
  { id:'lighting', name:'Streetlighting Cell', icon:'💡', head:'P. Nair', phone:'1800-111-005' },
  { id:'general', name:'Grievance Cell (Other)', icon:'🏛️', head:'Admin Officer', phone:'1800-111-000' }
];
const SLA_HOURS = { Low:168, Medium:96, High:48, Urgent:24 };
const WARDS = ['Ward 1','Ward 2','Ward 3','Ward 4','Ward 5','Ward 6','Ward 7','Ward 8'];

function readJSON(k,f){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):f; }catch{ return f; } }
function writeJSON(k,v){ localStorage.setItem(k,JSON.stringify(v)); }
function getUsers(){ return readJSON(DB.users,[]); }
function saveUsers(u){ writeJSON(DB.users,u); }
function getComplaints(){ return readJSON(DB.complaints,[]); }
function saveComplaints(c){ writeJSON(DB.complaints,c); }
function getSession(){ return readJSON(DB.session,null); }
function setSession(email){ email?localStorage.setItem(DB.session,JSON.stringify({email})):localStorage.removeItem(DB.session); }
function getAnnouncements(){ return readJSON(DB.announce,[]); }
function saveAnnouncements(a){ writeJSON(DB.announce,a); }
function getNotifs(){ return readJSON(DB.notif,[]); }
function pushNotif(email,title,body){ const n=getNotifs(); n.unshift({email,title,body,date:new Date().toISOString(),read:false}); writeJSON(DB.notif,n.slice(0,100)); }
function myNotifs(email){ return getNotifs().filter(n=>!n.email||n.email===email).slice(0,10); }
function escapeHTML(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatDate(iso){ try{ return new Date(iso).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch{ return iso; } }
function hoursBetween(a,b){ return (new Date(b)-new Date(a))/36e5; }
function slaDueFor(createdAt,priority){ const h=SLA_HOURS[priority]||96; return new Date(new Date(createdAt).getTime()+h*36e5).toISOString(); }
function isOverdue(c){ if(c.status==='Resolved'||c.status==='Rejected') return false; return new Date() > new Date(c.slaDue || slaDueFor(c.createdAt,c.priority||'Medium')); }
function priorityClass(p){ return p==='Urgent'?'b-urgent':p==='High'?'b-high':p==='Medium'?'b-medium':'b-low'; }
function generateComplaintId(existing){ const y=new Date().getFullYear(); let id; do{ id=`CIV-${y}-${Math.floor(1000+Math.random()*9000)}`;}while(existing.some(c=>c.id===id)); return id; }
function statusClass(s){ return s==='Pending'?'b-pending':s==='In Progress'?'b-progress':s==='Resolved'?'b-resolved':s==='Rejected'?'b-rejected':'b-default'; }
function deptForCategory(cat){ return cat==='roads'?'pwd':cat==='water'?'water':cat==='electricity'?'power':cat==='sanitation'?'sanitation':cat==='streetlight'?'lighting':'general'; }
function migrateComplaints(){
  const all=getComplaints(); let changed=false;
  all.forEach(c=>{
    if(!c.priority){ c.priority='Medium'; changed=true; }
    if(!c.slaDue){ c.slaDue=slaDueFor(c.createdAt,c.priority); changed=true; }
    if(!Array.isArray(c.upvotes)){ c.upvotes=[]; changed=true; }
    if(!Array.isArray(c.comments)){ c.comments=[]; changed=true; }
    if(c.rating===undefined){ c.rating=0; changed=true; }
    if(!c.ward){ c.ward='Ward 4'; changed=true; }
    if(c.lat===undefined){ c.lat=''; c.lng=''; changed=true; }
    if(!c.assignedDept){ c.assignedDept=deptForCategory(c.category); changed=true; }
    if(c.assignedStaff===undefined){ c.assignedStaff=''; changed=true; }
    if(c.anonymous===undefined){ c.anonymous=false; changed=true; }
  });
  if(changed) saveComplaints(all);
}
function seedIfNeeded(){
  let users=getUsers();
  if(!users.some(u=>u.email==='admin@civic.com')) users.push({name:'Admin Officer',email:'admin@civic.com',phone:'9999999999',pass:btoa('Admin123!'),role:'admin',createdAt:new Date().toISOString()});
  if(!users.some(u=>u.email==='demo@citizen.com')) users.push({name:'Demo Citizen',email:'demo@citizen.com',phone:'9876543210',pass:btoa('Demo123!'),role:'citizen',createdAt:new Date().toISOString()});
  saveUsers(users);
  let complaints=getComplaints();
  if(complaints.length===0){
    const now=Date.now();
    const samples=[
      {userEmail:'demo@citizen.com',userName:'Demo Citizen',category:'roads',title:'Potholes on MG Road',description:'Multiple deep potholes near bus stop causing accidents.',location:'MG Road, Ward 4',ward:'Ward 4',priority:'High',status:'In Progress',remark:'Work order issued to PWD.',lat:'28.6139',lng:'77.2090'},
      {userEmail:'demo@citizen.com',userName:'Demo Citizen',category:'streetlight',title:'Streetlight not working',description:'Streetlight pole 12B not working for 5 days.',location:'Gandhi Nagar Lane 2',ward:'Ward 2',priority:'Medium',status:'Pending',remark:'',lat:'',lng:''},
      {userEmail:'demo@citizen.com',userName:'Demo Citizen',category:'sanitation',title:'Garbage not collected',description:'Garbage bin overflowing near market.',location:'Central Market',ward:'Ward 1',priority:'Urgent',status:'Resolved',remark:'Cleared by sanitation team.',rating:5,lat:'',lng:''}
    ];
    const seeded=samples.map((s,i)=>{ const created=new Date(now-(i+1)*86400000).toISOString(); return { id:`CIV-${new Date().getFullYear()}-${1001+i}`, photo:'', upvotes:['demo@citizen.com'], comments:[{by:'Admin Officer',text:'We have noted this issue.',date:new Date(now-i*86400000).toISOString()}], assignedDept:deptForCategory(s.category), assignedStaff:'', anonymous:false, slaDue:slaDueFor(created,s.priority), updatedAt:new Date(now-i*86400000).toISOString(), createdAt:created, history:[{status:'Pending',date:created,remark:'Complaint registered'},{status:s.status,date:new Date(now-i*86400000).toISOString(),remark:s.remark||s.status}], ...s }; });
    saveComplaints(seeded);
  } else migrateComplaints();
  if(getAnnouncements().length===0) saveAnnouncements([
    {title:'Monsoon helpline active',body:'Report waterlogging on priority — SLA reduced to 24 hrs during rains.',date:new Date().toISOString()},
    {title:'Mega sanitation drive Saturday',body:'Ward 1–4 garbage backlog clearance this weekend.',date:new Date().toISOString()}
  ]);
  migrateComplaints();
}
document.addEventListener('DOMContentLoaded',seedIfNeeded);
