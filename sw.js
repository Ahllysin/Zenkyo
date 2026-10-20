// Zenkyo — modo offline / cache no aparelho (service worker).
// Ideia: o que NÃO mudou fica salvo no celular e abre na hora, até sem internet; o que mudou é baixado de novo.
//   • Casca do site (HTML, CSS, JS, fontes): guardada na instalação. A versão (VERSION) muda a cada publicação,
//     então uma publicação nova troca o cache inteiro — ninguém fica preso numa versão velha.
//   • Páginas (HTML): rede primeiro (pega a versão nova), e se estiver sem internet usa a guardada.
//   • Arquivos com ?v=: cache primeiro (o ?v= muda quando o arquivo muda, então nunca fica velho).
//   • Imagens, ícones e JSON: guarda ao usar e atualiza em segundo plano ("stale-while-revalidate").
//   • Supabase, Mercado Pago, Discord e qualquer outro endereço de fora NÃO passam por aqui (login, mural e pagamentos
//     sempre ao vivo).
// A lista abaixo é gerada por `node build.js` — não edite entre BUILD:START e BUILD:END.
// BUILD:START
const VERSION = '6384c263';
const PRECACHE = [ "./", "index.html", "privacidade.html", "termos.html", "manifest.webmanifest", "fonts/fonts.css", "fonts/jetbrains-mono-1.woff2", "fonts/kaushan-script-2.woff2", "fonts/nunito-3.woff2", "fonts/shippori-mincho-4.woff2", "fonts/shippori-mincho-5.woff2", "fonts/shippori-mincho-6.woff2", "fonts/shippori-mincho-7.woff2", "fonts/shippori-mincho-8.woff2", "fonts/shippori-mincho-9.woff2", "fonts/shippori-mincho-10.woff2", "fonts/shippori-mincho-11.woff2", "fonts/shippori-mincho-12.woff2", "fonts/shippori-mincho-13.woff2", "fonts/shippori-mincho-14.woff2", "fonts/shippori-mincho-15.woff2", "fonts/shippori-mincho-16.woff2", "fonts/shippori-mincho-17.woff2", "fonts/shippori-mincho-18.woff2", "fonts/shippori-mincho-19.woff2", "fonts/shippori-mincho-20.woff2", "fonts/barlow-21.woff2", "fonts/barlow-22.woff2", "fonts/barlow-23.woff2", "fonts/barlow-24.woff2", "fonts/barlow-25.woff2", "fonts/barlow-condensed-26.woff2", "fonts/barlow-condensed-27.woff2", "fonts/barlow-condensed-28.woff2", "fonts/barlow-condensed-29.woff2", "fonts/barlow-condensed-30.woff2", "fonts/barlow-condensed-31.woff2", "fonts/dela-gothic-one-32.woff2", "vendor/supabase.js", "assets/icone-192.png", "assets/icone-512.png", "base.css?v=2a054ce9", "visual-novo.css?v=d7b5f921", "js/dados.js?v=25dc1b32", "js/app.js?v=b8746344" ];
// BUILD:END
const SHELL = 'zk-shell-' + VERSION;
const MEDIA = 'zk-media-v1';
const MEDIA_MAX = 600;                       // no máximo 600 arquivos de mídia guardados (os mais antigos saem primeiro)
const MEDIA_RE = /\.(?:webp|png|jpe?g|svg|gif|ico|woff2?|ttf|json|mp3|mp4)$/i;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('zk-shell-') && n !== SHELL).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function limitar(nome, max){
  const c = await caches.open(nome), ks = await c.keys();
  for(let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
}
function ok(r){ return r && r.status === 200 && (r.type === 'basic' || r.type === 'default'); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;                // Supabase, Discord, Mercado Pago: sempre ao vivo
  if(url.pathname.endsWith('/sw.js')) return;

  // páginas: rede primeiro, cópia guardada se estiver offline
  if(req.mode === 'navigate'){
    e.respondWith((async () => {
      try{
        const r = await fetch(req);
        if(ok(r)){ const c = await caches.open(SHELL); c.put(url.pathname.endsWith('.html') || url.pathname.endsWith('/') ? req : './', r.clone()); }
        return r;
      }catch(_){
        const c = await caches.open(SHELL);
        return (await c.match(req, { ignoreSearch: true })) || (await c.match('./')) || (await c.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  // arquivos versionados (?v=): cache primeiro
  if(url.searchParams.has('v')){
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      const hit = await c.match(req);
      if(hit) return hit;
      const r = await fetch(req);
      if(ok(r)) c.put(req, r.clone());
      return r;
    })());
    return;
  }

  // mídia e dados: devolve o guardado na hora e atualiza em segundo plano
  if(MEDIA_RE.test(url.pathname)){
    e.respondWith((async () => {
      const c = await caches.open(MEDIA);
      const hit = await c.match(req);
      const rede = fetch(req).then(r => { if(ok(r)){ c.put(req, r.clone()).then(() => limitar(MEDIA, MEDIA_MAX)); } return r; }).catch(() => null);
      return hit || (await rede) || Response.error();
    })());
  }
});

// A página pode pedir estas coisas (botão "Modo offline"):
self.addEventListener('message', e => {
  const msg = e.data || {};
  const port = e.ports && e.ports[0];
  if(msg.tipo === 'status'){
    e.waitUntil((async () => {
      const m = await caches.open(MEDIA), s = await caches.open(SHELL);
      port && port.postMessage({ versao: VERSION, casca: (await s.keys()).length, midia: (await m.keys()).length });
    })());
  } else if(msg.tipo === 'limpar'){
    e.waitUntil((async () => {
      await caches.delete(MEDIA);
      port && port.postMessage({ ok: true });
    })());
  }
});
