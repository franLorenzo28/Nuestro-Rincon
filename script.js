import { openTicTacToe, openSnake } from './arcade-games.mjs';
import { openMurdoku } from './murdoku.mjs';

(function(){

'use strict';

const $=s=>document.querySelector(s);

const ld=(k,d)=>window.nrStore ? window.nrStore.get(k,d) : d;

const sv=(k,v)=>window.nrStore ? window.nrStore.set(k,v) : false;

const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};

const COL=['#F1E6C8','#EBCFD1','#D3E0E8','#D9E4D2','#E3DAEA'];

const giro=i=>(((i*37)%7)-3)*.8+'deg';

const hash=n=>Math.imul(n|0,2654435761)>>>0;

const today=()=>{const d=new Date();return{d,key:d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(),seed:d.getFullYear()*372+d.getMonth()*31+d.getDate()}};

const pick=(a,s)=>a[hash(today().seed+s)%a.length];

const rng=s=>()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};

const shuf=(a,r)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

const getRes=()=>ld('res-'+today().key,{});

const setRes=(k,v)=>{const r=getRes();r[k]=v;sv('res-'+today().key,r);window.nrGameResult?.(k,v)};

const gate=(b,k)=>{const r=getRes()[k];if(r){b.innerHTML='';b.appendChild(el('p','aviso','Ya completaron este desafío hoy. Resultado: '+r+'. Mañana habrá uno nuevo.'));return true}return false};



/* ---- Pestañas principales ---- */

const tabs=[1,2,3].map(i=>({b:$('#b'+i),s:$('#t'+i)}));

tabs.forEach((t,i)=>t.b.addEventListener('click',()=>{tabs.forEach((u,j)=>{u.b.setAttribute('aria-selected',i===j);u.s.hidden=i!==j});sv('tab',i)}));

const t0=ld('tab',0);if(t0>0&&tabs[t0])tabs[t0].b.click();



/* ---- Tarjetas y ventanas ---- */

const IC={

 todo:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7 5M3.5 12l1.5 1.5L7 11M3.5 18l1.5 1.5L7 17"/>',

 ver:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4-2.5z"/>',

 metas:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',

 vision:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 17l5-4 4 3 3-2 6 4"/>',

 d14:'<rect x="3" y="8" width="18" height="4"/><path d="M12 8v13M5 12v8h14v-8M12 8c-2-4-6-3-5 0 .5 1.5 3 1 5 0zm0 0c2-4 6-3 5 0-.5 1.5-3 1-5 0z"/>',

 musica:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',

 mist:'<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>',

 memo:'<rect x="3" y="6" width="9" height="13" rx="1.5"/><rect x="12" y="5" width="9" height="13" rx="1.5"/>',

 tateti:'<path d="M8 3v18M16 3v18M3 8h18M3 16h18M4 4l3 3m0-3L4 7"/><circle cx="20" cy="20" r="2"/>',

 snake:'<path d="M4 17h5a3 3 0 003-3V9a3 3 0 013-3h5M17 4l3 2-3 2"/><circle cx="5" cy="17" r="1"/>',

 caja:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',

 grid:'<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>'};

function juego(cont,id,titulo,ico,fn){

 const d=el('dialog');d.id='m-'+id;

 d.innerHTML='<div class="hoja"><header><h3></h3><button class="cerrar">Cerrar</button></header><div class="gb"></div></div>';

 d.querySelector('h3').textContent=titulo;document.body.appendChild(d);

 d.addEventListener('click',e=>{if(e.target===d)d.close()});d.querySelector('.cerrar').addEventListener('click',()=>d.close());

 const b=el('button','tj');b.style.setProperty('--c',COL[cont.children.length%5]);b.style.setProperty('--g',giro(cont.children.length+2));

 b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+IC[ico]+'</svg><span class="et"></span>';b.lastChild.textContent=titulo;

 b.addEventListener('click',()=>{fn(d.querySelector('.gb'),d);d.showModal()});cont.appendChild(b);return d;

}



/* ---- Listas ---- */

function lista(b,k,mode,ph,cb){

 let it=ld(k,[]);b.innerHTML='';

 const f=el('form','add'),inp=el('input');inp.maxLength=120;inp.placeholder=ph;inp.setAttribute('aria-label',ph);

 const bt=el('button','btn','Agregar');f.append(inp,bt);const cn=el('p','cuenta'),ul=el('ul',mode);b.append(f,cn,ul);

 const save=()=>{sv(k,it);draw();if(cb)cb(it)};

 function draw(){ul.innerHTML='';

  it.forEach((x,i)=>{const li=el('li'),sp=el('span','',x.t),q=el('button','q','Quitar');q.type='button';q.setAttribute('aria-label','Quitar '+x.t);

   q.addEventListener('click',()=>{it.splice(i,1);save()});

   if(mode==='check'){const l=el('label'),c=el('input');c.type='checkbox';c.checked=!!x.d;c.addEventListener('change',()=>{x.d=c.checked;save()});l.append(c,sp);li.append(l,q)}

   else{if(mode==='post'){li.style.setProperty('--c',COL[i%5]);li.style.setProperty('--g',giro(i))}li.append(sp,q)}

   ul.appendChild(li)});

  cn.textContent=it.length?(mode==='check'?it.filter(x=>x.d).length+' de '+it.length+' completados':''):'Todavía no hay nada. Agreguen lo primero.'}

 f.addEventListener('submit',e=>{e.preventDefault();const t=inp.value.trim();if(!t)return;it.push({t,d:false});inp.value='';save()});
 // Escuchar cambios de la otra cuenta mientras esta ventana está abierta.
 const unsubscribe=window.nrStore?.onChange(k,remote=>{
   it=Array.isArray(remote)?structuredClone(remote):[];draw();if(cb)cb(it);
 });
 b.closest('dialog')?.addEventListener('close',()=>unsubscribe?.(),{once:true});
 draw();

}



/* ---- Mural ---- */

const M=$('#mural');

juego(M,'todo','Por hacer...','todo',b=>lista(b,'todo','check','Una cita o plan para hacer juntos'));

juego(M,'ver','Por ver...','ver',b=>lista(b,'ver','check','Película, serie o maratón pendiente'));

juego(M,'metas','Sueños & Metas','metas',b=>lista(b,'metas','post','Una meta que queremos lograr juntos'));



const VIS=[['boda','Boda'],['casa','Casa'],['vida','Vida'],['viajes','Viajes']];

 juego(M,'vision','Vision Board','vision',b=>{
  b.innerHTML='';const tb=el('div','tabs'),box=el('div');tb.setAttribute('role','tablist');b.append(tb,box);
  let activeUnsubscribe=null;
  b.closest('dialog')?.addEventListener('close',()=>activeUnsubscribe?.(),{once:true});

 VIS.forEach(([id,t],n)=>{const bt=el('button','',t);bt.setAttribute('role','tab');tb.appendChild(bt);

  bt.addEventListener('click',()=>{[...tb.children].forEach(x=>x.setAttribute('aria-selected',x===bt));panel(id)});if(n===0)bt.click()});

  function panel(id){activeUnsubscribe?.();box.innerHTML='';

  const f=el('form','add'),inp=el('input');inp.maxLength=100;inp.placeholder='Una idea para sumar al collage';inp.setAttribute('aria-label','Nueva idea');f.append(inp,el('button','btn','Agregar'));

  const mas=el('div','mas');box.append(f,mas);let mine=ld('vis-'+id,[]);

  function draw(){mas.innerHTML='';

   mine.forEach((t,n)=>{const c=el('div');c.style.setProperty('--c',COL[n%5]);c.style.setProperty('--h',(70+(n*29)%60)+'px');

    if(n%3===1)c.insertAdjacentHTML('beforeend','<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+IC.vision+'</svg>');

    c.appendChild(el('span','',t));

    const q=el('button','q','Quitar');q.type='button';q.addEventListener('click',()=>{mine.splice(n,1);sv('vis-'+id,mine);draw()});c.appendChild(q);

    mas.appendChild(c)})}

   f.addEventListener('submit',e=>{e.preventDefault();const t=inp.value.trim();if(!t)return;mine.push(t);sv('vis-'+id,mine);inp.value='';draw()});
  activeUnsubscribe=window.nrStore?.onChange('vis-'+id,remote=>{mine=Array.isArray(remote)?structuredClone(remote):[];draw()});
  draw()}

});



juego(M,'d14','Regalo del 14','d14',b=>{

 const n=new Date(),t0=new Date(n.getFullYear(),n.getMonth(),n.getDate()),hoy=t0.getDate()===14;

 let nx=new Date(n.getFullYear(),n.getMonth(),14);if(t0>nx)nx=new Date(n.getFullYear(),n.getMonth()+1,14);

 const pv=new Date(nx.getFullYear(),nx.getMonth()-1,14),dias=Math.round((nx-t0)/864e5),p=Math.min(1,(t0-pv)/(nx-pv)),C=339.3;

 const f=nx.toLocaleDateString('es',{weekday:'long',day:'numeric',month:'long'});

 b.innerHTML='<div class="reloj"><svg viewBox="0 0 140 140" role="img" aria-label="'+(hoy?'Hoy es 14':'Faltan '+dias+' días')+'"><circle cx="70" cy="70" r="54" fill="none" stroke="#EBDDD0" stroke-width="9"/><circle cx="70" cy="70" r="54" fill="none" stroke="#A8606B" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+C*(1-p)+'" transform="rotate(-90 70 70)"/><text class="n" x="70" y="78" text-anchor="middle">'+(hoy?'Hoy':dias)+'</text><text class="t" x="70" y="98" text-anchor="middle">'+(hoy?'es 14':(dias===1?'día':'días'))+'</text></svg><p id="f14"></p></div>'

  +(hoy?'<div class="aviso ok"><b>Feliz día 14</b>Un mes más juntos y cada uno vale la pena. Gracias por elegirme otra vez. Hoy toca celebrar, aunque sea con algo pequeñito.</div>':'');

 $('#f14').textContent=hoy?'Hoy cumplimos otro mes.':'Falta para nuestro próximo día 14: '+f+'.';

});

if(new Date().getDate()===14){try{if(!sessionStorage.getItem('nr-14')){sessionStorage.setItem('nr-14','1');setTimeout(()=>{const t=[...M.children].find(x=>x.textContent==='Regalo del 14');if(t)t.click()},500)}}catch(e){}}



let ci=0,play=false;

juego(M,'musica','Nuestra Música','musica',b=>{

 b.innerHTML='<div class="cinta"><svg viewBox="0 0 240 150" role="img" aria-label="Cassette"><rect x="4" y="6" width="232" height="138" rx="12" fill="#C9AF98" stroke="#8C766B" stroke-width="2"/><rect x="22" y="18" width="196" height="62" rx="6" fill="#FDFBF7"/><text id="lab" x="120" y="55" text-anchor="middle" font-family="Caveat,cursive" font-size="22" fill="#5E4A42"></text><rect x="62" y="92" width="116" height="38" rx="19" fill="#5E4A42"/><g class="reel"><circle cx="86" cy="111" r="13" fill="#FDFBF7"/><path d="M86 98v26M73 111h26M77 102l18 18M95 102l-18 18" stroke="#5E4A42" stroke-width="2"/></g><g class="reel"><circle cx="154" cy="111" r="13" fill="#FDFBF7"/><path d="M154 98v26M141 111h26M145 102l18 18M163 102l-18 18" stroke="#5E4A42" stroke-width="2"/></g></svg><div class="acc" style="margin:0 0 14px"><button class="btn s" id="cp">Anterior</button><button class="btn" id="cl">Reproducir</button><button class="btn s" id="cn">Siguiente</button></div></div><div id="ls"></div><div class="enl"><label for="pl">Enlace de nuestra playlist</label><div class="add" style="margin:0"><input id="pl" type="url" placeholder="https://..."><button class="btn" id="pg">Guardar enlace</button></div><div id="pa"></div></div>';

 const cinta=b.querySelector('.cinta');

 const lab=()=>{const s=ld('canciones',[]);if(ci>=s.length)ci=0;b.querySelector('#lab').textContent=s.length?s[ci].t.slice(0,26):'Nuestra playlist'};

 lista(b.querySelector('#ls'),'canciones','plain','Una canción especial para nosotros',lab);lab();

 b.querySelector('#cl').addEventListener('click',e=>{play=!play;cinta.classList.toggle('play',play);e.currentTarget.textContent=play?'Pausar':'Reproducir'});

 b.querySelector('#cn').addEventListener('click',()=>{const s=ld('canciones',[]);if(s.length){ci=(ci+1)%s.length;lab()}});

 b.querySelector('#cp').addEventListener('click',()=>{const s=ld('canciones',[]);if(s.length){ci=(ci-1+s.length)%s.length;lab()}});

 const link=()=>{const u=ld('playlist',''),a=b.querySelector('#pa');a.innerHTML='';if(/^https?:\/\//i.test(u)){const x=el('a','','Abrir nuestra playlist');x.href=u;x.target='_blank';x.rel='noopener';a.appendChild(x)}};

 b.querySelector('#pg').addEventListener('click',()=>{const v=b.querySelector('#pl').value.trim();if(/^https?:\/\//i.test(v)){sv('playlist',v);b.querySelector('#pl').value='';link()}else b.querySelector('#pl').focus()});
 const stopLink=window.nrStore?.onChange('playlist',link);
 b.closest('dialog')?.addEventListener('close',()=>stopLink?.(),{once:true});link();

});



/* ---- Puzzle ---- */

const COLS=4,ROWS=3,TOT=12,board=$('#board'),frame=$('#frame'),peek=$('#peek');

const CAND=['fotopuzzle.jpg','fotopuzzle.jpeg','fotopuzzle.png','fotopuzzle'];

let src='',order=[],moves=0,solved=false,picked=null,drag=null;

function ph(){const c=document.createElement('canvas');c.width=800;c.height=600;const g=c.getContext('2d');

 const gr=g.createLinearGradient(0,0,800,600);gr.addColorStop(0,'#EBCFD1');gr.addColorStop(.5,'#FDFBF7');gr.addColorStop(1,'#D3E0E8');g.fillStyle=gr;g.fillRect(0,0,800,600);

 g.fillStyle='#A8606B';g.textAlign='center';g.font='italic 64px serif';g.fillText('Aquí irá su foto',400,290);g.font='28px sans-serif';g.fillText('fotopuzzle.jpg',400,350);return c.toDataURL('image/png')}

function load(i){if(i>=CAND.length){src=ph();$('#hint').hidden=false;start(4/3);return}

 const im=new Image();im.onload=()=>{src=CAND[i];start(im.naturalWidth/im.naturalHeight)};im.onerror=()=>load(i+1);im.src=CAND[i]}

function start(r){document.documentElement.style.setProperty('--img','url("'+src+'")');board.style.aspectRatio=String(r);

 frame.style.width='min(100%,620px,calc('+Math.round(62*r)+'vh + 28px))';shuffle();render()}

function shuffle(){do{order=shuf([...Array(TOT).keys()],Math.random)}while(order.every((p,i)=>p===i));moves=0;solved=false;picked=null;board.classList.remove('solved');$('#win').hidden=true}

function render(){board.innerHTML='';

 order.forEach((pid,cell)=>{const c=el('div','cell');c.dataset.cell=cell;const p=el('div','piece');p.dataset.cell=cell;p.setAttribute('role','button');p.tabIndex=solved?-1:0;

  p.setAttribute('aria-label','Pieza '+(pid+1)+' en la casilla '+(cell+1));

  p.style.backgroundSize=COLS*100+'% '+ROWS*100+'%';p.style.backgroundPosition=(pid%COLS)/(COLS-1)*100+'% '+Math.floor(pid/COLS)/(ROWS-1)*100+'%';

  if(picked===cell)p.classList.add('picked');

  if(!solved){p.addEventListener('pointerdown',down);p.addEventListener('keydown',key)}

  c.appendChild(p);board.appendChild(c)});

 $('#moves').textContent=moves}

const cellAt=(x,y)=>{const e=document.elementFromPoint(x,y);return e?e.closest('#board .cell'):null};

function down(e){if(solved||(e.pointerType==='mouse'&&e.button!==0))return;const p=e.currentTarget;p.setPointerCapture(e.pointerId);const r=p.getBoundingClientRect();

 drag={p,id:e.pointerId,from:+p.dataset.cell,sx:e.clientX,sy:e.clientY,ox:e.clientX-r.left,oy:e.clientY-r.top,w:r.width,h:r.height,moved:false,g:null,over:null};

 p.addEventListener('pointermove',mv);p.addEventListener('pointerup',up);p.addEventListener('pointercancel',end)}

function mv(e){if(!drag||e.pointerId!==drag.id)return;

 if(!drag.moved){if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<6)return;drag.moved=true;const g=drag.p.cloneNode(false);g.className='piece ghost';g.style.width=drag.w+'px';g.style.height=drag.h+'px';document.body.appendChild(g);drag.g=g;drag.p.classList.add('lifted')}

 drag.g.style.left=e.clientX-drag.ox+'px';drag.g.style.top=e.clientY-drag.oy+'px';

 const t=cellAt(e.clientX,e.clientY);if(drag.over&&drag.over!==t)drag.over.classList.remove('over');

 if(t&&+t.dataset.cell!==drag.from){t.classList.add('over');drag.over=t}else drag.over=null}

function end(){const d=drag;if(!d)return null;d.p.removeEventListener('pointermove',mv);d.p.removeEventListener('pointerup',up);d.p.removeEventListener('pointercancel',end);

 if(d.g)d.g.remove();if(d.over)d.over.classList.remove('over');d.p.classList.remove('lifted');drag=null;return d}

function up(e){if(!drag||e.pointerId!==drag.id)return;const d=end();

 if(d.moved){const t=cellAt(e.clientX,e.clientY);if(t&&+t.dataset.cell!==d.from)swap(d.from,+t.dataset.cell)}else tap(d.from)}

function tap(c){if(picked===null)picked=c;else if(picked===c)picked=null;else{swap(picked,c);return}render();foc(c)}

function foc(c){const p=board.querySelector('.cell:nth-child('+(c+1)+') .piece');if(p&&!solved)p.focus()}

function key(e){const c=+e.currentTarget.dataset.cell;if(e.key==='Enter'||e.key===' '){e.preventDefault();tap(c);return}

 const s={ArrowLeft:-1,ArrowRight:1,ArrowUp:-COLS,ArrowDown:COLS}[e.key];if(!s)return;e.preventDefault();

 if((e.key==='ArrowLeft'&&c%COLS===0)||(e.key==='ArrowRight'&&c%COLS===COLS-1))return;const n=c+s;if(n>=0&&n<TOT)foc(n)}

function swap(a,b){[order[a],order[b]]=[order[b],order[a]];moves++;picked=null;

 if(order.every((p,i)=>p===i)){window.nrGameResult?.('puzzle',moves);solved=true;board.classList.add('solved');$('#win-t').textContent='Armaron su foto en '+moves+' movimientos. Cada pieza encontró su lugar, igual que ustedes dos.';$('#win').hidden=false;render()}

 else{render();foc(b)}}

$('#b-mix').addEventListener('click',()=>{shuffle();render()});

$('#b-peek').addEventListener('click',e=>{const on=peek.classList.toggle('on');e.currentTarget.setAttribute('aria-pressed',on);e.currentTarget.textContent=on?'Ocultar la foto':'Ver la foto completa'});

load(0);



/* ---- Arcade ---- */

const A=$('#arcade');

juego(A,'mist','Murdoku de Misterio','mist',(b,dlg)=>openMurdoku(b,dlg,{
 get:ld,set:sv,onWin:result=>window.nrGameResult?.('misterio',result)
}));

juego(A,'tateti','Tatetí','tateti',(b,dlg)=>openTicTacToe(b,dlg,{
 store:window.nrStore,userId:window.nrIdentity.id,
 onWin:score=>window.nrGameResult?.('tateti',score)
}));

juego(A,'snake','Vivorita','snake',(b,dlg)=>openSnake(b,dlg,{
 get:ld,set:sv,onWin:score=>window.nrGameResult?.('snake',score)
}));



const memoGame=b=>{

 b.innerHTML='';const W=['Luna','Sol','Mar','Café','Flor','Lluvia','Cine','Música'];let open=[],lock=false,mv2=0,found=0;

 const info=el('p','','Intentos: 0'),g=el('div','mm'),m=el('div','aviso ok');m.hidden=true;

 shuf(W.concat(W),Math.random).forEach((w,i)=>{const c=el('button','',w);c.type='button';c.setAttribute('aria-label','Carta '+(i+1));

  c.addEventListener('click',()=>{if(lock||c.classList.contains('v')||c.classList.contains('h'))return;c.classList.add('v');open.push(c);

   if(open.length===2){mv2++;info.textContent='Intentos: '+mv2;const[x,y]=open;

    if(x.textContent===y.textContent){x.className=y.className='h';found++;open=[];if(found===8){window.nrGameResult?.('memotest',mv2);m.innerHTML='<b>Lo lograron</b>';m.append('Encontraron todas las parejas en '+mv2+' intentos.');m.hidden=false}}

    else{lock=true;setTimeout(()=>{x.classList.remove('v');y.classList.remove('v');open=[];lock=false},800)}}});g.appendChild(c)});

 const r=el('button','btn s','Mezclar de nuevo');r.type='button';r.addEventListener('click',()=>memoGame(b));

 const acc=el('div','acc');acc.appendChild(r);b.append(info,g,m,acc);

};

juego(A,'memo','Memotest','memo',memoGame);



juego(A,'caja','Caja Fuerte','caja',b=>{

 const cfg=ld('caja',{c:'1402',m:'Gracias por cada día. Este rincón es nuestro y siempre habrá lugar para una sorpresa más.'});let v='';b.innerHTML='';

 const disp=el('div','disp'),pad=el('div','pad'),msg=el('div','aviso'),box=el('div');msg.hidden=true;

 b.append(el('p','','Ingresen el código de 4 dígitos para abrir la caja.'),disp,pad,msg,box);

 const show=()=>{disp.innerHTML='';for(let i=0;i<4;i++)disp.appendChild(el('span','',i<v.length?'•':''))};show();

 function abrir(){window.nrGameResult?.('caja','abierta');pad.hidden=disp.hidden=true;msg.className='aviso ok';msg.innerHTML='<b>Caja abierta</b>';msg.append(cfg.m);msg.hidden=false;

  box.innerHTML='<p style="margin-top:14px">Cambien la clave o el mensaje:</p>';

  const c=el('input');c.inputMode='numeric';c.maxLength=4;c.placeholder='Nueva clave de 4 dígitos';const t=el('textarea');t.rows=3;t.style.width='100%';t.style.marginTop='8px';t.placeholder='Nuevo mensaje';

  const g=el('button','btn','Guardar');g.type='button';const s=el('p','cuenta');

  g.addEventListener('click',()=>{if(c.value&&!/^\d{4}$/.test(c.value)){s.textContent='La clave debe tener 4 dígitos.';return}

   if(c.value)cfg.c=c.value;if(t.value.trim())cfg.m=t.value.trim();sv('caja',cfg);msg.childNodes[1].textContent=cfg.m;s.textContent='Guardado.'});

  const acc=el('div','acc');acc.appendChild(g);box.append(c,t,acc,s)}

 ['1','2','3','4','5','6','7','8','9','Borrar','0'].forEach(k=>{const x=el('button','',k);x.type='button';if(k==='Borrar')x.style.fontSize='1rem';

  x.addEventListener('click',()=>{if(k==='Borrar'){v='';show();msg.hidden=true;return}

   if(v.length>=4)return;v+=k;show();

   if(v.length===4){if(v===cfg.c)abrir();else{msg.className='aviso mal';msg.textContent='Código incorrecto. Intenten de nuevo.';msg.hidden=false;setTimeout(()=>{v='';show()},500)}}});pad.appendChild(x)});

});



/* ---- Desafíos diarios ---- */

const D=$('#diarios');

const WORDS=['AMIGO','BESOS','CALMA','CARTA','CIELO','DULCE','FELIZ','FUEGO','HOGAR','JUNTO','LUCES','MIRAR','NOCHE','PLAYA','RISAS','SUENO','TARDE','VERDE','VIAJE','BAILE','ABRIL','AROMA','BRISA','CAMPO','CANTO','GUSTO','MANTA','NUBES','PAUSA','ROSAS','SABOR','FLORA'];

juego(D,'wordle','Wordle Avanzado','grid',(b,dlg)=>{

 if(gate(b,'wordle'))return;b.innerHTML='';

 const W=pick(WORDS,1),L=5,MAX=6,rows=[],kk={};let cur='',n=0,over=false;

 b.appendChild(el('p','','Adivinen la palabra de 5 letras en 6 intentos. Verde: letra en su lugar. Amarillo: está en otro lugar. Gris: no está.'));

 const grid=el('div');for(let i=0;i<MAX;i++){const r=el('div','fila'),cs=[];for(let j=0;j<L;j++){const c=el('div','l');r.appendChild(c);cs.push(c)}grid.appendChild(r);rows.push(cs)}

 const msg=el('div','aviso');msg.hidden=true;const kb=el('div','kb');b.append(grid,msg,kb);

 const draw=()=>rows[n].forEach((c,i)=>c.textContent=cur[i]||'');

 const typ=ch=>{if(!over&&cur.length<L){cur+=ch;draw()}},del=()=>{if(!over){cur=cur.slice(0,-1);draw()}};

 function send(){if(over)return;if(cur.length<L){msg.className='aviso mal';msg.textContent='Faltan letras.';msg.hidden=false;return}msg.hidden=true;

  const res=Array(L).fill('no'),cnt={};for(const ch of W)cnt[ch]=(cnt[ch]||0)+1;

  for(let i=0;i<L;i++)if(cur[i]===W[i]){res[i]='ok';cnt[cur[i]]--}

  for(let i=0;i<L;i++)if(res[i]!=='ok'&&cnt[cur[i]]>0){res[i]='m';cnt[cur[i]]--}

  const rk={no:1,m:2,ok:3};

  res.forEach((s,i)=>{rows[n][i].classList.add(s);const ch=cur[i];if(!kk[ch]||rk[s]>rk[kk[ch].s]){kk[ch]={s};const kb2=kb.querySelector('[data-k="'+ch+'"]');kb2.className=s}});

  n++;

  if(cur===W){over=true;setRes('wordle',n+'/'+MAX);msg.className='aviso ok';msg.innerHTML='<b>Muy bien</b>';msg.append('La palabra era '+W+'. La resolvieron en '+n+' intentos.');msg.hidden=false}

  else if(n===MAX){over=true;setRes('wordle','X/'+MAX);msg.className='aviso mal';msg.textContent='La palabra era '+W+'. Mañana habrá otra.';msg.hidden=false}

  cur=''}

 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').forEach(k=>{const x=el('button','',k);x.type='button';x.dataset.k=k;x.addEventListener('click',()=>typ(k));kb.appendChild(x)});

 const bd=el('button','','Borrar'),be=el('button','','Enviar');bd.type=be.type='button';bd.addEventListener('click',del);be.addEventListener('click',send);kb.append(bd,be);

 const kh=e=>{if(!dlg.open||e.ctrlKey||e.metaKey||e.altKey)return;if(/^[a-zA-Z]$/.test(e.key))typ(e.key.toUpperCase());else if(e.key==='Backspace')del();else if(e.key==='Enter'){e.preventDefault();send()}};

 if(dlg._kh)document.removeEventListener('keydown',dlg._kh);dlg._kh=kh;document.addEventListener('keydown',kh);

});



const CS=[[['Playa','SOL','ARENA','MAR','TOALLA'],['Postres','FLAN','TORTA','HELADO','BROWNIE'],['Instrumentos','GUITARRA','PIANO','VIOLÍN','FLAUTA'],['Planetas','MARTE','VENUS','SATURNO','URANO']],

 [['Frutas','MANZANA','PERA','UVA','KIWI'],['Colores','ROJO','VERDE','ROSA','AZUL'],['Animales','GATO','PERRO','LORO','CABALLO'],['Capitales','LIMA','QUITO','ROMA','PARÍS']],

 [['Cine','ACTOR','GUION','CÁMARA','ESCENA'],['Cocina','HORNO','SARTÉN','CUCHARA','OLLA'],['Escuela','LÁPIZ','CUADERNO','PIZARRA','RECREO'],['Casa','SOFÁ','CAMA','MESA','SILLA']],

 [['Días','LUNES','MARTES','JUEVES','VIERNES'],['Meses','ENERO','MAYO','JUNIO','JULIO'],['Estaciones','VERANO','OTOÑO','INVIERNO','PRIMAVERA'],['Puntos cardinales','NORTE','SUR','ESTE','OESTE']]];

juego(D,'conex','Conexiones 4x4','grid',b=>{

 if(gate(b,'conex'))return;b.innerHTML='';

 const set=pick(CS,3),GC=['#F1E6C8','#D9E4D2','#D3E0E8','#E3DAEA'];

 let words=shuf(set.flatMap((g,gi)=>g.slice(1).map(w=>({w,gi}))),rng(today().seed+11)),sel=[],solved=[],err=0,over=false;

 b.appendChild(el('p','','Agrupen las 16 palabras en 4 categorías ocultas. Elijan 4 y pulsen Enviar. Pueden equivocarse hasta 3 veces.'));

 const top=el('div'),g=el('div','cg'),msg=el('div','aviso'),acc=el('div','acc'),bt=el('button','btn','Enviar');bt.type='button';acc.appendChild(bt);msg.hidden=true;b.append(top,g,acc,msg);

 const say=(c,t)=>{msg.className='aviso '+c;msg.textContent=t;msg.hidden=false};

 function draw(){top.innerHTML='';solved.forEach(gi=>{const d=el('div','grp');d.style.setProperty('--c',GC[gi]);d.append(el('b','',set[gi][0]+': '),document.createTextNode(set[gi].slice(1).join(', ')));top.appendChild(d)});

  g.innerHTML='';words.filter(x=>!solved.includes(x.gi)).forEach(x=>{const c=el('button',sel.includes(x)?'on':'',x.w);c.type='button';c.addEventListener('click',()=>{if(over)return;const i=sel.indexOf(x);if(i>=0)sel.splice(i,1);else if(sel.length<4)sel.push(x);draw()});g.appendChild(c)})}

 bt.addEventListener('click',()=>{if(over||sel.length!==4)return;const cn={};sel.forEach(x=>cn[x.gi]=(cn[x.gi]||0)+1);const best=Math.max(...Object.values(cn));

  if(best===4){solved.push(sel[0].gi);sel=[];msg.hidden=true;draw();

   if(solved.length===4){over=true;setRes('conex','4/4 grupos, '+err+(err===1?' error':' errores'));say('ok','Resolvieron las 4 categorías con '+err+(err===1?' error.':' errores.'))}}

  else{err++;say('mal',best===3?'Casi: tres de esas palabras van juntas.':'Esas palabras no forman un grupo.');sel=[];

   if(err>=4){over=true;setRes('conex',solved.length+'/4 grupos');[0,1,2,3].forEach(i=>{if(!solved.includes(i))solved.push(i)});say('mal','Se acabaron los intentos. Mañana habrá otro panel.')}draw()}});

 draw();

});



/* ---- Copiar puntaje ---- */

$('#b-copy').addEventListener('click',()=>{

 const r=getRes(),d=today().d,f=String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();

 const txt='Nuestro Rincon - '+f+'\nWordle: '+(r.wordle||'pendiente')+'\nConexiones: '+(r.conex||'pendiente');

 const ta=$('#copy-t'),s=$('#copy-s');ta.value=txt;

 const fb=()=>{ta.hidden=false;ta.focus();ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(e){}s.textContent=ok?'Puntaje copiado.':'Selecciona el texto y cópialo.'};

 if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(txt).then(()=>{ta.hidden=true;s.textContent='Puntaje copiado.'},fb);else fb();

});



/* ---- Buzón ---- */

const KEY='notas',au=$('#autor'),tx=$('#texto'),es=$('#est');let notas=ld(KEY,[]);if(!Array.isArray(notas))notas=[];au.value=ld('autor','')||'';

const col=n=>{let h=0;for(const ch of (n||'').trim().toLowerCase())h=(h*31+ch.charCodeAt(0))>>>0;return COL[h%5]};

function dibuja(){const bx=$('#notas');bx.innerHTML='';

 if(!notas.length){bx.appendChild(el('p','vacio','Todavía no hay mensajes. El primero que escribas se pegará aquí.'));return}

 notas.slice().reverse().forEach((n,i)=>{const a=el('article','nota');a.style.setProperty('--c',n.color||col(n.autor));a.style.setProperty('--g',giro(i));

  const f=el('footer'),s=el('span');let d='';try{d=new Date(n.fecha).toLocaleDateString('es',{day:'numeric',month:'long',year:'numeric'})}catch(e){}

  s.textContent=(n.autor?n.autor+' · ':'')+d;const q=el('button','q','Quitar');q.type='button';

  q.addEventListener('click',()=>{if(!confirm('¿Quitar este mensaje?'))return;notas=notas.filter(x=>x.id!==n.id);sv(KEY,notas);dibuja()});

  f.append(s,q);a.append(el('p','',n.texto),f);bx.appendChild(a)})}

$('#form').addEventListener('submit',e=>{e.preventDefault();const t=tx.value.trim(),a=au.value.trim();

 if(!t){es.textContent='Escribe algo antes de guardar.';tx.focus();return}

 notas.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),autor:a,texto:t,fecha:new Date().toISOString(),color:col(a)});

 const ok=sv(KEY,notas);if(a)sv('autor',a);tx.value='';es.textContent=ok?'Mensaje guardado.':'Se pegó, pero el navegador no permite guardarlo (¿modo privado?).';dibuja()});

 tx.addEventListener('input',()=>{es.textContent=''});
 window.nrStore?.onChange('notas',remote=>{
  notas=Array.isArray(remote)?structuredClone(remote):[];dibuja();
 });
 dibuja();

})();
