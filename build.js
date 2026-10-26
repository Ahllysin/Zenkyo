// Passo de publicação do Zenkyo. Rode SEMPRE antes de publicar:
//
//     node build.js            (atualiza tudo)
//     node build.js --check    (só confere; sai com erro se algo estiver desatualizado — o test-logic.js também confere)
//
// O que faz:
//   1) Coloca em index.html o ?v=<hash> de cada arquivo (base.css, visual-novo.css, js/dados.js, js/app.js): o endereço
//      muda quando o arquivo muda, então o celular nunca fica com CSS/JS velho em cache.
//   2) Gera a lista e a VERSÃO do modo offline em sw.js (entre BUILD:START e BUILD:END).
//   3) Gera uma página estática por guerreiro em p/<nome>.html (para o Google e para links com prévia) e o sitemap.xml.
//   4) Regera a CSP (update-csp.js).
//   5) Gera en/index.html (versão em inglês) a partir do index.html: <html lang="en">, <base href="../"> (os caminhos
//      relativos continuam valendo a partir da raiz), título/descrição/links de idioma e js/lang/en.js. Os textos vêm de
//      js/lang/pt.js e js/lang/en.js — o código (app.js) é um só para os dois idiomas.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SITE = 'https://zenkyo.com.br';
const CHECK = process.argv.includes('--check');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const readBuf = f => fs.readFileSync(path.join(ROOT, f));
const hash = buf => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
const norm = s => s.replace(/\r\n/g, '\n');
const problemas = [];
function gravar(f, novo){
  const atual = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : null;
  if(atual !== null && norm(atual) === norm(novo)) return;
  if(CHECK){ problemas.push(f + ' está desatualizado'); return; }
  const crlf = atual !== null && atual.includes('\r\n');
  fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, f), crlf ? norm(novo).replace(/\n/g, '\r\n') : novo, 'utf8');
}
// hash do conteúdo sem depender do fim de linha (Windows CRLF x GitHub LF)
const hashTexto = f => hash(Buffer.from(norm(read(f)), 'utf8'));

// ---------- 1) ?v= em index.html ----------
const VERSIONADOS = ['base.css', 'visual-novo.css', 'js/i18n.js', 'js/lang/pt.js', 'js/dados.js', 'js/app.js'];
let html = read('index.html');
VERSIONADOS.forEach(f => {
  const esc = f.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  const re = new RegExp('((?:href|src)=")' + esc + '(?:\\?v=[A-Za-z0-9]+)?(")', 'g');
  if(!re.test(html)) throw new Error('index.html não referencia ' + f);
  html = html.replace(new RegExp(re.source, 'g'), '$1' + f + '?v=' + hashTexto(f) + '$2');
});
gravar('index.html', html);

// ---------- 2) modo offline (sw.js) ----------
const fontsCss = read('fonts/fonts.css');
const fontes = [...new Set([...fontsCss.matchAll(/url\(([^)]+\.woff2)\)/g)].map(m => 'fonts/' + m[1]))];
const precache = ['./', 'index.html', 'privacidade.html', 'termos.html', 'manifest.webmanifest', 'fonts/fonts.css', ...fontes, 'vendor/supabase.js',
  'assets/icone-192.png', 'assets/icone-512.png',
  ...VERSIONADOS.map(f => f + '?v=' + hashTexto(f))];
const arquivosDaVersao = precache.filter(p => p !== './').map(p => p.split('?')[0]).filter(p => fs.existsSync(path.join(ROOT, p)));
const hArq = p => /\.(?:woff2|png)$/.test(p) ? hash(readBuf(p)) : hashTexto(p);
const versao = hash(Buffer.from(arquivosDaVersao.map(p => p + ':' + hArq(p)).join('|'), 'utf8'));
let sw = read('sw.js');
const bloco = "// BUILD:START\nconst VERSION = '" + versao + "';\nconst PRECACHE = " + JSON.stringify(precache.filter(p => p === './' || fs.existsSync(path.join(ROOT, p.split('?')[0]))), null, 1).replace(/\n\s*/g, ' ') + ";\n// BUILD:END";
sw = norm(sw).replace(/\/\/ BUILD:START[\s\S]*?\/\/ BUILD:END/, bloco);
gravar('sw.js', sw);

// ---------- 3a) versão em inglês: en/index.html ----------
// Lê um js/lang/<idioma>.js sem abrir navegador: o arquivo só chama kzAddLang('xx', { chave: texto }).
function dicionario(f){
  const dic = {};
  vm.runInNewContext(read(f), { kzAddLang: (_idioma, textos) => Object.assign(dic, textos) });
  return dic;
}
function gerarIngles(htmlPt){
  const pt = dicionario('js/lang/pt.js');
  const en = Object.assign({}, pt, dicionario('js/lang/en.js'));   // o que faltar em inglês fica em português
  const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  let h = htmlPt;
  const trocar = (de, para) => {
    if(!h.includes(de)) throw new Error('index.html mudou e a versão em inglês não achou: ' + de.slice(0, 70));
    h = h.split(de).join(para);
  };
  trocar('<html lang="pt-BR">', '<html lang="en">');
  trocar('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<base href="../">');
  ['meta.titulo', 'meta.descricao', 'meta.imagemAlt'].forEach(k => trocar(attr(pt[k]), attr(en[k])));
  trocar('<meta property="og:locale" content="pt_BR">', '<meta property="og:locale" content="en_US">');
  trocar('<meta property="og:url" content="' + SITE + '/">', '<meta property="og:url" content="' + SITE + '/en/">');
  trocar('<link rel="canonical" href="' + SITE + '/">', '<link rel="canonical" href="' + SITE + '/en/">');
  const seletor = /<a class="kz-lang-switch"[^>]*>[^<]*<\/a>/;
  if(!seletor.test(h)) throw new Error('index.html não tem o seletor de idioma (a#langSwitch)');
  h = h.replace(seletor, () => `<a class="kz-lang-switch" id="langSwitch" href="./" hreflang="${attr(en['idioma.outroCodigo'])}" lang="${attr(en['idioma.outroCodigo'])}" title="${attr(en['idioma.trocar'])}" aria-label="${attr(en['idioma.trocar'])}">${en['idioma.outroSigla']}</a>`);
  const ptJs = h.match(/<script src="js\/lang\/pt\.js(?:\?v=[A-Za-z0-9]+)?"><\/script>/);
  if(!ptJs) throw new Error('index.html não carrega js/lang/pt.js');
  h = h.replace(ptJs[0], () => ptJs[0] + '\n<script src="js/lang/en.js?v=' + hashTexto('js/lang/en.js') + '"></script>');
  return h;
}

// ---------- 3) páginas por guerreiro + sitemap ----------
async function paginas(){
  const { loadApp, evalIn } = require('./sandbox-harness');
  const sandbox = await loadApp();
  const chars = evalIn(sandbox, `state.characters.map(c => ({ nome:c.name, slug:slug(c.name), raridade:c.rarity, tipo:c.type, afinidade:c.affinity,
    raca:c.element, genero:c.gender, tags:c.tags || [], skill:c.skill, supreme:c.supreme, combo:c.combo }))`);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = [{ loc: SITE + '/', pri: '1.0' }, { loc: SITE + '/privacidade.html', pri: '0.3' }, { loc: SITE + '/termos.html', pri: '0.3' }];
  const esperadas = new Set();
  chars.forEach(c => {
    const desc = [c.raridade, c.tipo && 'tipo ' + c.tipo, c.afinidade && 'afinidade ' + c.afinidade].filter(Boolean).join(' · ');
    const hab = [['Habilidade', c.skill], ['Suprema', c.supreme], ['Ataque combinado', c.combo]].filter(([, a]) => a && (a.name || a.desc))
      .map(([r, a]) => `<h2>${r}${a.name ? ': ' + esc(a.name) : ''}</h2><p>${esc(a.desc)}</p>`).join('\n');
    const temRetrato = fs.existsSync(path.join(ROOT, 'portraits', c.slug + '.webp'));
    const url = `${SITE}/p/${c.slug}.html`;
    const meta = `${c.nome} (${desc}) em Dragon Ball: habilidades, supremo e combo. Veja a ficha completa no Zenkyo.`;
    const pagina = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none'">
<title>${esc(c.nome)} — Zenkyo</title>
<meta name="description" content="${esc(meta)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Zenkyo">
<meta property="og:title" content="${esc(c.nome)} — Zenkyo"><meta property="og:description" content="${esc(meta)}">
<meta property="og:url" content="${url}">${temRetrato ? `\n<meta property="og:image" content="${SITE}/portraits/${c.slug}.webp">` : ''}
<link rel="stylesheet" href="../fonts/fonts.css">
<link rel="icon" href="../assets/icone-192.png">
<style>body{margin:0;background:#0a0606;color:#f1e6d8;font:16px/1.55 'Barlow',system-ui,sans-serif}main{max-width:760px;margin:0 auto;padding:28px 18px 60px}
h1{font:italic 900 44px/1.05 'Barlow Condensed',sans-serif;text-transform:uppercase;color:#ffc21a;margin:0 0 6px}h2{font:italic 800 22px 'Barlow Condensed',sans-serif;text-transform:uppercase;color:#ff9a4d;margin:26px 0 4px}
p{margin:0;color:#d9cbbb}.meta{color:#a99b8b;margin:0 0 18px}.btn{display:inline-block;margin-top:28px;padding:12px 22px;background:#ff6a13;color:#fff;font-weight:800;text-decoration:none}
img{display:block;max-width:260px;height:auto;margin:14px 0}footer{margin-top:40px;font-size:13px;color:#8f8272}a{color:#ffc21a}</style>
</head>
<body><main>
<p class="meta"><a href="../">Zenkyo</a> › Guerreiros</p>
<h1>${esc(c.nome)}</h1>
<p class="meta">${esc([c.raridade, c.tipo, c.afinidade, c.raca !== 'Nenhum' ? c.raca : '', c.genero].filter(Boolean).join(' · '))}${c.tags.length ? '<br>' + c.tags.map(esc).join(' · ') : ''}</p>
${temRetrato ? `<img src="../portraits/${c.slug}.webp" alt="${esc(c.nome)}" width="260" loading="lazy">` : ''}
${hab}
<a class="btn" href="../#/guerreiro/${c.slug}">Abrir a ficha completa no Zenkyo</a>
<footer>Zenkyo é um site de fã, sem vínculo com Bandai Namco, Toei Animation, Shueisha ou os criadores do jogo. Dragon Ball e as imagens pertencem aos seus donos.</footer>
</main></body></html>
`;
    esperadas.add('p/' + c.slug + '.html');
    gravar('p/' + c.slug + '.html', pagina);
    urls.push({ loc: url, pri: '0.6' });
  });
  // páginas que não existem mais (personagem removido/renomeado) saem junto
  const pdir = path.join(ROOT, 'p');
  if(fs.existsSync(pdir)) fs.readdirSync(pdir).filter(f => f.endsWith('.html') && !esperadas.has('p/' + f)).forEach(f => {
    if(CHECK) problemas.push('p/' + f + ' sobrou (guerreiro não existe mais)'); else fs.unlinkSync(path.join(pdir, f));
  });
  gravar('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${hoje}</lastmod><priority>${u.pri}</priority></url>`).join('\n') + '\n</urlset>\n');
  return chars.length;
}

paginas().then(n => {
  if(!CHECK) execFileSync(process.execPath, [path.join(ROOT, 'update-csp.js')], { stdio: 'inherit' });
  else try{ execFileSync(process.execPath, [path.join(ROOT, 'update-csp.js'), '--check'], { stdio: 'pipe' }); }catch(e){ problemas.push('CSP desatualizada (rode node build.js)'); }
  gravar('en/index.html', gerarIngles(read('index.html')));   // depois da CSP, que também mexe no index.html
  if(CHECK){
    if(problemas.length){ console.error('build desatualizado:\n - ' + problemas.join('\n - ')); process.exit(1); }
    console.log('build em dia.');
  } else console.log(`Build ok: versão offline ${versao}, ${n} páginas de guerreiros, sitemap.`);
}).catch(e => { console.error(e); process.exit(1); });
