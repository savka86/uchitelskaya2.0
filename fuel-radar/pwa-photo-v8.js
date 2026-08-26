(()=>{'use strict';
const ENDPOINT='https://oetqjkmlzwemreldpbui.supabase.co/functions/v1/station-media-upload-safe';
const CONTROL='https://oetqjkmlzwemreldpbui.supabase.co/functions/v1/radar-control';
const KEY='sb_publishable_kqlxVotJ_ZWooXMofhDVfg_KTYT42ou';
const YANDEX_KEY='fe65e2ff-4677-425d-9d58-38dff96982dd';
let source=null,canvas=null,boxes=[],drag=null,safeFile=null,safeUrl=null,yandexPromise=null;
const $=id=>document.getElementById(id);
const say=t=>{const n=$('mediaMsg');if(n)n.textContent=t};
function clearSafe(){if(safeUrl)URL.revokeObjectURL(safeUrl);safeUrl=null;safeFile=null}

function setupEmergencyControl(){
  if(window.__RADAR_EMERGENCY_CONTROL)return;
  window.__RADAR_EMERGENCY_CONTROL=true;
  const s=document.createElement('style');
  s.textContent='#radarShutdown{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:24px;background:var(--bg,#0b1017);color:var(--text,#f3f4f6);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}#radarShutdown[hidden]{display:none}#radarShutdown .shutdownCard{width:min(560px,100%);text-align:center;background:var(--card,#151b24);border:1px solid var(--line,#303846);border-radius:24px;padding:30px 24px;box-shadow:0 24px 80px #0008}#radarShutdown .shutdownIcon{font-size:52px;line-height:1;margin-bottom:14px}#radarShutdown h1{font-size:27px;margin:0 0 10px}#radarShutdown p{font-size:16px;margin:0;color:var(--muted,#a2aaba)}#radarShutdown small{display:block;margin-top:16px;color:var(--muted,#a2aaba)}';
  document.head.appendChild(s);
  const overlay=document.createElement('div');
  overlay.id='radarShutdown';overlay.hidden=true;
  overlay.innerHTML='<div class="shutdownCard"><div class="shutdownIcon">⛔</div><h1>Радар временно отключён</h1><p id="radarShutdownMessage">Сервис временно недоступен</p><small>Страница восстановится автоматически после включения сервиса.</small></div>';
  document.body.appendChild(overlay);
  let locked=false;
  const apply=j=>{const off=j&&j.enabled===false;if(off){locked=true;const msg=$('radarShutdownMessage');if(msg)msg.textContent=String(j.message||'Сервис временно недоступен');overlay.hidden=false;document.body.style.overflow='hidden';document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}})}else if(locked){locked=false;overlay.hidden=true;document.body.style.overflow=''}};
  const check=async()=>{try{const r=await fetch(CONTROL+'?t='+Date.now(),{cache:'no-store'});if(r.ok)apply(await r.json())}catch{}};
  check();setInterval(check,4000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});window.addEventListener('focus',check)
}

function ensureYandexApi(){
  if(window.ymaps3)return window.ymaps3.ready;
  if(yandexPromise)return yandexPromise;
  yandexPromise=new Promise((resolve,reject)=>{
    const sc=document.createElement('script');
    sc.src='https://api-maps.yandex.ru/v3/?apikey='+encodeURIComponent(YANDEX_KEY)+'&lang=ru_RU';
    sc.async=true;
    sc.onload=()=>{if(!window.ymaps3){reject(Error('Яндекс Карты не загрузились'));return}window.ymaps3.ready.then(resolve,reject)};
    sc.onerror=()=>reject(Error('Не удалось загрузить Яндекс Карты'));
    document.head.appendChild(sc)
  });
  return yandexPromise
}

function setupYandexMap(){
  if(window.__RADAR_YANDEX_MAP)return;
  window.__RADAR_YANDEX_MAP=true;
  const st=document.createElement('style');
  st.textContent='.ymarker{--marker:#64748b;position:relative;width:20px;height:20px;padding:0;border:2px solid #fff;border-radius:50%;background:var(--marker);box-shadow:0 2px 8px #0008;cursor:pointer;transform:translate(-50%,-50%);transition:width .15s ease,height .15s ease,box-shadow .15s ease;overflow:visible}.ymarker.selected{width:27px;height:27px;box-shadow:0 0 0 5px #2563eb33,0 4px 12px #0009;z-index:50}.ymarkerBubble{display:none;position:absolute;left:50%;bottom:30px;transform:translateX(-50%);width:220px;max-width:65vw;padding:9px 10px;text-align:left;border-radius:11px;background:var(--card,#fff);color:var(--text,#111827);border:1px solid var(--line,#d9dee6);box-shadow:0 10px 28px #0005;white-space:normal;font:12px/1.35 system-ui;pointer-events:none}.ymarker.selected .ymarkerBubble{display:block}.ymarkerBubble b{display:block;font-size:13px;margin-bottom:3px}.ymarkerBubble span{display:block;color:var(--muted,#687386);margin-top:2px}.yandexMapError{display:grid;place-items:center;height:100%;padding:20px;text-align:center;color:#991b1b;background:#fee2e2;font-weight:750}';
  document.head.appendChild(st);

  const selectMarker=id=>{
    try{state.selectedId=String(id);(state.markers||[]).forEach(m=>m.el?.classList.toggle('selected',String(m.id)===String(id)))}catch{}
  };
  window.focusMapStation=id=>{
    try{const m=(state.markers||[]).find(x=>String(x.id)===String(id));if(!m||!state.map||state.mapKind!=='yandex')return;selectMarker(id);state.map.setLocation({center:[m.lon,m.lat],zoom:14,duration:300})}catch{}
  };

  const oldRenderList=window.renderList;
  if(typeof oldRenderList==='function'){
    window.renderList=function(rows){
      oldRenderList(rows);
      document.querySelectorAll('[data-station-id]').forEach(card=>{
        card.addEventListener('click',e=>{if(e.target.closest('button,a,input,select,textarea'))return;window.focusMapStation?.(card.dataset.stationId)})
      })
    }
  }

  window.renderMap=async function(rows){
    const mapEl=$('map'),status=$('mapStatus');
    if(!mapEl)return;
    const seq=(state.mapRenderSeq||0)+1;state.mapRenderSeq=seq;
    if(state.mapKind!=='yandex'&&state.map){try{state.map.remove?.()}catch{}state.map=null;state.markers=[];mapEl.innerHTML=''}
    try{
      await ensureYandexApi();
      if(seq!==state.mapRenderSeq)return;
      const {YMap,YMapDefaultSchemeLayer,YMapDefaultFeaturesLayer,YMapMarker}=ymaps3;
      if(!state.map||state.mapKind!=='yandex'){
        mapEl.innerHTML='';
        const theme=document.documentElement.dataset.theme==='dark'?'dark':'light';
        state.map=new YMap(mapEl,{location:{center:[129.70,62.04],zoom:10},theme,zoomRange:{min:4,max:16}});
        state.map.addChild(new YMapDefaultSchemeLayer());
        state.map.addChild(new YMapDefaultFeaturesLayer({zIndex:1800}));
        state.mapKind='yandex'
      }
      (state.markers||[]).forEach(m=>{try{state.map.removeChild(m.entity)}catch{}});state.markers=[];
      const pts=[];
      rows.forEach(s=>{
        const lat=Number(s.lat),lon=Number(s.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
        const el=document.createElement('button');el.type='button';el.className='ymarker';el.style.setProperty('--marker',markerColor(s));el.setAttribute('aria-label',(s.name||'АЗС')+', '+statusLabel(statusOf(s)));
        const bubble=document.createElement('span');bubble.className='ymarkerBubble';
        const name=document.createElement('b');name.textContent=s.name||'АЗС';
        const addr=document.createElement('span');addr.textContent=s.address||'';
        const stat=document.createElement('span');stat.textContent=statusLabel(statusOf(s));
        bubble.append(name,addr,stat);el.appendChild(bubble);
        el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectMarker(s.id);try{focusListStation(s.id)}catch{}});
        const entity=new YMapMarker({coordinates:[lon,lat]},el);state.map.addChild(entity);
        state.markers.push({entity,el,id:s.id,lat,lon});pts.push([lon,lat]);
        if(String(state.selectedId)===String(s.id))el.classList.add('selected')
      });
      if(pts.length===1)state.map.setLocation({center:pts[0],zoom:14,duration:250});
      else if(pts.length>1){const lons=pts.map(p=>p[0]),lats=pts.map(p=>p[1]);state.map.setLocation({bounds:[[Math.min(...lons),Math.min(...lats)],[Math.max(...lons),Math.max(...lats)]],duration:250})}
      if(status)status.textContent='Яндекс · '+pts.length+' точек'
    }catch(err){
      console.error('Yandex Maps',err);if(status)status.textContent='Яндекс Карты недоступны';mapEl.innerHTML='<div class="yandexMapError">Не удалось загрузить Яндекс Карты.<br>Проверьте активацию API-ключа и ограничение HTTP Referer.</div>'
    }
  };
  try{if(state.map&&state.mapKind!=='yandex'){state.map.remove?.();state.map=null;state.markers=[];$('map').innerHTML=''}}catch{}
  try{render()}catch{}
}

function moveFiltersBelowInstruction(){const filters=$('filters'),guide=$('radarInstruction');if(!filters||!guide)return;guide.insertAdjacentElement('afterend',filters);filters.style.marginTop='4px';filters.style.marginBottom='12px'}

function setupTheme(){
  if(window.__RADAR_THEME)return;window.__RADAR_THEME=true;
  const s=document.createElement('style');
  s.textContent='html[data-theme="light"]{color-scheme:light;--bg:#f4f6f8;--card:#fff;--text:#111827;--muted:#687386;--line:#d9dee6;--blue:#2563eb;--green:#15803d;--red:#dc2626;--amber:#b45309;--guide-bg:#fff7ed;--guide-card:#fff;--guide-line:#f59e0b;--guide-note:#ffedd5;--guide-muted:#7c2d12;--guide-shadow:#92400e22}html[data-theme="dark"]{color-scheme:dark;--bg:#0b1017;--card:#151b24;--text:#f3f4f6;--muted:#a2aaba;--line:#303846;--blue:#60a5fa;--green:#4ade80;--red:#f87171;--amber:#fbbf24;--guide-bg:#21190e;--guide-card:#2a2115;--guide-line:#f59e0b;--guide-note:#352713;--guide-muted:#fdba74;--guide-shadow:#0008}body{transition:background .18s ease,color .18s ease}.themeToggle{min-height:38px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--text);padding:0 12px;font-weight:850;cursor:pointer;box-shadow:0 2px 8px #0001}.themeToggle:active{transform:translateY(1px)}html[data-theme="dark"] .notice{background:#172554;color:#bfdbfe;border-color:#1d4ed8}html[data-theme="dark"] .hint{background:#172554;color:#bfdbfe}';
  document.head.appendChild(s);
  let saved='';try{saved=localStorage.getItem('radar-theme')||''}catch{}
  let theme=saved==='dark'||saved==='light'?saved:(window.matchMedia&&matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
  const apply=t=>{theme=t;document.documentElement.dataset.theme=t;try{localStorage.setItem('radar-theme',t)}catch{}const b=$('themeToggle');if(b){b.textContent=t==='dark'?'🌙 Тёмная':'☀️ Светлая';b.setAttribute('aria-label','Переключить цветовую тему')}const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',t==='dark'?'#0b1017':'#f4f6f8');try{if(typeof state!=='undefined'&&state.mapKind==='yandex'&&state.map?.update)state.map.update({theme:t})}catch{}};
  const head=document.querySelector('.head');if(head&&!$('themeToggle')){const b=document.createElement('button');b.id='themeToggle';b.className='themeToggle';b.type='button';b.onclick=()=>apply(theme==='dark'?'light':'dark');head.appendChild(b)}apply(theme)
}

function addInstruction(){
  if($('radarInstruction'))return;const updates=$('updates')?.closest('.section');if(!updates)return;
  const s=document.createElement('style');
  s.textContent='#radarInstruction{position:relative;overflow:hidden;border:2px solid var(--guide-line)!important;background:var(--guide-bg)!important;box-shadow:0 12px 30px var(--guide-shadow);padding:16px!important;margin-top:4px;margin-bottom:18px!important}#radarInstruction:before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,#f59e0b,#f97316)}#radarInstruction .sectionHead{margin-top:4px;margin-bottom:12px}#radarInstruction .sectionHead h2{font-size:21px;font-weight:900}#radarInstruction .sectionHead .muted{color:var(--guide-muted);font-weight:750}#radarInstruction .guideGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}#radarInstruction .guideItem{border:1px solid color-mix(in srgb,var(--guide-line) 42%,var(--line));border-radius:13px;padding:13px;background:var(--guide-card);font-size:15px;line-height:1.48;box-shadow:0 2px 8px #0000000d}#radarInstruction .guideItem b{display:block;font-size:16px;margin-bottom:5px;color:var(--text)}#radarInstruction .guideNote{margin-top:11px;padding:11px 13px;border-left:5px solid var(--guide-line);border-radius:0 11px 11px 0;background:var(--guide-note);font-size:14px;line-height:1.48;color:var(--text)}@media(max-width:900px){#radarInstruction .guideGrid{grid-template-columns:1fr 1fr}}@media(max-width:560px){#radarInstruction{padding:14px!important}#radarInstruction .guideGrid{grid-template-columns:1fr}#radarInstruction .sectionHead{align-items:flex-start;flex-direction:column;gap:2px}}';
  document.head.appendChild(s);
  const box=document.createElement('section');box.className='section';box.id='radarInstruction';box.innerHTML='<div class="sectionHead"><h2>📖 Инструкция</h2><span class="muted">Как пользоваться Радаром</span></div><div class="guideGrid"><div class="guideItem"><b>1. Найди АЗС</b>Выбери нужную заправку на карте или в списке.</div><div class="guideItem"><b>2. Проверь статус</b>Посмотри свежие сообщения о топливе и очереди.</div><div class="guideItem"><b>3. Помоги другим</b>Нажми «Сообщить статус» и укажи реальную обстановку.</div><div class="guideItem"><b>4. Добавь фото</b>При желании прикрепи безопасное фото. Оно удалится автоматически через 1 час.</div></div><div class="guideNote"><b>Важно:</b> не публикуйте сведения об охраняемых и военных объектах, системах безопасности, ПВО, последствиях атак БПЛА или работе силовых и экстренных служб.</div>';
  updates.insertAdjacentElement('afterend',box)
}

function patch2gisStatuses(){
  if(window.__RADAR_2GIS_STATUS_PATCH)return;window.__RADAR_2GIS_STATUS_PATCH=true;
  const st=document.createElement('style');st.textContent='.pill.limited{background:#fef3c7;color:#92400e}.source.official2gis{padding:8px 9px;border-radius:9px;background:var(--bg);line-height:1.45}.source.official2gis b{color:var(--text)}';document.head.appendChild(st);
  const xesc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.statusOf=function(s){const r=s?.latest_report;if(r?.created_at&&Date.now()-new Date(r.created_at).getTime()<3600000){if(r.report_type==='available')return 'available';if(r.report_type==='empty')return 'empty';if(r.report_type==='queue')return 'queue'}if(s?.official_status==='open')return 'available';if(s?.official_status==='limited')return 'limited';if(s?.official_status==='closed')return 'empty';return 'unknown'};
  window.statusLabel=function(t){return t==='available'?'✅ Есть':t==='limited'?'🟡 Частично':t==='empty'?'❌ Нет':t==='queue'?'🚗 Очередь':'Нет свежих данных'};
  window.markerColor=function(s){const t=statusOf(s);return t==='available'?'#22c55e':t==='limited'?'#f59e0b':t==='empty'?'#ef4444':t==='queue'?'#f59e0b':'#64748b'};
  window.sourceHtml=function(s){if(!s?.source_name||!String(s.source_name).includes('2ГИС'))return '';const when=s.official_published_at&&typeof rel==='function'?' · '+rel(s.official_published_at):'';const note=s.official_note?'<div>'+xesc(s.official_note)+'</div>':'';const link=s.source_url?'<div><a href="'+xesc(s.source_url)+'" target="_blank" rel="noopener noreferrer">Открыть статус в 2ГИС ↗</a></div>':'';return '<div class="source official2gis"><b>'+xesc(s.source_name)+'</b>'+when+note+link+'</div>'};
  const filters=$('filters');if(filters&&!filters.querySelector('[data-filter="limited"]')){const b=document.createElement('button');b.type='button';b.dataset.filter='limited';b.textContent='🟡 Частично';const after=filters.querySelector('[data-filter="available"]');after?.insertAdjacentElement('afterend',b);b.onclick=()=>{filters.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.filter='limited';render()}}
  try{render()}catch{}
}

function editor(){
  let w=$('pwaPhotoEditor');if(w)return w;
  w=document.createElement('div');w.id='pwaPhotoEditor';w.hidden=true;
  w.innerHTML='<div class="pp"><div class="ph"><b>🔒 Проверка фото</b><button id="px" type="button">✕</button></div><p>Проверьте лица, госномера и чувствительные детали. Проведите пальцем по области, которую нужно скрыть.</p><div class="pc"><canvas id="pwaCanvas"></canvas></div><div class="pa"><button id="undo" type="button">↩ Отменить</button><button id="done" type="button">✓ Готово</button></div></div>';
  const s=document.createElement('style');s.textContent='#pwaPhotoEditor{position:fixed;inset:0;z-index:2147483647;background:#000d;padding:12px;overflow:auto;color:#111;font:15px system-ui}#pwaPhotoEditor[hidden]{display:none}.pp{max-width:760px;margin:auto;background:#fff;border-radius:18px;padding:14px}.ph{display:flex;justify-content:space-between;align-items:center}.ph b{font-size:19px}.ph button,.pa button{min-height:44px;border:1px solid #ddd;border-radius:12px;background:#fff;font-weight:800;padding:0 14px}.pp p{background:#eff6ff;color:#1e3a8a;padding:10px;border-radius:11px}.pc{background:#111827;border-radius:14px;overflow:hidden;display:grid;place-items:center;touch-action:none}.pc canvas{display:block;max-width:100%;max-height:65vh;touch-action:none}.pa{display:grid;grid-template-columns:1fr 1.4fr;gap:9px;margin-top:12px}.pa #done{background:#111827;color:#fff}@media(max-width:560px){.pa{grid-template-columns:1fr}}';document.head.appendChild(s);document.body.appendChild(w);canvas=$('pwaCanvas');
  $('px').onclick=()=>{w.hidden=true;source=null;boxes=[]};$('undo').onclick=()=>{boxes.pop();draw()};$('done').onclick=finish;
  const pos=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
  canvas.addEventListener('pointerdown',e=>{if(!source)return;drag=pos(e);canvas.setPointerCapture?.(e.pointerId);e.preventDefault()});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;draw();const q=pos(e),g=canvas.getContext('2d');g.strokeStyle='#ef4444';g.lineWidth=Math.max(3,canvas.width/300);g.strokeRect(drag.x,drag.y,q.x-drag.x,q.y-drag.y);e.preventDefault()});
  canvas.addEventListener('pointerup',e=>{if(!drag)return;const q=pos(e),r={x:Math.min(drag.x,q.x),y:Math.min(drag.y,q.y),w:Math.abs(q.x-drag.x),h:Math.abs(q.y-drag.y)};drag=null;if(r.w>12&&r.h>12)boxes.push(r);draw();e.preventDefault()});
  return w
}
function pixel(g,b,r){const x=Math.max(0,r.x|0),y=Math.max(0,r.y|0),w=Math.min(b.width-x,Math.ceil(r.w)),h=Math.min(b.height-y,Math.ceil(r.h));if(w<2||h<2)return;const m=document.createElement('canvas');m.width=Math.max(1,Math.round(w/14));m.height=Math.max(1,Math.round(h/14));m.getContext('2d').drawImage(b,x,y,w,h,0,0,m.width,m.height);g.save();g.imageSmoothingEnabled=false;g.drawImage(m,0,0,m.width,m.height,x,y,w,h);g.restore()}
function draw(){if(!source||!canvas)return;canvas.width=source.width;canvas.height=source.height;const g=canvas.getContext('2d');g.drawImage(source,0,0);boxes.forEach(r=>pixel(g,source,r))}
async function toCanvas(file){if(file.size>25*1024*1024)throw Error('Фото больше 25 МБ');let im;try{im=await createImageBitmap(file,{imageOrientation:'from-image'})}catch{im=await new Promise((ok,no)=>{const u=URL.createObjectURL(file),x=new Image();x.onload=()=>{URL.revokeObjectURL(u);ok(x)};x.onerror=()=>{URL.revokeObjectURL(u);no(Error('Не удалось открыть фото'))};x.src=u})}const iw=im.width||im.naturalWidth,ih=im.height||im.naturalHeight,k=Math.min(1,1920/Math.max(iw,ih)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(iw*k));c.height=Math.max(1,Math.round(ih*k));const g=c.getContext('2d',{alpha:false});g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);im.close?.();return c}
async function finish(){draw();let blob=null;for(const q of [.88,.8,.72,.64]){blob=await new Promise(ok=>canvas.toBlob(ok,'image/jpeg',q));if(blob&&blob.size<=5*1024*1024)break}if(!blob||blob.size>5*1024*1024){say('Фото после обработки больше 5 МБ.');return}clearSafe();safeFile=new File([blob],`SAFE_${Date.now()}.jpg`,{type:'image/jpeg'});safeUrl=URL.createObjectURL(safeFile);const img=$('mediaImagePreview');if(img){img.src=safeUrl;img.classList.add('show')}$('filePreview')?.classList.add('show');const meta=$('filePreviewMeta');if(meta)meta.textContent='JPEG · EXIF/GPS удалены · удалится через 1 час';$('pwaPhotoEditor').hidden=true;say('Фото готово. Подтвердите согласие и нажмите «Загрузить фото».');const b=$('sendMedia');if(b){b.disabled=false;b.textContent='Загрузить фото'}}
async function upload(e){e.preventDefault();e.stopImmediatePropagation();if(!$('mediaConsent')?.checked){say('Подтвердите согласие на публикацию.');return}if(!safeFile){say('Сначала выберите и проверьте фото.');return}const station=$('mediaStationId')?.value;if(!station){say('АЗС не выбрана.');return}const b=$('sendMedia');if(b){b.disabled=true;b.textContent='Загрузка…'}try{const f=new FormData();f.append('station_id',station);f.append('consent_accepted','yes');f.append('consent_version','media-v1-2026-08-23');f.append('privacy_processed','yes');f.append('privacy_reviewed','yes');f.append('privacy_method','pwa-canvas-manual-redaction-v1');f.append('file',safeFile,safeFile.name);const r=await fetch(ENDPOINT,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY},body:f});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Ошибка загрузки');say('Готово! Фото появилось в карточке и удалится через час.');if(b)b.textContent='Готово';setTimeout(()=>{$('mediaDialog')?.close();clearSafe();window.loadMedia?.()},700)}catch(x){say('Ошибка: '+String(x.message||x));if(b){b.disabled=false;b.textContent='Загрузить фото'}}}

function init(){
  setupEmergencyControl();setupYandexMap();setupTheme();patch2gisStatuses();addInstruction();moveFiltersBelowInstruction();try{render()}catch{}
  const inp=$('mediaFile'),form=$('mediaForm');if(!inp||!form){setTimeout(init,100);return}if(window.__SAFE_RADAR_PHOTO)return;window.__SAFE_RADAR_PHOTO=true;
  inp.accept='image/*';const hint=document.querySelector('#mediaDialog .mediaHint');if(hint)hint.innerHTML='<b>Фото в безопасном режиме.</b> Создаётся новая JPEG-копия без EXIF/GPS. Проверьте лица, номера и чувствительные детали; при необходимости замажьте их пальцем. Видео в публичной версии отключено.';
  inp.addEventListener('change',async e=>{e.stopImmediatePropagation();const f=inp.files?.[0];if(!f)return;if(!String(f.type||'').startsWith('image/')){inp.value='';say('Можно загрузить только фото.');return}const b=$('sendMedia');if(b)b.disabled=true;try{clearSafe();boxes=[];source=await toCanvas(f);editor().hidden=false;draw();say('Фото обрабатывается только на этом устройстве.')}catch(x){inp.value='';say('Ошибка: '+String(x.message||x))}},true);
  form.addEventListener('submit',upload,true)
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();