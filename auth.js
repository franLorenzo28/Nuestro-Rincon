import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const $ = s => document.querySelector(s);
const screen = $('#auth-screen');
const bar = $('#account-bar');
const appNodes = [$('.nav'), $('main'), $('.pf')];
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL)
  && SUPABASE_PUBLISHABLE_KEY.length > 20 && !SUPABASE_PUBLISHABLE_KEY.includes('TU-');
const db = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
let user = null, pair = null, store = null, profileDialog = null;
let realtimeChannel = null, loadedApp = false;

const GAMES = {puzzle:'Puzzle', wordle:'Wordle', conex:'Conexiones', memotest:'Memotest', misterio:'Misterio', caja:'Caja fuerte'};
const POINTS = {puzzle:30, wordle:20, conex:20, memotest:15, misterio:10, caja:5};
const BADGES = [
  ['primera_carta','💌','Primera carta'], ['primer_plan','📌','Primer plan'],
  ['primer_juego','⭐','Primer triunfo'], ['puzzle','🧩','Rompecabezas'],
  ['wordle','🔤','Palabra ganadora'], ['conex','🧠','Conexiones'],
  ['memotest','🎴','Memoria de oro'], ['misterio','🔎','Detective'],
  ['caja','🔐','Caja abierta'], ['tres_juegos','🏆','Campeón arcade']
];
const REWARDS = [[50,'🌷','Sello de primavera'],[100,'🎀','Cinta de plata'],[200,'🏆','Trofeo dorado'],[350,'👑','Leyenda del arcade']];
const isShared = k => /^(todo|ver|metas|canciones|playlist|notas|caja|vis-[a-z]+)$/.test(k);
const safe = str => String(str).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(message) { const e=$('#cloud-status'); if(e) e.textContent=message; }
function showOnlyAccess() {
  appNodes.forEach(n => n.hidden=true); bar.hidden=true; screen.hidden=false;
}
function showAuth(msg='') {
  showOnlyAccess();
  screen.innerHTML=`<h2>Bienvenidos a Nuestro Rincón</h2>
    <p>Creá tu perfil con un nombre. No hace falta correo, contraseña ni verificación.</p>
    <form id="login-form">
      <label for="login-name">Tu nombre</label>
      <input id="login-name" maxlength="30" autocomplete="nickname" placeholder="Cómo querés aparecer" required>
      <div class="acc"><button class="btn" type="submit">Crear mi perfil</button></div>
    </form>
    <p class="auth-msg" id="auth-msg" role="status"></p>
    <p class="access-warning">Tu perfil queda vinculado a este navegador. No uses modo incógnito ni borres los datos del sitio: sin correo no vas a poder recuperar este perfil en otro dispositivo.</p>`;
  const f=$('#login-form'), info=$('#auth-msg'); info.textContent=msg;
  if(!db){f.querySelectorAll('input,button').forEach(n=>n.disabled=true);
    info.textContent='Configurá config.js con la URL y clave pública (publishable / anon) de Supabase.';return;}
  f.addEventListener('submit',async e=>{
    e.preventDefault();
    const displayName=$('#login-name').value.trim();
    if(!displayName){info.textContent='Escribí tu nombre para continuar.';return;}
    const button=f.querySelector('button');button.disabled=true;info.textContent='Creando tu perfil…';
    try{
      const {data,error}=await db.auth.signInAnonymously({options:{data:{display_name:displayName}}});
      if(error)throw error;
      if(!data.user)throw new Error('No se pudo crear el perfil.');
      await openApp(data.user);
    }catch(err){info.textContent='No se pudo crear el perfil: '+err.message;
      button.disabled=false;}
  });
}

async function pairOf(uid) {
  const {data,error}=await db.from('pair_members').select('pair_id').eq('user_id',uid).maybeSingle();
  if(error)throw error;
  if(!data) return null;
  const {data:room,error:err}=await db.from('pairs').select('id,invite_code').eq('id',data.pair_id).single();
  if(err)throw err;
  return room;
}
async function showPairSetup() {
  showOnlyAccess();
  screen.innerHTML=`<h2>Conecten sus perfiles</h2>
    <p>Una persona crea el rincón y comparte el código con la otra. Los datos compartidos se actualizan en vivo.</p>
    <div class="acc"><button id="create-pair" class="btn" type="button">Crear nuestro rincón</button></div>
    <form id="join-form"><label for="invite">Código de invitación</label>
      <input id="invite" maxlength="12" autocapitalize="characters" placeholder="12 caracteres" required>
      <div class="acc"><button class="btn s" type="submit">Unirme al rincón</button></div></form>
    <p id="pair-msg" class="auth-msg" role="status"></p>
    <p class="access-warning">Este perfil se guarda en este navegador. Evitá el modo incógnito y no borres los datos del sitio para conservarlo.</p>`;
  const message=$('#pair-msg');
  $('#create-pair').onclick=async()=>{const b=$('#create-pair');b.disabled=true;message.textContent='Creando…';
    try{const {error}=await db.rpc('nr_create_pair');if(error)throw error;
      pair=await pairOf(user.id);await openRoom();}
    catch(err){message.textContent=err.message;b.disabled=false;}};
  $('#join-form').onsubmit=async e=>{e.preventDefault(); const b=$('#join-form button');b.disabled=true;
    try{const code=$('#invite').value.trim().toUpperCase();const {error}=await db.rpc('nr_join_pair',{p_invite_code:code});
      if(error)throw error;pair=await pairOf(user.id);await openRoom();}
    catch(err){message.textContent='No se pudo vincular: '+err.message;b.disabled=false;}};
}

function createStore() {
  const values=new Map(), subscribers=new Map(), pending=new Map();
  const cacheKey='nr-outbox-'+user.id, listeners=[];
  let timer=null, busy=false, stopped=false;
  // Pendientes locales del dispositivo, separados por cuenta: si no hay internet,
  // los cambios se conservan y se intentan subir al reconectar.
  try {const old=JSON.parse(localStorage.getItem(cacheKey)||'{}');
    Object.entries(old).forEach(([k,v])=>{if(/^[a-zA-Z0-9_-]{1,100}$/.test(k))pending.set(k,v);});
  }catch{}
  const persist = () => {try{localStorage.setItem(cacheKey,JSON.stringify(Object.fromEntries(pending)));}catch{status('Almacenamiento local bloqueado');}};
  const emit=(k,v)=>{for(const cb of subscribers.get(k)||[])try{cb(v);}catch(e){console.warn('Vista',e);}};
  async function initialize() {
    const [a,b]=await Promise.all([
      db.from('shared_entries').select('key,value').eq('pair_id',pair.id),
      db.from('user_entries').select('key,value').eq('user_id',user.id)
    ]);
    if(a.error)throw a.error;if(b.error)throw b.error;
    [...a.data,...b.data].forEach(row=>values.set(row.key,row.value));
    // No pisar cambios que estaban sin sincronizar en este equipo.
    for(const [k,v] of pending)values.set(k,v);
    if(pending.size)schedule();
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(flush,500);}
  async function flush(){
    if(stopped||busy||!pending.size)return;
    busy=true;const snapshot=[...pending];status('Guardando…');
    try{
      const shared=snapshot.filter(([k])=>isShared(k)).map(([key,value])=>({pair_id:pair.id,key,value,updated_by:user.id}));
      const personal=snapshot.filter(([k])=>!isShared(k)).map(([key,value])=>({user_id:user.id,key,value}));
      if(shared.length){const {error}=await db.from('shared_entries').upsert(shared,{onConflict:'pair_id,key'});if(error)throw error;}
      if(personal.length){const {error}=await db.from('user_entries').upsert(personal,{onConflict:'user_id,key'});if(error)throw error;}
      for(const [k,v] of snapshot) if(JSON.stringify(pending.get(k))===JSON.stringify(v))pending.delete(k);
      persist();status(pending.size?'Cambios pendientes…':'Sincronizado ✓');
    }catch(err){status('Sin conexión o error al guardar'); console.warn('Error de sincronización',err);}
    finally{busy=false;if(pending.size&&snapshot.some(([k,v])=>JSON.stringify(pending.get(k))!==JSON.stringify(v)))schedule();}
  }
  const online=()=>{void flush();};
  window.addEventListener('online',online);
  async function pull() {
    const {data,error}=await db.from('shared_entries').select('key,value').eq('pair_id',pair.id);
    if(error)return;
    for(const row of data){if(pending.has(row.key))continue;
      if(JSON.stringify(values.get(row.key))!==JSON.stringify(row.value)){values.set(row.key,row.value);emit(row.key,row.value);}}
  }
  return {
    initialize,
    get:(k,defaultValue)=>values.has(k)?values.get(k):defaultValue,
    set:(k,v)=>{if(!/^[a-zA-Z0-9_-]{1,100}$/.test(k))return false;
      values.set(k,structuredClone(v));pending.set(k,structuredClone(v));persist();schedule();status('Pendiente…');return true;},
    onChange:(k,cb)=>{if(!subscribers.has(k))subscribers.set(k,new Set());subscribers.get(k).add(cb);
      return()=>subscribers.get(k)?.delete(cb);},
    remote:(row)=>{if(!row||pending.has(row.key)||!isShared(row.key))return;
      values.set(row.key,row.value);emit(row.key,row.value);status('Actualizado en vivo ✓');},
    pull, retry:flush,
    stop:()=>{stopped=true;clearTimeout(timer);window.removeEventListener('online',online);subscribers.clear();}
  };
}

function makeBar(){
  bar.hidden=false;
  bar.innerHTML=`<span id="account-name" class="account-name">Nuestro rincón</span>
    <div class="account-actions"><span id="cloud-status" class="sync-state" role="status">Conectando…</span>
      <button id="pair-code" class="btn s" type="button">Invitar</button>
      <button id="import-legacy" class="btn s" type="button">Importar datos</button>
      <button id="leaderboard" class="btn s" type="button">Tops</button>
      <button id="profile" class="btn s" type="button">Perfiles</button>
      <button id="access-help" class="cerrar" type="button">Mi acceso</button></div>`;
  $('#pair-code').onclick=()=>simpleDialog('Código para compartir',`<p>Mandale este código a tu novia para que se una con su propia cuenta:</p><p class="pair-invite">${safe(pair.invite_code)}</p><p>Solo acepta dos integrantes. Compartilo de forma privada.</p>`);
  $('#import-legacy').onclick=importLegacy;
  $('#leaderboard').onclick=()=>void showLeaderboard();
  $('#profile').onclick=()=>void showProfiles();
  $('#access-help').onclick=()=>simpleDialog('Acceso a tu perfil',
    '<p>La sesión está guardada automáticamente en este navegador, sin correo ni contraseña.</p><p><strong>Importante:</strong> no cierres sesión, no uses modo incógnito ni borres los datos del sitio. Si cambiás de dispositivo no vas a poder recuperar este mismo perfil con esta versión.</p>');
}
function importLegacy(){
  const keys=['todo','ver','metas','canciones','playlist','notas','caja','vis-boda','vis-casa','vis-vida','vis-viajes'];
  const available=[];
  for(const key of keys){
    const previous=localStorage.getItem('nr-'+key);if(previous===null)continue;
    try{const parsed=JSON.parse(previous);
      if(parsed!==null && (!Array.isArray(parsed)||parsed.length>0))available.push([key,parsed]);
    }catch{}
  }
  if(!available.length){simpleDialog('Importar datos','<p>No encontré datos anteriores guardados en este navegador.</p>');return;}
  if(!confirm(`Hay ${available.length} secciones guardadas en este navegador. ¿Importarlas al rincón compartido? No se reemplazarán las secciones que ya tengan datos en la nube.`))return;
  let count=0;
  for(const [key,value] of available){
    const existing=store.get(key,null);
    if(existing!==null&&existing!==undefined&&(!Array.isArray(existing)||existing.length>0))continue;
    if(store.set(key,value))count++;
  }
  simpleDialog('Importación preparada',`<p>Se prepararon ${count} secciones para sincronizar. Los datos anteriores se conservan en este navegador.</p><p>Recargá la página cuando indique «Sincronizado» para ver todo actualizado.</p>`);
}
function dialogBase(){
  if(!profileDialog){profileDialog=document.createElement('dialog');profileDialog.className='profile-dialog';
    document.body.appendChild(profileDialog);profileDialog.addEventListener('click',e=>{if(e.target===profileDialog)profileDialog.close();});}
  profileDialog.innerHTML='';if(!profileDialog.open)profileDialog.showModal();
  return profileDialog;
}
function simpleDialog(title,body){const d=dialogBase();d.innerHTML=`<h2>${safe(title)}</h2>${body}<div class="acc"><button class="btn" id="close-dialog">Cerrar</button></div>`;
  $('#close-dialog').onclick=()=>d.close();}
async function getSummary(){
  const [pr,me,rs,ba]=await Promise.all([
    db.from('profiles').select('id,display_name,points'),
    db.from('pair_members').select('user_id').eq('pair_id',pair.id),
    db.from('game_results').select('user_id,game,score,played_day,created_at').eq('pair_id',pair.id).limit(1000),
    db.from('earned_badges').select('user_id,badge_code')
  ]);
  for(const r of [pr,me,rs,ba])if(r.error)throw r.error;
  const ids=new Set(me.data.map(r=>r.user_id));
  return {people:pr.data.filter(p=>ids.has(p.id)),results:rs.data,badges:ba.data};
}
async function refreshBar(){
  try{const {people}=await getSummary();const me=people.find(p=>p.id===user.id);
    if(me)$('#account-name').textContent=`${me.display_name} · ${me.points} puntos`;}
  catch(err){console.warn('Resumen',err);}
}
function makeCard(row,kind='') {const d=document.createElement('div');d.className='badge-card '+kind;d.textContent=row;return d;}
async function showProfiles(){
  const d=dialogBase();d.innerHTML='<h2>Perfiles</h2><p>Cargando…</p>';
  try{
    const {people,results,badges}=await getSummary();d.innerHTML='<h2>Perfiles del rincón</h2>';
    for(const p of people){const self=p.id===user.id;
      const h=document.createElement('h3');h.textContent=(self?'⭐ ':'🌷 ')+p.display_name;d.append(h);
      const count=results.filter(r=>r.user_id===p.id).length;
      d.append(makeCard(`${p.points} puntos · ${count} partidas ganadas · ${badges.filter(b=>b.user_id===p.id).length}/${BADGES.length} logros`));
      const list=document.createElement('div');list.className='badge-list';
      BADGES.forEach(([code,emoji,name])=>{const got=badges.some(b=>b.user_id===p.id&&b.badge_code===code);
        list.append(makeCard(`${emoji} ${name}${got?' ✓':' · pendiente'}`,got?'':'locked'));});
      d.append(list);
      const rewards=document.createElement('p');rewards.textContent='Premios: '+REWARDS.map(([pts,emoji,name])=>`${emoji} ${name} (${pts} pts)${p.points>=pts?' ✓':' 🔒'}`).join(' · ');d.append(rewards);
      if(self){const f=document.createElement('form');f.className='profile-form';
        f.innerHTML='<label for="edit-name">Cambiar mi nombre</label><div class="add"><input id="edit-name" maxlength="30" required><button class="btn">Guardar</button></div><p class="est" role="status"></p>';
        f.querySelector('input').value=p.display_name;
        f.onsubmit=async e=>{e.preventDefault();const value=f.querySelector('input').value.trim();if(!value)return;
          const {error}=await db.from('profiles').update({display_name:value}).eq('id',user.id);
          f.querySelector('.est').textContent=error?'Error: '+error.message:'Nombre actualizado';if(!error)void refreshBar();};d.append(f);}
    }
    const btn=document.createElement('button');btn.className='btn';btn.textContent='Cerrar';btn.onclick=()=>d.close();d.append(btn);
  }catch(err){d.innerHTML='<h2>Perfiles</h2><p>No se pudieron cargar los datos: '+safe(err.message)+'</p><button class="btn" id="close-dialog">Cerrar</button>';
    $('#close-dialog').onclick=()=>d.close();}
}
async function showLeaderboard(){
  const d=dialogBase();d.innerHTML='<h2>Top de juegos</h2><p>Cargando…</p>';
  try{const {people,results}=await getSummary();d.innerHTML='<h2>Top de juegos 🏆</h2><p>Ranking amistoso entre los dos perfiles. Menos movimientos o intentos = mejor marca.</p>';
    for(const [game,name] of Object.entries(GAMES)){
      const h=document.createElement('h3');h.textContent=name;d.append(h);
      const data=people.map(p=>{
        const wins=results.filter(r=>r.game===game&&r.user_id===p.id);
        const scores=wins.filter(r=>r.score!==null).map(r=>r.score);
        return {name:p.display_name,wins:wins.length,best:scores.length?Math.min(...scores):null};
      }).sort((a,b)=>b.wins-a.wins||(a.best??Infinity)-(b.best??Infinity));
      const list=document.createElement('div');list.className='leader-list';
      for(const [i,p] of data.entries()){
        const info=document.createElement('div');info.className='rank-row';
        info.textContent=`${i+1}. ${p.name} — ${p.wins} ${p.wins===1?'victoria':'victorias'}${p.best!==null?' · mejor marca: '+p.best:''}`;list.append(info);}
      d.append(list);
    }
    const b=document.createElement('button');b.className='btn';b.textContent='Cerrar';b.onclick=()=>d.close();d.append(b);
  }catch(err){d.innerHTML='<h2>Ranking</h2><p>Error: '+safe(err.message)+'</p><button id="close-dialog" class="btn">Cerrar</button>';
    $('#close-dialog').onclick=()=>d.close();}
}
function toScore(game,result){
  const str=String(result);
  if(game==='conex'){const m=str.match(/(\d+)\s+errores?/);return m?Number(m[1]):0;}
  if(['puzzle','memotest','wordle'].includes(game)){const n=parseInt(str,10);return Number.isFinite(n)?n:null;}
  return null;
}
async function recordWin(game,result){
  if(!pair||!(game in GAMES))return;
  if(game==='wordle'&&!/^\d+\/6$/.test(String(result)))return;
  if(game==='conex'&&!String(result).startsWith('4/4'))return;
  // El cliente informa sus resultados; ranking casual, no antitrampas competitivo.
  const d=new Date();const played_day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const {error}=await db.from('game_results').upsert({pair_id:pair.id,user_id:user.id,
    game,played_day,score:toScore(game,result),won:true}, {onConflict:'pair_id,user_id,game,played_day'});
  if(error) {console.warn('Resultado',error);status('No se guardó el resultado');return;}
  void refreshBar();
}
function startRealtime(){
  realtimeChannel=db.channel('nuestro-rincon-'+pair.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'shared_entries',filter:`pair_id=eq.${pair.id}`},p=>{
      if(p.new?.key)store?.remote(p.new);
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>{void refreshBar();})
    .on('postgres_changes',{event:'*',schema:'public',table:'game_results',filter:`pair_id=eq.${pair.id}`},()=>{void refreshBar();})
    .subscribe(state=>{if(state==='SUBSCRIBED'){status('Conectados en vivo ✓');void store.pull();}
      else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT')status('Realtime reconectando…');});
}
async function openRoom(){
  if(!pair)return showPairSetup();
  try{
    screen.innerHTML='<h2>Abriendo Nuestro Rincón…</h2><p>Sincronizando las listas y cartas.</p>';screen.hidden=false;
    store=createStore();await store.initialize();window.nrStore=store;
    window.nrGameResult=(game,result)=>{void recordWin(game,result);};
    makeBar();
    if(!loadedApp){await import('./script.js');loadedApp=true;}
    screen.hidden=true;appNodes.forEach(n=>n.hidden=false);
    startRealtime();void refreshBar();
  }catch(err){console.error(err);showOnlyAccess();
    screen.innerHTML=`<h2>No se pudo conectar</h2><p>${safe(err.message)}</p><p>Revisá que hayas ejecutado el SQL y configurado config.js.</p><button id="retry" class="btn">Reintentar</button>`;
    $('#retry').onclick=()=>location.reload();}
}
async function openApp(account){
  if(user)return;user=account;
  screen.hidden=false;screen.innerHTML='<h2>Conectando…</h2>';
  try{pair=await pairOf(user.id);if(pair)await openRoom();else await showPairSetup();}
  catch(err){console.error(err);showOnlyAccess();screen.innerHTML=`<h2>Error de acceso</h2><p>${safe(err.message)}</p><button class="btn" id="retry">Reintentar</button>`;
    $('#retry').onclick=()=>location.reload();}
}
if(!configured)showAuth();
else{
  try{const {data,error}=await db.auth.getSession();if(error)throw error;
    if(data.session?.user)await openApp(data.session.user);else showAuth();}
  catch(err){showAuth('Error conectando con Supabase: '+err.message);}
}
