// Gera og/<slug>.jpg (1200x630): a imagem que aparece quando alguém cola o link de um guerreiro no WhatsApp, Discord, Telegram...
// Não precisa rodar a cada mudança: só quando entrar guerreiro novo, trocar retrato, nome ou raridade.
//   npm i sharp --no-save && node gerar-previas.js            (todos)
//   node gerar-previas.js vegetto-ss4 kale                    (só esses)
// Depois rode: node build.js (as páginas p/<slug>.html passam a apontar para og/<slug>.jpg)
const fs = require('fs'), path = require('path');
const sharp = require('sharp');
const ROOT = __dirname;
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const dados = fs.readFileSync(path.join(ROOT, 'js/dados.js'), 'utf8');
const i0 = dados.indexOf('const DEFAULT_CHARACTERS = ') + 'const DEFAULT_CHARACTERS = '.length;
const resto = dados.slice(i0);
const CH = JSON.parse(resto.slice(0, resto.indexOf('\n];') + 2));
const so = process.argv.slice(2);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const raridadeTxt = r => String(r || '').replace(/^SSR \[(.*)\]$/, 'SSR $1');
const COR = { 'SSR Ultimate': '#7fe9ff', 'SSR Lendário': '#ff9a4d', 'SSR Limitado': '#ffd34d' };

function linhas(nome) {
  const pal = nome.split(' '), out = []; let atual = '';
  pal.forEach(p => { if ((atual + ' ' + p).trim().length > 13 && atual) { out.push(atual); atual = p; } else atual = (atual + ' ' + p).trim(); });
  if (atual) out.push(atual);
  return out.slice(0, 3);
}

async function fazer(c) {
  const s = slug(c.name);
  const retrato = path.join(ROOT, 'portraits', s + '.webp');
  if (!fs.existsSync(retrato)) { console.log('sem retrato, pulei:', s); return; }
  const W = 1200, H = 630;
  const fundo = await sharp(path.join(ROOT, 'assets/bg-landscape.webp')).resize(W, H, { fit: 'cover' }).modulate({ brightness: 0.55 }).toBuffer();
  const ch = 566, cw = Math.round(ch * 1070 / 1413);
  const card = await sharp(retrato).resize({ height: ch }).png().toBuffer();
  const meta = await sharp(card).metadata();
  const sombra = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width + 60}" height="${meta.height + 60}"><rect x="30" y="38" width="${meta.width}" height="${meta.height}" rx="14" fill="#000" opacity="0.55"/></svg>`);
  const sombraB = await sharp(sombra).blur(14).toBuffer();
  const L = linhas(c.name), maior = Math.max(...L.map(l => l.length));
  const tam = Math.max(46, Math.min(84, Math.floor(540 / (maior * 0.6))));
  const rar = raridadeTxt(c.rarity), corRar = COR[rar] || '#f1e6d8';
  const y0 = 250 - (L.length - 1) * tam * 0.5;
  const texto = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs><linearGradient id="v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a0606" stop-opacity="0.82"/><stop offset="0.6" stop-color="#0a0606" stop-opacity="0.35"/><stop offset="1" stop-color="#0a0606" stop-opacity="0"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#v)"/>
<rect x="0" y="0" width="12" height="${H}" fill="#ff6a13"/>
${L.map((l, i) => `<text x="72" y="${y0 + i * tam * 1.05}" font-family="Arial Black, Impact, Arial, sans-serif" font-weight="900" font-style="italic" font-size="${tam}" fill="#ffc21a" stroke="#5a2a00" stroke-width="3" paint-order="stroke">${esc(l.toUpperCase())}</text>`).join('\n')}
<text x="72" y="${y0 + (L.length - 1) * tam * 1.05 + 64}" font-family="Arial, sans-serif" font-weight="700" font-size="40" fill="${corRar}">${esc(rar)}</text>
<text x="72" y="${H - 96}" font-family="Arial, sans-serif" font-weight="700" font-size="34" fill="#f1e6d8">Zenkyo</text>
<text x="72" y="${H - 52}" font-family="Arial, sans-serif" font-size="26" fill="#cdbfae">zenkyo.com.br · site de fã, não oficial</text>
</svg>`;
  const x = W - meta.width - 70, y = Math.round((H - meta.height) / 2);
  const jpg = await sharp(fundo)
    .composite([{ input: sombraB, left: x - 30, top: y - 20 }, { input: card, left: x, top: y }, { input: Buffer.from(texto), left: 0, top: 0 }])
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  fs.mkdirSync(path.join(ROOT, 'og'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'og', s + '.jpg'), jpg);
  console.log('ok', s, Math.round(jpg.length / 1024) + ' KB');
}
(async () => { for (const c of CH) { if (!so.length || so.includes(slug(c.name))) await fazer(c); } })();
