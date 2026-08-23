(()=>{
'use strict';
const SAFE_UPLOAD='https://oetqjkmlzwemreldpbui.supabase.co/functions/v1/station-media-upload-safe';
const PUBLIC_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlIiwicmVmIjoib2V0cWprbWx6d2VtcmVsZHBidWkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NzM4MDQyNywiZXhwIjoyMTAyOTU2NDI3fQ.OtIQDj7iqoIZxS54yz79-C3_B0nc-jYsKYssnic7Tq4';
const PRIVACY_METHOD='pwa-canvas-manual-redaction-v1';
const MAX_SOURCE=25*1024*1024;
const MAX_LONG_SIDE=1920;
const MAX_OUTPUT=5*1024*1024;
let frame=null,w=null,d=null,safeFile=null,safeUrl=null,source=null,canvas=null,rects=[],drag=null;
const $=id=>d&&d.getElementById(id);
const say=t=>{const n=$('mediaMsg');if(n)n.textContent=t};
function clearSafe(){if(safeUrl)URL.revokeObjectURL(safeUrl);safeUrl=null;safeFile=null}
function showDialog(st){
  clearSafe();
  const form=$('mediaForm'), dialog=$('mediaDialog'), input=$('mediaFile'), title=$('mediaDialogTitle'), hidden=$('mediaStationId'), send=$('sendMedia');
  if(!form||!dialog||!input||!hidden)return;
  form.reset();
  hidden.value=String(st&&st.id||'');
  if(title)title.textContent='Фото: '+String(st&&st.name||'АЗС');
  input.accept='image/*'; input.removeAttribute('capture');
  const hint=d.querySelector('#mediaDialog .mediaHint');
  if(hint)hint.innerHTML='<b>PWA-защита + удаление через 1 час.</b><br>Фото обрабатывается прямо на этом устройстве: создаётся новая JPEG-копия без EXIF/GPS. Проверьте лица и госномера и при необходимости замажьте их пальцем. Видео в PWA не загружается.';
  const lab=d.querySelector('label[for="mediaFile"]'); if(lab)lab.textContent='Выберите фото или снимите камерой';
  const vid=$('mediaVideoPreview'); if(vid){vid.pause?.();vid.classList.remove('show');vid.removeAttribute('src')}
  const img=$('mediaImagePreview'); if(img){img.classList.remove('show');img.removeAttribute('src')}
  $('filePreview')?.classList.remove('show');
  if(send){send.disabled=false;send.textContent='Загрузить фото'}
  say('Выберите фото. Исходный файл на сервер не отправляется.');
  dialog.showModal();
}
function editor(){
  let x=d.getElementById('radarPwaEditor'); if(x)return x;
  x=d.createElement('div'); x.id='radarPwaEditor'; x.hidden=true;
  x.innerHTML='<div class="rp-card"><div class="rp-head"><div><b>🔒 Проверка фото перед отправкой</b><span id="rpStatus">Подготавливаю фото…</span></div><button id="rpClose" type="button">✕</button></div><div class="rp-tip">Проверьте лица и госномера. Чтобы скрыть область, проведите по ней пальцем.</div><div class="rp-stage"><canvas id="rpCanvas"></canvas></div><div class="rp-actions"><button id="rpUndo" type="button">↩ Отменить область</button><button id="rpDone" type="button" class="rp-ok">✓ Готово, использовать фото</button></div></div>';
  const s=d.createElement('style');
  s.textContent='#radarPwaEditor{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.84);padding:12px;overflow:auto;color:#111827;font:15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}#radarPwaEditor[hidden]{display:none}.rp-card{max-width:760px;margin:auto;background:#fff;border-radius:18px;padding:14px}.rp-head{display:flex;justify-content:space-between;gap:12px}.rp-head b{font-size:18px}.rp-head span{display:block;font-size:12px;color:#64748b;margin-top:3px}.rp-head button,.rp-actions button{min-height:44px;border:1px solid #d7dce3;border-radius:12px;background:#fff;color:#111827;font-weight:800;padding:0 13px}.rp-tip{margin:12px 0;padding:10px 12px;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-size:13px}.rp-stage{background:#111827;border-radius:14px;overflow:hidden;display:grid;place-items:center;touch-action:none}.rp-stage canvas{display:block;max-width:100%;max-height:68vh;touch-action:none}.rp-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:9px;margin-top:12px}.rp-actions .rp-ok{background:#111827;color:white}@media(max-width:560px){.rp-actions{grid-template-columns:1fr}.rp-stage canvas{max-height:60vh}}';
  d.head.appendChild(s); d.body.appendChild(x); canvas=d.getElementById('rpCanvas');
  d.getElementById('rpClose').onclick=()=>{x.hidden=true;source=null;rects=[];drag=null};
  d.getElementById('rpUndo').onclick=()=>{rects.pop();draw()};
  d.getElementById('rpDone').onclick=finish;
  const pos=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
  canvas.addEventListener('pointerdown',e=>{if(!source)return;drag=pos(e);canvas.setPointerCapture?.(e.pointerId);e.preventDefault()});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;draw();const p=pos(e),c=canvas.getContext('2d');c.strokeStyle='#ef4444';c.lineWidth=Math.max(3,canvas.width/300);c.setLineDash([12,8]);c.strokeRect(drag.x,drag.y,p.x-drag.x,p.y-drag.y);e.preventDefault()});
  canvas.addEventListener('pointerup',e=>{if(!drag)return;const p=pos(e);const r={x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),w:Math.abs(p.x-drag.x),h:Math.abs(p.y-drag.y)};drag=null;if(r.w>12&&r.h>12)rects.push(r);draw();e.preventDefault()});
  return x;
}
function mosaic(ctx,base,r){const x=Math.max(0,Math.floor(r.x)),y=Math.max(0,Math.floor(r.y)),ww=Math.min(base.width-x,Math.ceil(r.w)),hh=Math.min(base.height-y,Math.ceil(r.h));if(ww<2||hh<2)return;const mini=d.createElement('canvas');mini.width=Math.max(1,Math.round(ww/14));mini.height=Math.max(1,Math.round(hh/14));mini.getContext('2d').drawImage(base,x,y,ww,hh,0,0,mini.width,mini.height);ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(mini,0,0,mini.width,mini.height,x,y,ww,hh);ctx.restore()}
function draw(){if(!source||!canvas)return;canvas.width=source.width;canvas.height=source.height;const c=canvas.getContext('2d');c.drawImage(source,0,0);rects.forEach(r=>mosaic(c,source,r))}
async function decode(file){if(file.size>MAX_SOURCE)throw new Error('Фото больше 25 МБ');if('createImageBitmap'in w){try{return await w.createImageBitmap(file,{imageOrientation:'from-image'})}catch(_){}}return await new Promise((ok,no)=>{const u=URL.createObjectURL(file),i=new w.Image();i.onload=()=>{URL.revokeObjectURL(u);ok(i)};i.onerror=()=>{URL.revokeObjectURL(u);no(new Error('Не удалось открыть фото'))};i.src=u})}
async function prepare(file){const im=await decode(file),iw=im.width||im.naturalWidth,ih=im.height||im.naturalHeight;if(!iw||!ih)throw new Error('Не удалось определить размер фото');const k=Math.min(1,MAX_LONG_SIDE/Math.max(iw,ih)),cw=Math.max(1,Math.round(iw*k)),ch=Math.max(1,Math.round(ih*k));const c=d.createElement('canvas');c.width=cw;c.height=ch;const g=c.getContext('2d',{alpha:false});g.fillStyle='#fff';g.fillRect(0,0,cw,ch);g.drawImage(im,0,0,cw,ch);im.close?.();return c}
function blob(q){return new Promise(ok=>canvas.toBlob(ok,'image/jpeg',q))}
async function finish(){const b=d.getElementById('rpDone');b.disabled=true;b.textContent='Готовлю JPEG…';try{draw();let out=null;for(const q of [.88,.8,.72,.64]){out=await blob(q);if(out&&out.size<=MAX_OUTPUT)break}if(!out||out.size>MAX_OUTPUT)throw new Error('Фото после обработки больше 5 МБ');clearSafe();safeFile=new w.File([out],`SAFE_${Date.now()}.jpg`,{type:'image/jpeg'});safeUrl=URL.createObjectURL(safeFile);const im=$('mediaImagePreview');if(im){im.src=safeUrl;im.classList.add('show')}$('filePreview')?.classList.add('show');const meta=$('filePreviewMeta');if(meta)meta.textContent='Защищённая JPEG-копия · '+(safeFile.size/1024/1024).toFixed(2)+' МБ · EXIF/GPS удалены · удалится через 1 час';say('Фото подготовлено. Подтвердите согласие и нажмите «Загрузить фото».');d.getElementById('radarPwaEditor').hidden=true;const send=$('sendMedia');if(send){send.disabled=false;send.textContent='Загрузить фото'}}catch(e){d.getElementById('rpStatus').textContent='Ошибка: '+String(e.message||e)}finally{b.disabled=false;b.textContent='✓ Готово, использовать фото'}}
async function choose(file){clearSafe();rects=[];source=null;const ed=editor();ed.hidden=false;d.getElementById('rpStatus').textContent='Создаю локальную копию без EXIF/GPS…';source=await prepare(file);draw();d.getElementById('rpStatus').textContent='Проверьте фото и замажьте лица/номера при необходимости.'}
async function upload(e){e.preventDefault();e.stopImmediatePropagation();const consent=$('mediaConsent');if(!consent?.checked){say('Подтвердите согласие на публикацию.');return}if(!safeFile){say('Сначала выберите фото и нажмите «Готово, использовать фото».');return}const station=$('mediaStationId')?.value;if(!station){say('АЗС не выбрана.');return}const send=$('sendMedia');if(send){send.disabled=true;send.textContent='Загрузка…'}say('Отправляю защищённую JPEG-копию…');try{const f=new FormData();f.append('station_id',station);f.append('consent_accepted','yes');f.append('consent_version','media-v1-2026-08-23');f.append('privacy_processed','yes');f.append('privacy_reviewed','yes');f.append('privacy_method',PRIVACY_METHOD);f.append('file',safeFile,safeFile.name);const r=await fetch(SAFE_UPLOAD,{method:'POST',headers:{apikey:PUBLIC_KEY},body:f});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Ошибка загрузки');say('Готово! Фото появилось в карточке и удалится через час.');if(send)send.textContent='Готово';setTimeout(()=>{$('mediaDialog')?.close();clearSafe();frame.src='./index.html?fresh='+Date.now()},900)}catch(err){say('Ошибка: '+String(err.message||err));if(send){send.disabled=false;send.textContent='Загрузить фото'}}}
function patch(){
  try{w=frame.contentWindow;d=frame.contentDocument}catch(_){return false} if(!w||!d||typeof w.openMedia!=='function')return false;
  if(w.__RADAR_PWA_PHOTO_V4)return true; w.__RADAR_PWA_PHOTO_V4=true;
  w.openMedia=showDialog;
  const input=$('mediaFile'); if(input){input.accept='image/*';input.addEventListener('change',async e=>{e.stopImmediatePropagation();const f=input.files?.[0];if(!f)return;if(!String(f.type||'').startsWith('image/')){input.value='';say('В PWA можно загрузить только фото.');return}const send=$('sendMedia');if(send)send.disabled=true;try{await choose(f)}catch(err){input.value='';say('Ошибка: '+String(err.message||err));const ed=d.getElementById('radarPwaEditor');if(ed)ed.hidden=true}},true)}
  const form=$('mediaForm'); if(form)form.addEventListener('submit',upload,true);
  return true;
}
function install(f){frame=f;let n=0;const go=()=>{n++;if(patch()||n>80)return;setTimeout(go,100)};go();frame.addEventListener('load',()=>{n=0;go()})}
window.RadarPwaPhoto={install};
})();
