import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const $ = selector => document.querySelector(selector);
const screen = $('#auth-screen');
const bar = $('#account-bar');
const appElements = [$('.nav'), $('main'), $('.pf')];
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL)
  && SUPABASE_PUBLISHABLE_KEY.length > 20
  && !SUPABASE_PUBLISHABLE_KEY.includes('TU-');
const db = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
let currentUser = null;
let store = null;
let profileDialog = null;

const REWARDS = [
  {points:50, icon:'🌷', name:'Sello de primavera'},
  {points:100, icon:'🎀', name:'Cinta de plata'},
  {points:200, icon:'🏆', name:'Trofeo dorado'},
  {points:350, icon:'👑', name:'Leyenda del arcade'}
];

const BADGES = [
  {code:'primera_carta', icon:'💌', name:'Primera carta', description:'Guardar una carta en el buzón'},
  {code:'primer_plan', icon:'📌', name:'Primer plan', description:'Agregar un plan al mural'},
  {code:'primer_juego', icon:'⭐', name:'Primer triunfo', description:'Ganar un juego'},
  {code:'puzzle', icon:'🧩', name:'Rompecabezas', description:'Completar el puzzle'},
  {code:'wordle', icon:'🔤', name:'Palabra ganadora', description:'Ganar el Wordle'},
  {code:'conex', icon:'🧠', name:'Conexiones', description:'Completar las conexiones'},
  {code:'memotest', icon:'🎴', name:'Memoria de oro', description:'Completar el memotest'},
  {code:'misterio', icon:'🔎', name:'Detective', description:'Resolver el misterio'},
  {code:'caja', icon:'🔐', name:'Caja abierta', description:'Abrir la caja fuerte'},
  {code:'tres_juegos', icon:'🏆', name:'Campeón arcade', description:'Ganar tres juegos diferentes'}
];

function showAuth(message = '') {
  appElements.forEach(element => { element.hidden = true; });
  bar.hidden = true;
  screen.hidden = false;
  screen.innerHTML = `
    <h2>Entren a su rincón</h2>
    <p>Sus cartas, listas y logros se guardan en su propia cuenta.</p>
    <form id="login-form">
      <label for="login-name">Nombre (solo para crear cuenta)</label>
      <input id="login-name" maxlength="30" autocomplete="nickname" placeholder="Tu nombre">
      <label for="login-email">Correo electrónico</label>
      <input id="login-email" type="email" autocomplete="email" required placeholder="correo@ejemplo.com">
      <label for="login-password">Contraseña</label>
      <input id="login-password" type="password" minlength="6" autocomplete="current-password" required placeholder="Mínimo 6 caracteres">
      <div class="acc"><button class="btn" type="submit">Ingresar</button>
      <button class="btn s" id="create-account" type="button">Crear cuenta</button></div>
    </form>
    <p class="auth-msg" role="status" id="auth-message"></p>`;
  const form = $('#login-form');
  const msg = $('#auth-message');
  msg.textContent = message;
  if (!db) {
    form.querySelectorAll('button,input').forEach(e => { e.disabled = true; });
    msg.textContent = 'Primero configurá config.js con los datos públicos de tu proyecto Supabase.';
    return;
  }
  const credentials = () => ({ email: $('#login-email').value.trim(), password: $('#login-password').value });
  const toggle = isBusy => {form.querySelectorAll('button').forEach(button => {button.disabled = isBusy;});};
  form.addEventListener('submit', async event => {
    event.preventDefault(); toggle(true); msg.textContent = 'Iniciando sesión…';
    try {
      const {data, error} = await db.auth.signInWithPassword(credentials());
      if (error) throw error;
      if (data.user) await openApp(data.user);
    } catch (error) { msg.textContent = 'No se pudo ingresar: ' + error.message; }
    finally {toggle(false);}
  });
  $('#create-account').addEventListener('click', async () => {
    if (!form.reportValidity()) return;
    toggle(true); msg.textContent = 'Creando cuenta…';
    try {
      const name = $('#login-name').value.trim() || 'Jugador';
      const {data, error} = await db.auth.signUp({
        ...credentials(),
        options: { data: { display_name: name }, emailRedirectTo: location.origin }
      });
      if (error) throw error;
      if (data.session?.user) await openApp(data.session.user);
      else msg.textContent = 'Cuenta solicitada. Revisá tu correo para confirmar la dirección y después iniciá sesión.';
    } catch (error) { msg.textContent = 'No se pudo crear la cuenta: ' + error.message; }
    finally {toggle(false);}
  });
}

// El código original trabaja con un get/set síncrono. Primero precargamos los datos de
// Supabase y después iniciamos el juego. Las escrituras se sincronizan en segundo plano.
async function createCloudStore(user, showStatus) {
  const uid = user.id;
  const pendingKey = 'nr-pending-' + uid;
  let pending = {};
  try { pending = JSON.parse(localStorage.getItem(pendingKey)) || {}; }
  catch { pending = {}; }
  if (!pending || typeof pending !== 'object' || Array.isArray(pending)) pending = {};
  const {data, error} = await db.from('app_entries').select('key,value');
  if (error) throw error;
  const values = new Map((data || []).map(row => [row.key, row.value]));
  Object.entries(pending).forEach(([key,value]) => values.set(key,value));
  let busy = false;
  let timeout;
  let stopped = false;
  const persistPending = () => {
    try { localStorage.setItem(pendingKey, JSON.stringify(pending)); }
    catch { showStatus('Sin respaldo local disponible'); }
  };
  const schedule = () => {
    clearTimeout(timeout);
    timeout = setTimeout(flush, 500);
  };
  async function flush() {
    if (stopped || busy || !Object.keys(pending).length) return;
    busy = true;
    const entries = Object.entries(pending).map(([key,value]) => ({user_id:uid,key,value}));
    showStatus('Guardando en la nube…');
    try {
      const {error} = await db.from('app_entries').upsert(entries, {onConflict:'user_id,key'});
      if (error) throw error;
      for (const row of entries) {
        if (JSON.stringify(pending[row.key]) === JSON.stringify(row.value)) delete pending[row.key];
      }
      persistPending();
      showStatus(Object.keys(pending).length ? 'Cambios pendientes…' : 'Guardado en la nube ✓');
    } catch (error) {
      console.warn('No se pudo sincronizar:',error);
      showStatus('Sin sincronizar — revisá la conexión');
    } finally {
      busy = false;
      if (Object.keys(pending).length && navigator.onLine) {
        // Si hubo cambios mientras una escritura estaba en curso, seguí guardando.
        // Los errores se reintentan al reconectar o con el siguiente cambio.
        if (entries.some(row => JSON.stringify(pending[row.key]) !== JSON.stringify(row.value))) schedule();
      }
    }
  }
  window.addEventListener('online', flush);
  if (Object.keys(pending).length) schedule();
  return {
    get: (key,fallback) => values.has(key) ? values.get(key) : fallback,
    set: (key,value) => {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) return false;
      values.set(key,value);
      pending[key] = value;
      persistPending();
      showStatus('Pendiente de guardar…');
      schedule();
      return true;
    },
    stop: () => { stopped = true; clearTimeout(timeout); window.removeEventListener('online', flush); },
    retry: flush
  };
}

function showAccountBar() {
  bar.innerHTML = `
    <span class="account-name" id="account-name">Mi rincón</span>
    <div class="account-actions">
      <span class="sync-state" id="cloud-status" role="status">Conectado</span>
      <button class="btn s" type="button" id="open-profile">Mi perfil</button>
      <button class="cerrar" type="button" id="logout">Salir</button>
    </div>`;
  $('#open-profile').addEventListener('click',openProfile);
  $('#logout').addEventListener('click', async () => {
    await db.auth.signOut();
    location.reload(); // reinicia el estado del JS original sin contaminar otra cuenta
  });
  bar.hidden = false;
}

function status(text) {
  const elem = $('#cloud-status');
  if (elem) elem.textContent = text;
}

async function refreshSummary() {
  if (!currentUser) return {profile:null,badges:[],results:[]};
  const [pr,ba,gr] = await Promise.all([
    db.from('profiles').select('display_name,points').eq('id',currentUser.id).single(),
    db.from('earned_badges').select('badge_code,created_at').order('created_at',{ascending:false}),
    db.from('game_results').select('game,won,created_at').eq('won',true).order('created_at',{ascending:false}).limit(10)
  ]);
  for (const res of [pr,ba,gr]) if (res.error) throw res.error;
  const profile = pr.data;
  const name = $('#account-name');
  if (name) name.textContent = (profile?.display_name || 'Jugador') + ' · ' + (profile?.points ?? 0) + ' puntos';
  return {profile, badges:ba.data||[], results:gr.data||[]};
}

async function openProfile() {
  if (!profileDialog) {
    profileDialog = document.createElement('dialog');
    profileDialog.className = 'profile-dialog';
    document.body.appendChild(profileDialog);
    profileDialog.addEventListener('click',e => {if(e.target === profileDialog) profileDialog.close();});
  }
  profileDialog.innerHTML = '<h2>Mi perfil</h2><p>Buscando logros…</p>';
  profileDialog.showModal();
  try {
    const {profile,badges,results} = await refreshSummary();
    const earned = new Set(badges.map(b => b.badge_code));
    profileDialog.innerHTML = `
      <h2>Mi perfil</h2>
      <p class="profile-points" id="points"></p>
      <form id="profile-form">
        <label for="profile-name">Nombre para mostrar</label>
        <div class="add"><input id="profile-name" maxlength="30" required>
        <button class="btn" type="submit">Guardar</button></div>
      </form>
      <p class="profile-msg" id="profile-msg" role="status"></p>
      <h3>Mis insignias</h3>
      <div class="badge-list" id="badge-list"></div>
      <h3>Premios por puntos</h3>
      <div class="badge-list" id="reward-list"></div>
      <h3>Partidas ganadas</h3>
      <p id="recent-results"></p>
      <div class="acc"><button class="btn s" id="close-profile" type="button">Cerrar</button></div>`;
    $('#points').textContent = (profile?.points ?? 0) + ' puntos · ' + badges.length + '/' + BADGES.length + ' logros';
    $('#profile-name').value = profile?.display_name || '';
    const badgeList = $('#badge-list');
    BADGES.forEach(badge => {
      const card = document.createElement('div');
      card.className = 'badge-card' + (earned.has(badge.code) ? '' : ' locked');
      const title = document.createElement('strong'); title.textContent = badge.icon + ' ' + badge.name;
      const info = document.createElement('small'); info.textContent = earned.has(badge.code) ? 'Conseguido' : badge.description;
      card.append(title,info);badgeList.appendChild(card);
    });
    const rewardList = $('#reward-list');
    REWARDS.forEach(reward => {
      const card = document.createElement('div');
      const unlocked = (profile?.points ?? 0) >= reward.points;
      card.className = 'badge-card' + (unlocked ? '' : ' locked');
      const title = document.createElement('strong');
      title.textContent = reward.icon + ' ' + reward.name;
      const info = document.createElement('small');
      info.textContent = unlocked ? 'Desbloqueado · ' + reward.points + ' puntos' : 'Se desbloquea con ' + reward.points + ' puntos';
      card.append(title,info);
      rewardList.appendChild(card);
    });
    const names = {puzzle:'Puzzle',wordle:'Wordle',conex:'Conexiones',memotest:'Memotest',misterio:'Misterio',caja:'Caja fuerte'};
    $('#recent-results').textContent = results.length
      ? results.map(r => names[r.game]||r.game).join(' · ')
      : 'Todavía no hay victorias. ¡A jugar!';
    $('#profile-form').addEventListener('submit',async e => {
      e.preventDefault();
      const value = $('#profile-name').value.trim();
      if (!value) return;
      const {error} = await db.from('profiles').update({display_name:value}).eq('id',currentUser.id);
      $('#profile-msg').textContent = error ? error.message : 'Nombre actualizado.';
      if (!error) await refreshSummary();
    });
    $('#close-profile').addEventListener('click',()=>profileDialog.close());
  } catch (error) {
    profileDialog.innerHTML = '';
    const msg=document.createElement('p');msg.textContent='No se pudo cargar el perfil: '+error.message;
    const close=document.createElement('button');close.className='btn';close.textContent='Cerrar';close.addEventListener('click',()=>profileDialog.close());
    profileDialog.append(msg,close);
  }
}

async function recordWin(game, result) {
  const valid = ['puzzle','misterio','memotest','caja','wordle','conex'];
  if (!currentUser || !valid.includes(game)) return;
  const won = game === 'wordle' ? /^\d+\/6$/.test(String(result))
    : game === 'conex' ? String(result).startsWith('4/4') : true;
  if (!won) return; // las derrotas diarias igual se guardan en app_entries
  const daily = ['wordle','conex','memotest'].includes(game);
  const d=new Date();
  const day=[d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  const eventKey = daily ? day : 'primera-vez';
  const score = Number.parseInt(String(result),10);
  const {error} = await db.from('game_results').insert({
    user_id:currentUser.id, game, event_key:eventKey,won:true,score:Number.isFinite(score)?Math.max(0,score):null
  });
  if (error && error.code !== '23505') {console.warn('No se pudo guardar el resultado:',error);status('Error al guardar logro');return;}
  if (!error) {
    try { await refreshSummary(); } catch(e) {console.warn(e);}
  }
}

async function openApp(user) {
  if (currentUser) return;
  currentUser = user;
  screen.hidden = false;
  screen.innerHTML = '<h2>Abriendo su rincón…</h2><p>Cargando cartas, listas y resultados guardados.</p>';
  try {
    store = await createCloudStore(user,status);
    window.nrStore = store;
    window.nrGameResult = (game,result) => { void recordWin(game,result); };
    showAccountBar();
    await import('./script.js');
    screen.hidden = true;
    appElements.forEach(element => {element.hidden = false;});
    try { await refreshSummary(); }
    catch(err) { console.warn('No se pudo cargar el resumen de perfil',err);status('Falta configurar tablas SQL'); }
  } catch (error) {
    currentUser = null;
    console.error(error);
    showAuth('No se pudieron cargar los datos de Supabase: ' + error.message + '. Revisá que ejecutaste schema.sql.');
    if (db) {
      const btn = document.createElement('button');
      btn.textContent = 'Cerrar sesión';btn.className = 'btn s';
      btn.addEventListener('click',async()=>{await db.auth.signOut();location.reload();});
      screen.appendChild(btn);
    }
  }
}

if (!configured) {
  showAuth();
} else {
  try {
    const {data,error} = await db.auth.getSession();
    if (error) throw error;
    if (data.session?.user) await openApp(data.session.user);
    else showAuth();
  } catch (error) { showAuth('No se pudo conectar con Supabase: '+error.message); }
}
