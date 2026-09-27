/* Maps via Leaflet + OSM, graceful offline fallback */
function leafletCSS(){ if(document.getElementById('leafletCss')) return; const l=document.createElement('link'); l.id='leafletCss'; l.rel='stylesheet'; l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l); }
function leafletJS(cb){ if(typeof L!=='undefined') return cb(); leafletCSS(); const s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload=cb; s.onerror=()=>cb(new Error('offline')); document.head.appendChild(s); }
function defaultCenter(){ return [28.6139,77.2090]; } // New Delhi default
function initPicker(mapId, latId, lngId){
  const box=document.getElementById(mapId); if(!box) return;
  leafletJS((err)=>{
    if(err || typeof L==='undefined'){ box.innerHTML='<p style="padding:20px;color:var(--muted)">📍 Map offline — enter location manually. Your complaint still works.</p>'; return; }
    const map=L.map(mapId).setView(defaultCenter(),12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    let marker=null;
    const set=(lat,lng)=>{ const la=document.getElementById(latId),ln=document.getElementById(lngId); if(la)la.value=lat.toFixed(5); if(ln)ln.value=lng.toFixed(5); };
    map.on('click',e=>{ if(marker) marker.setLatLng(e.latlng); else marker=L.marker(e.latlng,{draggable:true}).addTo(map).on('dragend',ev=>{const p=ev.target.getLatLng();set(p.lat,p.lng);}); set(e.latlng.lat,e.latlng.lng); });
    const geo=document.getElementById('useGeo');
    if(geo) geo.addEventListener('click',()=>{ if(!navigator.geolocation){showToast('Geolocation not supported.','error');return;} navigator.geolocation.getCurrentPosition(p=>{ const ll=[p.coords.latitude,p.coords.longitude]; map.setView(ll,15); if(marker)marker.setLatLng(ll); else marker=L.marker(ll,{draggable:true}).addTo(map); set(ll[0],ll[1]); showToast('Location captured.','success'); },()=>showToast('Location denied. Tap map manually.','error')); });
  });
}
function initPublicMap(mapId, max=50){
  const box=document.getElementById(mapId); if(!box||typeof getComplaints!=='function') return;
  leafletJS((err)=>{
    if(err||typeof L==='undefined'){ box.innerHTML='<p style="padding:20px;color:var(--muted)">Map unavailable offline.</p>'; return; }
    const map=L.map(mapId).setView(defaultCenter(),11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    getComplaints().filter(c=>c.lat&&c.lng).slice(0,max).forEach(c=>{ L.marker([+c.lat,+c.lng]).addTo(map).bindPopup(`<b>${escapeHTML(c.title)}</b><br>${escapeHTML(c.id)} • ${escapeHTML(c.status)}`); });
  });
}
