// Zenkyo — idioma e textos da interface. Carregado ANTES de dados.js e app.js.
// O idioma vem do <html lang> da página: "/" é português (pt-BR) e "/en/" é inglês (gerado por node build.js).
// Os textos ficam em js/lang/pt.js (sempre carregado) e js/lang/en.js (só em /en/). kzt('chave', { nome:'x' }) devolve o
// texto no idioma da página e troca {nome} pelo valor; se a chave ainda não existir em inglês, cai no português
// (nunca aparece uma chave crua). Chaves que faltam nos dois viram o próprio nome da chave, para aparecer nos testes.
(function(g){
  let docLang = '';
  try{ docLang = String(g.document.documentElement.getAttribute('lang') || '').toLowerCase(); }catch(e){}
  const lang = docLang.indexOf('en') === 0 ? 'en' : 'pt';
  const dic = { pt:{}, en:{} };

  g.KZ_LANG = lang;
  g.KZ_LOCALE = lang === 'en' ? 'en-US' : 'pt-BR';   // para toLocaleString / toLocaleDateString / localeCompare
  g.KZ_DECIMAL = lang === 'en' ? '.' : ',';          // separador decimal dos números montados à mão
  g.kzAddLang = (idioma, textos) => { Object.assign(dic[idioma] || (dic[idioma] = {}), textos); };
  g.kzt = (chave, vars) => {
    let s = dic[lang][chave];
    if(s == null) s = dic.pt[chave];
    if(s == null) return chave;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k]))) : s;
  };
  // Termos do jogo que vêm dos dados em português (Ataque, Fogo, Saiyajin, tags...): os dados continuam em português
  // (são chaves lógicas); só o texto mostrado muda. 'termo.<valor em português>' em js/lang/en.js; sem tradução, mostra o original.
  g.kzTermo = v => { const s = dic[lang]['termo.' + v]; return s != null ? s : v; };
  // Textos do jogo (nomes de personagens e de habilidades, descrições): a chave é o próprio texto em português, como está em
  // dados.js. Vêm de js/dados-en.js (só em /en/) por kzAddDados({ 'texto em português': 'English text' }). Sem tradução, o
  // português aparece (nunca some nem quebra). Os dados em si continuam em português: são chaves lógicas do código.
  const dadosEn = {};
  g.kzAddDados = mapa => { Object.assign(dadosEn, mapa); };
  g.kzTrad = t => { if(lang !== 'en' || t == null) return t; const s = dadosEn[t]; return s != null ? s : t; };
  g.kzNome = n => g.kzTrad(n);   // nome de personagem
  g.kzDadosEn = dadosEn;         // para os testes e o relatório de cobertura
  // Valores citados em textos (limites de apoio): o site guarda tudo em reais; em inglês mostra o equivalente em dólar pela
  // taxa fixa KZ_USD_BRL (a mesma que a função de pagamento internacional usa). Para ajustar, mude só esta constante.
  g.KZ_USD_BRL = 5;
  g.kzValorBRL = n => lang === 'en'
    ? '$' + (Math.round(n / g.KZ_USD_BRL * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : 'R$ ' + n;
  g.kzLangTextos = dic;   // só para os testes conferirem as chaves

  // O botão PT/EN do cabeçalho leva para a mesma tela no outro idioma (mantém o #/rota).
  const sincronizaSeletor = () => {
    try{
      const a = g.document.getElementById('langSwitch');
      if(a && a.setAttribute) a.setAttribute('href', (lang === 'pt' ? 'en/' : './') + (g.location.hash || ''));
    }catch(e){}
  };
  try{
    sincronizaSeletor();
    g.addEventListener('hashchange', sincronizaSeletor);
  }catch(e){}
})(typeof window !== 'undefined' ? window : globalThis);
