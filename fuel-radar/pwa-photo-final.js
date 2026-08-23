(()=>{
'use strict';
if(location.hostname!=='radar-azs.vercel.app') return;

const SAFE_UPLOAD='https://oetqjkmlzwemreldpbui.supabase.co/functions/v1/station-media-upload-safe';
const PUBLIC_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ldHFqa21sendlbXJlbGRwYnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczODA0MjcsImV4cCI6MjEwMjk1NjQyN30.OtIQDj7iqoIZxS54yz79-C3_B0nc-jYsKYssnic7Tq4';
const MAX_SOURCE=25*1024*1024;
const MAX_LONG_SIDE=1920;
const MAX_OUTPUT=5*1024*1024;
let safeFile=null,safeUrl=null,sourceCanvas=null,editorCanvas=null,rects=[],dragStart=null;
const $=id=>document.getElementById(id);
const say=text=>{const n=$('mediaMsg');if(n)n.textContent=text};

window.RADAR_NATIVE_APP=true;
window.RADAR_PWA_APP=true;
window.RADAR_PWA_MODE=true;

function clearSafe(){if(safeUrl)URL.revokeObjectURL(safeUrl);safeUrl=null;safeFile=null}
function updatePwaLabels(){
 document.querySelectorAll('.media-btn').forEach(b=>b.textContent='📸 Добавить фото');
 const input=$('mediaFile'); if(input){input.accept='image/*';input.removeAttribute('capture')}
 const title=$('mediaDialogTitle'); if(title&&title.textContent.startsWith('Фото/видео:'))title.textContent=title.textContent.replace('Фото/видео:','Фото:');
 const label=document.querySelector('label[for="mediaFile"]');if(label)label.textContent='Выберите фото или снимите камерой';
 const hint=document.querySelector('#mediaDialog .mediaHint');if(hint)hint.innerHTML='<b>Фото в PWA + удаление через 1 час.</b><br>Перед отправкой создаётся новая JPEG-копия без EXIF/GPS. Проверьте лица и госномера и при необходимости замажьте их пальцем. Видео через PWA не загружается.';
 const send=$('sendMedia');if(send&&send.textContent==='Загрузить')send.textContent='Загрузить фото';
}

function ensureEditor(){
 let wrap=$('radarPwaPhotoEditorFinal');if(wrap)return wrap;
 wrap=document.createElement('div');wrap.id='radarPwaPhotoEditorFinal';wrap.hidden=true;
 wrap.innerHTML='<div class="rpf-card"><div class="rpf-head"><div><b>🔒 Проверка фото</b><span id="rpfStatus">Подготавливаю безопасную копию…</span></div><button id="rpfClose" type="button">✕</button></div><div class="rpf-tip">Проверьте лица и госномера. Чтобы скрыть область, проведите по ней пальцем или мышью.</div><div class="rpf-stage"><canvas id="rpfCanvas"></canvas></div><div class="rpf-actions"><button id="rpfUndo" type="button">↩ Отменить область</button><button id="rpfDone" class="rpf-primary" type="button">✓ Готово, использовать фото</button></div></div>';
 const style=document.createElement('style');
 style.textContent='#radarPwaPhotoEditorFinal{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.86);padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));overflow:auto;color:#111827;font:15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}#radarPwaPhotoEditorFinal[hidden]{display:none}.rpf-card{max-width:760px;margin:auto;background:#fff;border-radius:18px;padding:14px;box-shadow:0 24px 80px rgba(0,0,0,.45)}.rpf-head{display:flex;justify-content:space-between;gap:12px}.rpf-head b{font-size:19px}.rpf-head span{display:block;font-size:12px;color:#64748b;margin-top:3px}.rpf-head button,.rpf-actions button{min-height:44px;border:1px solid #d7dce3;border-radius:12px;background:#fff;color:#111827;font-weight:800;padding:0 13px}.rpf-tip{margin:12px 0;padding:10px 12px;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-size:13px}.rpf-stage{background:#111827;border-radius:14px;overflow:hidden;display:grid;place-items:center;touch-action:none}.rpf-stage canvas{display:block;max-width:100%;max-height:68vh;touch-action:none}.rpf-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:9px;margin-top:12px}.rpf-actions .rpf-primary{background:#111827;color:#fff}@media(max-width:560px){.rpf-actions{grid-template-columns:1fr}.rpf-stage canvas{max-height:60vh}}';
 document.head.appendChild(style);document.body.appendChild(wrap);editorCanvas=$('rpfCanvas');
 $('rpfClose').onclick=()=>{wrap.hidden=true;sourceCanvas=null;rects=[];dragStart=null};
 $('rpfUndo').onclick=()=>{rects.pop();renderEditor()};
 $('rpfDone').onclick=finishEditor;
 const point=e=>{const r=editorCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*editorCanvas.width/r.width,y:(e.clientY-r.top)*editorCanvas.height/r.height}};
 editorCanvas.addEventListener('pointerdown',e=>{if(!sourceCanvas)return;dragStart=point(e);editorCanvas.setPointerCapture?.(e.pointerId);e.preventDefault()});
 editorCanvas.addEventListener('pointermove',e=>{if(!dragStart)return;renderEditor();const p=point(e),ctx=editorCanvas.getContext('2d');ctx.strokeStyle='#ef4444';ctx.lineWidth=Math.max(3,editorCanvas.width/300);ctx.setLineDash([12,8]);ctx.strokeRect(dragStart.x,dragStart.y,p.x-dragStart.x,p.y-dragStart.y);e.preventDefault()});
 editorCanvas.addEventListener('pointerup',e=>{if(!dragStart)return;const p=point(e);const r={x:Math.min(dragStart.x,p.x),y:Math.min(dragStart.y,p.y),w:Math.abs(p.x-dragStart.x),h:Math.abs(p.y-dragStart.y)};dragStart=null;if(r.w>12&&r.h>12)rects.push(r);renderEditor();e.preventDefault()});
 return wrap;
}

function pixelate(ctx,base,r){
 const x=Math.max(0,Math.floor(r.x)),y=Math.max(0,Math.floor(r.y));
 const w=Math.min(base.width-x,Math.ceil(r.w)),h=Math.min(base.height-y,Math.ceil(r.h));
 if(w<2||h<2)return;
 const mini=document.createElement('canvas');mini.width=Math.max(1,Math.round(w/14));mini.height=Math.max(1,Math.round(h/14));
 mini.getContext('2d').drawImage(base,x,y,w,h,0,0,mini.width,mini.height);
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(mini,0,0,mini.width,mini.height,x,y,w,h);ctx.restore();
}
function renderEditor(){if(!sourceCanvas||!editorCanvas)return;editorCanvas.width=sourceCanvas.width;editorCanvas.height=sourceCanvas.height;const ctx=editorCanvas.getContext('2d');ctx.drawImage(sourceCanvas,0,0);rects.forEach(r=>pixelate(ctx,sourceCanvas,r))}

async function decodeImage(file){
 if(file.size>MAX_SOURCE)throw new Error('Фото больше 25 МБ');
 if('createImageBitmap' in window){try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch(_){}}
 return await new Promise((resolve,reject)=>{const u=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Не удалось открыть фото'))};img.src=u});
}
async function prepareCanvas(file){
 const image=await decodeImage(file);const iw=image.width||image.naturalWidth,ih=image.height||image.naturalHeight;
 if(!iw||!ih)throw new Error('Не удалось определить размер фото');
 const scale=Math.min(1,MAX_LONG_SIDE/Math.max(iw,ih));const w=Math.max(1,Math.round(iw*scale)),h=Math.max(1,Math.round(ih*scale));
 const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);image.close?.();return c;
}
const canvasBlob=(q)=>new Promise(resolve=>editorCanvas.toBlob(resolve,'image/jpeg',q));
async function finishEditor(){
 const btn=$('rpfDone');btn.disabled=true;btn.textContent='Готовлю JPEG…';
 try{
   renderEditor();let blob=null;for(const q of [.88,.80,.72,.64]){blob=await canvasBlob(q);if(blob&&blob.size<=MAX_OUTPUT)break}
   if(!blob||blob.size>MAX_OUTPUT)throw new Error('Фото после обработки больше 5 МБ');
   clearSafe();safeFile=new File([blob],`SAFE_${Date.now()}.jpg`,{type:'image/jpeg',lastModified:Date.now()});safeUrl=URL.createObjectURL(safeFile);
   const img=$('mediaImagePreview'),vid=$('mediaVideoPreview');if(vid){vid.pause?.();vid.classList.remove('show');vid.removeAttribute('src')}if(img){img.src=safeUrl;img.classList.add('show')}
   $('filePreview')?.classList.add('show');const meta=$('filePreviewMeta');if(meta)meta.textContent=`Защищённая JPEG-копия · ${(safeFile.size/1024/1024).toFixed(2)} МБ · EXIF/GPS удалены · удалится через 1 час`;
   say('Фото готово. Подтвердите согласие и нажмите «Загрузить фото».');wrapClose();const send=$('sendMedia');if(send){send.disabled=false;send.textContent='Загрузить фото'}
 }catch(e){$('rpfStatus').textContent='Ошибка: '+String(e?.message||e)}finally{btn.disabled=false;btn.textContent='✓ Готово, использовать фото'}
}
function wrapClose(){const wrap=$('radarPwaPhotoEditorFinal');if(wrap)wrap.hidden=true}
async function choosePhoto(file){clearSafe();rects=[];sourceCanvas=null;const wrap=ensureEditor();wrap.hidden=false;$('rpfStatus').textContent='Создаю JPEG-копию без EXIF/GPS…';sourceCanvas=await prepareCanvas(file);renderEditor();$('rpfStatus').textContent='Проверьте фото и замажьте лица/номера при необходимости.'}

async function uploadSafePhoto(e){
 e.preventDefault();e.stopImmediatePropagation();
 const consent=$('mediaConsent');if(!consent?.checked){say('Подтвердите согласие на публикацию.');consent?.focus();return}
 if(!safeFile){say('Сначала выберите фото и нажмите «Готово, использовать фото».');return}
 const stationId=$('mediaStationId')?.value;if(!stationId){say('АЗС не выбрана.');return}
 const send=$('sendMedia');if(send){send.disabled=true;send.textContent='Загрузка…'}say('Отправляю защищённую JPEG-копию…');
 try{
   const body=new FormData();body.append('station_id',stationId);body.append('consent_accepted','yes');body.append('consent_version','media-v1-2026-08-23');body.append('privacy_processed','yes');body.append('privacy_reviewed','yes');body.append('privacy_method','pwa-canvas-manual-redaction-v1');body.append('file',safeFile,safeFile.name);
   const r=await fetch(SAFE_UPLOAD,{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+PUBLIC_KEY},body});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Ошибка загрузки');
   say('Готово! Фото появилось в карточке и удалится через час.');if(send)send.textContent='Готово';setTimeout(()=>{$('mediaDialog')?.close();clearSafe();if(typeof loadMedia==='function')loadMedia()},900);
 }catch(err){say('Ошибка: '+String(err?.message||err));if(send){send.disabled=false;send.textContent='Загрузить фото'}}
}

function install(){
 updatePwaLabels();
 const input=$('mediaFile'),form=$('mediaForm');if(!input||!form){setTimeout(install,100);return}
 if(window.__RADAR_PWA_PHOTO_FINAL)return;window.__RADAR_PWA_PHOTO_FINAL=true;
 input.addEventListener('change',async e=>{e.stopImmediatePropagation();const file=input.files?.[0];clearSafe();const send=$('sendMedia');if(send)send.disabled=true;if(!file)return;if(!String(file.type||'').startsWith('image/')){input.value='';say('Через PWA можно загрузить только фото.');return}try{say('Обрабатываю фото на этом устройстве…');await choosePhoto(file)}catch(err){input.value='';say('Ошибка: '+String(err?.message||err));wrapClose()}},true);
 form.addEventListener('submit',uploadSafePhoto,true);
 const observer=new MutationObserver(updatePwaLabels);observer.observe(document.body,{childList:true,subtree:true});
 if('serviceWorker' in navigator)navigator.serviceWorker.register('/service-worker.js').catch(()=>{});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();