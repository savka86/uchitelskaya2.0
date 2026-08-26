(()=>{'use strict';
if(window.__RADAR_QUEUE_POINTS)return;window.__RADAR_QUEUE_POINTS=true;

let queuePoint=null,pickerMap=null,pickerEntities=[];
const $q=id=>document.getElementById(id);

function injectStyles(){
  const st=document.createElement('style');
  st.textContent='.queuePointRow{display:none;margin:10px 0;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--bg)}.queuePointRow.show{display:block}.queuePointRow b{display:block;margin-bottom:4px}.queuePointHelp{font-size:12px;color:var(--muted);margin:0 0 8px}.queuePointActions{display:flex;gap:7px;flex-wrap:wrap}.queuePointActions button{min-height:38px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);padding:0 11px;font-weight:800;cursor:pointer}.queuePointActions .pick{border-color:var(--amber);color:var(--amber)}.queuePointState{font-size:12px;color:var(--muted);margin-top:7px}.queuePointState.ready{color:var(--green);font-weight:800}#queuePointMap{height:430px;border-radius:12px;overflow:hidden;background:#e5e7eb;margin-top:10px}.queuePickerHint{padding:9px 10px;border-radius:10px;background:var(--bg);font-size:12px;color:var(--muted)}.queueStartMarker{position:relative;width:34px;height:34px;border:2px solid #fff;border-radius:50%;background:#f59e0b;box-shadow:0 3px 12px #0006;display:grid;place-items:center;font-size:18px;cursor:pointer;transform:translate(-50%,-50%)}.queueStartMarker.mainQueue{width:30px;height:30px;font-size:16px}.queueStartBubble{display:none;position:absolute;left:50%;bottom:38px;transform:translateX(-50%);min-width:180px;max-width:70vw;padding:8px 9px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);box-shadow:0 8px 22px #0004;font:12px/1.35 system-ui;white-space:normal;z-index:20}.queueStartMarker:hover .queueStartBubble,.queueStartMarker:focus .queueStartBubble{display:block}.queueStationMarker{width:34px;height:34px;border:2px solid #fff;border-radius:50%;background:#111827;color:#fff;box-shadow:0 3px 12px #0006;display:grid;place-items:center;font-size:18px;transform:translate(-50%,-50%)}@media(max-width:560px){#queuePointMap{height:360px}}';
  document.head.appendChild(st);
}

function injectFormUi(){
  const reportForm=$q('reportForm'),queueLevel=$q('queueLevel');
  if(!reportForm||!queueLevel||$q('queuePointRow'))return;
  const row=document.createElement('div');row.id='queuePointRow';row.className='queuePointRow';
  row.innerHTML='<b>📍 Где начинается очередь?</b><p class="queuePointHelp">Поставьте точку примерно у последнего автомобиля. Геолокация устройства не запрашивается.</p><div class="queuePointActions"><button class="pick" id="pickQueuePoint" type="button">📍 Указать на карте</button><button id="clearQueuePoint" type="button" hidden>Убрать точку</button></div><div id="queuePointState" class="queuePointState">Необязательно</div>';
  queueLevel.closest('.row')?.insertAdjacentElement('afterend',row);

  const dlg=document.createElement('dialog');dlg.id='queuePointDialog';
  dlg.innerHTML='<form class="form" method="dialog"><h2>📍 Начало очереди</h2><p>Нажмите на карту там, где сейчас находится последний автомобиль в очереди.</p><div class="queuePickerHint">⛽ — выбранная АЗС &nbsp; · &nbsp; 🚗 — начало очереди. Точку можно переставить повторным нажатием.</div><div id="queuePointMap"></div><div class="buttons"><button id="cancelQueuePoint" type="button">Отмена</button><button id="doneQueuePoint" class="send" type="button">Готово</button></div></form>';
  document.body.appendChild(dlg);

  $q('pickQueuePoint').onclick=openPicker;
  $q('clearQueuePoint').onclick=()=>{queuePoint=null;updateState();};
  $q('cancelQueuePoint').onclick=()=>{dlg.close();destroyPicker();};
  $q('doneQueuePoint').onclick=()=>{dlg.close();destroyPicker();updateState();};
  $q('reportType')?.addEventListener('change',updateVisibility);
  updateVisibility();updateState();
}

function updateVisibility(){
  const row=$q('queuePointRow');if(!row)return;
  const show=$q('reportType')?.value==='queue';row.classList.toggle('show',show);
  if(!show){queuePoint=null;updateState();}
}
function updateState(){
  const n=$q('queuePointState'),c=$q('clearQueuePoint'),p=$q('pickQueuePoint');if(!n)return;
  if(queuePoint){n.textContent='✅ Точка начала очереди выбрана';n.classList.add('ready');if(c)c.hidden=false;if(p)p.textContent='📍 Изменить точку';}
  else{n.textContent='Необязательно';n.classList.remove('ready');if(c)c.hidden=true;if(p)p.textContent='📍 Указать на карте';}
}

async function ensureMaps(){
  if(window.ymaps3){await window.ymaps3.ready;return}
  throw Error('Яндекс Карты ещё загружаются. Попробуйте ещё раз через несколько секунд.');
}
function currentStation(){return (state?.stations||[]).find(s=>String(s.id)===String($q('stationId')?.value))}

async function openPicker(){
  const dlg=$q('queuePointDialog'),msg=$q('reportMsg'),s=currentStation();
  if(!dlg||!s)return;
  const lat=Number(s.lat),lon=Number(s.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon)){if(msg)msg.textContent='Для этой АЗС пока нет координат.';return}
  try{await ensureMaps();dlg.showModal();requestAnimationFrame(()=>buildPicker(s));}
  catch(e){if(msg)msg.textContent=String(e.message||e)}
}

function destroyPicker(){
  if(pickerMap){try{pickerMap.destroy?.()}catch{}try{pickerMap.remove?.()}catch{}}pickerMap=null;pickerEntities=[];
  const el=$q('queuePointMap');if(el)el.innerHTML='';
}
function addPickerPoint(s,lon,lat){
  if(!pickerMap)return;
  const {YMapMarker,YMapFeature}=ymaps3;
  for(const e of pickerEntities.splice(0)){try{pickerMap.removeChild(e)}catch{}}
  const stationEl=document.createElement('div');stationEl.className='queueStationMarker';stationEl.textContent='⛽';
  const sm=new YMapMarker({coordinates:[Number(s.lon),Number(s.lat)]},stationEl);pickerMap.addChild(sm);pickerEntities.push(sm);
  const qEl=document.createElement('button');qEl.type='button';qEl.className='queueStartMarker';qEl.textContent='🚗';
  const qm=new YMapMarker({coordinates:[lon,lat]},qEl);pickerMap.addChild(qm);pickerEntities.push(qm);
  try{const line=new YMapFeature({geometry:{type:'LineString',coordinates:[[lon,lat],[Number(s.lon),Number(s.lat)]]},style:{stroke:[{width:4,color:'#f59e0b',dash:[8,6]}]}});pickerMap.addChild(line);pickerEntities.push(line)}catch{}
}
async function buildPicker(s){
  destroyPicker();const el=$q('queuePointMap');if(!el)return;
  const {YMap,YMapDefaultSchemeLayer,YMapDefaultFeaturesLayer,YMapListener}=ymaps3;
  pickerMap=new YMap(el,{location:{center:[Number(s.lon),Number(s.lat)],zoom:15},zoomRange:{min:8,max:18}});
  pickerMap.addChild(new YMapDefaultSchemeLayer());pickerMap.addChild(new YMapDefaultFeaturesLayer({zIndex:1800}));
  const start=queuePoint?[queuePoint.lon,queuePoint.lat]:[Number(s.lon)+0.001,Number(s.lat)+0.0005];
  addPickerPoint(s,start[0],start[1]);
  if(!queuePoint)queuePoint={lon:start[0],lat:start[1]};
  const listener=new YMapListener({layerId:'any',onClick:(_object,event)=>{const c=event?.coordinates;if(!Array.isArray(c)||c.length<2)return;const lon=Number(c[0]),lat=Number(c[1]);if(!Number.isFinite(lon)||!Number.isFinite(lat))return;queuePoint={lon,lat};addPickerPoint(s,lon,lat);updateState();}});
  pickerMap.addChild(listener);pickerEntities.push(listener);
}

function wrapOpenReport(){
  const old=window.openReport;if(typeof old!=='function')return;
  window.openReport=function(id){queuePoint=null;updateState();const out=old(id);updateVisibility();return out};
}
function wrapFetch(){
  const old=window.fetch.bind(window);window.fetch=function(input,init){
    try{
      const u=typeof input==='string'?input:input?.url;
      if(u===REPORT&&String(init?.method||'GET').toUpperCase()==='POST'&&typeof init?.body==='string'){
        const b=JSON.parse(init.body);
        if(b.report_type==='queue'&&queuePoint){b.queue_lat=queuePoint.lat;b.queue_lon=queuePoint.lon;init={...init,body:JSON.stringify(b)}}
      }
    }catch{}
    return old(input,init)
  }
}

function wrapMainMap(){
  const old=window.renderMap;if(typeof old!=='function')return;
  window.renderMap=async function(rows){await old(rows);try{await renderQueueMarkers(rows||[])}catch(e){console.warn('queue markers',e)}};
}
async function renderQueueMarkers(rows){
  if(!state?.map||state.mapKind!=='yandex'||!window.ymaps3)return;
  await ymaps3.ready;
  for(const e of state.queueEntities||[]){try{state.map.removeChild(e)}catch{}}state.queueEntities=[];
  const {YMapMarker,YMapFeature}=ymaps3;
  for(const s of rows){
    const r=s?.latest_report,qlat=Number(r?.queue_lat),qlon=Number(r?.queue_lon),slat=Number(s?.lat),slon=Number(s?.lon);
    if(r?.report_type!=='queue'||!Number.isFinite(qlat)||!Number.isFinite(qlon)||!Number.isFinite(slat)||!Number.isFinite(slon))continue;
    const el=document.createElement('button');el.type='button';el.className='queueStartMarker mainQueue';el.textContent='🚗';el.setAttribute('aria-label','Начало очереди: '+(s.name||'АЗС'));
    const bubble=document.createElement('span');bubble.className='queueStartBubble';bubble.textContent='Начало очереди · '+(typeof rel==='function'?rel(r.created_at):'свежая отметка');el.appendChild(bubble);
    el.onclick=e=>{e.preventDefault();e.stopPropagation();try{focusListStation(s.id)}catch{}};
    const marker=new YMapMarker({coordinates:[qlon,qlat]},el);state.map.addChild(marker);state.queueEntities.push(marker);
    try{const line=new YMapFeature({geometry:{type:'LineString',coordinates:[[qlon,qlat],[slon,slat]]},style:{stroke:[{width:3,color:'#f59e0b',dash:[7,6]}]}});state.map.addChild(line);state.queueEntities.push(line)}catch{}
  }
}

injectStyles();injectFormUi();wrapOpenReport();wrapFetch();wrapMainMap();
try{render()}catch{}
})();