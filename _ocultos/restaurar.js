// Devolve ao site um guerreiro guardado em _ocultos/.
//   node _ocultos/restaurar.js "Vegetto (SS4)"
// Depois rode: node build.js && node test-logic.js && node validate-data.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const nome = process.argv[2];
const dados = JSON.parse(fs.readFileSync(path.join(__dirname, 'personagens-ocultos.json'), 'utf8')).personagens;
if (!nome || !dados[nome]) { console.log('Guerreiros guardados:', Object.keys(dados).join(' | ')); process.exit(1); }
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const d = dados[nome], s = slug(nome);
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wr = (f, t) => fs.writeFileSync(path.join(ROOT, f), t);
// dados.js: habilidades + personagem
let t = rd('js/dados.js');
const mAP = /^const ABILITY_PROGRESSION = (\{.*\});$/m.exec(t);
const AP = JSON.parse(mAP[1]); AP[nome] = d.habilidades;
t = t.replace(mAP[0], () => 'const ABILITY_PROGRESSION = ' + JSON.stringify(AP) + ';');
const i0 = t.indexOf('const DEFAULT_CHARACTERS = ') + 'const DEFAULT_CHARACTERS = '.length;
const resto = t.slice(i0), fim = resto.indexOf('\n];');
const CH = JSON.parse(resto.slice(0, fim + 2)).filter(c => c.name !== nome); CH.push(d.personagem);
wr('js/dados.js', t.slice(0, i0) + JSON.stringify(CH, null, 2) + resto.slice(fim + 2));
// vinculos.js e almas.js: uma linha por guerreiro, antes do fechamento
const addLinha = (f, obj) => {
  let x = rd(f); const crlf = x.includes('\r\n'); x = x.replace(/\r\n/g, '\n');
  const k = '  ' + JSON.stringify(nome) + ':';
  x = x.split('\n').filter(l => !l.startsWith(k)).join('\n');
  const f2 = x.lastIndexOf('};'); let corpo = x.slice(0, f2).replace(/\s+$/, ''); if (!corpo.endsWith(',') && !corpo.endsWith('{')) corpo += ',';
  x = corpo + '\n' + k + ' ' + JSON.stringify(obj) + '\n' + x.slice(f2);
  wr(f, crlf ? x.replace(/\n/g, '\r\n') : x);
};
addLinha('js/vinculos.js', d.vinculos); addLinha('js/almas.js', d.almas);
// habilidades completas
const JP = 'personagens-habilidades-completas.json'; const jt = rd(JP), crlf = jt.includes('\r\n'); const J = JSON.parse(jt);
const arr = Object.values(J.personagens).filter(p => p.nome !== nome); arr.push(d.habilidadesCompletas);
J.personagens = {}; arr.forEach((p, i) => { J.personagens[String(i)] = p; });
let jo = JSON.stringify(J, null, 2); wr(JP, crlf ? jo.replace(/\n/g, '\r\n') : jo);
// imagens
const copia = (de, para) => { fs.mkdirSync(path.dirname(path.join(ROOT, para)), { recursive: true }); fs.copyFileSync(path.join(__dirname, de), path.join(ROOT, para)); };
const pasta = path.join(__dirname, 'ability-icons/Novos', s);
if (fs.existsSync(pasta)) fs.readdirSync(pasta).forEach(f => copia('ability-icons/Novos/' + s + '/' + f, 'ability-icons/Novos/' + s + '/' + f));
if (fs.existsSync(path.join(__dirname, 'icones', s + '.webp'))) {
  copia('icones/' + s + '.webp', 'icones/' + s + '.webp');
  const ver = JSON.parse(rd('icones/versoes.json')); ver[s] = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'icones', s + '.webp'))).digest('hex').slice(0, 8);
  wr('icones/versoes.json', JSON.stringify(ver));
}
// traduções em inglês guardadas (as que o guerreiro usa e o site ainda não tem)
try {
  const tr = JSON.parse(fs.readFileSync(path.join(__dirname, 'traducoes-en.json'), 'utf8'));
  const fonte = rd('js/dados.js') + rd('js/vinculos.js') + rd('js/app.js');
  const ja = rd('js/lang/dados-en.js');
  const novas = Object.entries(tr).filter(([k]) => fonte.includes(k) && !ja.includes(JSON.stringify(k) + ':'));
  if (novas.length) {
    const c2 = ja.includes('\r\n'); const L = ja.replace(/\r\n/g, '\n').split('\n'); const f2 = L.lastIndexOf('});');
    L.splice(f2, 0, ...novas.map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ','));
    wr('js/lang/dados-en.js', c2 ? L.join('\n').replace(/\n/g, '\r\n') : L.join('\n'));
    console.log('traduções em inglês devolvidas:', novas.length);
  }
} catch (e) { /* sem traduções guardadas */ }
console.log('Restaurado:', nome, '— agora rode: node build.js && node test-logic.js && node validate-data.js');
