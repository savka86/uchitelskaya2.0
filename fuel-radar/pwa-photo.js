(()=>{
'use strict';
const SAFE_UPLOAD='https://oetqjkmlzwemreldpbui.supabase.co/functions/v1/station-media-upload-safe';
const PUBLIC_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlIiwicmVmIjoib2V0cWprbWx6d2VtcmVsZHBidWkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NzM4MDQyNywiZXhwIjoyMTAyOTU2NDI3fQ.OtIQDj7iqoIZxS54yz79-C3_B0nc-jYsKYssnic7Tq4';
const PRIVACY_METHOD='pwa-canvas-manual-redaction-v1';
const MAX_SOURCE=25*1024*1024;
const MAX_LONG_SIDE=1920;
const MAX_OUTPUT=5*1024*1024;
let safeFile=null,safePreviewUrl=null,frameWin=null,frameDoc=null;
let sourceCanvas=null,editorCanvas=null,rects=[],dragStart=null;

function $(id){return frameDoc?.getElementById(id)||null}
function msg(text){const n=$('mediaMsg');if(n)n.textContent=text}
function revokeSafe(){if(safePreviewUrl)URL.revokeObjectURL(safePreviewUrl);safePreviewUrl=null;safeFile=null}
function escapeName(name){return String(name||'photo').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,50)||'photo'}

function ensureEditor(){
 if(document.getElementById('radarPwaPhotoEditor'))return;
 const wrap=document.createElement('div');wrap.id='radarPwaPhotoEditor';wrap.hidden=true;
 wrap.innerHTML=`<div class="rp-card"><div class="rp-head"><div><b>🔒 Проверка фото перед отправкой</b><span id="rpStatus">Подготавливаю безопасную копию…</span></div><button id="rpClose" type="button">✕</button></div><div class="rp-tip">Проверьте лица и госномера. Чтобы скрыть область, <b>проведите по ней пальцем</b>. Можно сделать несколько прямоугольников.</div><div class="rp-stage"><canvas id="rpCanvas"></canvas></div><div class="rp-actions"><button id="rpUndo" type="button">↩ Отменить область</button><button id="rpDone" class="rp-primary" type="button">✓ Готово, использовать фото</button></div></div>`;
 const style=document.createElement('style');
 style.textContent=`#radarPwaPhotoEditor{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.82);padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));overflow:auto;font:15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;color:#111827}#radarPwaPhotoEditor[hidden]{display:none}.rp-card{max-width:760px;margin:auto;background:#fff;border-radius:18px;padding:14px;box-shadow:0 24px 80px rgba(0,0,0,.4)}.rp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.rp-head b{display:block;font-size:18px}.rp-head span{display:block;color:#64748b;font-size:12px;margin-top:3px}.rp-head button,.rp-actions button{border:1px solid #d7dce3;background:#fff;color:#111827;border-radius:12px;min-height:44px;padding:0 13px;font-weight:800}.rp-head button{min-width:44px;padding:0}.rp-tip{margin:12px 0;padding:10px 12px;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-size:13px}.rp-stage{background:#111827;border-radius:14px;overflow:hidden;display:grid;place-items:center;touch-action:none}.rp-stage canvas{display:block;max-width:100%;max-height:70vh;width:auto;height:auto;touch-action:none}.rp-actions{display:grid;grid-template-columns:1fr 1.3fr;gap:9px;margin-top:12px}.rp-actions .rp-primary{background:#111827;color:#fff;border-color:#111827}@media(max-width:560px){.rp-actions{grid-template-columns:1fr}.rp-card{padding:11px}.rp-stage canvas{max-height:62vh}}`;
 document.head.appendChild(style);document.body.appendChild(wrap);
 editorCanvas=document.getElementById('rpCanvas');
 const close=()=>{wrap.hidden=true;sourceCanvas=null;rects=[];dragStart=null;};
 document.getElementById('rpClose').addEventListener('click',close);
 document.getElementById('rpUndo').addEventListener('click',()=>{rects.pop();renderEditor()});
 document.getElementById('rpDone').addEventListener('click',async()=>{
   if(!sourceCanvas)return;
   const btn=document.getElementById('rpDone');btn.disabled=true;btn.textContent='Готовлю JPEG…';
   try{renderEditor();const blob=await exportJpeg(editorCanvas);if(!blob)throw new Error('Не удалось создать JPEG');
     revokeSafe();safeFile=new File([blob],`SAFE_${Date.now()}.jpg`,{type:'image/jpeg',lastModified:Date.now()});safePreviewUrl=URL.createObjectURL(safeFile);
     const img=$('mediaImagePreview'),vid=$('mediaVideoPreview'),box=$('filePreview'),meta=$('filePreviewMeta');
     if(vid){vid.pause?.();vid.classList.remove('show');vid.removeAttribute('src')}
     if(img){img.src=safePreviewUrl;img.classList.add('show')}
     box?.classList.add('show');if(meta)meta.textContent=`Защищённая JPEG-копия · ${(safeFile.size/1024/1024).toFixed(2)} МБ · EXIF/GPS удалены · удалится через 1 час`;
     msg('Фото подготовлено. Проверьте согласие и нажмите «Загрузить».');
     const send=$('sendMedia');if(send){send.disabled=false;send.textContent='Загрузить фото'}
     wrap.hidden=true;
   }catch(e){document.getElementById('rpStatus').textContent='Ошибка: '+String(e?.message||e)}finally{btn.disabled=false;btn.textContent='✓ Готово, использовать фото'}
 });
 const point=e=>{const r=editorCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*editorCanvas.width/r.width,y:(e.clientY-r.top)*editorCanvas.height/r.height}};
 editorCanvas.addEventListener('pointerdown',e=>{if(!sourceCanvas)return;dragStart=point(e);editorCanvas.setPointerCapture?.(e.pointerId);e.preventDefault()});
 editorCanvas.addEventListener('pointermove',e=>{if(!dragStart)return;renderEditor();const p=point(e),ctx=editorCanvas.getContext('2d');ctx.strokeStyle='#ef4444';ctx.lineWidth=Math.max(3,editorCanvas.width/300);ctx.setLineDash([12,8]);ctx.strokeRect(dragStart.x,dragStart.y,p.x-dragStart.x,p.y-dragStart.y);e.preventDefault()});
 editorCanvas.addEventListener('pointerup',e=>{if(!dragStart)return;const p=point(e);let x=Math.min(dragStart.x,p.x),y=Math.min(dragStart.y,p.y),w=Math.abs(p.x-dragStart.x),h=Math.abs(p.y-dragStart.y);dragStart=null;if(w>12&&h>12)rects.push({x,y,w,h,kind:'manual'});renderEditor();e.preventDefault()});
}

function expandRect(r,w,h,p=.16){const dx=r.width*p,dy=r.height*p;return{x:Math.max(0,r.x-dx),y:Math.max(0,r.y-dy),w:Math.min(w,r.width+2*dx),h:Math.min(h,r.height+2*dy),kind:'auto'}}
function pixelate(ctx,base,r){let x=Math.max(0,Math.floor(r.x)),y=Math.max(0,Math.floor(r.y)),w=Math.min(base.width-x,Math.ceil(r.w)),h=Math.min(base.height-y,Math.ceil(r.h));if(w<2||h<2)return;const small=document.createElement('canvas'),sw=Math.max(1,Math.round(w/14)),sh=Math.max(1,Math.round(h/14));small.width=sw;small.height=sh;const s=small.getContext('2d');s.drawImage(base,x,y,w,h,0,0,sw,sh);ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,sw,sh,x,y,w,h);ctx.restore()}
function renderEditor(){if(!sourceCanvas||!editorCanvas)return;editorCanvas.width=sourceCanvas.width;editorCanvas.height=sourceCanvas.height;const ctx=editorCanvas.getContext('2d');ctx.drawImage(sourceCanvas,0,0);for(const r of rects)pixelate(ctx,sourceCanvas,r)}

async function decodeImage(file){
 if(file.size>MAX_SOURCE)throw new Error('Исходное фото слишком большое (максимум 25 МБ)');
 if('createImageBitmap' in window){try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch(_e){}}
 return await new Promise((resolve,reject)=>{const u=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Не удалось открыть фото'))};img.src=u});
}
async function prepareCanvas(file){const image=await decodeImage(file);const iw=image.width||image.naturalWidth,ih=image.height||image.naturalHeight;if(!iw||!ih)throw new Error('Не удалось определить размер фото');const scale=Math.min(1,MAX_LONG_SIDE/Math.max(iw,ih));const w=Math.max(1,Math.round(iw*scale)),h=Math.max(1,Math.round(ih*scale));const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);image.close?.();return c}
function canvasBlob(canvas,q){return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',q))}
async function exportJpeg(canvas){for(const q of [.88,.8,.72,.64]){const b=await canvasBlob(canvas,q);if(b&&b.size<=MAX_OUTPUT)return b}throw new Error('После обработки фото всё ещё больше 5 МБ')}
function normPlate(v){const map={'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'C','Т':'T','У':'Y','Х':'X'};return String(v||'').toUpperCase().replace(/[АВЕКМНОРСТУХ]/g,c=>map[c]||c).replace(/[^A-Z0-9]/g,'')}
function looksLikePlate(v){return /[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2,3}/.test(normPlate(v))}
async function autoDetect(){
 const status=document.getElementById('rpStatus');let faces=0,plates=0,supported=false;
 if('FaceDetector' in window){supported=true;try{const det=new FaceDetector({fastMode:false,maxDetectedFaces:20});const found=await det.detect(sourceCanvas);for(const f of found){if(f.boundingBox){rects.push(expandRect(f.boundingBox,sourceCanvas.width,sourceCanvas.height,.2));faces++}}}catch(_e){}}
 if('TextDetector' in window){supported=true;try{const det=new TextDetector();const found=await det.detect(sourceCanvas);for(const t of found){if(t.boundingBox&&looksLikePlate(t.rawValue)){rects.push(expandRect(t.boundingBox,sourceCanvas.width,sourceCanvas.height,.22));plates++}}}catch(_e){}}
 renderEditor();
 if(faces||plates)status.textContent=`Автопроверка: скрыто лиц — ${faces}, номеров — ${plates}. Обязательно проверьте фото сами.`;
 else if(supported)status.textContent='Автопроверка ничего не нашла. Проверьте лица и номера вручную.';
 else status.textContent='На этом браузере автопоиск недоступен. Проверьте лица и номера вручную.';
}
async function openEditor(file){ensureEditor();revokeSafe();rects=[];sourceCanvas=null;document.getElementById('radarPwaPhotoEditor').hidden=false;document.getElementById('rpStatus').textContent='Создаю локальную копию без EXIF/GPS…';sourceCanvas=await prepareCanvas(file);renderEditor();document.getElementById('rpStatus').textContent='Проверяю фото…';await autoDetect()}

function install(frame){
 frameWin=frame.contentWindow;frameDoc=frame.contentDocument;if(!frameWin||!frameDoc)return;
 const original=frameWin.openMedia;
 if(typeof original==='function'&&!frameWin.__radarPwaPhotoOpenPatched){
   frameWin.__radarPwaPhotoOpenPatched=true;
   frameWin.openMedia=function(station){const prev=frameWin.RADAR_NATIVE_APP;frameWin.RADAR_NATIVE_APP=true;try{original.call(frameWin,station)}finally{frameWin.RADAR_NATIVE_APP=prev}
     revokeSafe();const input=$('mediaFile');if(input){input.accept='image/*';input.removeAttribute('capture')}
     const title=$('mediaDialogTitle');if(title)title.textContent='Фото: '+String(station?.name||'АЗС');
     const hint=frameDoc.querySelector('#mediaDialog .mediaHint');if(hint)hint.innerHTML='<b>PWA-защита + удаление через 1 час.</b><br>Фото обрабатывается на этом устройстве: создаётся новая JPEG-копия без EXIF/GPS. Проверьте лица и госномера; нужные области можно скрыть пальцем. Видео в PWA не загружается.';
     const label=frameDoc.querySelector('label[for="mediaFile"]');if(label)label.textContent='Выберите фото или снимите камерой';
     msg('Выберите фото. Исходный файл на сервер не отправляется.');
   };
 }
 const input=$('mediaFile');if(input&&!input.__radarPwaPhotoChange){input.__radarPwaPhotoChange=true;input.addEventListener('change',async e=>{e.stopImmediatePropagation();const file=input.files?.[0];revokeSafe();const send=$('sendMedia');if(send)send.disabled=true;if(!file){msg('Выберите фото.');return}if(!String(file.type||'').startsWith('image/')){input.value='';msg('В PWA можно загрузить только фото.');return}try{msg('Фото обрабатывается локально…');await openEditor(file)}catch(err){input.value='';msg('Ошибка: '+String(err?.message||err));document.getElementById('radarPwaPhotoEditor').hidden=true}},true)}
 const form=$('mediaForm');if(form&&!form.__radarPwaPhotoSubmit){form.__radarPwaPhotoSubmit=true;form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const consent=$('mediaConsent');if(!consent?.checked){msg('Перед загрузкой подтвердите согласие на публикацию.');consent?.focus();return}if(!safeFile){msg('Сначала выберите фото и нажмите «Готово, использовать фото».');return}const stationId=$('mediaStationId')?.value||'';if(!stationId){msg('АЗС не выбрана.');return}const send=$('sendMedia');if(send){send.disabled=true;send.textContent='Загрузка…'}msg('Отправляю только защищённую JPEG-копию…');try{const body=new FormData();body.append('station_id',stationId);body.append('consent_accepted','yes');body.append('consent_version','media-v1-2026-08-23');body.append('privacy_processed','yes');body.append('privacy_reviewed','yes');body.append('privacy_method',PRIVACY_METHOD);body.append('file',safeFile,safeFile.name);const r=await fetch(SAFE_UPLOAD,{method:'POST',headers:{apikey:PUBLIC_KEY},body});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Ошибка загрузки');msg('Готово! Фото появилось в карточке и удалится через час.');if(send)send.textContent='Готово';setTimeout(()=>{$('mediaDialog')?.close();revokeSafe();if(typeof frameWin.loadMedia==='function')frameWin.loadMedia();else frame.location.reload()},900)}catch(err){msg('Ошибка: '+String(err?.message||err));if(send){send.disabled=false;send.textContent='Загрузить фото'}}},true)}
}

window.RadarPwaPhoto={install};
})();
