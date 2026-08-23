(async()=>{
  try{
    const r=await fetch('/index.html?pwa_src=7',{cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    let html=await r.text();
    html=html.replace(/<head>/i,`<head>
<base href="/">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#111827">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Радар АЗС">
<script>window.RADAR_NATIVE_APP=true;window.RADAR_PWA_APP=true;window.RADAR_PWA_MODE=true;<\/script>`);
    html=html.replace(/<\/body>/i,`<script src="/pwa-photo-direct.js?v=7"><\/script>
<script>if('serviceWorker' in navigator){navigator.serviceWorker.register('/service-worker.js?v=7').catch(()=>{})}<\/script>
</body>`);
    document.open();
    document.write(html);
    document.close();
  }catch(e){
    document.body.innerHTML='<div style="font:16px system-ui;padding:24px;color:white">Не удалось открыть Радар. Обновите страницу.</div>';
    console.error(e);
  }
})();
