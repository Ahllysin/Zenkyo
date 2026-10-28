// Versão do site (aparece no rodapé e nos registros de erro). Só muda quando o dono publicar uma versão nova.
const SITE_VERSAO = '0.1.1 Alpha';

/* ---------- Log de crash: erros do site vão para a tabela site_errors do Supabase (só o dono lê, na aba Perfil) ----------
   Fica no começo do script para pegar também erros durante a carga. No máximo 5 registros por visita, sem repetir. */
const CRASH_MAX = 5;
let crashEnviados = 0, crashFila = [];
const crashVistos = new Set();
function crashAba(){ try{ return (typeof state !== 'undefined' && state) ? state.tab : null; }catch(e){ return null; } }
function reportCrash(msg, stack, extra){
  try{
    msg = String(msg == null ? '' : msg).replace(/\s+/g, ' ').trim().slice(0, 500) || 'erro desconhecido';
    const chave = msg + '|' + String(stack || '').slice(0, 160);
    if(crashVistos.has(chave) || crashEnviados >= CRASH_MAX) return;
    crashVistos.add(chave); crashEnviados++;
    const linha = {
      msg,
      stack: stack ? String(stack).slice(0, 2000) : null,
      pagina: typeof location !== 'undefined' ? String((location.pathname || '') + (location.hash || '')).slice(0, 200) : null,
      navegador: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 300) : null,
      versao: SITE_VERSAO + (typeof document !== 'undefined' ? ' · ' + String(document.lastModified || '').slice(0, 40) : ''),
      extra: extra || null,
    };
    if(window.__sb && window.__sb.client) enviarCrash(linha); else crashFila.push(linha);
  }catch(e){}
}
function enviarCrash(linha){
  try{ window.__sb.client.from('site_errors').insert(linha).then(()=>{}, ()=>{}); }catch(e){}
}
if(typeof window.addEventListener === 'function'){
  window.addEventListener('supabase-ready', ()=>{ const f = crashFila; crashFila = []; f.forEach(enviarCrash); });
  window.addEventListener('error', e=>{
    if(e && e.target && e.target !== window) return;                         // imagem/arquivo que não carregou: não é crash
    if(!e.filename && /^Script error\.?$/.test(e.message || '')) return;     // erro de script de fora, sem detalhes
    reportCrash(e.message, e.error && e.error.stack, { arquivo: String(e.filename || '').split('/').pop().slice(0, 80) || null, linha: e.lineno || null, coluna: e.colno || null, aba: crashAba() });
  }, true);
  window.addEventListener('unhandledrejection', e=>{
    const r = e && e.reason;
    reportCrash('Promessa rejeitada: ' + ((r && r.message) || String(r)), r && r.stack, { aba: crashAba() });
  });
}
// Falhas tratadas pelo próprio site (ex.: "Não consegui carregar os guias") também entram no log, marcadas como "aviso".
if(typeof console !== 'undefined' && typeof console.error === 'function'){
  const consoleErrorOriginal = console.error.bind(console);
  console.error = (...args)=>{
    consoleErrorOriginal(...args);
    try{
      const txt = args.map(a=>a && a.message ? a.message : (typeof a === 'string' ? a : '')).filter(Boolean).join(' — ');
      const err = args.find(a=>a && a.stack);
      if(txt) reportCrash(txt, err && err.stack, { tipo: 'aviso', aba: crashAba() });
    }catch(e){}
  };
}

// Imagens: o que antes era onerror/onload dentro do HTML agora é tratado aqui (a política de segurança do site proíbe script em atributo).
document.addEventListener('error', e => {
  const t = e.target;
  if(!t || t.tagName !== 'IMG' || !t.dataset || !t.dataset.onerr) return;
  switch(t.dataset.onerr){
    case 'fallback': t.style.display = 'none'; if(t.nextElementSibling) t.nextElementSibling.style.display = 'flex'; if(t.parentElement) t.parentElement.classList.add('img-failed'); break;
    case 'hide': t.style.visibility = 'hidden'; break;
    case 'remove': t.remove(); break;
    case 'remove-parent': if(t.parentNode) t.parentNode.remove(); break;
    case 'card':   // arte de corpo inteiro que não existe: mostra a carta do personagem no lugar
      if(t.dataset.card && !t.src.endsWith(t.dataset.card)){ const box = t.closest('.kz-nv-char, .kz-nv-dchar'); if(box) box.classList.add('is-card'); t.src = t.dataset.card; }
      else t.style.visibility = 'hidden';
      break;
    case 'cut':    // faixa do time que não existe: usa a carta recortada no mesmo formato
      if(t.dataset.card && !t.src.endsWith(t.dataset.card)){ t.classList.add('cut'); t.src = t.dataset.card; }
      else t.style.visibility = 'hidden';
      break;
  }
}, true);
document.addEventListener('load', e => {
  const t = e.target;
  if(t && t.tagName === 'IMG' && t.dataset && t.dataset.onload === 'show') t.style.visibility = '';
}, true);
/* ======================= STORAGE SHIM ======================= */
// window.storage (get/set assíncronos por chave) pode ser injetado por um ambiente
// de hospedagem específico. Quando o arquivo é aberto direto num navegador comum,
// window.storage não existe e todo save cai quieto no catch(e){} — nada persiste
// entre sessões. Este shim cobre esse caso com localStorage puro, mantendo a mesma
// interface assíncrona {get(key)->{value}|null, set(key,value)}.
if(!window.storage){
  window.storage = {
    async get(key){
      try{
        const v = localStorage.getItem('kiai_'+key);
        return v===null ? null : { value: v };
      }catch(e){ return null; }
    },
    async set(key, value){
      try{ localStorage.setItem('kiai_'+key, value); }catch(e){}
    },
  };
}

/* ======================= DATA / CONSTANTS ======================= */
const EFFECTS = ['derrubada','empurrao','elevacao_alta','elevacao_baixa'];
const EFFECT_LABELS = {derrubada:kzt('ef.derrubada'), empurrao:kzt('ef.empurrao'), elevacao_alta:kzt('ef.elevacao_alta'), elevacao_baixa:kzt('ef.elevacao_baixa')};
const EFFECT_ABBR = {derrubada:kzt('ef.abbr.derrubada'), empurrao:kzt('ef.abbr.empurrao'), elevacao_alta:kzt('ef.abbr.elevacao_alta'), elevacao_baixa:kzt('ef.abbr.elevacao_baixa')};
const ELEMENTS = ['Saiyajin','Humano','Androide','Nenhum'];
const GENDERS = ['Masculino','Feminino'];
const TYPES = ['Ataque','Defesa','Habilidade'];
const AFFINITIES = ['Raio','Fogo','Pedra','Luz'];

// Tier list estilo tiermaker — ranks configuráveis (nome e cor), por isso cada tier
// tem um "id" estável (nunca muda) separado do "label" (o texto, editável). Cores em
// hex puro (não var(--...)) porque o canvas de exportação também usa elas direto.
const TIER_COLOR_PALETTE = ['#d65a44','#c9a24b','#4f8a68','#5b7fa6','#8a5ac9','#b3402f','#c9527a','#4fa08a'];
function makeDefaultTierList(){
  return {
    tiers: [
      {id:'t_s', label:'S', color:'#d65a44', items:[]},
      {id:'t_a', label:'A', color:'#c9a24b', items:[]},
      {id:'t_b', label:'B', color:'#4f8a68', items:[]},
      {id:'t_c', label:'C', color:'#5b7fa6', items:[]},
      {id:'t_d', label:'D', color:'#8a5ac9', items:[]},
    ],
    unranked: [],
  };
}
// Cores padrão antigas dos 5 ranks iniciais -> cores do layout novo. Só troca quando o
// rank ainda está com a cor padrão antiga (não mexe em cor que o usuário tenha mudado).
const LEGACY_TIER_COLORS = {t_a:['#b3402f','#c9a24b'], t_b:['#c9a24b','#4f8a68'], t_c:['#4f8a68','#5b7fa6'], t_d:['#5b7fa6','#8a5ac9']};

// Dados reais de habilidade por personagem, em todos os niveis/estagios, extraidos
// manualmente do jogo (ver personagens-habilidades-completas.json para o dataset completo,
// incluindo as passivas da secao 'Supremo' que ainda ficam de fora da progressao abaixo).

// Calcula qual versao de cada habilidade esta desbloqueada para o nivel de estrela atual.
// Habilidade: base -> MAX. (dourada, na estrela indicada pelo proprio jogo, sempre 3).
// Suprema: base -> MAX. dourada (estrela 5) -> SMAX. azul (estrela 5 da fase azul, ou seja nivel 10).
// Habilidade Passiva (padrao, igual pra todos): soh aparece a partir da estrela indicada (sempre 2).
// Cronograma real de desbloqueio por estrela (confirmado pelo usuário, jogo original):
//   ★1 dourada  — Habilidade, Suprema e Ataque de Perseguição (base)
//   ★2 dourada  — Habilidade Passiva (padrão, aba própria)
//   ★3 dourada  — Passiva Única (a 3ª da seção "Supremo", exclusiva do personagem)
//   ★4 dourada  — Passiva (padrão, 1ª da seção "Supremo")
//   ★5 dourada  — Suprema MAX. (+ Despertar)
//   ★1 azul     — Passiva Única — nível máximo
//   ★2 azul     — Passiva (padrão, 2ª da seção "Supremo")
//   ★3 azul     — Habilidade MAX.
//   ★4 azul     — Passiva (padrão) — ainda não capturada do jogo
//   ★5 azul     — Suprema SMAX.
// Nome de cada fase e rótulo de cada nível (★1 Dourada ... ★5 Azul, ★1 LR ...); em inglês: ★1 Gold, ★1 Blue...
const STAR_PHASE_NAME = { gold:kzt('estrelas.dourada'), blue:kzt('estrelas.azul'), lr:'LR' };
const STAR_SCHEDULE = Array.from({ length:15 }, (_, i) => ({ reqLevel:i + 1, starLabel:'★' + starFilled(i + 1) + ' ' + STAR_PHASE_NAME[starPhase(i + 1)] }));
// Fases das estrelas: Dourada 1-5, Azul 6-10 (UR) e LR 11-15 (estrelas coloridas; só os SSR chegam lá).
function starPhase(lv){ return lv > 10 ? 'lr' : lv > 5 ? 'blue' : 'gold'; }
function starFilled(lv){ return lv > 10 ? lv - 10 : lv > 5 ? lv - 5 : lv; }
// Só chega ao LR quem é SSR e tem dados de LR (ABILITY_PROGRESSION[nome].lr); os demais param no 10.
function temDadosLR(c){ const p = c && ABILITY_PROGRESSION[c.name]; return !!(p && Array.isArray(p.lr) && p.lr.length); }
function maxStarLevel(c){ return (c && rarityLabel(c.rarity) === 'SSR' && temDadosLR(c)) ? 15 : 10; }
function starLabelFor(reqLevel){ return (STAR_SCHEDULE.find(s=>s.reqLevel===reqLevel)||{}).starLabel || kzt('estrelas.nivel', { n: reqLevel }); }

// Passivas "gerais" universais — mesmo nome/texto pra TODOS os personagens (não vêm do
// personagens-habilidades-completas.json, são fixas). Confirmadas pelo usuário direto do
// jogo. (O slot ★4 Dourada acabou não sendo universal — cada personagem tem seu próprio
// texto, capturado em p.passivaQuatroEstrelas.)
const GENERIC_PASSIVES_UNIVERSAIS = {
  7: { nome:'Redução de DANO', icone:'ability-icons/Passiva padrão/despertar 2.png', tipo:'Ativar',
       desc:'Habilidade passiva geral de Guerreiro, que reduz o dano sofrido pelo Guerreiro. Redução de Dano +6%' },
  9: { nome:'Aumento de Dano', icone:'ability-icons/Passiva padrão/despertar 4.png', tipo:'Ativar',
       desc:'Habilidade passiva geral de Guerreiro, que ajuda a causar mais dano. Taxa de Dano +6%' },
};


function getAbilityUnlocks(charName, level){
  const p = ABILITY_PROGRESSION[charName];
  if(!p) return null;
  // As passivas da seção "Supremo" do jogo (p.passivasSupremo) NÃO entram nesta progressão
  // por instrução explícita — ficam de fora por enquanto, guardadas só no JSON.

  const habilidade = (p.habilidade.max && level >= 8) ? p.habilidade.max : p.habilidade.base;
  let suprema = p.suprema.base;
  if(p.suprema.max && level >= 5) suprema = p.suprema.max;
  if(p.suprema.smax && level >= 10) suprema = p.suprema.smax;

  // Agrupado por TIPO de habilidade (Habilidade / Suprema / Combinado / Passiva), não por
  // ordem cronológica de estrela — cada tipo fica na sua própria seção no popup, com os
  // tiers em sequência dentro dela.
  // `fallbackTipo` só é usado quando o tier ainda não tem dado real (data=null) — pra
  // saber se, quando for capturado, vai ser "Ativar" (passiva nova e independente) ou
  // "Despertar" (upgrade de uma habilidade que já existia). Default 'Ativar'.
  const mkTier = (reqLevel, data, fallbackTipo) => ({ reqLevel, starLabel: starLabelFor(reqLevel), data, unlocked: level >= reqLevel, fallbackTipo: fallbackTipo || 'Ativar' });
  const groups = [
    { title:'Habilidade', tiers:[ mkTier(1, p.habilidade.base), mkTier(8, p.habilidade.max) ] },
    { title:'Suprema', tiers:[ mkTier(1, p.suprema.base), mkTier(5, p.suprema.max), mkTier(10, p.suprema.smax) ] },
    { title:'Ataque Combinado', tiers:[ mkTier(1, p.combinado) ] },
    // Passiva exclusiva do personagem: aprende em ★3 Dourada, sobe de nível (a mesma
    // passiva, "Despertar") em ★1 Azul. Exibida antes da Passiva (Padrão), por pedido
    // do usuário.
    { title:'Passiva Única', tiers:[
        mkTier(3, p.passivaUnica ? p.passivaUnica.base : null),
        mkTier(6, p.passivaUnica ? p.passivaUnica.max : null, 'Despertar'),
      ] },
    // A passiva de ★2 Dourada entra JUNTO com as outras passivas padrão (★4 Dourada /
    // ★2 Azul / ★4 Azul), não como grupo separado. Cada uma é uma passiva DISTINTA e
    // independente (não uma evolução da anterior), então todas são "Ativar". ★4 Dourada
    // não é universal (cada personagem tem seu próprio texto/valor), só ★2 Azul/★4 Azul são.
    { title:'Passiva (Padrão)', tiers:[
        mkTier(2, p.passiva),
        mkTier(4, p.passivaQuatroEstrelas),
        mkTier(7, GENERIC_PASSIVES_UNIVERSAIS[7]),
        mkTier(9, GENERIC_PASSIVES_UNIVERSAIS[9]),
      ] },
  ];
  // Super Despertar (LR, estrelas coloridas 11-15): só os SSR chegam, e só alguns têm habilidades novas (19 de 51).
  if(Array.isArray(p.lr) && p.lr.length){
    groups.push({ title:'Super Despertar (LR)', tiers: p.lr.map((d, i) => mkTier(11 + i, d.semTexto ? { nome:d.nome, desc:kzt('hab.lrSemTexto'), tipo:d.tipo, icone:d.icone } : d, 'Despertar')) });
  }

  const passivaUnlocked = !!(p.passiva && level >= 2);
  return {
    habilidade, suprema, combinado: p.combinado,
    passiva: p.passiva, passivaUnlocked,
    passivaReqLabel: '★2 Dourada',
    groups
  };
}

function uid(){ return 'c_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); }

function emptyAbility(){ return {name:'', desc:'', effects:[]}; }
function emptyCombo(){ return {name:'', desc:'', triggers:[], effects:[]}; }
function blankChar(){
  return {
    id: uid(), name:'', element:'Nenhum', gender:'Masculino', tags:[],
    rarity:'', type:'', affinity:'',
    skill: emptyAbility(), supreme: emptyAbility(), combo: emptyCombo(),
    passive: emptyAbility(), // habilidade passiva própria do personagem (desbloqueia na ★3 dourada) — ainda sem dados reais
  };
}

/* ======================= DADOS PADRAO DO JOGO ======================= */
/* Elenco completo (61 guerreiros) embutido no site. O botao Importar/Exportar
   continua disponivel para adicionar ou atualizar personagens depois. */

function makeCharFromData(item){
  return {
    ...blankChar(),
    ...item,
    // id derivado do nome (e não aleatório): sem isso, cada recarga da página gerava ids
    // novos pro elenco padrão e a equipe/coleção/favoritos/tier list salvos por id se perdiam.
    id: item.id || ('c_' + slug(item.name)),
    tags: item.tags || [],
    skill: {...emptyAbility(), ...(item.skill||{})},
    supreme: {...emptyAbility(), ...(item.supreme||{})},
    combo: {...emptyCombo(), ...(item.combo||{})},
    passive: {...emptyAbility(), ...(item.passive||{})},
  };
}

/* ======================= STATE ======================= */
let state = {
  tab: 'chars',                     // 'chars' | 'collection' | 'combos' | 'guias' | 'tierlist' | 'favs'
  characters: [],
  team: Array(6).fill(null),        // character id or null, index 0..5 = position 1..6 (Casa 1..6)
  filters: { search:'', rarity:null, type:null, affinity:null, element:null },
  favs: [],                         // ids dos personagens favoritados (aba Favoritos)
  donors: [],                       // [{id, number, name, amount, quote, discord, link, honras:[], active}] — Aliança Z (aba Doar + widget flutuante)
  nextDonorNumber: 1,               // próximo número permanente a distribuir (nunca reaproveita número de quem foi removido)
  rankingAberto: false,             // aba Doar: ranking expandido até o top 10
  mpDoacao: { valor:KZ_LANG === 'en' ? 25 : 20, outro:false, outroValor:'', nome:'', anonimo:false, estado:'', msg:'' },   // aba Doar (Mercado Pago)
  admin: { lista:null, carregando:false, erro:'', filtro:'pagas', busca:'' },   // aba Admin (só o dono)
  mpRetorno: null,                  // 'aprovada' | 'pendente' | 'recusada' ao voltar do Mercado Pago
  myDonationTotal: null,            // soma real das doações do próprio login (null = desconhecido)
  donorProfileId: null,             // id do apoiador com o perfil aberto no popup, ou null
  discordUser: null,                // {id, username, avatarUrl} — sessão Supabase/Discord da Aliança Z, ou null
  myProfile: null,                  // rascunho do próprio perfil (aba Perfil), carregado após login
  profiles: [],                     // cache dos perfis públicos (pra enriquecer o mural da Aliança Z)
  navCompact: typeof window !== 'undefined' && (window.innerWidth || 1200) < 900,   // no celular a barra já começa recolhida (sem "piscar" na carga)                // barra lateral recolhida (só ícones)
  guiasView: 'sistemas',            // 'sistemas' (12 guias do jogo) | 'combos' (como o site monta combos)
  guideId: null,                    // guia aberto na leitura, ou null
  guideQuery: '',                   // busca na lista de guias
  crashLog: null,                   // log de erros carregado no painel do dono (aba Perfil)
  heroEdit: null,                   // rascunho {scope,id,x,y,z} enquanto o ajuste do retrato está aberto, ou null
  heroCharId: null,                 // personagem em destaque no topo da lista (troca no hover)
  slotSel: null,                    // casa do Montador selecionada, esperando um guerreiro do elenco
  rosterSearch: '',
  recRarity: 'all',
  iaOff: false,                       // IA do montador desligada nesta sessão (limite gratuito do dia ou função não configurada)
  iaAviso: '',                        // motivo da última falha da IA, mostrado ao lado do resultado
  recFill: null,                      // frente que falta na equipe (dano|tank|suporte|controle) para filtrar as sugestões
  autoMode: 'equilibrado',
  autoOpts: null,
  descText: '', descRes: null,      // aba Combos: "Descreva o time" (texto e resultado, não persiste)
  communityPosts: [],                // posts da aba Comunidade (vêm do Supabase, já sanitizados)
  communityLoaded: false, communityLoading: false, communityError: null, communityFor: null,
  communityMyLikes: [], communityReported: [],
  communityOpenPost: null, communityProfileUser: null,   // post aberto na aba Comunidade / perfil de autor aberto no popup
  communityFilter: 'all', communitySort: 'recent', communitySearch: '', communityCompose: null,
  sf: { chars:{tags:[],trig:[],eff:[]}, coll:{tags:[],trig:[],eff:[]}, roster:{tags:[],trig:[],eff:[]}, open:{} },   // filtro de pesquisa por tags + o que o Ataque Combinado persegue/causa, um por aba
  editingChar: null,                // character object being edited in modal, or null
  ioModalOpen: false,               // import/export JSON modal
  pickerSlot: null,                 // slot index currently choosing a warrior for, or null
  simModalOpen: false,              // popup com o Simulador de combo aberto (aba Combos)
  simCharId: null,                  // personagem selecionado no Simulador de combo (aba Combos)
  formations: [],                   // [{name, team}]
  collection: {},                   // {characterId: {owned:bool, level:0-15}} — sincroniza com a conta Discord quando logado
  collectionSearch: '',
  collectionOnlyOwned: false,
  collectionType: '',                // '' = todos os tipos, ou 'Ataque'/'Defesa'/'Habilidade'
  collectionAffinity: '',            // '' = todas as afinidades, ou 'Raio'/'Fogo'/'Pedra'/'Luz'
  abilityPopupCharId: null,         // character id currently showing the ability-details popup, or null
  viewingCharId: null,               // character id whose full detail page is open in the Personagens tab, or null
  charDetailTab: 'habilidades',       // aba ativa dentro da ficha do personagem: 'habilidades'|'comida'|'vinculos'
  tierList: null,                    // {tiers:[{id,label,color,items:[charId,...]}], unranked:[charId,...]} — preenchido em loadState(); só local, sem conta
};
let dragSlotIdx = null;             // slot index currently being dragged (team reorder)
let dragRosterId = null;            // character id being dragged from the Elenco panel into a slot
let charsListScrollY = 0;           // posição de scroll da lista de Personagens antes de abrir a ficha, pra restaurar ao voltar
let dragTierRowId = null;          // rank sendo arrastado pela alça pra reordenar (Tier List)
let dragWasDropped = false;         // set by the 'drop' handler so dragend knows not to treat it as "dropped outside"

/* ---------- Auto-rolagem durante o arrastar (Tier List, Montador de Combos…) ----------
   O arrastar nativo nem sempre rola a página; aqui, enquanto um card está sendo arrastado e o mouse
   chega perto da borda de cima ou de baixo da janela, a página rola sozinha (mais rápido quanto mais perto da borda). */
let dragScrollY = null, dragScrollRaf = 0;
function dragScrollTick(){
  if(dragScrollY === null){ dragScrollRaf = 0; return; }
  const vh = window.innerHeight, edge = Math.max(70, Math.min(130, vh * 0.2)), MAX = 26;
  let dy = 0;
  if(dragScrollY < edge) dy = -Math.max(2, Math.ceil((edge - dragScrollY) / edge * MAX));
  else if(dragScrollY > vh - edge) dy = Math.max(2, Math.ceil((dragScrollY - (vh - edge)) / edge * MAX));
  if(dy) window.scrollBy(0, dy);
  dragScrollRaf = requestAnimationFrame(dragScrollTick);
}
function dragScrollStop(){ dragScrollY = null; }
document.addEventListener('dragover', e=>{
  dragScrollY = e.clientY;
  if(!dragScrollRaf) dragScrollRaf = requestAnimationFrame(dragScrollTick);
}, true);
document.addEventListener('dragend', dragScrollStop, true);
document.addEventListener('drop', dragScrollStop, true);
let dragTierItemId = null;          // character id currently being dragged in the tier list

/* ---------- Arrastar com o dedo ----------
   O navegador do celular não dispara dragstart/dragover/drop (isso só existe com mouse). Aqui, segurar o dedo num elemento
   com draggable="true" por ~0,25 s começa o arrasto: aparece uma cópia sob o dedo, a tela rola perto das bordas e, ao soltar,
   os MESMOS handlers do mouse (Tier List, casas do Montador, elenco, Comunidade) recebem os eventos simulados.
   Mexer o dedo antes disso é rolar a página normalmente. */
(function touchDragDrop(){
  if(typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  const ESPERA = 260, FOLGA = 10;
  let origem = null, dt = null, fantasma = null, ativo = false, timer = 0, x0 = 0, y0 = 0, sobre = null, aceita = false, ignoraClique = 0;
  const novoDT = () => {
    const d = {};
    return { effectAllowed:'all', dropEffect:'move', types:[], files:[], items:[],
      setData(t, v){ d[t] = String(v); if(!this.types.includes(t)) this.types.push(t); }, getData(t){ return d[t] || ''; },
      clearData(){ Object.keys(d).forEach(k => delete d[k]); this.types = []; }, setDragImage(){} };
  };
  function disparar(el, tipo, x, y){
    const ev = new Event(tipo, { bubbles:true, cancelable:true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt });
    Object.defineProperty(ev, 'clientX', { value: x });
    Object.defineProperty(ev, 'clientY', { value: y });
    el.dispatchEvent(ev);
    return ev;
  }
  function limpar(){
    clearTimeout(timer); timer = 0;
    if(fantasma && fantasma.parentNode) fantasma.parentNode.removeChild(fantasma);
    fantasma = null; ativo = false; origem = null; dt = null; sobre = null; aceita = false;
    document.documentElement.classList.remove('kz-touch-drag');
  }
  function comeca(x, y){
    if(!origem) return;
    dt = novoDT();
    const ev = disparar(origem, 'dragstart', x, y);
    if(ev.defaultPrevented){ limpar(); return; }
    ativo = true;
    const r = origem.getBoundingClientRect();
    fantasma = origem.cloneNode(true);
    fantasma.removeAttribute('id');
    Object.assign(fantasma.style, { position:'fixed', left:r.left + 'px', top:r.top + 'px', width:r.width + 'px', height:r.height + 'px', margin:'0', zIndex:'99999',
      pointerEvents:'none', opacity:'.88', transform:'scale(1.06)', boxShadow:'0 10px 30px rgba(0,0,0,.6)', transition:'none' });
    fantasma._dx = x - r.left; fantasma._dy = y - r.top;
    document.body.appendChild(fantasma);
    document.documentElement.classList.add('kz-touch-drag');
    try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){}
  }
  document.addEventListener('touchstart', e => {
    if(e.touches.length !== 1){ limpar(); return; }
    const alvo = e.target && e.target.closest ? e.target.closest('[draggable="true"]') : null;
    if(!alvo) return;
    limpar();
    origem = alvo; const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY;
    timer = setTimeout(() => comeca(x0, y0), ESPERA);
  }, { passive:true });
  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if(!ativo){
      if(timer && Math.hypot(t.clientX - x0, t.clientY - y0) > FOLGA) limpar();   // era rolagem, não arrasto
      return;
    }
    e.preventDefault();   // arrastando: a página não rola com o dedo (a rolagem perto das bordas vem do dragover)
    fantasma.style.left = (t.clientX - fantasma._dx) + 'px'; fantasma.style.top = (t.clientY - fantasma._dy) + 'px';
    const alvo = document.elementFromPoint(t.clientX, t.clientY);
    if(alvo !== sobre){
      if(sobre) disparar(sobre, 'dragleave', t.clientX, t.clientY);
      if(alvo) disparar(alvo, 'dragenter', t.clientX, t.clientY);
      sobre = alvo;
    }
    aceita = !!(alvo && disparar(alvo, 'dragover', t.clientX, t.clientY).defaultPrevented);
  }, { passive:false });
  function termina(cancelado, e){
    if(!ativo){ limpar(); return; }
    const t = e && e.changedTouches && e.changedTouches[0];
    const x = t ? t.clientX : x0, y = t ? t.clientY : y0;
    const alvoFinal = sobre;
    if(!cancelado && alvoFinal && aceita) disparar(alvoFinal, 'drop', x, y);
    else if(alvoFinal) disparar(alvoFinal, 'dragleave', x, y);
    const o = origem;
    ignoraClique = Date.now() + 450;      // o toque que solta não pode virar clique
    disparar(o, 'dragend', x, y);
    limpar();
  }
  document.addEventListener('touchend', e => { if(ativo) e.preventDefault(); termina(false, e); }, { passive:false });
  document.addEventListener('touchcancel', e => termina(true, e), { passive:true });
  document.addEventListener('click', e => { if(Date.now() < ignoraClique){ e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', e => { if(timer || ativo) e.preventDefault(); });
})();

let loaded = false;

/* ======================= STORAGE ======================= */
/* ---------- Links por aba e por guerreiro: #/guerreiro/<nome>, #/combos, #/colecao ... ---------- */
const ROUTE_TABS = { guerreiros:'chars', colecao:'collection', combos:'combos', guias:'guias', tierlist:'tierlist', comunidade:'comunidade', favoritos:'favs', doar:'doar' };
const ROUTE_NAMES = Object.fromEntries(Object.entries(ROUTE_TABS).map(([k, v]) => [v, k]));
function parseRouteHash(h){
  h = String(h || '');
  let m = /^#\/guerreiro\/([a-z0-9-]{1,60})$/.exec(h);
  if(m) return { tab:'chars', char:m[1] };
  m = /^#guia-([a-z0-9-]{1,40})$/.exec(h);
  if(m) return { tab:'guias', guide:m[1] };
  m = /^#\/comunidade\/([0-9a-f-]{36})$/.exec(h);
  if(m) return { tab:'comunidade', post:m[1] };
  const t = /^#\/([a-z]{3,12})$/.exec(h);
  return t && ROUTE_TABS[t[1]] ? { tab: ROUTE_TABS[t[1]] } : null;
}
function applyRouteHash(){
  const r = parseRouteHash(typeof location !== 'undefined' ? location.hash : '');
  if(!r) return false;
  state.tab = r.tab; state.viewingCharId = null; state.communityOpenPost = null; state.communityProfileUser = null;
  if(r.tab !== 'guias') state.guideId = null;
  if(r.char){
    const ch = state.characters.find(x => slug(x.name) === r.char);
    if(ch){ state.viewingCharId = ch.id; state.charDetailTab = 'habilidades'; }
  }
  if(r.tab === 'guias'){ if(r.guide){ state.guiasView = 'sistemas'; state.guideId = r.guide; } else state.guideId = null; }
  if(r.post) state.communityOpenPost = r.post;
  return true;
}
function routeHashFor(){
  if(state.tab === 'chars' && state.viewingCharId){ const ch = getChar(state.viewingCharId); return ch ? '#/guerreiro/' + slug(ch.name) : ''; }
  if(state.tab === 'guias' && state.guideId && /^[a-z0-9-]{1,40}$/.test(state.guideId)) return '#guia-' + state.guideId;
  if(state.tab === 'comunidade' && state.communityOpenPost && /^[0-9a-f-]{36}$/.test(String(state.communityOpenPost))) return '#/comunidade/' + state.communityOpenPost;
  return ROUTE_NAMES[state.tab] ? '#/' + ROUTE_NAMES[state.tab] : '';
}
// Cada mudança de aba, ficha, guia ou post vira uma entrada do histórico: o botão Voltar do navegador/celular volta uma ação
// dentro do site (a primeira entrada só é ajustada, sem criar uma a mais). Voltar/avançar disparam hashchange (abaixo).
let rotaPronta = false;
function setRouteHash(){
  if(!loaded || typeof history === 'undefined' || typeof location === 'undefined') return;
  // Volta do login (Discord): o hash traz o token (#access_token=…). Não mexer enquanto o Supabase não o ler e limpar.
  if(/access_token=|refresh_token=|error_description=|provider_token=/.test(location.hash || '')) return;
  const h = routeHashFor();
  if(h !== (location.hash || '')){
    try{
      const url = location.pathname + location.search + h;
      if(rotaPronta) history.pushState(null, '', url); else history.replaceState(null, '', url);
    }catch(e){}
  }
  rotaPronta = true;
}
function charShareUrl(id){
  const ch = getChar(id);
  return ch ? location.origin + location.pathname + '#/guerreiro/' + slug(ch.name) : '';
}
async function copyCharLink(id){
  const url = charShareUrl(id);
  if(!url) return;
  try{ await navigator.clipboard.writeText(url); showToast('Link copiado!'); }
  catch(e){ try{ window.prompt('Copie o link:', url); }catch(_){} }
}
if(typeof window !== 'undefined' && window.addEventListener) window.addEventListener('hashchange', () => {
  if(!loaded) return;
  if(applyRouteHash()){
    render();
    window.scrollTo(0, (state.tab === 'chars' && !state.viewingCharId) ? (charsListScrollY || 0) : 0);   // voltar da ficha: a lista no mesmo ponto
  }
});
async function loadState(){
  // Lê tudo de window.storage (localStorage) primeiro — sempre funciona, mesmo sem conta.
  // Se der pra logar com Discord (Supabase configurado), pullUserDataFromRemote() roda
  // logo depois e essas mesmas chaves são substituídas pelo que estiver na nuvem.
  for(const key of SYNCED_KEYS){
    try{
      const r = await window.storage.get(key);
      if(r && r.value != null) applyStoredValue(key, r.value);
    }catch(e){}
  }
  state.characters = siteCharacters();
  // Doadores (Aliança Z) são dado PÚBLICO — não fazem parte da conta pessoal de ninguém,
  // por isso ficam fora de SYNCED_KEYS/applyStoredValue e são carregados à parte aqui.
  try{
    const dn = await window.storage.get('donors');
    state.donors = (dn && dn.value) ? JSON.parse(dn.value) : DEFAULT_DONORS.slice();
  }catch(e){ state.donors = DEFAULT_DONORS.slice(); }
  try{
    const dnn = await window.storage.get('next_donor_number');
    state.nextDonorNumber = (dnn && dnn.value) ? parseInt(dnn.value, 10) : (state.donors.length + 1);
  }catch(e){}
  await initDonorBackend();
  const allIds = new Set(state.characters.map(c=>c.id));
  state.favs = (Array.isArray(state.favs) ? state.favs : []).filter(id=>allIds.has(id));
  ensureTierListIntegrity();
  await loadHeroFrames();
  await loadNvArts();
  applyGuideHash();
  applyRouteHash();
  applyDoacaoRetorno();
  loaded = true;
  render();
}
const NAV_TABS = ['chars','collection','combos','guias','tierlist','comunidade','favs','perfil','doar','admin'];
async function saveFavs(){ await persist('favs', JSON.stringify(state.favs)); }
async function saveUiTab(){ await persist('ui_tab', state.tab); }

// Ranking de apoiadores: sem gateway de pagamento integrado (ver comentário em
// renderDoarTab), então fica sem nome nenhum até o dono do site adicionar manualmente
// pelo painel da própria aba Doar — nunca inventar doador aqui. Público (todo visitante
// vê o mesmo ranking), então usa window.storage/syncDonorRemote direto, não persist().
const DEFAULT_DONORS = [];
async function saveDonors(){
  try{ await window.storage.set('donors', JSON.stringify(state.donors)); }catch(e){}
}
async function saveNextDonorNumber(){
  try{ await window.storage.set('next_donor_number', String(state.nextDonorNumber)); }catch(e){}
}
// Garante que todo personagem do roster apareça em exatamente um rank (ou em
// "unranked"), removendo ids de personagens que não existem mais e mandando
// personagens novos pra "Não classificados" — roda toda vez que characters/tierList
// mudam de fonte (load inicial, import de personagens, etc.). Também migra um
// tierList salvo com o formato antigo (chave fixa S/A/B/C/D) pro formato novo
// (array de tiers com id estável, pra suportar renomear/adicionar/remover rank).
function ensureTierListIntegrity(){
  if(!state.tierList || !Array.isArray(state.tierList.tiers)){
    state.tierList = makeDefaultTierList();
  }
  if(!Array.isArray(state.tierList.unranked)) state.tierList.unranked = [];
  state.tierList.tiers.forEach(t=>{
    if(!Array.isArray(t.items)) t.items = [];
    const legacy = LEGACY_TIER_COLORS[t.id];
    if(legacy && t.color === legacy[0]) t.color = legacy[1];
  });

  const allIds = new Set(state.characters.map(c=>c.id));
  const placed = new Set();
  state.tierList.tiers.forEach(t=>{
    t.items = t.items.filter(id=>{
      if(!allIds.has(id) || placed.has(id)) return false;
      placed.add(id);
      return true;
    });
  });
  state.tierList.unranked = state.tierList.unranked.filter(id=>{
    if(!allIds.has(id) || placed.has(id)) return false;
    placed.add(id);
    return true;
  });
  state.characters.forEach(c=>{ if(!placed.has(c.id)) state.tierList.unranked.push(c.id); });
}
async function saveTierList(){ await persist('tier_list', JSON.stringify(state.tierList)); }
function moveTierItem(charId, toTierId){
  state.tierList.tiers.forEach(t=>{
    const idx = t.items.indexOf(charId);
    if(idx !== -1) t.items.splice(idx, 1);
  });
  const uidx = state.tierList.unranked.indexOf(charId);
  if(uidx !== -1) state.tierList.unranked.splice(uidx, 1);
  if(toTierId === 'unranked'){
    state.tierList.unranked.unshift(charId);
  } else {
    const tier = state.tierList.tiers.find(t=>t.id===toTierId);
    if(tier) tier.items.push(charId);
  }
  saveTierList();
}
// Move o rank 'id' pra antes/depois do rank 'targetId' (reordenar a tier list).
function moveTierRow(id, targetId, after){
  const tiers = state.tierList.tiers;
  const from = tiers.findIndex(t=>t.id===id);
  if(from === -1 || id === targetId) return;
  const [t] = tiers.splice(from, 1);
  let to = tiers.findIndex(x=>x.id===targetId);
  if(to === -1){ tiers.splice(from, 0, t); return; }
  tiers.splice(after ? to + 1 : to, 0, t);
  saveTierList();
  render();
}
function moveTierBy(id, dir){
  const tiers = state.tierList.tiers;
  const i = tiers.findIndex(t=>t.id===id), j = i + dir;
  if(i === -1 || j < 0 || j >= tiers.length) return;
  [tiers[i], tiers[j]] = [tiers[j], tiers[i]];
  saveTierList();
  render();
}
function addTier(){
  const id = 't_' + Math.random().toString(36).slice(2,9);
  const color = TIER_COLOR_PALETTE[state.tierList.tiers.length % TIER_COLOR_PALETTE.length];
  state.tierList.tiers.push({id, label:'Novo', color, items:[]});
  saveTierList();
  render();
}
// Remove o rank mas não perde os personagens — eles voltam pra "Não classificados".
function removeTier(tierId){
  const idx = state.tierList.tiers.findIndex(t=>t.id===tierId);
  if(idx === -1) return;
  const [removed] = state.tierList.tiers.splice(idx, 1);
  state.tierList.unranked.unshift(...removed.items);
  saveTierList();
  render();
}
function renameTier(tierId, newLabel){
  const tier = state.tierList.tiers.find(t=>t.id===tierId);
  if(!tier) return;
  tier.label = newLabel || '?';
  saveTierList();
}
// Guerreiros: a lista do site (DEFAULT_CHARACTERS) é sempre a fonte. Só o dono edita: as fichas que ele editou
// (marcadas com _editado) e os guerreiros que ele criou ficam por cima, no navegador/conta dele. Visitantes sempre
// veem a lista atual do site, mesmo que tenham uma cópia antiga salva (ela é ignorada, não apagada).
let storedCharacters = null;
function siteCharacters(){
  const base = DEFAULT_CHARACTERS.map(makeCharFromData);
  if(!isHeroAdmin() || !Array.isArray(storedCharacters)) return base;
  const baseIds = new Set(base.map(c=>c.id));
  const salvo = new Map(storedCharacters.filter(c=>c && c.id).map(c=>[c.id, c]));
  const out = base.map(b=>{ const s = salvo.get(b.id); return s && s._editado ? s : b; });
  storedCharacters.forEach(c=>{ if(c && c.id && !baseIds.has(c.id)) out.push(c); });
  return out;
}
// Recalcula a lista (ao entrar/sair da conta ou ao puxar os dados da nuvem) e limpa referências a quem sumiu.
function refreshCharacters(){
  state.characters = siteCharacters();
  const ids = new Set(state.characters.map(c=>c.id));
  state.favs = (Array.isArray(state.favs) ? state.favs : []).filter(id=>ids.has(id));
  state.team = (state.team || []).map(id=>id && ids.has(id) ? id : null);
  if(state.viewingCharId && !ids.has(state.viewingCharId)) state.viewingCharId = null;
  ensureTierListIntegrity();
}
async function saveCharacters(){
  if(!isHeroAdmin()) return;
  storedCharacters = JSON.parse(JSON.stringify(state.characters));
  try{ await persist('characters', JSON.stringify(state.characters)); }catch(e){ showToast('Erro ao salvar personagens'); }
}
async function saveTeamState(){ await persist('team_state', JSON.stringify({team:state.team})); }
async function saveFormations(){ await persist('formations', JSON.stringify(state.formations)); }

/* ======================= CONTA (Discord + Supabase) ======================= */
// Login único pro site inteiro — ver comentário HTML acima do <script type="module"> do
// Supabase. As funções de fato (signInWithDiscord, signOutDiscord, persist, etc.) ficam
// na seção da Aliança Z mais abaixo; aqui só a UI do botão que fica sempre no topo.
async function saveCollection(){
  await persist('collection', JSON.stringify(state.collection));
}

function getEntry(charId){
  const e = state.collection[charId] || { owned: false, level: 0 };
  // Nível LR salvo de personagem sem dados de LR volta para 10.
  if(e.level > 10){ const c = getChar(charId); if(c && maxStarLevel(c) <= 10) return Object.assign({}, e, { level: 10 }); }
  return e;
}

function toggleAcquire(charId){
  const entry = getEntry(charId);
  if(entry.owned){
    customConfirm(kzt('coll.removerConfirma'), ()=>{
      delete state.collection[charId];
      saveCollection();
      updateCollectionCard(charId);
    });
  } else {
    state.collection[charId] = { owned: true, level: 1 };
    saveCollection();
    updateCollectionCard(charId);
  }
}

function setCollectionLevel(charId, level){
  const entry = getEntry(charId);
  if(!entry.owned) return;
  entry.level = Math.max(1, Math.min(level, maxStarLevel(getChar(charId)))); // 1-15 (dourada 1-5, azul 6-10, LR 11-15; LR só pros SSR); fica >=1 enquanto adquirido
  state.collection[charId] = entry;
  saveCollection();
  updateCollectionCard(charId);
}

// Transição dourada -> azul ao "Despertar": as 5 estrelas esmaecem pro azul (transição
// de cor no CSS de .kz-coll-stars.awakening) antes de o nível virar ★1 Azul.
const AWAKEN_FADE_MS = 500;

function playAwakenFire(charId, onDone){
  const container = document.querySelector(`.kz-coll-stars[data-charid="${charId}"]`);
  if(container) container.classList.add('awakening');
  setTimeout(onDone, AWAKEN_FADE_MS);
}

function renderAccountArea(){
  if(!isSupabaseConfigured()) return ''; // sem backend, não tem o que logar — botão nem aparece
  if(state.discordUser){
    return `
      <div class="kz-account">
        <button class="kz-account-name" id="accountGoPerfilBtn" title="${kzt('conta.verPerfil')}">
          ${avatarFoto(state.myProfile && state.myProfile.avatarCharId) ? `<span style="display:inline-block;width:24px;height:24px;border-radius:50%;overflow:hidden;vertical-align:middle;">${avatarFotoImg(avatarFoto(state.myProfile.avatarCharId))}</span>`
            : state.discordUser.avatarUrl ? `<img src="${escapeAttr(state.discordUser.avatarUrl)}" alt="" style="width:24px;height:24px;border-radius:50%;">` : ''}
          <span class="kz-account-email">${escapeHtml(state.discordUser.username)}</span>
        </button>
        <button class="kz-btn kz-btn-sm" id="logoutBtn">${kzt('conta.sair')}</button>
      </div>`;
  }
  return `<button class="kz-discord-btn kz-header-discord-btn" id="loginBtn" aria-label="${kzt('conta.entrarDiscord')}" title="${kzt('conta.entrarDiscord')}">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
    <span class="kz-discord-txt">${kzt('conta.entrar')}</span>
  </button>`;
}

function attachAccountHandlers(){
  const loginBtn = document.getElementById('loginBtn');
  if(loginBtn) loginBtn.addEventListener('click', signInWithDiscord);
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.addEventListener('click', signOutDiscord);
  const goPerfilBtn = document.getElementById('accountGoPerfilBtn');
  if(goPerfilBtn) goPerfilBtn.addEventListener('click', ()=> goTab('perfil'));
}

function showToast(msg){
  const el = document.createElement('div');
  el.className='toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 2200);
}

/* Custom confirm/prompt — native confirm()/prompt() don't work inside embedded preview panes */
function customConfirm(message, onConfirm){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '300';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <div class="modal-body" style="padding-top:22px;">
        <p style="margin:0;color:var(--text);font-size:14px;line-height:1.5;">${escapeHtml(message)}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="cancel">${kzt('comum.cancelar')}</button>
        <button class="btn btn-primary" data-act="ok">${kzt('comum.confirmar')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  trapFocus(overlay.querySelector('.modal'));
  overlay.addEventListener('click', e=>{ if(e.target===overlay){ overlay.remove(); restoreFocusAfterModal(); } });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', ()=>{ overlay.remove(); restoreFocusAfterModal(); });
  overlay.querySelector('[data-act="ok"]').addEventListener('click', ()=>{ overlay.remove(); restoreFocusAfterModal(); onConfirm(); });
}

function customPrompt(message, onSubmit){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '300';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <div class="modal-body" style="padding-top:22px;">
        <label class="field-label">${escapeHtml(message)}</label>
        <input type="text" id="customPromptInput" style="margin-top:8px;">
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="cancel">${kzt('comum.cancelar')}</button>
        <button class="btn btn-primary" data-act="ok">OK</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  trapFocus(overlay.querySelector('.modal'));
  const input = overlay.querySelector('#customPromptInput');
  input.focus();
  const submit = () => {
    const val = input.value.trim();
    if(!val) return;
    overlay.remove();
    restoreFocusAfterModal();
    onSubmit(val);
  };
  overlay.addEventListener('click', e=>{ if(e.target===overlay){ overlay.remove(); restoreFocusAfterModal(); } });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', ()=>{ overlay.remove(); restoreFocusAfterModal(); });
  overlay.querySelector('[data-act="ok"]').addEventListener('click', submit);
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });
}

/* ======================= HELPERS ======================= */
function getChar(id){ return state.characters.find(c=>c.id===id); }
function initials(name){
  if(!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?parts[1][0]:'')).toUpperCase();
}
function slug(name){
  return (name||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function avatarInner(c){
  // Full-body sprite (transparent bg) — used only on the team-builder battlefield slots.
  return `<img src="sprites/${slug(c.name)}.png" alt="" loading="lazy" decoding="async" data-onerr="fallback"><span class="avatar-fallback" style="display:none;">${initials(c.name)}</span>`;
}
function portraitInner(c){
  // Bust/face portrait — used everywhere else (roster list, character cards, picker modal).
  return `<img src="portraits/mini/${slug(c.name)}.webp" alt="" loading="lazy" decoding="async" draggable="false" data-onerr="fallback"><span class="avatar-fallback" style="display:none;">${initials(c.name)}</span>`;
}
function rarityClass(r){
  if(!r) return 'rarity-r';
  return r.startsWith('SSR') ? 'rarity-ssr' : r==='SR' ? 'rarity-sr' : 'rarity-r';
}
function rarityLabel(r){
  if(!r) return '?';
  return r.startsWith('SSR') ? 'SSR' : r==='SR' ? 'SR' : 'R';
}
// Ordem padrão de classificação por raridade dos personagens (do mais raro pro
// mais comum): Ultimate > Lendário > Limitado > SSR normal > SR > R.
const RARITY_SORT_ORDER = ['SSR [Ultimate]', 'SSR [Lendário]', 'SSR [Limitado]', 'SSR', 'SR', 'R'];
function rarityRank(r){
  if(!r) return RARITY_SORT_ORDER.length;
  const idx = RARITY_SORT_ORDER.indexOf(r);
  if(idx !== -1) return idx;
  if(r.includes('Ultimate')) return 0;
  if(r.includes('Lendário')) return 1;
  if(r.includes('Limitado')) return 2;
  if(r.startsWith('SSR')) return 3;
  if(r === 'SR') return 4;
  if(r === 'R') return 5;
  return RARITY_SORT_ORDER.length;
}
function sortByRarity(chars){
  return chars.slice().sort((a,b) => rarityRank(a.rarity) - rarityRank(b.rarity));
}
function typeClass(t){
  return t==='Ataque' ? 'type-ataque' : t==='Defesa' ? 'type-defesa' : t==='Habilidade' ? 'type-habilidade' : '';
}
function typeLetter(t){
  return t==='Ataque' ? 'A' : t==='Defesa' ? 'D' : t==='Habilidade' ? 'H' : '?';
}
function affinityClass(a){
  return a==='Raio' ? 'affinity-raio' : a==='Fogo' ? 'affinity-fogo' : a==='Pedra' ? 'affinity-pedra' : a==='Luz' ? 'affinity-luz' : '';
}
function affinityLetter(a){
  return a==='Raio' ? 'R' : a==='Fogo' ? 'F' : a==='Pedra' ? 'P' : a==='Luz' ? 'L' : '?';
}
function genderClass(g){
  return g==='Masculino' ? 'gender-masculino' : g==='Feminino' ? 'gender-feminino' : '';
}
// Cor de cada tag livre (#tag) igual aparece na tela "Posição" do próprio jogo —
// conferido personagem por personagem no LDPlayer. Tag sem entrada aqui cai no
// acento dourado neutro (fallback em .ctags .chip).
const TAG_COLOR_CLASSES = {
  'Saiyajin': 'tag-saiyajin',
  'Guerreiro Maligno': 'tag-guerreiro-maligno',
  'Guerreiro Dourado': 'tag-guerreiro-dourado',
  'TEC de Guerreiro': 'tag-tec',
  'SSG': 'tag-ssg',
  'Guerreiro S': 'tag-guerreiro-s',
  'Guerreiro de Fusão': 'tag-guerreiro-fusao',
  'Guerreiro de ATQ': 'tag-guerreiro-atq',
  'DEF de Guerreiro': 'tag-def',
  'Artista Marcial': 'tag-artista-marcial',
  'Tropa do Orgulho': 'tag-tropa-orgulho',
  'Guerreiro Lendário': 'tag-guerreiro-lendario',
  'Deus da Destruição': 'tag-deus-destruicao',
  'SS4': 'tag-ss4',
  'Anjo': 'tag-anjo',
};
function tagChipClass(tag){
  return TAG_COLOR_CLASSES[tag] || '';
}
function effectBadge(effKey){
  return `<span class="effect-badge eff-${effKey}" title="${EFFECT_LABELS[effKey]}">${EFFECT_ABBR[effKey]}</span>`;
}
function effectBadgeRow(effArr){
  if(!effArr || !effArr.length) return `<span style="font-size:10px;color:var(--text-faint)">—</span>`;
  return effArr.map(effectBadge).join('');
}
/* ---------- Busca: nome, tags, nomes das habilidades E o texto das habilidades ----------
   "bloqueio" acha todo guerreiro que tem a palavra no kit (habilidade, suprema, passivas, combinado, em qualquer estágio). Sem acento
   e sem diferença de maiúscula. O texto das habilidades só entra a partir de 3 letras (senão qualquer "a" acharia todo mundo). */
const _buscaCache = new Map();
function buscaNorm(x){ return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
const BUSCA_ROTULOS = { habilidade:kzt('hab.habilidade'), suprema:kzt('hab.suprema'), passivaUnica:kzt('hab.passivaUnica'), passivasSupremo:kzt('hab.passiva'), passivaQuatroEstrelas:kzt('hab.passivaQuatro'), combinado:kzt('hab.ataqueCombinado'), passiva:kzt('hab.passiva'), lr:'LR', skill:kzt('hab.habilidade'), supreme:kzt('hab.suprema'), combo:kzt('hab.ataqueCombinado') };
function charTextoBusca(c){
  const p = ABILITY_PROGRESSION[c.name];
  const chave = c.id + '|' + c.name + '|' + (c.skill && c.skill.desc || '').length + '|' + (c.supreme && c.supreme.desc || '').length;
  const hit = _buscaCache.get(chave);
  if(hit) return hit;
  const nomes = buscaNorm([c.name, kzNome(c.name), ...(c.tags || []), ...(c.tags || []).map(kzTermo), c.skill && c.skill.name, c.skill && kzTrad(c.skill.name), c.supreme && c.supreme.name, c.combo && c.combo.name,
    ...(p ? [p.habilidade && p.habilidade.base && p.habilidade.base.nome, p.suprema && p.suprema.base && p.suprema.base.nome] : []),
    ...(((c.combo && c.combo.triggers) || []).concat((c.combo && c.combo.effects) || [])).map(e => EFFECT_LABELS[e])].filter(Boolean).join(' '));
  const textos = [], vistos = new Set();
  const add = (rot, txt) => { const t = String(txt || '').trim(); if(t.length < 8 || vistos.has(t)) return; vistos.add(t); textos.push({ rot, txt: t, norm: buscaNorm(t) }); const en = kzTrad(t); if(en !== t) textos.push({ rot, txt: en, norm: buscaNorm(en) }); };
  const anda = (o, rot) => {
    if(!o || typeof o !== 'object') return;
    if(Array.isArray(o)){ o.forEach(x => anda(x, rot)); return; }
    if(typeof o.desc === 'string') add(rot, o.desc);
    Object.keys(o).forEach(k => { if(o[k] && typeof o[k] === 'object') anda(o[k], BUSCA_ROTULOS[k] || rot); });
  };
  if(p) Object.keys(p).forEach(k => anda(p[k], BUSCA_ROTULOS[k] || k));
  ['skill', 'supreme', 'combo', 'passive'].forEach(k => { if(c[k]) add(BUSCA_ROTULOS[k], c[k].desc); });
  const r = { nomes, textos };
  _buscaCache.set(chave, r);
  return r;
}
function charMatchesText(c, q){
  q = buscaNorm(q).trim();
  if(!q) return true;
  const b = charTextoBusca(c);
  return b.nomes.includes(q) || (q.length >= 3 && b.textos.some(t => t.norm.includes(q)));
}
// Quando o guerreiro só apareceu por causa do texto de uma habilidade: qual habilidade e o trecho (com a palavra destacada).
function buscaTrecho(c, q){
  q = buscaNorm(q).trim();
  if(q.length < 3) return null;
  const b = charTextoBusca(c);
  if(b.nomes.includes(q)) return null;
  const t = b.textos.find(x => x.norm.includes(q));
  if(!t) return null;
  const i = t.norm.indexOf(q), ini = Math.max(0, i - 38), fim = Math.min(t.txt.length, i + q.length + 62);
  const pre = (ini > 0 ? '…' : '') + t.txt.slice(ini, i), meio = t.txt.slice(i, i + q.length), pos = t.txt.slice(i + q.length, fim) + (fim < t.txt.length ? '…' : '');
  return { rot: t.rot, html: escapeHtml(pre) + '<mark>' + escapeHtml(meio) + '</mark>' + escapeHtml(pos) };
}
function buscaTrechoHtml(c){
  const q = state.filters && state.filters.search;
  const h = q ? buscaTrecho(c, q) : null;
  return h ? `<div class="kz-card-hit"><b>${escapeHtml(h.rot)}</b> ${h.html}</div>` : '';
}
function matchesFilters(c){
  const f = state.filters;
  if(f.search && !charMatchesText(c, f.search)) return false;
  if(f.rarity && rarityLabel(c.rarity) !== f.rarity) return false;
  if(f.type && c.type !== f.type) return false;
  if(f.affinity && c.affinity !== f.affinity) return false;
  if(f.element && c.element !== f.element) return false;
  if(!matchSF(c, state.sf.chars)) return false;
  return true;
}
function hasActiveFilters(){
  const f = state.filters;
  return !!(f.search || f.rarity || f.type || f.affinity || f.element || sfCount(state.sf.chars));
}
function getFilteredChars(){
  const lista = sortByRarity(state.characters.filter(matchesFilters));
  const q = buscaNorm(state.filters.search).trim();
  if(!q) return lista;
  // quem tem o termo no nome/tags/nome das habilidades vem antes de quem só tem no texto da habilidade
  const porNome = lista.filter(c => charTextoBusca(c).nomes.includes(q));
  return porNome.concat(lista.filter(c => !porNome.includes(c)));
}
function allTags(){
  const s = new Set();
  state.characters.forEach(c=>c.tags.forEach(t=>s.add(t)));
  return [...s].sort();
}

/* ---------- Filtro de pesquisa: tags + o que o Ataque Combinado persegue / causa ---------- */
const SF_EFFECTS = ['derrubada','empurrao','elevacao_alta','elevacao_baixa'];
function sfOf(scope){ return state.sf[scope]; }
function sfCount(sf){ return (sf.tags.length||0) + (sf.trig.length||0) + (sf.eff.length||0); }
// tags: precisa ter TODAS as marcadas; persegue / causa: basta bater QUALQUER uma das marcadas.
function matchSF(c, sf){
  if(!sf) return true;
  if(sf.tags.length && !sf.tags.every(t=>(c.tags||[]).includes(t))) return false;
  const k = c.combo || {};
  if(sf.trig.length && !sf.trig.some(e=>(k.triggers||[]).includes(e))) return false;
  if(sf.eff.length && !sf.eff.some(e=>(k.effects||[]).includes(e))) return false;
  return true;
}
function renderSF(scope){
  const sf = sfOf(scope), n = sfCount(sf), open = !!state.sf.open[scope];
  const tagCounts = {};
  state.characters.forEach(c=>(c.tags||[]).forEach(t=>{ tagCounts[t] = (tagCounts[t]||0)+1; }));
  const tags = Object.keys(tagCounts).sort((a,b)=>tagCounts[b]-tagCounts[a] || a.localeCompare(b));
  const chip = (grp, val, label, extra) => `<button class="kz-fchip ${sf[grp].includes(val)?'active':''}" data-sf="${scope}" data-grp="${grp}" data-val="${escapeAttr(val)}">${escapeHtml(kzTermo(label))}${extra!=null?`<span class="c">${extra}</span>`:''}</button>`;
  const effChips = grp => SF_EFFECTS.map(e=>chip(grp, e, EFFECT_LABELS[e])).join('');
  return `
  <div class="kz-sf" data-sf-root="${scope}">
    <div class="kz-sf-head">
      <button type="button" class="kz-sf-toggle ${n?'has':''}" data-sf-toggle="${scope}" aria-expanded="${open}">
        <span>${kzt('sf.titulo')}</span>${n?`<span class="n">${n}</span>`:''}<span class="caret">${open?'▲':'▼'}</span>
      </button>
      ${n?`<button type="button" class="kz-link-btn" data-sf-clear="${scope}">${kzt('sf.limpar')}</button>`:''}
    </div>
    ${open?`
    <div class="kz-sf-body">
      <div class="kz-sf-group">
        <div class="kz-sf-label">${kzt('sf.tags')}<small>${kzt('sf.tagsAjuda')}</small></div>
        <div class="kz-sf-chips">${tags.map(t=>chip('tags', t, t, tagCounts[t])).join('')}</div>
      </div>
      <div class="kz-sf-group">
        <div class="kz-sf-label">${kzt('sf.persegue')}<small>${kzt('sf.perseguAjuda')}</small></div>
        <div class="kz-sf-chips">${effChips('trig')}</div>
      </div>
      <div class="kz-sf-group">
        <div class="kz-sf-label">${kzt('sf.causa')}<small>${kzt('sf.causaAjuda')}</small></div>
        <div class="kz-sf-chips">${effChips('eff')}</div>
      </div>
    </div>`:''}
  </div>`;
}
// Liga o painel de um escopo; onChange() deve refazer a lista da aba.
function attachSF(scope, root, onChange){
  const q = sel => root.querySelectorAll(sel);
  q(`[data-sf-toggle="${scope}"]`).forEach(b=>b.addEventListener('click', ()=>{ state.sf.open[scope] = !state.sf.open[scope]; onChange(); }));
  q(`[data-sf-clear="${scope}"]`).forEach(b=>b.addEventListener('click', ()=>{ state.sf[scope] = {tags:[],trig:[],eff:[]}; onChange(); }));
  q(`.kz-fchip[data-sf="${scope}"]`).forEach(b=>b.addEventListener('click', ()=>{
    const arr = state.sf[scope][b.dataset.grp], v = b.dataset.val, i = arr.indexOf(v);
    if(i>-1) arr.splice(i,1); else arr.push(v);
    onChange();
  }));
}

/* ======================= COMBO ENGINE ======================= */
// Varre a equipe sempre na mesma ordem, da Casa 1 até a Casa 6 — sem prioridade de fileira.
function priorityOrder(){ return [0,1,2,3,4,5]; }

const STARTER_KEYS = ['skill','supreme'];
const ABILITY_ICON = {skill:'H', supreme:'S', combo:'C'};
const ABILITY_LABEL = {skill:kzt('hab.habilidade'), supreme:kzt('hab.suprema'), combo:kzt('hab.ataqueCombinadoTitulo')};

// Quem, no time (inclusive o próprio que usou a habilidade), tem o Ataque Combinado ativado por algum efeito que essa habilidade causa —
// igual ao "Detalhes do Ataque Comb." do jogo: um passo só, não a cadeia inteira.
function comboContinuations(sourceCharId, abilityKey){
  const c = getChar(sourceCharId);
  const ability = c && c[abilityKey];
  const effects = (ability && ability.effects) || [];
  if(!effects.length) return [];
  const out = [];
  state.team.forEach(tid=>{
    if(!tid) return;   // quem iniciou também pode perseguir (uma vez), então a própria origem entra
    const tc = getChar(tid);
    if(!tc) return;
    const trig = (tc.combo.triggers||[]).find(t=>effects.includes(t));
    if(trig) out.push({ char: tc, triggeredBy: trig });
  });
  return out;
}

// Cadeia completa de verdade: a cada efeito pendente, só UM aliado continua — o de menor
// número de casa entre quem tem o gatilho certo (prioridade de casa, igual no jogo).
// Quantas vezes o guerreiro pode entrar na MESMA cadeia: 1, a não ser que o texto do Ataque Combinado diga
// "pode ser ativado duas vezes por rodada" (hoje só o Goku Instinto). Vem do texto, então vale para quem ganhar a frase depois.
function comboUsos(c){
  const m = /pode ser ativad[oa] (duas|tr[eê]s|quatro|2|3|4) vezes/i.exec((c && c.combo && c.combo.desc) || '');
  return m ? ({ duas:2, '2':2, 'três':3, tres:3, '3':3, quatro:4, '4':4 })[m[1].toLowerCase()] || 1 : 1;
}
function simulateCombo(charId, abilityKey){
  const order = priorityOrder();
  const startChar = getChar(charId);
  if(!startChar) return [];
  const startAbility = startChar[abilityKey];
  const chain = [{ charId, abilityKey, ability: startAbility, char: startChar }];
  const used = new Map();   // quantas vezes cada um já usou o Ataque Combinado (1 por cadeia, ou mais se o texto permitir, ver comboUsos) — o que iniciou a cadeia ainda não usou o dele
  let queue = [...(startAbility.effects||[])];

  let guard = 0;
  while(queue.length && guard < 30){
    guard++;
    const eff = queue.shift();
    let found = null;
    for(const idx of order){
      const tid = state.team[idx];
      if(!tid) continue;
      const tc = getChar(tid);
      if(!tc || (used.get(tid) || 0) >= comboUsos(tc)) continue;
      if(tc.combo.triggers && tc.combo.triggers.includes(eff)){
        found = tc; break;
      }
    }
    if(found){
      used.set(found.id, (used.get(found.id) || 0) + 1);
      chain.push({ charId: found.id, abilityKey:'combo', ability: found.combo, char: found, triggeredBy: eff, uso: used.get(found.id) });
      if(found.combo.effects && found.combo.effects.length){
        queue.push(...found.combo.effects);
      }
    }
  }
  return chain;
}

/* ======================= VISUAL HELPERS (layout do site) ======================= */
const EFF_STYLE = {
  derrubada:{bg:'#b3402f',fg:'#fff'},
  empurrao:{bg:'#5b7fa6',fg:'#fff'},
  elevacao_alta:{bg:'#c9a24b',fg:'#241a06'},
  elevacao_baixa:{bg:'#7a5ba6',fg:'#fff'},
};
// [rgb do fundo translúcido, cor do texto] de cada chip de raça/gênero/tipo/afinidade.
const PILL_RGB = {
  Saiyajin:['217,123,42','#e0904f'], Humano:['91,127,166','#82a3d1'], Androide:['147,160,172','#b7c0c8'], Nenhum:['138,147,160','#b9c0ca'],
  Masculino:['91,127,166','#82a3d1'], Feminino:['201,82,122','#e084a7'],
  Ataque:['179,64,47','#e8806c'], Defesa:['91,127,166','#82a3d1'], Habilidade:['79,138,104','#7cd29f'],
  Raio:['59,111,196','#7aa8ea'], Fogo:['210,57,43','#ef7d6c'], Pedra:['166,124,61','#d4a768'], Luz:['201,162,55','#e8cf6f'],
};
// Mesmas famílias de cor das tags conferidas no jogo (tela "Posição"); tag sem entrada cai no dourado neutro.
const TAG_RGB = {
  'Saiyajin':['139,95,191','#c3aaf0'], 'Guerreiro Maligno':['139,95,191','#c3aaf0'], 'Guerreiro Dourado':['184,120,45','#f0b46e'],
  'SSG':['160,100,40','#e0ab66'], 'TEC de Guerreiro':['63,174,90','#86e3a2'], 'Deus da Destruição':['63,174,90','#86e3a2'],
  'Guerreiro S':['209,71,122','#f08fb5'], 'Guerreiro de Fusão':['224,114,95','#f5ab9b'], 'Anjo':['224,114,95','#f5ab9b'],
  'Guerreiro de ATQ':['192,57,43','#ef8b7f'], 'DEF de Guerreiro':['59,130,196','#86c0f0'], 'Artista Marcial':['212,175,55','#eed883'],
  'Guerreiro Lendário':['212,175,55','#eed883'], 'Tropa do Orgulho':['62,201,201','#86ecec'], 'SS4':['47,95,168','#86ade6'],
};
const RARITY_PILL = {
  SSR:{bg:'linear-gradient(120deg,#ffe08a,#f0b53a)',color:'#2a1a00',border:'#ffd66b'},
  SR:{bg:'#8b5fbf',color:'#fff',border:'#b28be0'},
  R:{bg:'#5b7fa6',color:'#fff',border:'#86a8cf'},
};
function isLimitedChar(c){ return (c.rarity||'').includes('Limitado'); }
function charMeta(c){ return `${rarityLabel(c.rarity)}${isLimitedChar(c)?' ★':''} · ${kzTermo(c.type)||'—'} · ${kzTermo(c.affinity)||'—'}`; }
function pillHtml(label, key){
  const r = PILL_RGB[key] || ['201,162,75','#e0c070'];
  return `<span class="kz-pill" style="background:linear-gradient(rgba(${r[0]},.22),rgba(${r[0]},.22)),#0c0a14;color:${r[1]};border-color:rgba(${r[0]},.7);">${escapeHtml(kzTermo(label))}</span>`;
}
function tagPillHtml(tag){
  const r = TAG_RGB[tag] || ['201,162,75','#e0c070'];
  return `<span class="kz-pill" style="background:linear-gradient(rgba(${r[0]},.22),rgba(${r[0]},.22)),#0c0a14;color:${r[1]};border-color:rgba(${r[0]},.6);">#${escapeHtml(kzTermo(tag))}</span>`;
}
function rarityPillHtml(c){
  const base = rarityLabel(c.rarity);
  const s = RARITY_PILL[base] || RARITY_PILL.R;
  return `<span class="kz-pill" style="background:${s.bg};color:${s.color};border-color:${s.border};">${escapeHtml(base)}${isLimitedChar(c)?' ★':''}</span>`;
}
// Fileira de 5 estrelas de texto: douradas de ★1 a ★5, depois a mesma fileira enche em azul (★6-★10).
function textStarsHtml(req){
  const phase = starPhase(req), n = starFilled(req);
  let s = '';
  for(let i=0;i<5;i++){
    s += i < n
      ? (phase === 'lr' ? '<span class="kz-sv kz-rb lr"></span>' : `<span class="kz-sv ${phase}"></span>`)
      : '<span class="kz-sv"></span>';
  }
  return `<span class="kz-stars">${s}</span>`;
}
function reqLabelText(req){ return `★${starFilled(req)} ${STAR_PHASE_NAME[starPhase(req)]}`; }
function tipoText(raw){ return (raw||'Ativar').replace(/\s*\([^)]*\)\s*$/, ''); }
function tipoColor(tipo){ return /despertar/i.test(tipo) ? '#ffb13b' : '#6fb6ff'; }
function effPillHtml(eff){
  const s = EFF_STYLE[eff];
  return s ? `<span class="kz-eff-pill" style="background:${s.bg};color:${s.fg};">${EFFECT_LABELS[eff]}</span>` : '';
}
function ballSrc(n){ return `assets/balls/esfera-${n}.webp`; }
function portraitSrc(c){ return `portraits/${slug(c.name)}.webp`; }
/* ---------- Visual novo (prévia ligada por ?visual=novo; ver o <script> do <head> e visual-novo.css) ---------- */
function visualNovo(){ try{ return document.documentElement.classList.contains('vis-novo') === true; }catch(e){ return false; } }
// Arte da ficha (pasta Fichas/<personagem>) e faixa do time (pasta Faixas/<personagem>), convertidas por
// gerar-artes.py; ?v= muda quando a arte muda, então a troca aparece sem esperar o cache.
let nvFichaVer = {}, nvFaixaVer = {}, nvIconeVer = {};
// Ícone pequeno (pasta Icones/<personagem>): só existe no visual novo e depois de carregar icones/versoes.json.
function iconeSrc(c){
  const s = slug(c.name);
  return Object.prototype.hasOwnProperty.call(nvIconeVer, s) ? `icones/${s}.webp?v=${nvIconeVer[s]}` : null;
}
// Ícone de quem ainda não está no site mas aparece num presente (ex.: Vegeta Instinto Superior): vale se existir icones/<nome>.webp.
function iconeSrcNome(nome){
  const s = slug(nome);
  return Object.prototype.hasOwnProperty.call(nvIconeVer, s) ? `icones/${s}.webp?v=${nvIconeVer[s]}` : null;
}
function faixaSrc(c){
  const s = slug(c.name), v = Object.prototype.hasOwnProperty.call(nvFaixaVer, s) ? nvFaixaVer[s] : '';
  return `faixas/${s}.webp${v ? '?v=' + v : ''}`;
}
function renderSrc(c){
  const s = slug(c.name), v = Object.prototype.hasOwnProperty.call(nvFichaVer, s) ? nvFichaVer[s] : '';
  return `renders/${s}.webp${v ? '?v=' + v : ''}`;
}
// Artes do "Em destaque" (pasta Destaques/<personagem>, convertidas por gerar-artes.py): o topo de Personagens
// alterna entre elas. Sem arte na lista, usa o corpo inteiro de renders/.
let nvArts = {};
const NV_ART_RE = /^destaques\/[a-z0-9-]+\/[a-z0-9-]+\.webp(\?v=[a-z0-9]+)?$/;
async function loadNvArts(){
  if(!visualNovo() || typeof fetch !== 'function') return;
  try{
    const r = await fetch('destaques/destaques.json', { cache:'no-cache' });
    if(r.ok){
      const d = await r.json(), ok = {};
      Object.keys(d || {}).forEach(k=>{
        const l = Array.isArray(d[k]) ? d[k].filter(u=>typeof u === 'string' && NV_ART_RE.test(u)).slice(0, 12) : [];
        if(/^[a-z0-9-]+$/.test(k) && l.length) ok[k] = l;
      });
      nvArts = ok;
    }
  }catch(e){}
  try{
    const r = await fetch('renders/versoes.json', { cache:'no-cache' });
    if(r.ok){
      const d = await r.json(), ok = {};
      Object.keys(d || {}).forEach(k=>{ if(/^[a-z0-9-]+$/.test(k) && /^[a-z0-9]{1,16}$/.test(d[k])) ok[k] = d[k]; });
      nvFichaVer = ok;
    }
  }catch(e){}
  try{
    const r = await fetch('faixas/versoes.json', { cache:'no-cache' });
    if(r.ok){
      const d = await r.json(), ok = {};
      Object.keys(d || {}).forEach(k=>{ if(/^[a-z0-9-]+$/.test(k) && /^[a-z0-9]{1,16}$/.test(d[k])) ok[k] = d[k]; });
      nvFaixaVer = ok;
    }
  }catch(e){}
  try{
    const r = await fetch('icones/versoes.json', { cache:'no-cache' });
    if(r.ok){
      const d = await r.json(), ok = {};
      Object.keys(d || {}).forEach(k=>{ if(/^[a-z0-9-]+$/.test(k) && /^[a-z0-9]{1,16}$/.test(d[k])) ok[k] = d[k]; });
      nvIconeVer = ok;
    }
  }catch(e){}
}
function nvArtsOf(c){
  const s = slug(c.name);
  return Object.prototype.hasOwnProperty.call(nvArts, s) ? nvArts[s] : [renderSrc(c)];
}
const NV_TYPE_COLOR = { Ataque:'#e8806c', Defesa:'#82a3d1', Habilidade:'#7cd29f' };
function nvDotHtml(aff){ const r = PILL_RGB[aff]; return r ? `<i class="kz-nv-dot" style="background:rgb(${r[0]});color:rgb(${r[0]})"></i>` : ''; }
function nvMetaHtml(c){
  const rar = rarityLabel(c.rarity);
  return `<b class="kz-nv-rar ${rar === 'SR' ? 'sr' : rar === 'R' ? 'r' : ''}">${rar}${isLimitedChar(c) ? ' ★' : ''}</b>`
    + `<span style="color:${NV_TYPE_COLOR[c.type] || '#E9D9C8'}">${escapeHtml(kzTermo(c.type) || '—')}</span>`
    + nvDotHtml(c.affinity) + `<span>${escapeHtml(kzTermo(c.affinity) || '—')}</span>`;
}
// Título em pincel: 3 camadas (contorno laranja com brilho, contorno preto, letra branca).
function nvTtl(text, attrs){
  const t = escapeHtml(text);
  return `<span class="kz-nv-ttl"${attrs || ''}><span class="o" aria-hidden="true">${t}</span><span class="k" aria-hidden="true">${t}</span><span class="w">${t}</span></span>`;
}
// Formação do time em faixas (casa 1 a 6). Faixas em faixas/<slug>.webp (gerar-artes.py); sem faixa, entra a carta recortada.
// edit = true (aba Combos): a faixa também é um editor — arraste para trocar de casa, toque no × para tirar, toque numa vaga vazia para escolher.
function nvLineupHtml(team, small, edit){
  const names = (team || []).map(id => (getChar(id) || {}).name).filter(Boolean);
  const alvo = edit ? '' : ` role="img" aria-label="${escapeAttr(kzt('time.formacao', { nomes: names.join(', ') || kzt('time.vazia') }))}"`;
  return `<div class="kz-nv-lineup${small ? ' sm' : ''}${edit ? ' edit' : ''}"${alvo}>${[0,1,2,3,4,5].map(i => {
    const c = team && team[i] && getChar(team[i]);
    const ed = edit ? ` data-slot="${i}"${state.slotSel === i ? ' data-sel="1"' : ''}` : '';
    if(c) return `<span class="ln${edit ? ' filled' : ''}"${ed}${edit ? ' draggable="true"' : ''}${edit ? ` title="${escapeAttr(kzt('time.casaTitulo', { n: i + 1, nome: kzNome(c.name) }))}"` : ''}><img src="${faixaSrc(c)}" alt="" loading="lazy" decoding="async" draggable="false" data-onerr="cut" data-card="${portraitSrc(c)}"><b>${i+1}</b>${edit ? `<button type="button" class="ln-x" data-remove-slot="${i}" aria-label="${escapeAttr(kzt('time.tirarNome', { nome: kzNome(c.name) }))}" title="${kzt('time.tirar')}">×</button>` : ''}</span>`;
    return `<span class="ln empty"${ed}${edit ? ` role="button" tabindex="0" aria-label="${kzt('time.escolherCasa', { n: i + 1 })}"` : ''}><i>+</i><b>${i+1}</b></span>`;
  }).join('')}</div>`;
}
// Depois de cada render, com a prévia ligada: título em pincel (data-text alimenta as camadas do CSS), topo com fogo
// e kanji em cada aba, e a arte de corpo inteiro na ficha. Personagens (lista) já vem pronto de renderCharsTabNovo.
const NV_TAB_DECOR = { collection:['集',kzt('deco.colecao')], combos:['連',kzt('deco.combos')], guias:['書',kzt('deco.guias')], tierlist:['番',kzt('deco.tierlist')],
  comunidade:['社',kzt('deco.comunidade')], favs:['★',kzt('deco.favs')], perfil:['印',kzt('deco.perfil')], doar:['援',kzt('deco.doar')] };
function nvBgHtml(kanji, kanjiStyle){
  const embers = NV_EMBERS.slice(0, nvEco() ? 0 : nvLite() ? 3 : 6).map(([l,b,s,d,dl])=>`<span class="kz-nv-em" style="left:${l + 8}%;bottom:${Math.round(b / 2)}px;width:${s}px;height:${s}px;animation-duration:${d}s;animation-delay:${dl}s"></span>`).join('');
  return `<div class="kz-nv-ph-bg" aria-hidden="true"><div class="kz-nv-fire"></div><div class="kz-nv-rays"></div><div class="kz-nv-tone"></div><div class="kz-nv-vig"></div>${kanji ? `<span class="kz-nv-kbig"${kanjiStyle ? ` style="${kanjiStyle}"` : ''}>${kanji}</span>` : ''}${embers}</div>`;
}
// Topo das abas no formato do canvas: etiqueta, título em pincel (bate na tela só na primeira visita à aba), texto e,
// à direita, o que a aba quiser (botões, contador, esferas). o = { key, kanji, tag, title, size, sub, side, kanjiStyle }
const nvSlamSeen = new Set();
function nvPageHeadHtml(o){
  const slam = !nvSlamSeen.has(o.key); nvSlamSeen.add(o.key);
  return `
    <div class="kz-nv-pagehead kz-nv-ph">
      ${nvBgHtml(o.kanji, o.kanjiStyle)}
      <div class="kz-nv-ph-in">
        <div class="kz-nv-ph-main">
          <span class="kz-nv-tag"><span class="kj">${o.tagKanji || o.kanji}</span>${escapeHtml(o.tag)}</span>
          <h1 class="kz-nv-ph-h1${slam ? ' slam' : ''}" style="--fs:${o.size || 116}px">${nvTtl(o.title)}</h1>
          ${o.sub ? `<p class="kz-nv-ph-sub">${o.sub}</p>` : ''}${o.after || ''}
        </div>
        ${o.side ? `<div class="kz-nv-ph-side">${o.side}</div>` : ''}
      </div>
    </div>`;
}
// Número grande em degradê + legenda (contador do topo das abas).
function nvCountHtml(n, label, ids){
  return `<p class="kz-nv-count"><b${ids && ids[0] ? ` id="${ids[0]}"` : ''}>${n}</b><span${ids && ids[1] ? ` id="${ids[1]}"` : ''}>${escapeHtml(label)}</span></p>`;
}
function nvDecorate(view){
  if(!visualNovo() || !view) return;
  view.querySelectorAll('.kz-title, .kz-panel-title, .kz-name-band h1').forEach(el=>{ el.dataset.text = el.textContent.trim(); });
  if(view.querySelector('.kz-nv-ph')) return;   // a aba já veio com o topo novo (nvPageHeadHtml)
  if(state.tab === 'chars'){
    const c = state.viewingCharId && getChar(state.viewingCharId);
    const hero = c && view.querySelector('.kz-detail-hero');
    if(hero){
      hero.insertAdjacentHTML('afterbegin', nvBgHtml('戦'));
      const card = hero.querySelector('.kz-detail-card');
      if(card) card.insertAdjacentHTML('afterbegin', `<div class="kz-nv-dchar" aria-hidden="true">${nvAuraImgs(renderSrc(c))}<img class="main" src="${renderSrc(c)}" alt="" data-onerr="card" data-card="${portraitSrc(c)}"></div>`);
    }
    return;
  }
  const deco = NV_TAB_DECOR[state.tab];
  const h1 = deco && view.querySelector('h1.kz-title');
  if(!h1 || h1.closest('.kz-gr')) return;
  let head = h1.closest('.kz-page-head') || h1.parentElement;
  if(head.classList.contains('kz-page')){   // título solto na seção: junta título e subtítulo num bloco
    const w = document.createElement('div');
    h1.before(w); w.append(h1);
    if(w.nextElementSibling && w.nextElementSibling.classList.contains('kz-subtitle')) w.append(w.nextElementSibling);
    head = w;
  }
  head.classList.add('kz-nv-pagehead');
  head.insertAdjacentHTML('afterbegin', nvBgHtml(deco[0]));
  h1.insertAdjacentHTML('beforebegin', `<span class="kz-nv-tag"><span class="kj">${deco[0]}</span>${deco[1]}</span>`);
}
function isFav(id){ return state.favs.includes(id); }
function isNarrowLayout(){ return (window.innerWidth || 1200) <= 700; }
function applyNavState(){
  const app = document.getElementById('kzApp');
  if(app) app.classList.toggle('nav-compact', !!state.navCompact);
  if(app && !app.classList.contains('kz-ready') && typeof requestAnimationFrame === 'function') requestAnimationFrame(()=>requestAnimationFrame(()=>app.classList.add('kz-ready')));
}

/* ======================= RENDER: ROOT ======================= */
function render(){
  const view = document.getElementById('view');
  if(!loaded){
    view.innerHTML = `<div class="kz-loading">${kzt('geral.carregando')}</div>`;
    return;
  }
  setRouteHash();
  applyNavState();
  document.querySelectorAll('.kz-nav-btn[data-tab]').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab === state.tab);
  });
  const navAdmin = document.getElementById('navAdminBtn');   // a aba Admin só aparece no menu para o dono
  if(navAdmin){
    navAdmin.style.display = isDonorAdmin() ? '' : 'none';
    navAdmin.classList.toggle('kz-alerta', !!state.admin.iaAlerta);   // bolinha de aviso: o limite gratuito da IA acabou hoje
  }
  if(isDonorAdmin()) verificarAvisoIa();
  // barra de abas do celular (visual novo): as 4 principais; o resto fica em "Mais", que abre o menu
  const tbFixas = ['chars','combos','tierlist','guias'];
  document.querySelectorAll('.kz-nv-tb[data-tbtab]').forEach(b=>{ const on = b.dataset.tbtab === state.tab; b.classList.toggle('on', on); if(on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const tbMais = document.getElementById('tabbarMoreBtn');
  if(tbMais) tbMais.classList.toggle('on', !tbFixas.includes(state.tab));
  const tab = state.tab;
  view.innerHTML = tab === 'chars' ? renderCharsTab()
    : tab === 'collection' ? renderCollectionTab()
    : tab === 'tierlist' ? renderTierListTab()
    : tab === 'guias' ? renderGuiasTab()
    : tab === 'comunidade' ? renderComunidadeTab()
    : tab === 'favs' ? renderFavsTab()
    : tab === 'perfil' ? renderPerfilTab()
    : tab === 'doar' ? renderDoarTab()
    : tab === 'admin' ? renderAdminTab()
    : renderCombosTab();
  nvDecorate(view);
  nvWatchPause(view);
  attachCharsHandlers();
  attachCollectionHandlers();
  attachTierListHandlers();
  attachCombosHandlers();
  attachFavsHandlers();
  attachGuiasHandlers();
  attachComunidadeHandlers();
  attachPerfilHandlers();
  attachDoarHandlers();
  attachAdminHandlers();
  document.getElementById('accountArea').innerHTML = renderAccountArea();
  attachAccountHandlers();
  if(state.editingChar && isHeroAdmin()) renderModal();
  else if(state.ioModalOpen && isHeroAdmin()) renderIOModal();
  else if(state.pickerSlot!==null) renderPickerModal();
  else if(state.simModalOpen) renderSimModal();
  else if(state.abilityPopupCharId) renderAbilityPopup(state.abilityPopupCharId);
  else if(state.donorProfileId) renderDonorProfileModal();
  else if(state.communityProfileUser) renderCommunityProfileModal();
  else closeModalDOM();
  updateModalFocusTrap();
}

function goTab(tab){
  state.tab = tab;
  state.viewingCharId = null;
  state.communityOpenPost = null;
  state.communityProfileUser = null;
  state.slotSel = null;
  if(tab !== 'guias' && state.guideId) setGuideHash(null);
  if(isNarrowLayout()) state.navCompact = true;
  saveUiTab();
  render();
  window.scrollTo(0, 0);
}

function openCharDetail(id){
  charsListScrollY = (state.tab === 'chars' && !state.viewingCharId) ? window.scrollY : 0;
  state.tab = 'chars';
  state.viewingCharId = id;
  state.heroEdit = null;
  if(typeof location !== 'undefined' && /^#guia-/.test(location.hash || '')) setGuideHash(null);
  state.charDetailTab = 'habilidades';
  saveUiTab();
  render();
  window.scrollTo(0, 0);
}

function toggleFav(id){
  const on = !isFav(id);
  state.favs = on ? [...state.favs, id] : state.favs.filter(x=>x!==id);
  saveFavs();
  if(state.tab === 'favs'){ render(); return; }
  document.querySelectorAll(`[data-fav="${id}"]`).forEach(b=>{
    b.classList.toggle('on', on);
    if(b.classList.contains('kz-fav-btn')) b.title = on ? kzt('fav.remover') : kzt('fav.favoritar');
    const lbl = b.querySelector('.lbl');
    if(lbl) lbl.textContent = on ? kzt('fav.favoritado') : kzt('fav.favoritar');
  });
}

function buildWithChar(id){
  const t = [...state.team];
  if(!t.includes(id)){
    const i = t.indexOf(null);
    t[i > -1 ? i : t.length - 1] = id;
  }
  state.team = t;
  state.simCharId = null;
  saveTeamState();
  goTab('combos');
}

function openCharEditor(id){
  if(!isHeroAdmin()) return;
  const c = getChar(id);
  if(!c) return;
  state.editingChar = JSON.parse(JSON.stringify(c));
  state.editingIsNew = false;
  render();
}

/* ======================= PERSONAGENS: LISTA ======================= */
const LIST_FILTER_GROUPS = [
  [kzt('filtro.raridade'),'rarity',['SSR','SR','R']],
  [kzt('filtro.tipo'),'type',TYPES],
  [kzt('filtro.afinidade'),'affinity',AFFINITIES],
  [kzt('filtro.raca'),'element',ELEMENTS],
];
function defaultHeroChar(){
  return state.characters.find(c=>c.name==='Cooler Dourado') || state.characters[0];
}

function renderCharsTab(){
  if(state.viewingCharId) return renderCharDetailPage(state.viewingCharId);
  const chars = getFilteredChars();
  const hero = getChar(state.heroCharId) || defaultHeroChar();
  const f = state.filters;
  if(visualNovo()) return renderCharsTabNovo(chars, hero);
  return `
  <section class="kz-page">
    <div class="kz-hero ${state.heroEdit && state.heroEdit.scope === 'list' ? 'editing' : ''}">
      <div class="kz-hero-art"><div class="kz-hero-art-mask">
        ${hero ? `<img id="heroImg" src="${portraitSrc(hero)}" alt="" style="${heroStyleOf(heroFrameLive('list', hero.id))}" data-onload="show" data-onerr="hide">` : ''}
      </div></div>
      <div class="kz-hero-scrim"></div>
      <div class="kz-hero-name" id="heroName">${hero ? escapeHtml(kzNome(hero.name)) : ''}</div>
      <div class="kz-hero-nav">
        <button type="button" class="kz-hero-navbtn" data-hero-step="-1" title="${kzt('chars.anterior')}" aria-label="${kzt('chars.anterior')}">‹</button>
        <button type="button" class="kz-hero-navbtn" data-hero-step="1" title="${kzt('chars.proximo')}" aria-label="${kzt('chars.proximo')}">›</button>
        ${isHeroAdmin() ? '<button type="button" class="kz-hero-navbtn txt" id="heroAdjustBtn" title="Mover e dar zoom no retrato do topo">Ajustar retrato</button>' : ''}
      </div>
      ${state.heroEdit && state.heroEdit.scope === 'list' ? '<div class="kz-hero-drag" id="heroDrag" title="Arraste para mover"></div>' + heroAdjustBarHtml() : ''}
      <div class="kz-hero-content">
        <div class="kz-hero-titlerow">
          <h1 class="kz-title kz-hero-title">${kzt('nav.personagens')}</h1>
          <span class="kz-hero-count" id="charsCount">${kzt('chars.contagem', { n: chars.length, total: state.characters.length })}</span>
        </div>
        <input type="text" class="kz-input kz-hero-search" id="searchInput" placeholder="${kzt('chars.buscarAntigo')}" value="${escapeAttr(f.search)}">
        <div class="kz-filter-groups">
          ${LIST_FILTER_GROUPS.map(([label,key,vals])=>`
          <div class="kz-filter-row">
            <span class="kz-filter-label">${label}</span>
            ${vals.map(v=>`<button class="kz-fchip ${f[key]===v?'active':''}" data-filter="${key}" data-val="${escapeAttr(v)}">${escapeHtml(kzTermo(v))}</button>`).join('')}
          </div>`).join('')}
        </div>
        ${renderSF('chars')}
        <button class="kz-link-btn" id="clearFilters" ${hasActiveFilters()?'':'hidden'}>${kzt('filtro.limparTudo')}</button>
      </div>
    </div>
    ${isHeroAdmin() ? `<div class="kz-list-tools">
      <button class="kz-btn kz-btn-sm" id="ioBtn">Importar / Exportar</button>
      <button class="kz-btn kz-btn-sm" id="addCharBtn">+ Adicionar personagem</button>
    </div>` : ''}
    <div id="charsGridWrap">${renderCharsGrid(chars)}</div>
  </section>`;
}

function renderCharsGrid(chars){
  if(!chars.length){
    return `<div class="kz-empty">${state.characters.length ? kzt('chars.nenhumFiltro') : kzt('chars.nenhumCadastro')}</div>`;
  }
  return `<div class="kz-grid">${chars.map(visualNovo() ? renderCharCardNovo : renderCharCard).join('')}</div>`;
}

function renderCharCard(c){
  const fav = isFav(c.id);
  return `
  <div class="kz-card" data-id="${c.id}" title="${kzt('chars.verFichaCompleta')}">
    <div class="kz-card-art">
      ${portraitInner(c)}
      <button class="kz-fav-btn ${fav?'on':''}" data-fav="${c.id}" title="${fav?kzt('fav.remover'):kzt('fav.favoritar')}" aria-label="${kzt('fav.favoritar')}">★</button>
    </div>
    <div class="kz-card-body">
      <div class="kz-card-name">${escapeHtml(kzNome(c.name))||kzt('geral.semNome')}</div>
      <div class="kz-card-meta">${escapeHtml(charMeta(c))}</div>
    </div>
  </div>`;
}

// Troca a arte do topo pro personagem em hover — só mexe na <img>, sem re-render.
function setHeroChar(id){
  if(state.heroCharId === id || state.heroEdit) return;
  state.heroCharId = id;
  const c = getChar(id);
  if(c && visualNovo() && document.getElementById('heroChar')){ setHeroNovo(c); return; }
  const img = document.getElementById('heroImg');
  const nm = document.getElementById('heroName');
  if(!c) return;
  if(img){ img.style.visibility = ''; img.src = portraitSrc(c); img.setAttribute('style', heroStyleOf(heroFrame('list', c.id))); }
  if(nm) nm.textContent = kzNome(c.name);
}

function attachCharCardHandlers(root){
  root.querySelectorAll('.kz-card').forEach(card=>{
    const id = card.dataset.id;
    card.addEventListener('click', e=>{
      if(e.target.closest('[data-fav]')) return;
      openCharDetail(id);
    });
    card.addEventListener('mouseenter', ()=> setHeroChar(id));
  });
  root.querySelectorAll('.kz-card [data-fav]').forEach(b=>{
    b.addEventListener('click', e=>{ e.stopPropagation(); toggleFav(b.dataset.fav); });
  });
}

function attachCharsHandlers(){
  const view = document.getElementById('view');
  if(!view || state.tab !== 'chars') return;
  if(state.viewingCharId){ attachCharDetailHandlers(); return; }

  const searchInput = document.getElementById('searchInput');
  if(searchInput) searchInput.addEventListener('input', e=>{ state.filters.search = e.target.value; softRerenderChars(); });
  view.querySelectorAll('.kz-fchip[data-filter]').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const key = chip.dataset.filter, val = chip.dataset.val;
      state.filters[key] = state.filters[key] === val ? null : val;
      render();
    });
  });
  const clearBtn = document.getElementById('clearFilters');
  if(clearBtn) clearBtn.addEventListener('click', ()=>{
    state.filters = {search:'', rarity:null, type:null, affinity:null, element:null};
    state.sf.chars = {tags:[],trig:[],eff:[]};
    render();
  });
  attachSF('chars', view, render);
  view.querySelectorAll('[data-hero-step]').forEach(b=>b.addEventListener('click', ()=> stepHeroChar(parseInt(b.dataset.heroStep, 10))));
  const heroAdj = document.getElementById('heroAdjustBtn');
  if(heroAdj) heroAdj.addEventListener('click', ()=>{ const hc = getChar(state.heroCharId) || defaultHeroChar(); if(hc) startHeroEdit('list', hc.id); });
  const nvFiltersBtn = document.getElementById('nvFiltersBtn');
  if(nvFiltersBtn) nvFiltersBtn.addEventListener('click', ()=>{   // celular: mostra/esconde os filtros completos
    state.nvFiltersOpen = !state.nvFiltersOpen;
    const sec = nvFiltersBtn.closest('.kz-nv');
    if(sec) sec.classList.toggle('filters-open', state.nvFiltersOpen);
    nvFiltersBtn.setAttribute('aria-expanded', String(state.nvFiltersOpen));
  });
  const heroPips = document.getElementById('heroPips');
  if(heroPips){   // visual novo: artes do destaque alternando
    const hc = getChar(nvHeroRot.id);
    if(hc) nvHeroQueue(hc);
    heroPips.addEventListener('click', e=>{
      const b = e.target.closest('[data-art]'), c = getChar(nvHeroRot.id);
      const i = b ? parseInt(b.dataset.art, 10) : -1;
      if(c && i >= 0 && i !== nvHeroRot.i) nvHeroGo(c, i);
    });
  }
  // visual novo: clicar na arte do destaque (ou no nome dela) abre a ficha do guerreiro
  const heroOpen = ()=>{ const c = getChar(nvHeroRot.id) || getChar(state.heroCharId) || defaultHeroChar(); if(c) openCharDetail(c.id); };
  const heroArt = document.getElementById('heroChar'), heroName = document.getElementById('heroNameStack');
  if(heroArt) heroArt.addEventListener('click', heroOpen);
  if(heroName){
    heroName.addEventListener('click', heroOpen);
    heroName.addEventListener('keydown', e=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); heroOpen(); } });
  }
  attachHeroAdjust();
  const addBtn = document.getElementById('addCharBtn');
  if(addBtn) addBtn.addEventListener('click', ()=>{ if(!isHeroAdmin()) return; state.editingChar = blankChar(); state.editingIsNew = true; render(); });
  const ioBtn = document.getElementById('ioBtn');
  if(ioBtn) ioBtn.addEventListener('click', ()=>{ if(!isHeroAdmin()) return; state.ioModalOpen = true; render(); });
  attachCharCardHandlers(view);
}

// Refiltra a grade enquanto digita, sem reconstruir o campo de busca (não perde o foco).
function softRerenderChars(){
  if(state.tab !== 'chars' || state.viewingCharId) return;
  const chars = getFilteredChars();
  const wrap = document.getElementById('charsGridWrap');
  if(wrap){ wrap.innerHTML = renderCharsGrid(chars); attachCharCardHandlers(wrap); }
  const count = document.getElementById('charsCount');
  if(count) count.textContent = visualNovo() ? kzt('chars.contagemNovo', { total: state.characters.length }) : `${kzt('chars.contagem', { n: chars.length, total: state.characters.length })}`;
  ['charsCountNum', 'charsCountBadge'].forEach(k=>{ const el = document.getElementById(k); if(el) el.textContent = chars.length; });
  const clearBtn = document.getElementById('clearFilters');
  if(clearBtn) clearBtn.hidden = !hasActiveFilters();
}

/* ---------- Personagens no visual novo (só com a prévia ligada) ----------
   Usa os mesmos ids da versão atual (searchInput, charsCount, clearFilters, heroImg, charsGridWrap, data-filter,
   data-hero-step, data-fav), então attachCharsHandlers/softRerenderChars/stepHeroChar servem para as duas. */
const NV_EMBERS = [[58,60,6,4.2,0],[63,220,4,3.4,.8],[67,120,7,5,1.6],[71,330,5,3.8,.4],[75,40,6,4.6,2.2],[79,260,4,3.2,1.1],[83,150,8,5.4,.2],[87,380,5,4,1.9],[91,90,6,4.4,2.8],[95,210,4,3.6,.6],[52,300,4,3.9,3],[85,470,5,4.8,1.4]];
let nvSlamDone = false;   // a entrada do título só toca na primeira vez (filtros refazem a aba a cada clique)
function renderCharsTabNovo(chars, hero){
  const f = state.filters, total = state.characters.length;
  const slam = !nvSlamDone; nvSlamDone = true;
  const embers = NV_EMBERS.slice(0, nvEco() ? 0 : nvLite() ? 3 : NV_EMBERS.length).map(([l,b,s,d,dl])=>`<span class="kz-nv-em" style="left:${l}%;bottom:${b}px;width:${s}px;height:${s}px;animation-duration:${d}s;animation-delay:${dl}s"></span>`).join('');
  const chipLabel = (key, v) => (key === 'affinity' ? nvDotHtml(v) : '') + escapeHtml(kzTermo(v));
  const bandA = `<span>${kzt('nav.combos')}</span><span class="kj">連</span><span>${kzt('banda.tierlist')}</span><span class="kj">番</span><span>${kzt('nav.colecao')}</span><span class="kj">集</span><span>${kzt('nav.guias')}</span><span class="kj">書</span><span>${kzt('nav.comunidade')}</span><span class="kj">社</span>`.repeat(4);
  const bandB = `<span class="jp">ワクワク</span><span>✦</span><span>${kzt('banda.nGuerreiros', { total })}</span><span>✦</span><span>${kzt('banda.monteCombo')}</span><span>✦</span><span>${kzt('banda.subaTier')}</span><span>✦</span><span>Zenkyo</span><span>✦</span>`.repeat(4);
  let heroSrc = '';
  if(hero){   // refazer a aba (filtros) mantém a arte que estava na tela
    const arts = nvArtsOf(hero);
    if(nvHeroRot.id !== hero.id){ clearTimeout(nvHeroRot.t); nvHeroRot = { id:hero.id, i:0, t:0 }; }
    nvHeroRot.i = Math.min(nvHeroRot.i, arts.length - 1);
    heroSrc = arts[nvHeroRot.i];
  }
  return `
  <section class="kz-page kz-nv${state.nvFiltersOpen ? ' filters-open' : ''}">
    <div class="kz-nv-hero">
      <div class="kz-nv-fire" aria-hidden="true"></div>
      <div class="kz-nv-rays" aria-hidden="true"></div>
      <svg class="kz-nv-rings" aria-hidden="true" viewBox="-550 -550 1100 1100">
        <g class="r1"><ellipse cx="0" cy="0" rx="430" ry="300" transform="rotate(-18)" fill="none" stroke="#E8261B" stroke-width="14" stroke-dasharray="520 140 90 160" stroke-linecap="round" opacity=".7"/><ellipse cx="0" cy="0" rx="330" ry="230" transform="rotate(-24)" fill="none" stroke="#FF6A13" stroke-width="5" stroke-dasharray="300 90 40 120" stroke-linecap="round" opacity=".75"/></g>
        <g class="r2"><ellipse cx="0" cy="0" rx="520" ry="370" transform="rotate(-12)" fill="none" stroke="#FFC21A" stroke-width="3" stroke-dasharray="180 220 60 260" stroke-linecap="round" opacity=".55"/><ellipse cx="0" cy="0" rx="250" ry="170" transform="rotate(-30)" fill="none" stroke="#FFE27A" stroke-width="2.5" stroke-dasharray="120 160" stroke-linecap="round" opacity=".6"/></g>
      </svg>
      <div class="kz-nv-tone" aria-hidden="true"></div>
      <div class="kz-nv-vig" aria-hidden="true"></div>
      <svg class="kz-nv-bolts" aria-hidden="true" viewBox="0 0 1440 820" preserveAspectRatio="none">
        <polyline class="kz-nv-bolt b1" points="1010,30 980,120 1012,138 968,240 1004,262 944,392"/>
        <polyline class="kz-nv-bolt b2" points="1400,90 1372,170 1398,186 1352,300 1384,318 1330,430"/>
        <polyline class="kz-nv-bolt b3" points="830,520 858,600 832,612 870,700"/>
      </svg>
      <div aria-hidden="true">${embers}</div>
      <span class="kz-nv-sfx" aria-hidden="true" style="right:1.5%;top:110px;font-size:54px;writing-mode:vertical-rl;transform:rotate(12deg);opacity:.85">ゴゴゴ</span>
      ${hero ? `<div class="kz-nv-char" id="heroChar" aria-hidden="true" title="${escapeAttr(kzt('chars.verFicha', { nome: kzNome(hero.name) }))}">
        <div class="kz-nv-char-in">
          ${nvAuraImgs(heroSrc)}
          <img class="main" id="heroImg" src="${heroSrc}" alt="" data-onerr="card" data-card="${portraitSrc(hero)}">
        </div>
        <span class="kz-nv-burst"></span>
      </div>
      <div class="kz-nv-plate">
        <span class="kz-nv-lb">${kzt('chars.emDestaque')}</span>
        ${nvTtl(kzNome(hero.name), ` id="heroNameStack" role="button" tabindex="0" aria-label="${escapeAttr(kzt('chars.verFicha', { nome: kzNome(hero.name) }))}"`)}
        <div class="kz-nv-pips" id="heroPips">${nvHeroPipsHtml(hero)}</div>
        <div class="kz-nv-plate-row">
          <span class="kz-nv-meta" id="heroMeta">${nvMetaHtml(hero)}</span>
          <div class="kz-hero-nav">
            <button type="button" class="kz-hero-navbtn" data-hero-step="-1" title="${kzt('chars.anterior')}" aria-label="${kzt('chars.anterior')}">‹</button>
            <button type="button" class="kz-hero-navbtn" data-hero-step="1" title="${kzt('chars.proximo')}" aria-label="${kzt('chars.proximo')}">›</button>
          </div>
        </div>
      </div>` : ''}
      <div class="kz-nv-content">
        <span class="kz-nv-tag"><span class="kj">戦</span>${kzt('chars.wiki')}</span>
        <div class="kz-nv-titlewrap">
          <h1 class="kz-nv-h1${slam ? ' slam' : ''}">${nvTtl(kzt('nav.personagens'))}</h1>
          <span class="kz-nv-sfx" aria-hidden="true">ドドド</span>
        </div>
        <p class="kz-nv-count"><b id="charsCountNum">${chars.length}</b><span id="charsCount">${kzt('chars.contagemNovo', { total })}</span></p>
        <div>
          <label class="kz-nv-lb" for="searchInput" style="display:block;margin-bottom:10px">${kzt('chars.buscar')}</label>
          <div class="kz-nv-search"><span class="kz-nv-scan" aria-hidden="true"></span><div>
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFC21A" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>
            <input type="text" id="searchInput" placeholder="${kzt('chars.buscarNovo')}" value="${escapeAttr(f.search)}" autocomplete="off">
          </div></div>
        </div>
        ${(()=>{   // celular (canvas): botão Filtros + raridade e tipo numa linha que rola; o resto abre no botão
          const n = ['rarity','type','affinity','element'].filter(k=>f[k]).length + sfCount(state.sf.chars);
          const q = (key, v)=>`<button type="button" class="kz-fchip ${f[key]===v?'active':''}" data-filter="${key}" data-val="${escapeAttr(v)}" aria-pressed="${f[key]===v}">${escapeHtml(kzTermo(v))}</button>`;
          return `<div class="kz-nv-quick"><button type="button" class="kz-fchip kz-nv-ftoggle${n ? ' has' : ''}" id="nvFiltersBtn" aria-expanded="${!!state.nvFiltersOpen}">${kzt('chars.filtros')}${n ? `<span class="n">${n}</span>` : ''}</button>${['SSR','SR','R'].map(v=>q('rarity', v)).join('')}${TYPES.map(v=>q('type', v)).join('')}</div>`;
        })()}
        <div class="kz-filter-groups">
          ${LIST_FILTER_GROUPS.map(([label,key,vals])=>`
          <div class="kz-filter-row">
            <span class="kz-filter-label">${label}</span>
            ${vals.map(v=>`<button type="button" class="kz-fchip ${f[key]===v?'active':''}" data-filter="${key}" data-val="${escapeAttr(v)}" aria-pressed="${f[key]===v}">${chipLabel(key, v)}</button>`).join('')}
          </div>`).join('')}
        </div>
        ${renderSF('chars')}
        <button class="kz-link-btn" id="clearFilters" ${hasActiveFilters()?'':'hidden'}>${kzt('filtro.limparTudo')}</button>
      </div>
    </div>
    <div class="kz-nv-bands" aria-hidden="true">
      <div class="kz-nv-band b1"><div class="kz-nv-track">${bandA}</div></div>
      <div class="kz-nv-band b2"><div class="kz-nv-track">${bandB}</div></div>
    </div>
    ${isHeroAdmin() ? `<div class="kz-list-tools">
      <button class="kz-btn kz-btn-sm" id="ioBtn">Importar / Exportar</button>
      <button class="kz-btn kz-btn-sm" id="addCharBtn">+ Adicionar personagem</button>
    </div>` : ''}
    <div class="kz-nv-gridhead">
      <h2>${nvTtl(kzt('chars.titulo'))}</h2>
      <span class="kz-nv-badge" id="charsCountBadge">${chars.length}</span>
      <svg aria-hidden="true" viewBox="0 0 300 20" preserveAspectRatio="none"><path d="M2 12 C 60 4, 120 16, 180 9 S 270 6, 298 10" fill="none" stroke="#FF6A13" stroke-width="5" stroke-linecap="round"/></svg>
    </div>
    <div id="charsGridWrap">${renderCharsGrid(chars)}</div>
  </section>`;
}
function renderCharCardNovo(c){
  const fav = isFav(c.id);
  return `
  <div class="kz-card" data-id="${c.id}" title="${kzt('chars.verFichaCompleta')}">
    <div class="kz-card-art">
      ${portraitInner(c)}
      <button class="kz-fav-btn ${fav?'on':''}" data-fav="${c.id}" title="${fav?kzt('fav.remover'):kzt('fav.favoritar')}" aria-label="${kzt('fav.favoritar')} ${escapeAttr(kzNome(c.name))}">★</button>
    </div>
    <div class="kz-card-body">
      <div class="kz-card-name">${escapeHtml(kzNome(c.name))||kzt('geral.semNome')}</div>
      <div class="kz-card-meta">${nvMetaHtml(c)}</div>
      ${buscaTrechoHtml(c)}
    </div>
  </div>`;
}
// Troca o personagem em destaque do topo (hover nas cartas e setas ‹ ›) sem refazer a aba.
function setHeroNovo(c){
  const box = document.getElementById('heroChar');
  box.classList.remove('nv-swap');
  clearTimeout(nvHeroRot.t);
  nvHeroRot = { id:c.id, i:0, t:0 };
  nvHeroSetSrc(box, nvArtsOf(c)[0]);
  const main = document.getElementById('heroImg');
  if(main) main.dataset.card = portraitSrc(c);
  document.querySelectorAll('#heroNameStack > span').forEach(s=>{ s.textContent = kzNome(c.name); });
  document.getElementById('heroNameStack')?.setAttribute('aria-label', kzt('chars.verFicha', { nome: kzNome(c.name) }));
  box.title = kzt('chars.verFicha', { nome: kzNome(c.name) });
  const meta = document.getElementById('heroMeta');
  if(meta) meta.innerHTML = nvMetaHtml(c);
  nvHeroStart(c);
}
// Põe uma arte no destaque (as três camadas: aura, contorno e a arte).
function nvHeroSetSrc(box, src){
  box.classList.remove('is-card');
  box.querySelectorAll('img').forEach(img=>{ img.style.visibility = ''; img.src = src; });
}
// Alterna sozinho entre as artes do mesmo guerreiro (pasta com 2 ou mais), com clarão e anel de energia na troca.
// Os tracinhos embaixo do nome mostram quantas artes há, a do momento e o tempo até a próxima; clicar pula pra ela.
const NV_ART_MS = 5200;   // mesmo tempo do kzNvPip em visual-novo.css
let nvHeroRot = { id:null, i:0, t:0 };
// Modo leve (celular ou aparelho fraco): classes que o <script id="kzVisual"> do <head> põe no <html>.
function nvLite(){ try{ return document.documentElement.classList.contains('nv-lite'); }catch(e){ return false; } }
function nvEco(){ try{ return document.documentElement.classList.contains('nv-eco'); }catch(e){ return false; } }
// Camadas extras da arte (aura e contorno, com desfoque): só no modo completo; no leve a arte ganha um brilho fixo.
function nvAuraImgs(src){ return nvLite() ? '' : `<img class="a1" src="${src}" alt="" data-onerr="hide"><img class="a2" src="${src}" alt="" data-onerr="hide">`; }
// Pausa as animações dos blocos que saíram da tela (o fundo de fogo do topo, as patentes, o pódio...).
let nvIO = null;
function nvWatchPause(view){
  if(typeof IntersectionObserver !== 'function' || !view) return;
  try{
    if(nvIO) nvIO.disconnect();
    nvIO = new IntersectionObserver(es=> es.forEach(e=> e.target.classList.toggle('nv-paused', !e.isIntersecting)), { rootMargin:'120px' });
    view.querySelectorAll('.kz-nv-hero, .kz-nv-ph, .kz-nvf-hero, .kz-nv-bands, .kz-nvd-ally, .kz-nvd-pats, .kz-nvpf-prev, .kz-nvfav-more, .kz-nvco-cta, .kz-nvc-counter').forEach(el=> nvIO.observe(el));
  }catch(e){}
}
// Troca automática de arte: desligada com "reduzir movimento" e no modo leve (os tracinhos continuam trocando ao tocar).
function nvReduceMotion(){
  try{ if(window.matchMedia('(prefers-reduced-motion: reduce)').matches === true) return true; }catch(e){}
  return nvLite();
}
function nvHeroPipsHtml(c){
  const n = nvArtsOf(c).length;
  if(n < 2) return '';
  const auto = !nvReduceMotion();
  return Array.from({ length:n }, (_, i)=>{
    const on = i === nvHeroRot.i;
    return `<button type="button" class="kz-nv-pip${on ? ' on' : ''}" data-art="${i}" aria-label="${kzt('chars.arte', { i: i + 1, n })}"${on ? ' aria-current="true"' : ''}>${on && auto ? '<i></i>' : ''}</button>`;
  }).join('');
}
function nvHeroStart(c){
  const pips = document.getElementById('heroPips');
  if(pips) pips.innerHTML = nvHeroPipsHtml(c);
  nvHeroQueue(c);
}
function nvHeroQueue(c){
  clearTimeout(nvHeroRot.t);
  if(nvArtsOf(c).length < 2 || nvReduceMotion()) return;
  nvHeroRot.t = setTimeout(()=> nvHeroGo(c, nvHeroRot.i + 1), NV_ART_MS);
}
function nvHeroGo(c, i){
  const box = document.getElementById('heroChar');
  if(!box || nvHeroRot.id !== c.id) return;                 // saiu da aba ou trocou de guerreiro
  if(document.hidden){ nvHeroQueue(c); return; }            // aba do navegador escondida: espera
  const arts = nvArtsOf(c);
  i = (i + arts.length) % arts.length;
  const src = arts[i];
  const pre = new Image();                                   // só troca depois que a arte nova carregou
  pre.onerror = ()=>{ nvHeroRot.i = i; nvHeroQueue(c); };
  pre.onload = ()=>{
    const b = document.getElementById('heroChar');           // a aba pode ter sido refeita (filtros) enquanto carregava
    if(nvHeroRot.id !== c.id || !b) return;
    nvHeroRot.i = i;
    b.classList.remove('nv-swap'); void b.offsetWidth; b.classList.add('nv-swap');
    setTimeout(()=>{                                         // troca no meio do clarão
      const b2 = document.getElementById('heroChar');
      if(nvHeroRot.id !== c.id || !b2) return;
      nvHeroSetSrc(b2, nvArtsOf(c)[nvHeroRot.i]);
    }, 300);
    nvHeroStart(c);
  };
  pre.src = src;
}

/* ======================= PERSONAGENS: FICHA ======================= */
const DETAIL_TABS = [['habilidades','技',kzt('detalhe.habilidades')],['comida','食',kzt('detalhe.afinidade')],['vinculos','絆',kzt('detalhe.vinculos')]];

// Ordem usada pra passar de um guerreiro pro outro: a mesma da lista (respeita os filtros ativos).
function charStepList(currentId){
  let list = getFilteredChars();
  if(!list.some(c=>c.id===currentId)) list = sortByRarity([...state.characters]);
  return list;
}
function charStepTarget(currentId, dir){
  const list = charStepList(currentId);
  if(list.length < 2) return null;
  const i = list.findIndex(c=>c.id===currentId);
  return list[((i < 0 ? 0 : i) + dir + list.length) % list.length];
}
function charStepButtonsHtml(currentId){
  const prev = charStepTarget(currentId, -1), next = charStepTarget(currentId, 1);
  if(!prev || !next) return '';
  return `
  <button class="kz-step-btn prev" data-step="-1" title="${escapeAttr(kzNome(prev.name))}"><span class="arr">‹</span><span class="col"><span class="lbl">${kzt('ficha.anterior')}</span><span class="nm">${escapeHtml(kzNome(prev.name))}</span></span></button>
  <button class="kz-step-btn next" data-step="1" title="${escapeAttr(kzNome(next.name))}"><span class="col"><span class="lbl">${kzt('ficha.proximo')}</span><span class="nm">${escapeHtml(kzNome(next.name))}</span></span><span class="arr">›</span></button>`;
}
// Troca o personagem aberto mantendo a aba da ficha (Habilidades/Comida/Vínculos).
function stepCharDetail(dir){
  if(state.tab !== 'chars' || !state.viewingCharId) return;
  const t = charStepTarget(state.viewingCharId, dir);
  if(!t) return;
  state.viewingCharId = t.id;
  state.heroEdit = null;
  render();
  window.scrollTo(0, 0);
}

/* ---------- Enquadramento do retrato de fundo da ficha ---------- */
// Padrão do site: posição (x,y em %) e zoom (z) do retrato atrás do nome, ajustados personagem por personagem.
// Quem não está na lista usa HERO_DEFAULT.
const HERO_DEFAULT = { x:50, y:35, z:2.1 };
const HERO_FRAMES = {
  "c_gohan-beast":{x:45.7,y:38.5,z:2.1},
  "c_broly-ss4":{x:46.1,y:37.4,z:2.1},
  "c_broly-dbs":{x:45.8,y:46.2,z:2.1},
  "c_ssg-trunks":{x:47.5,y:37.1,z:2.1},
  "c_gogeta-ss4":{x:37.1,y:36.3,z:2},
  "c_ssgss-gogeta":{x:39.6,y:40.6,z:2},
  "c_goku-ss3-rose":{x:39.2,y:39.6,z:2.1},
  "c_goku-instinto-superior":{x:42.2,y:37.2,z:2.1},
  "c_moro":{x:36.8,y:33.7,z:1.85},
  "c_vegetto-ssgss":{x:38.6,y:43,z:2.1},
  "c_goku-instinto":{x:32.5,y:42.1,z:2.1},
  "c_jiren-poder-maximo":{x:40.2,y:34.6,z:2.1},
  "c_cumber":{x:37.3,y:43.4,z:2.1},
  "c_whis":{x:44.5,y:42.4,z:2.1},
  "c_gohan-do-futuro":{x:38.4,y:36.8,z:2.1},
  "c_cooler-dourado":{x:35,y:49,z:2.1},
  "c_vegeta-ssgss":{x:33.9,y:41.4,z:2.1},
  "c_super-syn-shenlong":{x:36,y:46.2,z:2.1},
  "c_bardock-quebrador-do-tempo":{x:45.4,y:43.9,z:2.1},
  "c_jiren":{x:38.6,y:34,z:2.1},
  "c_goku-ssj-deus":{x:39.6,y:44.9,z:2.1},
  "c_goku-black-rose":{x:25.5,y:39,z:2.1},
  "c_janemba":{x:37,y:42.8,z:2.1},
  "c_goku-ssgss":{x:40.1,y:45.6,z:2.1},
  "c_vegeta-ssg":{x:39.6,y:44,z:2.1},
  "c_broly":{x:43.5,y:41.1,z:2.1},
  "c_baby":{x:40.5,y:44.3,z:2.1},
  "c_freeza-dourado":{x:40.3,y:36,z:2.1},
  "c_zamasu-fundido":{x:37.1,y:40.2,z:2.1},
  "c_beerus":{x:39.1,y:41.4,z:2.1},
  "c_toppo":{x:36.2,y:32.8,z:1.6},
  "c_vegeta-ss4":{x:37.2,y:41.1,z:2.1},
  "c_goku-ss4":{x:37.6,y:42.4,z:2.1},
  "c_gohan-mistico":{x:45.4,y:39.7,z:1.55},
  "c_kale":{x:41.8,y:41.6,z:2.1},
  "c_hit":{x:39.9,y:42.7,z:2.1},
  "c_android-18":{x:34.5,y:39.3,z:2.1},
  "c_goku-black":{x:37.8,y:40.1,z:2.1},
  "c_goku-gt":{x:39.3,y:40.1,z:1.8},
  "c_gohan":{x:38.8,y:43.1,z:2.1},
  "c_majin-vegeta":{x:42,y:43.9,z:2.1},
  "c_cell":{x:33.5,y:41.8,z:2.1},
  "c_bardock":{x:33,y:39.6,z:2.1},
  "c_goku-ss3":{x:31.7,y:39.6,z:2.1},
  "c_caulifla":{x:38,y:43.6,z:2.1},
  "c_zamasu":{x:44.7,y:39.4,z:2.1},
  "c_android-17":{x:39.4,y:41.1,z:2.1},
  "c_dabura":{x:41.8,y:35.9,z:2.1},
  "c_ribrianne":{x:42.5,y:40,z:2.1},
  "c_majin-boo":{x:41.6,y:38.4,z:2.1},
  "c_xeno-goku":{x:35.4,y:34,z:2.1},
  "c_trunks-do-futuro":{x:36,y:39.1,z:2.1},
  "c_goku":{x:40.1,y:49.2,z:2.1},
  "c_vegeta-base":{x:43.7,y:44.9,z:2.1},
  "c_dyspo":{x:41.1,y:42.1,z:2.1},
  "c_mestre-kame":{x:51.7,y:33.4,z:1.5},
  "c_goku-crianca":{x:31.7,y:45.2,z:1.6},
  "c_vegeta":{x:46.6,y:39.1,z:2.1},
  "c_bergamo":{x:40.9,y:38.2,z:2.1},
  "c_tenshinhan":{x:36.3,y:39,z:2.1},
  "c_bulma":{x:38.2,y:42.2,z:2.1},
  "c_freeza":{x:42.9,y:34,z:2.1},
  "c_frost":{x:41.8,y:35.9,z:2.1},
  "c_piccolo":{x:45.3,y:40.3,z:2.1},
  "c_kuririn":{x:42.4,y:37.2,z:2.1},
  "c_yamcha":{x:37.7,y:34.7,z:2.1},
  "c_android-16":{x:41.1,y:39.1,z:2.1}
};
// Enquadramentos salvos no arquivo hero-frames.json (ao lado do index.html): {detail:{id:{x,y,z}}, list:{...}}.
// "detail" = retrato atrás do nome na ficha; "list" = retrato grande do topo da aba Personagens.
let heroFramesData = { detail:{}, list:{} };
function heroFrame(scope, id){
  const d = heroFramesData;
  if(scope === 'list') return (d.list && d.list[id]) || (d.detail && d.detail[id]) || HERO_FRAMES[id] || HERO_DEFAULT;
  return (d.detail && d.detail[id]) || HERO_FRAMES[id] || HERO_DEFAULT;
}
// Enquadramento "de fábrica" do retrato (o que vale se não houver ajuste salvo para o escopo).
function heroBaseFrame(scope, id){
  if(scope === 'list') return (heroFramesData.detail && heroFramesData.detail[id]) || HERO_FRAMES[id] || HERO_DEFAULT;
  return HERO_FRAMES[id] || HERO_DEFAULT;
}
function heroFrameLive(scope, id){
  const e = state.heroEdit;
  return (e && e.scope === scope && e.id === id) ? e : heroFrame(scope, id);
}
function heroStyleOf(a){
  return `object-position:${+a.x}% ${+a.y}%;transform-origin:${+a.x}% ${+a.y}%;transform:scale(${+a.z});`;
}
function heroArtStyle(id){ return heroStyleOf(heroFrameLive('detail', id)); }
// Enquadramentos vêm de 3 lugares: hero-frames.json (arquivo do site), tabela site_frames do Supabase (gravada só pelo
// dono; todo mundo lê) e, só para o dono, o que ficou salvo neste navegador. Depois do último vale por cima.
let heroFramesFile = { detail:{}, list:{} }, heroFramesRemote = null, heroFramesLocal = null;
function cleanFrames(o){
  const out = {};
  if(o && typeof o === 'object') Object.keys(o).forEach(id=>{
    const a = o[id];
    if(/^[\w.-]{1,80}$/.test(id) && a && [a.x, a.y, a.z].every(n=>typeof n === 'number' && isFinite(n)))
      out[id] = { x:Math.min(100, Math.max(0, a.x)), y:Math.min(100, Math.max(0, a.y)), z:Math.min(4, Math.max(1, a.z)) };
  });
  return out;
}
function cleanFrameSet(j){ return { detail:cleanFrames(j && j.detail), list:cleanFrames(j && j.list) }; }
function mergeFrameSets(...parts){
  const out = { detail:{}, list:{} };
  parts.forEach(p=>{ if(p){ Object.assign(out.detail, p.detail); Object.assign(out.list, p.list); } });
  return out;
}
function recomputeHeroFrames(){
  heroFramesData = mergeFrameSets(heroFramesFile, heroFramesRemote, isHeroAdmin() ? heroFramesLocal : null);
}
// Só o dono mexe nos retratos: pelo servidor local (iniciar-local.bat) ou logado com a conta Discord de administrador.
function isHeroAdmin(){
  const host = (typeof location !== 'undefined' && location.hostname) || '';
  if(host === 'localhost' || host === '127.0.0.1') return true;
  return isSupabaseConfigured() && !!(state.discordUser && state.discordUser.id === window.ADMIN_DISCORD_ID);
}
async function loadHeroFrames(){
  try{
    if(typeof fetch === 'function'){
      const r = await fetch('hero-frames.json', { cache:'no-store' });
      if(r.ok) heroFramesFile = cleanFrameSet(await r.json());
    }
  }catch(e){}
  try{ // salvo só neste navegador quando não deu pra gravar no arquivo nem na conta
    const l = await window.storage.get('hero_frames_local');
    if(l && l.value) heroFramesLocal = cleanFrameSet(JSON.parse(l.value));
  }catch(e){}
  recomputeHeroFrames();
}
// Lê da conta (Supabase) o que o dono gravou; se o dono estiver logado e tiver ajustes só neste navegador, sobe pra conta.
async function loadHeroFramesRemote(){
  if(!isSupabaseConfigured()) return;
  try{
    const { data, error } = await window.__sb.client.from('site_frames').select('data').eq('id', 'hero').maybeSingle();
    if(!error) heroFramesRemote = data && data.data ? cleanFrameSet(data.data) : null;
  }catch(e){}
  recomputeHeroFrames();
  if(isHeroAdmin() && heroFramesLocal && (Object.keys(heroFramesLocal.detail).length || Object.keys(heroFramesLocal.list).length)){
    const how = await saveHeroFrames();
    if(how === 'conta') showToast('Seus enquadramentos de retrato foram enviados para o site');
  }
}
// Grava no arquivo pelo servidor local (iniciar-local.bat). Sem ele (ex.: site publicado), guarda só neste navegador.
async function saveHeroFrames(){
  const dados = { detail:cleanFrames(heroFramesData.detail), list:cleanFrames(heroFramesData.list) };
  const body = JSON.stringify(dados);
  const limpaLocal = async ()=>{ heroFramesLocal = null; try{ await window.storage.set('hero_frames_local', ''); }catch(e){} };
  const host = (typeof location !== 'undefined' && location.hostname) || '';
  if(host === 'localhost' || host === '127.0.0.1'){
    try{
      const r = await fetch('/api/hero-frames', { method:'POST', headers:{ 'Content-Type':'application/json' }, body });
      if(r.ok){ heroFramesFile = dados; await limpaLocal(); return 'arquivo'; }
    }catch(e){}
  }
  if(isHeroAdmin() && isSupabaseConfigured() && state.discordUser){
    try{
      const { error } = await window.__sb.client.from('site_frames').upsert({ id:'hero', data:dados, updated_at:new Date().toISOString() });
      if(!error){ heroFramesRemote = dados; await limpaLocal(); return 'conta'; }
      console.error('Não consegui gravar site_frames', error);
    }catch(e){ console.error(e); }
  }
  heroFramesLocal = dados;
  try{ await window.storage.set('hero_frames_local', body); }catch(_){}
  return 'local';
}
function startHeroEdit(scope, id){ if(!isHeroAdmin()) return; const a = heroFrame(scope, id); state.heroEdit = { scope, id, x:+a.x, y:+a.y, z:+a.z }; render(); }
function applyHeroEdit(){
  const e = state.heroEdit; if(!e) return;
  const img = document.getElementById(e.scope === 'list' ? 'heroImg' : 'detailHeroImg');
  if(img) img.setAttribute('style', heroStyleOf(e));
  document.querySelectorAll('[data-hero-val]').forEach(s=>{ const k = s.dataset.heroVal; s.textContent = k === 'z' ? e.z.toFixed(2)+'×' : Math.round(e[k])+'%'; });
  document.querySelectorAll('input[data-hero]').forEach(r=>{ if(+r.value !== e[r.dataset.hero]) r.value = e[r.dataset.hero]; });
}
async function closeHeroEdit(save){
  const e = state.heroEdit;
  state.heroEdit = null;
  if(e && save){
    const base = heroBaseFrame(e.scope, e.id);
    const same = Math.abs(e.x-base.x)<.01 && Math.abs(e.y-base.y)<.01 && Math.abs(e.z-base.z)<.01;
    const map = heroFramesData[e.scope] = heroFramesData[e.scope] || {};
    if(same) delete map[e.id]; else map[e.id] = { x:+e.x.toFixed(1), y:+e.y.toFixed(1), z:+e.z.toFixed(2) };
    render();
    const how = await saveHeroFrames();
    showToast(how === 'arquivo' ? 'Enquadramento salvo no site (hero-frames.json) — peça para publicar'
      : how === 'conta' ? 'Enquadramento salvo na sua conta — já vale para todos os visitantes'
      : 'Salvo só neste navegador — falta criar a tabela site_frames no Supabase para valer para todos');
    return;
  }
  render();
}
function heroAdjustBarHtml(){
  const e = state.heroEdit;
  const ctl = (k, label, min, max, step, val) => `<div class="ctl"><label>${label}<span data-hero-val="${k}">${k==='z'?e.z.toFixed(2)+'×':Math.round(e[k])+'%'}</span></label><input type="range" data-hero="${k}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
  return `
  <div class="kz-hero-adjust" id="heroAdjustBar">
    <div class="tip"><b>Ajustar retrato:</b> arraste a imagem de fundo para mover e use a roda do mouse (ou o controle) para dar zoom.</div>
    ${ctl('z','Zoom',1,4,0.05,e.z)}${ctl('x','Horizontal',0,100,1,e.x)}${ctl('y','Vertical',0,100,1,e.y)}
    <div class="btns">
      <button class="kz-btn kz-btn-sm" id="heroResetBtn">Padrão</button>
      <button class="kz-btn kz-btn-sm" id="heroCancelBtn">Cancelar</button>
      <button class="kz-btn kz-btn-primary kz-btn-sm" id="heroSaveBtn">Salvar</button>
    </div>
  </div>`;
}
function attachHeroAdjust(){
  const e = state.heroEdit; if(!e) return;
  const drag = document.getElementById('heroDrag'), art = document.querySelector('.kz-hero .kz-hero-art');
  const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
  document.querySelectorAll('input[data-hero]').forEach(r=>r.addEventListener('input', ()=>{ e[r.dataset.hero] = parseFloat(r.value); applyHeroEdit(); }));
  document.getElementById('heroResetBtn').addEventListener('click', ()=>{ const b = heroBaseFrame(e.scope, e.id); e.x = b.x; e.y = b.y; e.z = b.z; applyHeroEdit(); });
  document.getElementById('heroCancelBtn').addEventListener('click', ()=> closeHeroEdit(false));
  document.getElementById('heroSaveBtn').addEventListener('click', ()=> closeHeroEdit(true));
  if(!drag || !art) return;
  let last = null;
  drag.addEventListener('pointerdown', ev=>{ last = { x:ev.clientX, y:ev.clientY }; drag.classList.add('drag'); drag.setPointerCapture(ev.pointerId); });
  drag.addEventListener('pointermove', ev=>{
    if(!last) return;
    const r = art.getBoundingClientRect(), k = Math.max(0.05, e.z - 1);
    // o ponto de origem do zoom é o que "anda": mover o mouse para a direita arrasta a imagem junto
    e.x = clamp(e.x - (ev.clientX - last.x) / (k * r.width) * 100, 0, 100);
    e.y = clamp(e.y - (ev.clientY - last.y) / (k * r.height) * 100, 0, 100);
    last = { x:ev.clientX, y:ev.clientY };
    applyHeroEdit();
  });
  const end = ()=>{ last = null; drag.classList.remove('drag'); };
  drag.addEventListener('pointerup', end); drag.addEventListener('pointercancel', end);
  drag.addEventListener('wheel', ev=>{ ev.preventDefault(); e.z = clamp(+(e.z + (ev.deltaY < 0 ? 0.1 : -0.1)).toFixed(2), 1, 4); applyHeroEdit(); }, { passive:false });
}
// Passa o retrato do topo da aba Personagens pro anterior/próximo da lista (respeita os filtros).
function stepHeroChar(dir){
  if(state.heroEdit) return;
  const list = getFilteredChars();
  if(!list.length) return;
  const cur = state.heroCharId || (defaultHeroChar() || {}).id;
  const i = list.findIndex(c=>c.id === cur);
  const next = i < 0 ? (dir > 0 ? list[0] : list[list.length-1]) : list[(i + dir + list.length) % list.length];
  setHeroChar(next.id);
}

function renderCharDetailPage(charId){
  const c = getChar(charId);
  if(!c) return `<div class="kz-empty">${kzt('ficha.naoEncontrado')}</div>`;
  if(visualNovo()) return renderCharDetailNovo(c);
  const fav = isFav(c.id);
  const cur = DETAIL_TABS.find(t=>t[0]===state.charDetailTab) || DETAIL_TABS[0];
  const body = cur[0] === 'habilidades' ? renderRoleCard(c) + renderDetailAbilities(c)
    : cur[0] === 'comida' ? renderCharFoodSection(c)
    : renderCharBondsSection(c);
  return `
  <section class="kz-page">
    <div class="kz-hero kz-detail-hero ${state.heroEdit && state.heroEdit.scope === 'detail' && state.heroEdit.id === c.id ? 'editing' : ''}">
      <div class="kz-hero-art"><div class="kz-hero-art-mask">
        <img id="detailHeroImg" src="${portraitSrc(c)}" alt="" style="${heroArtStyle(c.id)}" data-onerr="hide">
      </div></div>
      <div class="kz-hero-scrim"></div>
      ${state.heroEdit && state.heroEdit.scope === 'detail' && state.heroEdit.id === c.id ? '<div class="kz-hero-drag" id="heroDrag" title="Arraste para mover"></div>' + heroAdjustBarHtml() : ''}
      <div class="kz-detail-content">
        <div class="kz-detail-top">
          <button class="kz-back-btn" id="charDetailBackBtn"><span class="arr">←</span><span>${kzt('ficha.voltar')}</span></button>
          ${charStepButtonsHtml(c.id)}
        </div>
        <div class="kz-detail-main">
          <div class="kz-detail-card">${portraitInner(c)}</div>
          <div class="kz-detail-info">
            <div class="kz-name-band"><h1>${escapeHtml(kzNome(c.name))||kzt('geral.semNome')}</h1></div>
            <div class="kz-pill-row">
              ${pillHtml(c.element, c.element)}${pillHtml(c.gender, c.gender)}${rarityPillHtml(c)}
              ${c.type ? pillHtml(c.type, c.type) : ''}${c.affinity ? pillHtml(c.affinity, c.affinity) : ''}
            </div>
            ${(c.tags||[]).length ? `<div class="kz-pill-row">${c.tags.map(tagPillHtml).join('')}</div>` : ''}
            <div class="kz-pill-row kz-role-line"><span class="kz-label">${kzt('ficha.papel')}</span>${rolePillsHtml(c, 3)}</div>
            <div class="kz-action-row">
              <button class="kz-build-btn" id="buildWithCharBtn" data-id="${c.id}"><span class="glyph">連</span><span>${kzt('ficha.montarCom')}</span></button>
              <button class="kz-fav-toggle ${fav?'on':''}" data-fav="${c.id}"><span class="star">★</span><span class="lbl">${fav?kzt('fav.favoritado'):kzt('fav.favoritar')}</span></button>
              ${isHeroAdmin() ? `<button class="kz-edit-btn edit-char" data-id="${c.id}" title="Editar os dados usados no Montador de Combos">Editar dados de combo</button>` : ''}
              ${isHeroAdmin() ? `<button class="kz-edit-btn" id="heroAdjustBtn" data-id="${c.id}" title="Mover e dar zoom no retrato de fundo">Ajustar retrato</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="kz-tabs" role="tablist">
      ${DETAIL_TABS.map(([k,g,l])=>`<button class="kz-tab ${cur[0]===k?'active':''}" data-cdptab="${k}" role="tab" aria-selected="${cur[0]===k}"><span class="glyph">${g}</span><span>${l}</span></button>`).join('')}
    </div>
    <div class="kz-tabpanel">
      <div class="kz-panel-head"><span class="kz-panel-glyph">${cur[1]}</span><h2 class="kz-panel-title">${cur[2]}</h2></div>
      ${body}
    </div>
  </section>`;
}

/* ---------- Ficha no visual novo (igual ao canvas "Ficha do guerreiro") ----------
   Topo: arte da pasta Fichas com a carta do jogo ao lado, título em pincel, barra com raridade/tipo/afinidade/raça/
   gênero, tags, papéis e ações. Habilidades: um bloco por grupo com botões de nível (mostra um nível por vez) e, ao
   lado, os painéis de Papel em batalha e Sinergias. Afinidade e Vínculos usam as mesmas seções da ficha atual.
   Mantém os ids e classes que attachCharDetailHandlers usa (charDetailBackBtn, kz-step-btn, data-cdptab, data-fav,
   buildWithCharBtn, edit-char, data-open-char, data-guide). */
// Títulos dos grupos de habilidade vêm dos dados em português (também servem de chave); aqui só muda o texto mostrado.
const GRUPO_TITULOS = { 'Habilidade':'hab.habilidade', 'Suprema':'hab.suprema', 'Ataque Combinado':'hab.ataqueCombinadoTitulo', 'Passiva Única':'hab.passivaUnicaTitulo', 'Passiva (Padrão)':'hab.passivaPadrao', 'Super Despertar (LR)':'hab.superDespertar', 'Passivas do Supremo':'hab.passivasSupremo' };
function grupoTitulo(t){ return GRUPO_TITULOS[t] ? kzt(GRUPO_TITULOS[t]) : t; }
const NVF_SEAL = { 'Habilidade':'技', 'Suprema':'極', 'Ataque Combinado':'連', 'Passiva Única':'魂', 'Passiva (Padrão)':'能', 'Super Despertar (LR)':'覚', 'Passivas do Supremo':'王' };
const NVF_EFF_TERM = { '[Derrubada]':'derrubada', '[Empurrão]':'empurrao', '[Elevação Alta]':'elevacao_alta', '[Elevação Baixa]':'elevacao_baixa',
  '[Knockdown]':'derrubada', '[Knockback]':'empurrao', '[High Launch]':'elevacao_alta', '[Low Launch]':'elevacao_baixa' };
function nvfTermsHtml(txt){
  return String(txt || '').split(/(\[[^\]]+\])/).filter(Boolean).map(t=>{
    if(t.charAt(0) !== '[') return escapeHtml(t);
    const k = NVF_EFF_TERM[t];
    return `<span class="kz-nvf-term${k ? ' e-' + k : ''}">${escapeHtml(t)}</span>`;
  }).join('');
}
function nvfSealHtml(glyph, rgb){
  return `<span class="kz-nvf-seal" aria-hidden="true"${rgb ? ` style="--c:${rgb[0]};--t:${rgb[1]}"` : ''}>${glyph}</span>`;
}
// Ícone da habilidade (quando existe) com o selo em kanji no canto; sem ícone, fica só o selo grande.
function nvfIconHtml(data, glyph){
  const src = SHOW_ABILITY_ICONS && data && data.icone;
  return src ? `<span class="kz-nvf-ico"><img src="${escapeAttr(encodeURI(src))}" alt="" data-onerr="remove">${nvfSealHtml(glyph)}</span>` : nvfSealHtml(glyph);
}
function nvfAbilityBlock(c, g){
  const key = c.id + '|' + g.title, tiers = g.tiers;
  const comDado = tiers.map((t, i)=> t.data ? i : -1).filter(i=> i >= 0);
  let sel = state.nvAbSel && state.nvAbSel[key];
  if(sel == null || !tiers[sel]) sel = comDado.length ? comDado[comDado.length - 1] : 0;   // padrão: o nível mais alto
  const t = tiers[sel], d = t.data;
  const tipo = tipoText(d && d.tipo ? d.tipo : t.fallbackTipo);
  const efeitos = abilityGroupEffects(c, g.title).map(([lbl, effs])=>`<span class="kz-ab-effects"><span>${lbl}</span>${effs.map(effPillHtml).join('')}</span>`).join('');
  const niveis = tiers.length > 1 ? `<div class="kz-nvf-lvs">${tiers.map((x, i)=>`<button type="button" class="kz-nvf-lv${i === sel ? ' on' : ''}${x.data ? '' : ' vazio'}" data-ab-key="${escapeAttr(key)}" data-ab-i="${i}" aria-pressed="${i === sel}"><span class="st ${starPhase(x.reqLevel)}" aria-hidden="true">★</span>${escapeHtml(reqLabelText(x.reqLevel))}</button>`).join('')}</div>` : '';
  return `
      <section class="kz-nvf-mv" data-ab-block="${escapeAttr(key)}">
        <div class="kz-nvf-mv-side">${nvfIconHtml(d, NVF_SEAL[g.title] || '技')}<h2>${escapeHtml(grupoTitulo(g.title))}</h2>${efeitos}</div>
        <div class="kz-nvf-mv-main">
          ${niveis}
          <div class="kz-nvf-mv-meta">${textStarsHtml(t.reqLevel)}<span class="lb">${escapeHtml(kzTermo(tipo))} · ${escapeHtml(reqLabelText(t.reqLevel))}</span>${d && d.dano ? `<span class="kz-nvf-dmg">${kzt('hab.dano', { v: escapeHtml(kzTrad(d.dano)) })}</span>` : ''}</div>
          <h3 class="kz-nvf-sn">${d ? (escapeHtml(kzTrad(d.nome)) || '—') : kzt('hab.naoCapturado')}</h3>
          <p class="kz-nvf-ds">${d ? nvfTermsHtml(kzTrad(d.desc)) : kzt('hab.naoExtraido')}</p>
        </div>
      </section>`;
}
function nvfAbilitiesHtml(c){
  const p = ABILITY_PROGRESSION[c.name];
  const unlocks = p ? getAbilityUnlocks(c.name, 10) : null;
  if(!unlocks) return `<div class="kz-empty-ball"><img src="${ballSrc(1)}" alt=""><div>${kzt('hab.semDados')}</div></div>`;
  const sup = p.passivasSupremo || [];
  const supHtml = sup.length ? `
      <section class="kz-nvf-mv">
        <div class="kz-nvf-mv-side">${nvfSealHtml(NVF_SEAL['Passivas do Supremo'])}<h2>${kzt('hab.passivasSupremo')}</h2></div>
        <div class="kz-nvf-mv-main">${sup.map(ps=>`<div class="kz-nvf-sup">${SHOW_ABILITY_ICONS && ps.icone ? `<img class="ico" src="${escapeAttr(encodeURI(ps.icone))}" alt="" data-onerr="remove">` : ''}<div><h3 class="kz-nvf-sn sm">${escapeHtml(kzTrad(ps.nome)) || '—'}</h3><p class="kz-nvf-ds">${nvfTermsHtml(kzTrad(ps.desc))}</p></div></div>`).join('')}</div>
      </section>` : '';
  return unlocks.groups.map(g=> nvfAbilityBlock(c, g)).join('') + supHtml;
}
function nvfRolePanel(c){
  const a = analyzeRoles(c);
  const linhas = a.roles.map((r, i)=>{
    const info = ROLE_INFO[r], ev = a.why[r].slice(0, 2);
    return `
        <div class="kz-nvf-role" style="--c:${info.rgb[0]};--t:${info.rgb[1]}">
          <div class="hd">${nvfSealHtml(info.glyph, info.rgb)}<b>${escapeHtml(info.label)}</b><span class="rk${i === 0 ? ' main' : ''}">${i === 0 ? kzt('papel.principal') : kzt('papel.secundario')}</span></div>
          <p>${escapeHtml(info.about)}</p>
          ${ev.length ? `<ul>${ev.map(e=>`<li>${escapeHtml(roleEvidence(e))}</li>`).join('')}</ul>` : `<p class="mut">${kzt('papel.definidoPorTipo', { tipo: escapeHtml(c.type || '—') })}</p>`}
        </div>`;
  }).join('<div class="sep" aria-hidden="true"></div>');
  return `<div class="kz-nvf-pn"><h2>${kzt('papel.emBatalha')}</h2>${linhas}</div>`;
}
function nvfSynergyPanel(c){
  const s = synergyInfo(c);
  const pals = s.recebe.map(n=>{ const o = state.characters.find(x=>x.name === n); return o ? `<button type="button" class="kz-nvf-pal" data-nvf-open="${escapeAttr(o.id)}">${escapeHtml(kzNome(n))}</button>` : ''; }).join('');
  return `
      <div class="kz-nvf-pn">
        <h2>${kzt('sin.titulo')}</h2>
        ${s.proprias.length ? `<ul class="kz-nvf-syn">${s.proprias.map(t=>`<li>${t}</li>`).join('')}</ul>` : ''}
        ${pals ? `<p class="kz-nvf-pn-sub">${kzt('sin.fortalecidoPor')}</p><div class="kz-nvf-pals">${pals}</div>` : ''}
        ${!s.proprias.length && !pals ? `<p class="mut">${kzt('sin.nenhuma')}</p>` : ''}
        <button type="button" class="kz-btn" id="nvfTestBtn" data-id="${c.id}"><span class="kj" aria-hidden="true">連</span>${kzt('sin.testar')}</button>
      </div>`;
}
function renderCharDetailNovo(c){
  const fav = isFav(c.id);
  const cur = DETAIL_TABS.find(t=>t[0]===state.charDetailTab) || DETAIL_TABS[0];
  const cor = v=>{ const r = PILL_RGB[v]; return r ? `<b style="color:${r[1]};text-shadow:0 0 12px rgba(${r[0]},.7)">${escapeHtml(kzTermo(v))}</b>` : `<b>${escapeHtml(kzTermo(v) || '—')}</b>`; };
  const rar = rarityLabel(c.rarity), rs = RARITY_PILL[rar] || RARITY_PILL.R;
  const hud = [
    [kzt('filtro.raridade'), `<b class="rar" style="background:${rs.bg};color:${rs.color}">${escapeHtml(rar)}${isLimitedChar(c) ? ' ★' : ''}</b>`],
    c.type && [kzt('filtro.tipo'), cor(c.type)],
    c.affinity && [kzt('filtro.afinidade'), nvDotHtml(c.affinity) + cor(c.affinity)],
    c.element && [kzt('filtro.raca'), cor(c.element)],
    c.gender && [kzt('ficha.genero'), cor(c.gender)],
  ].filter(Boolean).map(([k, v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const tags = (c.tags || []).map(t=>{ const r = TAG_RGB[t] || ['201,162,75','#e0c070']; return `<span class="kz-nvf-tg" style="--c:${r[0]};--t:${r[1]}">#${escapeHtml(kzTermo(t))}</span>`; }).join('');
  const papeis = rolesOf(c).slice(0, 3).map((r, i)=>{ const info = ROLE_INFO[r]; return `<div class="kz-nvf-rolebig" style="--t:${info.rgb[1]}">${nvfSealHtml(info.glyph, info.rgb)}<span><b>${escapeHtml(info.label)}</b><small>${i === 0 ? kzt('papel.papelPrincipal') : kzt('papel.papelSecundario')}</small></span></div>`; }).join('');
  const nome = kzNome(c.name) || kzt('geral.semNome'), fs = nome.length > 20 ? 72 : nome.length > 13 ? 92 : 116;   // nome longo: título menor
  const corpo = cur[0] === 'habilidades'
    ? `<div class="kz-nvf-body"><div class="kz-nvf-abs">${nvfAbilitiesHtml(c)}</div><aside class="kz-nvf-side">${nvfRolePanel(c)}${nvfSynergyPanel(c)}</aside></div>`
    : `<div class="kz-tabpanel"><div class="kz-panel-head"><span class="kz-panel-glyph">${cur[1]}</span><h2 class="kz-panel-title">${cur[2]}</h2></div>${cur[0] === 'comida' ? renderCharFoodSection(c) : renderCharBondsSection(c)}</div>`;
  return `
  <section class="kz-page kz-nvf">
    <div class="kz-nvf-hero">
      ${nvBgHtml('戦')}
      <svg class="kz-nv-bolts" aria-hidden="true" viewBox="0 0 1440 760" preserveAspectRatio="none">
        <polyline class="kz-nv-bolt b1" points="120,40 150,140 118,156 168,270 132,292 190,420"/>
        <polyline class="kz-nv-bolt b2" points="560,70 532,160 560,176 516,290 548,306 500,410"/>
      </svg>
      <div class="kz-nvf-top">
        <button class="kz-back-btn" id="charDetailBackBtn"><span class="arr">←</span><span>${kzt('nav.personagens')}</span></button>
        <div class="kz-nvf-steps">${charStepButtonsHtml(c.id)}</div>
        <button type="button" class="kz-back-btn kz-nvf-share" id="charShareBtn" title="${kzt('ficha.copiarLinkTitulo')}"><span class="arr">🔗</span><span>${kzt('ficha.copiarLink')}</span></button>
      </div>
      <div class="kz-nvf-grid">
        <div class="kz-nvf-art">
          <div class="kz-nv-dchar" aria-hidden="true">${nvAuraImgs(renderSrc(c))}<img class="main" src="${renderSrc(c)}" alt="" data-onerr="card" data-card="${portraitSrc(c)}"></div>
          <img class="kz-nvf-mini" src="${portraitSrc(c)}" alt="${escapeAttr(kzt('ficha.carta', { nome }))}" data-onerr="hide">
        </div>
        <div class="kz-nvf-info">
          <span class="kz-nv-tag"><span class="kj">戦</span>${kzt('ficha.fichaDoGuerreiro')}</span>
          <div class="kz-nvf-titlewrap">
            <h1 class="kz-nvf-h1" style="--fs:${fs}px">${nvTtl(nome)}</h1>
            <span class="kz-nv-sfx" aria-hidden="true">ゴゴゴ</span>
          </div>
          <dl class="kz-nvf-hud">${hud}</dl>
          ${tags ? `<div class="kz-nvf-tags">${tags}</div>` : ''}
          ${papeis ? `<div class="kz-nvf-roles">${papeis}</div>` : ''}
          <div class="kz-nvf-actions">
            <button class="kz-build-btn" id="buildWithCharBtn" data-id="${c.id}"><span class="glyph">連</span><span>${kzt('ficha.montarComEle')}</span></button>
            <button class="kz-fav-toggle ${fav ? 'on' : ''}" data-fav="${c.id}"><span class="star">★</span><span class="lbl">${fav ? kzt('fav.favoritado') : kzt('fav.favoritar')}</span></button>
            ${isHeroAdmin() ? `<button class="kz-edit-btn edit-char" data-id="${c.id}" title="Editar os dados usados no Montador de Combos">Editar dados de combo</button>` : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="kz-tabs kz-nvf-tabs" role="tablist">
      ${DETAIL_TABS.map(([k,g,l])=>`<button class="kz-tab ${cur[0]===k?'active':''}" data-cdptab="${k}" role="tab" aria-selected="${cur[0]===k}"><span class="glyph">${g}</span><span>${l}</span></button>`).join('')}
    </div>
    ${corpo}
  </section>`;
}
// Ficha nova: botões de nível de cada habilidade (troca só o bloco), atalhos das sinergias e "Testar no montador".
function attachNvfHandlers(view){
  const abs = view.querySelector('.kz-nvf-abs');
  if(abs) abs.addEventListener('click', e=>{
    const b = e.target.closest('[data-ab-key]');
    if(!b) return;
    const key = b.dataset.abKey, i = parseInt(b.dataset.abI, 10);
    const c = getChar(state.viewingCharId), u = c && getAbilityUnlocks(c.name, 10);
    const g = u && u.groups.find(x=> c.id + '|' + x.title === key);
    const blk = [...abs.querySelectorAll('[data-ab-block]')].find(x=> x.dataset.abBlock === key);
    if(!g || !blk) return;
    state.nvAbSel = state.nvAbSel || {};
    state.nvAbSel[key] = i;
    blk.outerHTML = nvfAbilityBlock(c, g);
  });
  view.querySelectorAll('[data-nvf-open]').forEach(b=> b.addEventListener('click', ()=> openCharDetail(b.dataset.nvfOpen)));
  const test = document.getElementById('nvfTestBtn');
  if(test) test.addEventListener('click', ()=> buildWithChar(test.dataset.id));
}

// Ícone real de habilidade só quando SHOW_ABILITY_ICONS estiver ligado; senão fica o "?" reservando o espaço.
function abilityIconBox(data){
  const img = (SHOW_ABILITY_ICONS && data && data.icone) ? `<img src="${escapeAttr(encodeURI(data.icone))}" alt="" data-onerr="remove">` : '?';
  return `<div class="kz-ab-icon${img === '?' ? '' : ' has-img'}">${img}</div>`;
}

function renderDetailAbilityRow(tier){
  const data = tier.data, noData = !data;
  const tipo = tipoText(!noData && data.tipo ? data.tipo : tier.fallbackTipo);
  return `
  <div class="kz-ab-row ${noData?'nodata':''}">
    ${abilityIconBox(data)}
    <div class="kz-ab-body">
      <div class="kz-ab-meta">
        ${textStarsHtml(tier.reqLevel)}
        <span class="kz-ab-tipo" style="color:${tipoColor(tipo)};">${escapeHtml(kzTermo(tipo))}</span>
        <span class="kz-ab-req">${reqLabelText(tier.reqLevel)}</span>
        ${!noData && data.dano ? `<span class="kz-ab-dano">${kzt('hab.dano', { v: escapeHtml(kzTrad(data.dano)) })}</span>` : ''}
      </div>
      <div class="kz-ab-name">${noData ? kzt('hab.naoCapturado') : (escapeHtml(kzTrad(data.nome))||'—')}</div>
      <div class="kz-ab-desc">${noData ? kzt('hab.naoExtraido') : escapeHtml(kzTrad(data.desc||''))}</div>
    </div>
  </div>`;
}

// Efeitos de combo do guerreiro mostrados ao lado de cada grupo de habilidade: [[rótulo, efeitos], ...].
function abilityGroupEffects(c, title){
  const parts = [];
  if(title === 'Habilidade' && c.skill.effects.length) parts.push([kzt('sf.causa'), c.skill.effects]);
  if(title === 'Suprema' && c.supreme.effects.length) parts.push([kzt('sf.causa'), c.supreme.effects]);
  if(title === 'Ataque Combinado'){
    if((c.combo.triggers||[]).length) parts.push([kzt('ficha.requisito'), c.combo.triggers]);
    if((c.combo.effects||[]).length) parts.push([kzt('sf.causa'), c.combo.effects]);
  }
  return parts;
}
// Ficha completa: progressão inteira de cada habilidade (todos os níveis de up), agrupada
// por tipo, com os efeitos de combo do personagem ao lado do título do grupo.
function renderDetailAbilities(c){
  const p = ABILITY_PROGRESSION[c.name];
  const unlocks = p ? getAbilityUnlocks(c.name, 10) : null;
  if(!unlocks){
    return `<div class="kz-empty-ball"><img src="${ballSrc(1)}" alt=""><div>${kzt('hab.semDados')}</div></div>`;
  }
  const groupEffects = title => abilityGroupEffects(c, title).map(([lbl, effs])=>`<span class="kz-ab-effects"><span>${lbl}</span>${effs.map(effPillHtml).join('')}</span>`).join('');
  const groups = unlocks.groups.map(g=>`
    <div class="kz-ab-group">
      <div class="kz-ab-group-head"><span class="kz-ab-group-title">${escapeHtml(grupoTitulo(g.title))}</span>${groupEffects(g.title)}</div>
      ${g.tiers.map(renderDetailAbilityRow).join('')}
    </div>`).join('');
  const sup = p.passivasSupremo || [];
  const supHtml = sup.length ? `
    <div class="kz-ab-group">
      <div class="kz-ab-group-head"><span class="kz-ab-group-title">${kzt('hab.passivasSupremo')}</span></div>
      <div class="kz-supremo-grid">
        ${sup.map(ps=>`<div class="kz-supremo-card">${(SHOW_ABILITY_ICONS && ps.icone) ? `<div class="ico"><img src="${escapeAttr(encodeURI(ps.icone))}" alt="" data-onerr="remove-parent"></div>` : ''}<div class="t"><div class="n">${escapeHtml(kzTrad(ps.nome))||'—'}</div><div class="d">${escapeHtml(kzTrad(ps.desc||''))}</div></div></div>`).join('')}
      </div>
    </div>` : '';
  return `<div class="kz-ab-groups">${groups}${supHtml}</div>`;
}

function foodRarityClass(raridade){
  const r = (raridade||'').toLowerCase();
  if(r.startsWith('dourad')) return 'rarity-dourado';
  if(r.startsWith('roxo')) return 'rarity-roxo';
  if(r.startsWith('azul')) return 'rarity-azul';
  return '';
}

// Presentes de Afinidade de cada guerreiro ("03-Lista de Afinidade.pdf"): 3 presentes de 5, 20 e 60 EXP.
// Os dados entre os marcadores são gerados por ferramentas-guias/build_presentes.py.
/* AFINIDADE-DADOS:inicio — gerado por ferramentas-guias/build_presentes.py a partir de "03-Lista de Afinidade.pdf" */
const AFFINITY_GIFTS = {"arroz-com-carne-assada": "Arroz com Carne Assada", "arroz-com-milho": "Arroz com Milho", "arroz-com-ovo": "Arroz com Ovo", "arroz-de-frutos-do-mar-do-vegeta": "Arroz de Frutos do Mar do Vegeta", "arroz-frito-com-frutos-do-mar": "Arroz Frito com Frutos do Mar", "arroz-frito-dourado": "Arroz Frito Dourado", "asas-de-frango-assadas": "Asas de Frango Assadas", "bife-energetico": "Bife Energético", "bife-na-brasa": "Bife na Brasa", "bife-tartaro": "Bife Tártaro", "biscoitos-de-cranberry": "Biscoitos de Cranberry", "bolinho-de-arroz-frito": "Bolinho de Arroz Frito", "bolinhos-de-arroz": "Bolinhos de Arroz", "bolinhos-de-polvo": "Bolinhos de Polvo", "bolo-de-morango": "Bolo de Morango", "carne-de-dinossauro-especial": "Carne de Dinossauro Especial", "cavala-grelhada": "Cavala Grelhada", "costeleta-de-cordeiro": "Costeleta de Cordeiro", "costeleta-de-porco-extrema": "Costeleta de Porco Extrema", "croquete": "Croquete", "curry-especial": "Curry Especial", "ensopado-de-frango": "Ensopado de Frango", "frango-assado": "Frango Assado", "gyudon-especial": "Gyudon Especial", "lagosta-de-cereja": "Lagosta de Cereja", "lamen-de-ameijoa": "Lámen de Amêijoa", "lamen-delicioso": "Lámen Delicioso", "macarrao-com-lagosta": "Macarrão com Lagosta", "macarrao-dragao": "Macarrão Dragão", "muffin-com-calda": "Muffin com Calda", "oden": "Oden", "omelete": "Omelete", "ovo-beneditino": "Ovo Beneditino", "oyakodon": "Oyakodon", "pao-com-manteiga": "Pão com Manteiga", "pao-no-vapor": "Pão no Vapor", "pastel-de-carne-em-camadas": "Pastel de Carne em Camadas", "peixe-com-batatas": "Peixe com Batatas", "peixe-com-limao": "Peixe com Limão", "peixe-frito-especial": "Peixe Frito Especial", "porco-assado-inteiro": "Porco Assado Inteiro", "prato-de-frutas-frescas": "Prato de Frutas Frescas", "presente-204062": "Presente sem nome no jogo (ID 204062)", "presente-204063": "Presente sem nome no jogo (ID 204063)", "pudim-de-ovo": "Pudim de Ovo", "raspadinha-de-verao": "Raspadinha de Verão", "rocambole-de-nozes": "Rocambole de Nozes", "salada-de-vegetais": "Salada de Vegetais", "sanduiche-de-cafe-da-manha": "Sanduíche de Café da Manhã", "sardinha-de-namekusei": "Sardinha de Namekusei", "sashimi-de-salmao": "Sashimi de Salmão", "sobremesa-de-taro": "Sobremesa de Taro", "sopa-de-frutos-do-mar": "Sopa de Frutos do Mar", "sopa-de-misso": "Sopa de Missô", "sorvete-de-mirtilo": "Sorvete de Mirtilo", "tofu-com-ovo": "Tofu com Ovo", "tofu-especial": "Tofu Especial", "tofu-picante": "Tofu Picante", "torrada-com-sorvete": "Torrada com Sorvete", "torta-de-chocolate": "Torta de Chocolate", "torta-de-dinossauro": "Torta de Dinossauro", "torta-de-maca-com-baunilha": "Torta de Maçã com Baunilha", "udon-especial": "Udon Especial"};
const AFFINITY_CHAR_GIFTS = {"Android 16": ["frango-assado", "torta-de-maca-com-baunilha", "bife-energetico"], "Android 17": ["frango-assado", "torta-de-maca-com-baunilha", "bife-energetico"], "Android 18": ["frango-assado", "torta-de-maca-com-baunilha", "bife-energetico"], "Android 21": ["bolinhos-de-polvo", "bolo-de-morango", "tofu-picante"], "Baby": ["croquete", "arroz-de-frutos-do-mar-do-vegeta", "sopa-de-frutos-do-mar"], "Bardock": ["sashimi-de-salmao", "asas-de-frango-assadas", "bife-tartaro"], "Bardock Quebrador do Tempo": ["sashimi-de-salmao", "asas-de-frango-assadas", "bife-tartaro"], "Beerus": ["pao-no-vapor", "lamen-delicioso", "sopa-de-misso"], "Bergamo": ["peixe-com-batatas", "sobremesa-de-taro", "pao-com-manteiga"], "Boo Puro": ["bolinhos-de-polvo", "bolo-de-morango", "tofu-picante"], "Broly": ["pao-no-vapor", "lamen-delicioso", "sopa-de-misso"], "Broly (DBS)": ["pao-no-vapor", "lamen-delicioso", "omelete"], "Broly SS4": ["sanduiche-de-cafe-da-manha", "arroz-com-ovo", "presente-204063"], "Bulma": ["arroz-com-carne-assada", "peixe-com-limao", "lamen-de-ameijoa"], "Caulifla": ["prato-de-frutas-frescas", "rocambole-de-nozes", "carne-de-dinossauro-especial"], "Cell": ["sashimi-de-salmao", "asas-de-frango-assadas", "bife-tartaro"], "Champa": ["pao-no-vapor", "lamen-delicioso", "sopa-de-misso"], "Cooler Dourado": ["cavala-grelhada", "torrada-com-sorvete", "ovo-beneditino"], "Cumber": ["udon-especial", "sorvete-de-mirtilo", "tofu-especial"], "Dabura": ["croquete", "arroz-de-frutos-do-mar-do-vegeta", "sopa-de-frutos-do-mar"], "Demigra Demoníaco": ["udon-especial", "sorvete-de-mirtilo", "tofu-especial"], "Dyspo": ["gyudon-especial", "ensopado-de-frango", "bolinho-de-arroz-frito"], "Freeza": ["cavala-grelhada", "torrada-com-sorvete", "ovo-beneditino"], "Freeza Dourado": ["cavala-grelhada", "torrada-com-sorvete", "ovo-beneditino"], "Frost": ["cavala-grelhada", "torrada-com-sorvete", "ovo-beneditino"], "Gogeta SS4": ["arroz-com-carne-assada", "peixe-com-limao", "oden"], "Gohan": ["salada-de-vegetais", "torta-de-dinossauro", "curry-especial"], "Gohan BEAST": ["salada-de-vegetais", "torta-de-dinossauro", "presente-204062"], "Gohan Místico": ["salada-de-vegetais", "torta-de-dinossauro", "curry-especial"], "Gohan do Futuro": ["salada-de-vegetais", "torta-de-dinossauro", "raspadinha-de-verao"], "Goku": ["bolinhos-de-arroz", "lagosta-de-cereja", "bife-na-brasa"], "Goku (Criança)": ["arroz-frito-com-frutos-do-mar", "muffin-com-calda", "sardinha-de-namekusei"], "Goku (GT)": ["arroz-com-carne-assada", "peixe-com-limao", "lamen-de-ameijoa"], "Goku Black": ["udon-especial", "sorvete-de-mirtilo", "oyakodon"], "Goku Black (Rose)": ["udon-especial", "sorvete-de-mirtilo", "oyakodon"], "Goku Instinto": ["sanduiche-de-cafe-da-manha", "arroz-com-ovo", "porco-assado-inteiro"], "Goku Instinto Superior": ["bolinhos-de-arroz", "lagosta-de-cereja", "macarrao-com-lagosta"], "Goku SS3": ["bolinhos-de-arroz", "lagosta-de-cereja", "bife-na-brasa"], "Goku SS3 (Rose)": ["bolinhos-de-arroz", "lagosta-de-cereja", "macarrao-com-lagosta"], "Goku SS4": ["sanduiche-de-cafe-da-manha", "arroz-com-ovo", "torta-de-chocolate"], "Goku SSGSS": ["sanduiche-de-cafe-da-manha", "arroz-com-ovo", "torta-de-chocolate"], "Goku SSJ Deus": ["sanduiche-de-cafe-da-manha", "arroz-com-ovo", "torta-de-chocolate"], "Gotenks": ["arroz-com-carne-assada", "peixe-com-limao", "lamen-de-ameijoa"], "Piccolo (Laranja)": ["bolinhos-de-arroz", "lagosta-de-cereja", "macarrao-com-lagosta"], "Hit": ["prato-de-frutas-frescas", "rocambole-de-nozes", "carne-de-dinossauro-especial"], "Janemba": ["croquete", "arroz-de-frutos-do-mar-do-vegeta", "sopa-de-frutos-do-mar"], "Jiren": ["gyudon-especial", "ensopado-de-frango", "bolinho-de-arroz-frito"], "Jiren Poder Máximo": ["gyudon-especial", "ensopado-de-frango", "omelete"], "Kale": ["prato-de-frutas-frescas", "rocambole-de-nozes", "carne-de-dinossauro-especial"], "Kefla": ["prato-de-frutas-frescas", "rocambole-de-nozes", "porco-assado-inteiro"], "Kuririn": ["arroz-frito-com-frutos-do-mar", "muffin-com-calda", "sardinha-de-namekusei"], "Majin Boo": ["bolinhos-de-polvo", "bolo-de-morango", "tofu-picante"], "Majin Vegeta": ["tofu-com-ovo", "biscoitos-de-cranberry", "pastel-de-carne-em-camadas"], "Mestre Kame": ["arroz-frito-com-frutos-do-mar", "muffin-com-calda", "sardinha-de-namekusei"], "Moro": ["tofu-com-ovo", "biscoitos-de-cranberry", "costeleta-de-cordeiro"], "Otta Magetta": ["peixe-com-batatas", "sobremesa-de-taro", "pao-com-manteiga"], "Piccolo": ["sashimi-de-salmao", "asas-de-frango-assadas", "bife-tartaro"], "Ribrianne": ["peixe-com-batatas", "sobremesa-de-taro", "pao-com-manteiga"], "SSG Trunks": ["arroz-frito-com-frutos-do-mar", "muffin-com-calda", "raspadinha-de-verao"], "SSGSS Gogeta": ["arroz-com-carne-assada", "peixe-com-limao", "oden"], "Super Mira": ["frango-assado", "torta-de-maca-com-baunilha", "arroz-com-milho"], "Super Syn Shenlong": ["croquete", "arroz-de-frutos-do-mar-do-vegeta", "sopa-de-frutos-do-mar"], "Tenshinhan": ["arroz-frito-com-frutos-do-mar", "muffin-com-calda", "sardinha-de-namekusei"], "Toppo": ["gyudon-especial", "ensopado-de-frango", "bolinho-de-arroz-frito"], "Towa": ["croquete", "arroz-de-frutos-do-mar-do-vegeta", "pudim-de-ovo"], "Trunks do Futuro": ["salada-de-vegetais", "torta-de-dinossauro", "curry-especial"], "Vados": ["pao-no-vapor", "lamen-delicioso", "pudim-de-ovo"], "Vegeta": ["tofu-com-ovo", "biscoitos-de-cranberry", "pastel-de-carne-em-camadas"], "Vegeta Base": ["tofu-com-ovo", "biscoitos-de-cranberry", "pastel-de-carne-em-camadas"], "Vegeta Instinto Superior": ["tofu-com-ovo", "biscoitos-de-cranberry", "macarrao-dragao"], "Vegeta SS4": ["peixe-frito-especial", "costeleta-de-porco-extrema", "arroz-frito-dourado"], "Vegeta SSG": ["peixe-frito-especial", "costeleta-de-porco-extrema", "arroz-frito-dourado"], "Vegeta SSGSS": ["peixe-frito-especial", "costeleta-de-porco-extrema", "arroz-frito-dourado"], "Vegeta Ultra Ego": ["tofu-com-ovo", "biscoitos-de-cranberry", "costeleta-de-cordeiro"], "Vegetto SSGSS": ["arroz-com-carne-assada", "peixe-com-limao", "porco-assado-inteiro"], "Whis": ["pao-no-vapor", "lamen-delicioso", "pudim-de-ovo"], "Xeno Goku": ["bolinhos-de-arroz", "lagosta-de-cereja", "bife-na-brasa"], "Yamcha": ["arroz-frito-com-frutos-do-mar", "muffin-com-calda", "sardinha-de-namekusei"], "Zamasu": ["udon-especial", "sorvete-de-mirtilo", "oyakodon"], "Zamasu Fundido": ["udon-especial", "sorvete-de-mirtilo", "oyakodon"]};
/* AFINIDADE-DADOS:fim */
const AFFINITY_EXP = [5, 20, 60];
// Fontes conhecidas (guia de Afinidade, só para os presentes do grupo do Goku).
const AFFINITY_SOURCES = { 'bolinhos-de-arroz|lagosta-de-cereja|bife-na-brasa':'Teste Diário, Caminho da Serpente, Loja de Vínculo e, conforme o presente, Mercearia, Loja da Arena, Loja de Teste, Pacote Semanal e Arena Multisservidor.' };
function affinityGiftsOf(name){
  return (AFFINITY_CHAR_GIFTS[name] || []).map((slug, i)=>({ slug, nome: kzTrad(AFFINITY_GIFTS[slug] || slug), exp: AFFINITY_EXP[i] }));
}
function affinityKey(name){ return (AFFINITY_CHAR_GIFTS[name] || []).join('|'); }
// Guerreiros que aceitam exatamente os mesmos 3 presentes.
function affinityMatesOf(name){
  const k = affinityKey(name);
  return k ? Object.keys(AFFINITY_CHAR_GIFTS).filter(n=>n !== name && affinityKey(n) === k) : [];
}
function affinityGroups(){
  const g = new Map();
  Object.keys(AFFINITY_CHAR_GIFTS).forEach(n=>{ const k = affinityKey(n); if(!g.has(k)) g.set(k, []); g.get(k).push(n); });
  return [...g.entries()].map(([k, membros])=>({ membros, slugs: k.split('|') }));
}
// Todos os guerreiros que usam um presente (em qualquer faixa de EXP).
function affinityUsersOf(slug){
  return Object.keys(AFFINITY_CHAR_GIFTS).filter(n=>AFFINITY_CHAR_GIFTS[n].includes(slug));
}
function affinityPopHtml(giftSlug, atual){
  const users = affinityUsersOf(giftSlug).sort((a, b)=> (b === atual) - (a === atual) || a.localeCompare(b));
  if(!users.length) return '';
  const av = n=>{
    const o = state.characters.find(x=>x.name === n);
    if(!o){
      const fora = iconeSrcNome(n);
      return `<span class="cdp-pop-av fora" title="${escapeAttr(kzt('afin.foraDoSite', { nome: n }))}"><span class="face">${fora ? `<img src="${fora}" alt="" loading="lazy" data-onerr="hide">` : `<span class="ini">${escapeHtml(initials(n))}</span>`}</span><span class="nm">${escapeHtml(n)}</span></span>`;
    }
    const ico = iconeSrc(o);   // ícone da pasta Icones; sem ele, o rosto recortado da carta
    const img = ico ? `<img src="${ico}" alt="" loading="lazy" data-onerr="hide">`
      : `<img src="portraits/mini/${slug(o.name)}.webp" alt="" loading="lazy" style="${heroStyleOf(heroFrame('detail', o.id))}" data-onerr="hide">`;
    return `<button type="button" class="cdp-pop-av${n === atual ? ' eu' : ''}" ${n === atual ? '' : `data-open-char="${escapeAttr(o.id)}"`} title="${escapeAttr(n)}"><span class="face">${img}</span><span class="nm">${escapeHtml(n)}</span></button>`;
  };
  return `<div class="cdp-food-pop" role="tooltip"><span class="t">${kzt('afin.quemUsa')}</span><div class="cdp-food-pop-grid">${users.map(av).join('')}</div></div>`;
}
function affinityFoodTier(exp){ return exp >= 60 ? 'rarity-dourado' : exp >= 20 ? 'rarity-roxo' : 'rarity-azul'; }
function affinityIconHtml(slug){ return /^[a-z0-9-]{1,60}$/.test(slug) ? `<img src="assets/presentes/${slug}.webp" alt="" loading="lazy" data-onerr="hide">` : '🍽'; }
function affinityResumoHtml(){
  const grupos = affinityGroups();
  const nomeLink = n=>{ const o = state.characters.find(x=>x.name === n); return o ? `<button type="button" class="kz-link-btn" data-open-char="${escapeAttr(o.id)}">${escapeHtml(n)}</button>` : escapeHtml(n); };
  const linhas = grupos.map(g=>`<tr><td>${g.membros.map(nomeLink).join(', ')}</td>${g.slugs.map(s=>`<td><span class="cdp-gift-cell">${affinityIconHtml(s)}${escapeHtml(kzTrad(AFFINITY_GIFTS[s] || s))}</span></td>`).join('')}</tr>`).join('');
  return `
  <div class="cdp-aff-block">
    <h3 class="cdp-aff-title">${kzt('afin.comoFunciona')}</h3>
    <ul class="cdp-aff-list">
      <li>${kzt('afin.l1')}</li>
      <li>${kzt('afin.l2')}</li>
      <li>${kzt('afin.l3')}</li>
      <li>${kzt('afin.l4')}</li>
      <li>${kzt('afin.l5')}</li>
    </ul>
    <details class="kz-gd"><summary><span class="tx"><b>${kzt('afin.todosPresentes')}</b><small>${kzt('afin.resumoGrupos', { n: Object.keys(AFFINITY_CHAR_GIFTS).length, g: grupos.length })}</small></span></summary>
      <div class="kz-gd-body"><div class="kz-gt-wrap"><table class="kz-gt"><thead><tr><th>${kzt('afin.colGuerreiros')}</th><th>5 EXP</th><th>20 EXP</th><th>60 EXP</th></tr></thead><tbody>${linhas}</tbody></table></div></div>
    </details>
    <button type="button" class="kz-btn kz-btn-sm" data-guide="afinidade">${kzt('afin.abrirGuia')}</button>
  </div>`;
}
function renderCharFoodSection(c){
  const extras = CHAR_EXTRAS[c.name];
  const doJogo = affinityGiftsOf(c.name);
  const foods = doJogo.length ? doJogo : ((extras && extras.comidaAfinidade) || []);
  const outros = affinityMatesOf(c.name);
  const fontes = AFFINITY_SOURCES[affinityKey(c.name)];
  const topo = foods.length ? `
  <div class="cdp-aff-block">
    <h3 class="cdp-aff-title">${kzt('afin.presentesQue', { nome: escapeHtml(kzNome(c.name)) })}</h3>
    <div class="cdp-food-row">${foods.map(f=>`
      <div class="cdp-food-item"${f.slug ? ' tabindex="0"' : ''}>
        <div class="cdp-food-icon ${f.exp ? affinityFoodTier(f.exp) : foodRarityClass(f.raridade)}">${f.slug ? affinityIconHtml(f.slug) : '🍽'}</div>
        <div class="cdp-food-name">${escapeHtml(kzTrad(f.nome))||'—'}</div>
        ${f.exp ? `<div class="cdp-food-exp">+${+f.exp} EXP</div>` : ''}
        ${f.slug ? affinityPopHtml(f.slug, c.name) : ''}
      </div>`).join('')}</div>
    ${outros.length ? `<div class="cdp-aff-group">${kzt('afin.mesmosPresentes')}${outros.map(n=>{ const o = state.characters.find(x=>x.name === n); return o ? `<button type="button" class="kz-link-btn" data-open-char="${escapeAttr(o.id)}">${escapeHtml(n)}</button>` : escapeHtml(n); }).join(', ')} <span>${kzt('afin.cadaUm')}</span></div>` : ''}
    ${fontes ? `<div class="cdp-aff-src"><b>${kzt('afin.ondeConseguir')}</b> ${escapeHtml(kzTrad(fontes))}</div>` : ''}
  </div>` : `<div class="kz-empty-ball"><img src="${ballSrc(2)}" alt=""><div>${kzt('afin.semPresentes', { nome: escapeHtml(kzNome(c.name)) })}</div></div>`;
  return topo + affinityResumoHtml();
}

// Avatar de um parceiro de vínculo: no site (retrato), fora do site mas com ícone, ou só as iniciais.
function bondAvatarHtml(nome){
  const o = state.characters.find(x=>x.name === nome);
  if(o) return `<div class="cdp-bond-avatar" title="${escapeAttr(kzNome(nome))}">${portraitInner(o)}</div>`;
  const ico = iconeSrcNome(nome);
  return `<div class="cdp-bond-avatar" title="${escapeAttr(kzNome(nome))}">${ico ? `<img src="${ico}" alt="" loading="lazy" decoding="async" data-onerr="hide">` : ''}<span class="avatar-fallback"${ico ? ' style="display:none;"' : ''}>${escapeHtml(initials(nome))}</span></div>`;
}
function bondStatLabel(s){ return s === 'PV' ? kzt('vinc.pv') : kzt('vinc.atq'); }
function bondListaNomes(nomes){ return nomes.map(n=>`<b>${escapeHtml(kzNome(n))}</b>`).join(', '); }
function bondRowHtml(c, b){
  const nome = b.nome ? escapeHtml(kzTrad(b.nome)) : `<span class="inactive-tag">${kzt('vinc.semNome')}</span>`;
  if(b.tipo === 'arma'){
    return `<div class="cdp-bond-row">
      <div class="cdp-bond-partner"><div class="cdp-bond-avatar">${portraitInner(c)}</div><div class="cdp-bond-avatar cdp-bond-weapon" aria-hidden="true"><span>武</span></div></div>
      <div class="cdp-bond-info">
        <div class="cdp-bond-skill">${nome}</div>
        <div class="cdp-bond-req">${kzt('vinc.reqArma')}</div>
        <div class="cdp-bond-lv"><span class="fixo">${escapeHtml(kzTrad(b.item))} · ${bondStatLabel(b.stat)} +${+b.valor}%</span></div>
        <div class="cdp-bond-note">${kzt('vinc.fixo')}</div>
      </div>
    </div>`;
  }
  const parceiros = b.parceiros || [];
  const req = b.tipo === 'sozinho' ? kzt('vinc.reqSozinho') : kzt('vinc.reqTer', { lista: bondListaNomes(parceiros) });
  const niveis = b.niveis.map((v, i)=>`<span>${kzt('vinc.nv', { n: i + 1 })} <b>${bondStatLabel(b.stat)} +${+v}%</b></span>`).join('');
  const nota = b.escalaPor ? kzt('vinc.sobeCom', { nome: escapeHtml(kzNome(b.escalaPor)) }) : kzt('vinc.semParceiro');
  return `<div class="cdp-bond-row">
      <div class="cdp-bond-partner"><div class="cdp-bond-avatar">${portraitInner(c)}</div>${parceiros.map(bondAvatarHtml).join('')}</div>
      <div class="cdp-bond-info">
        <div class="cdp-bond-skill">${nome}</div>
        <div class="cdp-bond-req">${req}</div>
        <div class="cdp-bond-lv">${niveis}</div>
        <div class="cdp-bond-note">${nota}</div>
      </div>
    </div>`;
}
function renderCharBondsSection(c){
  const v = VINCULOS[c.name];
  if(v && v.lista && v.lista.length){
    const guerreiros = v.lista.filter(b=>b.tipo !== 'arma'), armas = v.lista.filter(b=>b.tipo === 'arma');
    const bloco = (titulo, lista)=> lista.length ? `<h3 class="cdp-aff-title">${titulo}</h3><div class="cdp-bond-list">${lista.map(b=>bondRowHtml(c, b)).join('')}</div>` : '';
    return `<div class="cdp-aff-block">
      <div class="cdp-bond-total">${kzt('vinc.totalMax', { atq: +v.total.atq, pv: +v.total.pv })}</div>
      <details class="kz-gd"><summary><span class="tx"><b>${kzt('vinc.comoFunciona')}</b></span></summary>
        <div class="kz-gd-body"><ul class="cdp-aff-list"><li>${kzt('vinc.c1')}</li><li>${kzt('vinc.c2')}</li><li>${kzt('vinc.c3')}</li><li>${kzt('vinc.c4')}</li></ul></div>
      </details>
    </div>
    ${bloco(kzt('vinc.secGuerreiros', { n: guerreiros.length }), guerreiros)}
    ${bloco(kzt('vinc.secArma', { n: armas.length }), armas)}`;
  }
  const extras = CHAR_EXTRAS[c.name];
  const bonds = extras ? extras.vinculos : [];
  if(!bonds || !bonds.length){
    return `<div class="kz-empty-ball"><img src="${ballSrc(6)}" alt=""><div>${kzt('vinc.semDados')}</div></div>`;
  }
  return `<div class="cdp-bond-list">${bonds.map(b=>`
    <div class="cdp-bond-row">
      <div class="cdp-bond-partner">
        <div class="cdp-bond-avatar">${portraitInner(c)}</div>
        <div class="cdp-bond-avatar">${portraitInner({name: b.parceiro || ''})}</div>
      </div>
      <div class="cdp-bond-info">
        ${b.bonus ? `<div class="cdp-bond-bonus">${escapeHtml(kzTrad(b.bonus))}</div>` : ''}
        <div class="cdp-bond-skill">${escapeHtml(kzTrad(b.habilidadeNome))||'—'}${b.ativo===false ? `<span class="inactive-tag">${kzt('vinc.inativo')}</span>` : ''}</div>
        ${b.requisito ? `<div class="cdp-bond-req">${escapeHtml(kzTrad(b.requisito))}</div>` : ''}
        ${b.habilidadeDesc ? `<div class="kz-ab-desc">${escapeHtml(kzTrad(b.habilidadeDesc))}</div>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

function attachCharDetailHandlers(){
  const view = document.getElementById('view');
  const shareBtn = document.getElementById('charShareBtn');
  if(shareBtn) shareBtn.addEventListener('click', () => copyCharLink(state.viewingCharId));
  const backBtn = document.getElementById('charDetailBackBtn');
  if(backBtn) backBtn.addEventListener('click', ()=>{ state.viewingCharId = null; state.heroEdit = null; render(); window.scrollTo(0, charsListScrollY); });
  const adjBtn = document.getElementById('heroAdjustBtn');
  if(adjBtn) adjBtn.addEventListener('click', ()=> startHeroEdit('detail', adjBtn.dataset.id));
  attachHeroAdjust();
  view.querySelectorAll('.kz-step-btn[data-step]').forEach(b=> b.addEventListener('click', ()=> stepCharDetail(parseInt(b.dataset.step, 10))));
  view.querySelectorAll('.edit-char').forEach(b=> b.addEventListener('click', ()=> openCharEditor(b.dataset.id)));
  view.querySelectorAll('[data-open-char]').forEach(b=> b.addEventListener('click', ()=>{ openCharDetail(b.dataset.openChar); state.charDetailTab = 'comida'; render(); }));
  view.querySelectorAll('.kz-tabpanel [data-guide]').forEach(b=> b.addEventListener('click', ()=> openGuide(b.dataset.guide)));
  view.querySelectorAll('.kz-tab[data-cdptab]').forEach(b=> b.addEventListener('click', ()=>{
    state.charDetailTab = b.dataset.cdptab;
    render();
  }));
  view.querySelectorAll('.kz-fav-toggle[data-fav]').forEach(b=> b.addEventListener('click', ()=> toggleFav(b.dataset.fav)));
  const buildBtn = document.getElementById('buildWithCharBtn');
  if(buildBtn) buildBtn.addEventListener('click', ()=> buildWithChar(buildBtn.dataset.id));
  if(visualNovo()) attachNvfHandlers(view);
}

/* ======================= COLEÇÃO ======================= */
// Quantos tiers de habilidade (com dado capturado) já estão liberados no nível atual.
function collUnlockCount(c, level){
  const u = getAbilityUnlocks(c.name, level);
  if(!u) return 0;
  return u.groups.reduce((n, g)=> n + g.tiers.filter(t=>t.unlocked && t.data).length, 0);
}

// 7 esferas: cada uma acende a cada 1/7 da coleção completa.
function collCounterInner(){
  const total = state.characters.length;
  const owned = state.characters.filter(c=>getEntry(c.id).owned).length;
  const pct = total ? owned / total : 0;
  if(visualNovo()){   // canvas: esferas desenhadas (com as estrelas dentro) e o número grande embaixo
    const lit = [1,2,3,4,5,6,7].filter(i=> pct >= i/7 - 1e-9 || (i === 1 && owned > 0)).length;
    const balls = [1,2,3,4,5,6,7].map(i=>`<span class="kz-nvc-ball ${i <= lit ? 'lit' : 'off'}"><img src="${ballSrc(i)}" alt="" loading="lazy" decoding="async"></span>`).join('');
    return `<div class="kz-nvc-balls" role="img" aria-label="${kzt('coll.progressoEsferas', { lit })}">${balls}</div>${nvCountHtml(owned, kzt('coll.adquiridosNovo', { total }))}`;
  }
  const balls = [1,2,3,4,5,6,7].map(i=>{
    const on = pct >= i/7 - 1e-9 || (i === 1 && owned > 0);
    return `<img class="${on?'on':'off'}" src="${ballSrc(i)}" alt="">`;
  }).join('');
  return `<div class="kz-coll-balls">${balls}</div><span class="kz-coll-summary">${kzt('coll.adquiridos', { owned, total })}</span>`;
}

const COLL_FILTER_GROUPS = [[kzt('filtro.tipo'),'collectionType',TYPES],[kzt('filtro.afinidade'),'collectionAffinity',AFFINITIES]];

// Coleção no formato do canvas: topo com esferas e contador, uma linha de busca e filtros, grade de 6 cartas.
function renderCollectionTabNovo(){
  const chars = getFilteredCollectionChars();
  const on = !!state.collectionOnlyOwned;
  const chip = (key, v)=>`<button type="button" class="kz-fchip ${state[key]===v?'active':''}" data-cfilter="${key}" data-val="${escapeAttr(v)}" aria-pressed="${state[key]===v}">${key === 'collectionAffinity' ? nvDotHtml(v) : ''}${escapeHtml(kzTermo(v))}</button>`;
  return `
  <section class="kz-page kz-nvp">
    ${nvPageHeadHtml({ key:'collection', kanji:'集', tag:kzt('deco.colecao'), title:kzt('nav.colecao'), kanjiStyle:'left:36%;right:auto;top:-70px;font-size:420px',
      sub:`${kzt('coll.sub')} ${state.discordUser ? kzt('coll.sync') : kzt('coll.local')}`,
      side:`<div class="kz-nvc-counter" id="collCounter">${collCounterInner()}</div>` })}
    <div class="kz-nv-toolbar">
      <div class="kz-nv-search sm"><span class="kz-nv-scan" aria-hidden="true"></span><div>
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFC21A" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>
        <label for="collSearch" class="kz-sr">${kzt('coll.buscarPersonagem')}</label>
        <input type="text" id="collSearch" placeholder="${kzt('coll.buscarPlaceholder')}" value="${escapeAttr(state.collectionSearch||'')}" autocomplete="off">
      </div></div>
      <div class="kz-nv-switchwrap">
        <button type="button" class="kz-nv-switch${on ? ' on' : ''}" id="collOnlyOwned" role="switch" aria-checked="${on}" aria-labelledby="collOnlyOwnedLbl"><span></span></button>
        <span class="kz-nv-lb" id="collOnlyOwnedLbl">${kzt('coll.soAdquiridos')}</span>
      </div>
      ${COLL_FILTER_GROUPS.map(([label,key,vals])=>`<div class="kz-nv-chipgrp"><span class="kz-nv-lb">${label}</span>${vals.map(v=>chip(key, v)).join('')}</div>`).join('')}
      ${renderSF('coll')}
    </div>
    <div id="collGridWrap">${renderCollectionGrid(chars)}</div>
  </section>`;
}
function renderCollectionCardNovo(c){
  const e = getEntry(c.id);
  const owned = !!e.owned, lv = e.level || 0, phase = starPhase(lv), filled = starFilled(lv), pname = STAR_PHASE_NAME[phase];
  const nome = escapeHtml(kzNome(c.name))||kzt('geral.semNome');
  if(!owned) return `
  <div class="kz-coll-card kz-nvc off" data-id="${c.id}">
    <div class="kz-nvc-fr">${portraitInner(c)}<span class="kz-nvc-stamp" aria-hidden="true">封</span></div>
    <div class="kz-nvc-nm">${nome}</div>
    <button type="button" class="kz-btn kz-nvc-acq coll-acquire" data-id="${c.id}">${kzt('coll.adquirir')}</button>
  </div>`;
  const stars = [1,2,3,4,5].map(i=>`<button type="button" class="kz-star-btn ${i<=filled?phase:''}" data-star="${i}" title="${pname} ${i}" aria-label="${pname} ${i}">${i<=filled?'★':'☆'}</button>`).join('');
  const canLR = maxStarLevel(c) > 10;
  const extra = [
    lv === 5 ? `<button type="button" class="kz-awaken-btn" data-awaken>${kzt('coll.despertar')}</button>` : '',
    lv === 10 && canLR ? `<button type="button" class="kz-awaken-btn lr" data-lr-awaken title="${kzt('coll.superDespertarTitulo')}">${kzt('coll.superDespertar')}</button>` : '',
    phase === 'blue' ? `<button type="button" class="kz-gold-back-btn" data-goldback>${kzt('coll.voltarDourada')}</button>` : '',
    phase === 'lr' ? `<button type="button" class="kz-gold-back-btn" data-blueback>${kzt('coll.voltarAzul')}</button>` : '',
  ].join('');
  return `
  <div class="kz-coll-card kz-nvc owned ${phase}" data-id="${c.id}">
    <div class="kz-nvc-fr" data-open-popup title="${kzt('coll.verHabilidadesTitulo')}">${portraitInner(c)}</div>
    <div class="kz-nvc-nm">${nome}</div>
    <div class="kz-coll-stars kz-nvc-st" data-charid="${c.id}" data-phase="${phase}">
      <div class="kz-nvc-strow"><div class="kz-star-btns">${stars}</div><span class="kz-nvc-lv ${phase}">${kzt('coll.nivel', { n: filled, fase: pname })}</span></div>
      ${extra ? `<div class="kz-nvc-extra">${extra}</div>` : ''}
    </div>
    <div class="kz-nvc-acts">
      <button type="button" class="kz-nvc-mini" data-open-popup title="${kzt('coll.liberadasTitulo', { n: collUnlockCount(c, lv) })}">${kzt('coll.verHabilidades')} ›</button>
      <button type="button" class="kz-nvc-rm coll-remove" data-id="${c.id}" title="${kzt('coll.removerTitulo')}" aria-label="${escapeAttr(kzt('coll.removerNome', { nome: kzNome(c.name) }))}">${kzt('coll.remover')}</button>
    </div>
  </div>`;
}
function renderCollectionTab(){
  if(visualNovo()) return renderCollectionTabNovo();
  const chars = getFilteredCollectionChars();
  const on = state.collectionOnlyOwned;
  return `
  <section class="kz-page">
    <div class="kz-page-head">
      <div>
        <h1 class="kz-title">${kzt('nav.colecao')}</h1>
        <div class="kz-subtitle">${kzt('coll.sub')} ${state.discordUser ? kzt('coll.sync') : kzt('coll.local')}</div>
      </div>
      <div class="kz-coll-counter" id="collCounter">${collCounterInner()}</div>
    </div>
    <div class="kz-filter-panel">
      <div class="kz-filter-top">
        <input type="text" class="kz-input" id="collSearch" placeholder="${kzt('coll.buscarPlaceholder')}" value="${escapeAttr(state.collectionSearch||'')}">
        <button class="kz-owned-toggle ${on?'on':''}" id="collOnlyOwned"><span class="box">${on?'✓':''}</span><span>${kzt('coll.soAdquiridos')}</span></button>
      </div>
      ${COLL_FILTER_GROUPS.map(([label,key,vals])=>`
      <div class="kz-filter-row">
        <span class="kz-filter-label">${label}</span>
        ${vals.map(v=>`<button class="kz-fchip ${state[key]===v?'active':''}" data-cfilter="${key}" data-val="${escapeAttr(v)}">${escapeHtml(kzTermo(v))}</button>`).join('')}
      </div>`).join('')}
      ${renderSF('coll')}
    </div>
    <div id="collGridWrap">${renderCollectionGrid(chars)}</div>
  </section>`;
}

function renderCollectionGrid(chars){
  if(visualNovo()) return chars.length
    ? `<div class="kz-nvc-grid">${chars.map(renderCollectionCardNovo).join('')}</div>`
    : `<div class="kz-empty">${kzt('coll.nenhumEncontrado')}</div>`;
  return chars.length
    ? `<div class="kz-coll-grid">${chars.map(renderCollectionCard).join('')}</div>`
    : `<div class="kz-empty">${kzt('coll.nenhumEncontrado')}</div>`;
}

function renderCollectionCard(c){
  const e = getEntry(c.id);
  const owned = !!e.owned, lv = e.level || 0, phase = starPhase(lv), filled = starFilled(lv), pname = STAR_PHASE_NAME[phase];
  const stars = [1,2,3,4,5].map(i=>`<button class="kz-star-btn ${i<=filled?phase:''}" data-star="${i}" title="${pname} ${i}">${i<=filled?'★':'☆'}</button>`).join('');
  const canLR = maxStarLevel(c) > 10;
  return `
  <div class="kz-coll-card ${owned?'owned':''} ${owned&&phase!=='gold'?phase:''}" data-id="${c.id}">
    <div class="kz-coll-art" ${owned?'data-open-popup':''}>
      ${portraitInner(c)}
      ${!owned ? `<div class="kz-coll-seal"><span>封</span></div>` : ''}
      ${owned ? `
      <div class="kz-coll-stars" data-charid="${c.id}" data-phase="${phase}">
        <div class="kz-star-btns">${stars}</div>
        <div class="kz-phase-row">
          <span class="kz-phase-label ${phase}">${kzt('coll.nivel', { n: filled, fase: pname })}</span>
          ${lv === 5 ? `<button class="kz-awaken-btn" data-awaken>${kzt('coll.despertar')}</button>` : ''}
          ${lv === 10 && canLR ? `<button class="kz-awaken-btn lr" data-lr-awaken title="${kzt('coll.superDespertarTitulo')}">${kzt('coll.superDespertar')}</button>` : ''}
          ${phase === 'blue' ? `<button class="kz-gold-back-btn" data-goldback>${kzt('coll.voltarDourada')}</button>` : ''}
          ${phase === 'lr' ? `<button class="kz-gold-back-btn" data-blueback>${kzt('coll.voltarAzul')}</button>` : ''}
        </div>
      </div>` : ''}
    </div>
    <div class="kz-coll-body">
      <div>
        <div class="kz-coll-name">${escapeHtml(kzNome(c.name))||kzt('geral.semNome')}</div>
        <div class="kz-card-meta">${escapeHtml(charMeta(c))}</div>
      </div>
      ${owned ? `
      <div class="kz-coll-actions">
        <button class="kz-see-ab-btn" data-open-popup><span>${kzt('coll.liberadas', { n: collUnlockCount(c, lv) })}</span><span>${kzt('coll.verHabilidades')} ▸</span></button>
        <button class="kz-remove-btn coll-remove" data-id="${c.id}">${kzt('coll.removerTitulo')}</button>
      </div>` : `<button class="kz-acquire-btn coll-acquire" data-id="${c.id}">${kzt('coll.adquirir')}</button>`}
    </div>
  </div>`;
}

function getFilteredCollectionChars(){
  const q = (state.collectionSearch||'').toLowerCase();
  let chars = state.characters.filter(c => !q || charMatchesText(c, q));
  if(state.collectionOnlyOwned) chars = chars.filter(c => getEntry(c.id).owned);
  if(state.collectionType) chars = chars.filter(c => c.type === state.collectionType);
  if(state.collectionAffinity) chars = chars.filter(c => c.affinity === state.collectionAffinity);
  chars = chars.filter(c => matchSF(c, state.sf.coll));
  return sortByRarity(chars);
}

// Liga os cliques de um card (ou da grade toda): adquirir/remover, estrelas, Despertar, popup.
function attachCollectionCardHandlers(root){
  root.querySelectorAll('.coll-acquire').forEach(b=> b.addEventListener('click', ()=> toggleAcquire(b.dataset.id)));
  root.querySelectorAll('.coll-remove').forEach(b=> b.addEventListener('click', ()=> toggleAcquire(b.dataset.id)));
  root.querySelectorAll('[data-open-popup]').forEach(el=>{
    const card = el.closest('.kz-coll-card');
    if(!card) return;
    el.addEventListener('click', e=>{
      if(e.target.closest('.kz-coll-stars')) return;
      openAbilityPopup(card.dataset.id);
    });
  });
  root.querySelectorAll('.kz-coll-stars').forEach(box=>{
    const charId = box.dataset.charid, phase = box.dataset.phase;
    box.querySelectorAll('.kz-star-btn').forEach(star=>{
      star.addEventListener('click', e=>{
        e.stopPropagation();
        const n = parseInt(star.dataset.star, 10);
        setCollectionLevel(charId, phase === 'gold' ? n : phase === 'blue' ? 5 + n : 10 + n);
      });
    });
    const aw = box.querySelector('[data-awaken]');
    if(aw) aw.addEventListener('click', e=>{
      e.stopPropagation();
      aw.disabled = true;
      playAwakenFire(charId, ()=> setCollectionLevel(charId, 6));
    });
    const gb = box.querySelector('[data-goldback]');
    if(gb) gb.addEventListener('click', e=>{ e.stopPropagation(); setCollectionLevel(charId, 5); });
    const lra = box.querySelector('[data-lr-awaken]');
    if(lra) lra.addEventListener('click', e=>{
      e.stopPropagation();
      lra.disabled = true;
      playAwakenFire(charId, ()=> setCollectionLevel(charId, 11));
    });
    const bb = box.querySelector('[data-blueback]');
    if(bb) bb.addEventListener('click', e=>{ e.stopPropagation(); setCollectionLevel(charId, 10); });
  });
}

// Refaz só o card que mudou (e o contador de esferas), sem recarregar os outros 60 retratos.
function updateCollectionCard(charId){
  const view = document.getElementById('view');
  const counter = document.getElementById('collCounter');
  if(counter) counter.innerHTML = collCounterInner();
  const cardEl = view && view.querySelector(`.kz-coll-card[data-id="${charId}"]`);
  const c = getChar(charId);
  if(!view || !cardEl || !c || state.tab !== 'collection'){ render(); return; }
  if(state.collectionOnlyOwned && !getEntry(charId).owned){ softRerenderCollection(); return; }
  const wrap = document.createElement('div');
  wrap.innerHTML = visualNovo() ? renderCollectionCardNovo(c) : renderCollectionCard(c);
  const newCard = wrap.firstElementChild;
  newCard.style.animation = 'none';
  cardEl.replaceWith(newCard);
  attachCollectionCardHandlers(newCard);
}

function attachCollectionHandlers(){
  const view = document.getElementById('view');
  if(!view || state.tab !== 'collection') return;
  const search = document.getElementById('collSearch');
  if(search) search.addEventListener('input', e=>{ state.collectionSearch = e.target.value; softRerenderCollection(); });
  attachSF('coll', view, render);
  const onlyOwned = document.getElementById('collOnlyOwned');
  if(onlyOwned) onlyOwned.addEventListener('click', ()=>{ state.collectionOnlyOwned = !state.collectionOnlyOwned; render(); });
  view.querySelectorAll('.kz-fchip[data-cfilter]').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const key = chip.dataset.cfilter, val = chip.dataset.val;
      state[key] = state[key] === val ? '' : val;
      render();
    });
  });
  attachCollectionCardHandlers(view);
}

function softRerenderCollection(){
  const wrap = document.getElementById('collGridWrap');
  if(!wrap || state.tab !== 'collection') return;
  wrap.innerHTML = renderCollectionGrid(getFilteredCollectionChars());
  attachCollectionCardHandlers(wrap);
}

// Popup com as habilidades por nível — tiers acima do nível atual aparecem bloqueados.
function renderAbilityPopup(charId){
  const root = document.getElementById('modalRoot');
  const c = getChar(charId);
  if(!root || !c) return;
  const lv = getEntry(charId).level || 0;
  const unlocks = getAbilityUnlocks(c.name, lv);
  const body = unlocks ? unlocks.groups.map(g=>`
    <div class="kz-popup-group">
      <span class="kz-label">${escapeHtml(grupoTitulo(g.title))}</span>
      ${g.tiers.map(t=>{
        const locked = !t.unlocked, data = t.data, noData = !data;
        const tipo = tipoText(!noData && data.tipo ? data.tipo : t.fallbackTipo);
        return `
        <div class="kz-popup-row ${locked?'locked':''}">
          <div class="kz-popup-row-head">
            ${textStarsHtml(t.reqLevel)}
            <span class="tipo" style="color:${tipoColor(tipo)};">${escapeHtml(kzTermo(tipo))}</span>
            ${locked ? `<span class="kz-locked-tag">${kzt('coll.bloqueado')}</span>` : ''}
          </div>
          <div class="nm">${noData ? kzt('hab.naoCapturado') : (escapeHtml(kzTrad(data.nome))||'—')}</div>
          <div class="ds">${noData ? kzt('hab.naoExtraido') : escapeHtml(kzTrad(data.desc||''))}</div>
        </div>`;
      }).join('')}
    </div>`).join('') : `<div class="kz-muted">${kzt('hab.semDados')}</div>`;

  root.innerHTML = `
  <div class="modal-overlay" id="abilityPopupOverlay">
    <div class="modal kz-popup" role="dialog" aria-label="${escapeAttr(kzt('coll.habilidadesDe', { nome: kzNome(c.name) }))}">
      <div class="kz-popup-head">
        <div class="kz-popup-art">${portraitInner(c)}</div>
        <div class="kz-popup-title">
          <div class="kz-popup-name">${escapeHtml(kzNome(c.name))}</div>
          <div class="kz-popup-level">${textStarsHtml(lv)}<span class="lbl">${lv ? reqLabelText(lv) : kzt('coll.semEstrelas')}</span></div>
        </div>
        <button class="kz-close-btn" id="closeAbilityPopupBtn" aria-label="${kzt('comum.fechar')}">✕</button>
      </div>
      <div class="kz-popup-body">${body}</div>
    </div>
  </div>`;

  document.getElementById('closeAbilityPopupBtn').addEventListener('click', closeAbilityPopup);
  document.getElementById('abilityPopupOverlay').addEventListener('click', e=>{ if(e.target.id==='abilityPopupOverlay') closeAbilityPopup(); });
}
function openAbilityPopup(charId){ state.abilityPopupCharId = charId; render(); }
function closeAbilityPopup(){ state.abilityPopupCharId = null; render(); }

// Ícones reais do jogo (pasta ability-icons/, organizada por personagem); o "?" só aparece se o dado não tiver ícone.
const SHOW_ABILITY_ICONS = true;

/* ======================= TIER LIST ======================= */
function renderTierItem(c){
  return `<div class="tier-item" draggable="true" data-id="${c.id}" title="${escapeAttr(kzNome(c.name))}">${portraitInner(c)}</div>`;
}
function renderTierRow(t, i, all){
  const chars = t.items.map(getChar).filter(Boolean);
  const n = (all || state.tierList.tiers).length;
  return `
  <div class="tier-row" data-tier-row="${t.id}">
    <div class="tier-label" contenteditable="true" spellcheck="false" lang="${KZ_LANG === 'en' ? 'en' : 'pt-BR'}" data-tier="${t.id}" style="${visualNovo() ? `--tc:${t.color}` : `background:${t.color}`};">${escapeHtml(t.label)}</div>
    <div class="tier-items" data-tier="${t.id}">${chars.map(renderTierItem).join('')}</div>
    <div class="tier-ctrl">
      <span class="tier-handle" draggable="true" data-tier="${t.id}" title="${kzt('tier.reordenarTitulo')}" aria-label="${kzt('tier.reordenar')}">⋮⋮</span>
      <button class="tier-move-btn" data-tier="${t.id}" data-dir="-1" title="${kzt('tier.subir')}" ${i===0?'disabled':''}>▲</button>
      <button class="tier-move-btn" data-tier="${t.id}" data-dir="1" title="${kzt('tier.descer')}" ${i===n-1?'disabled':''}>▼</button>
      <button class="tier-remove-btn" data-tier="${t.id}" title="${kzt('tier.remover')}">✕</button>
    </div>
  </div>`;
}
// Tier List no formato do canvas: topo novo, ranks com degradê e raios na cor de cada rank, controles em coluna,
// "+ Adicionar rank" largo e o bloco "Sem tier". Mantém os ids/data-* que attachTierListHandlers usa.
function renderTierListTabNovo(){
  const unrankedChars = (state.tierList.unranked||[]).map(getChar).filter(Boolean);
  const dl = `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>`;
  return `
  <section class="kz-page kz-nvp kz-nvt">
    ${nvPageHeadHtml({ key:'tierlist', kanji:'番', tag:kzt('deco.tierlist'), title:kzt('nav.tierlist'), kanjiStyle:'right:22%;top:-60px;font-size:380px',
      sub:`${kzt('tier.subNovo')} ${state.discordUser ? kzt('coll.sync') : kzt('coll.local')}`,
      side:`<button class="kz-btn" id="tierSuggestBtn">${kzt('tier.sugestao')}</button><button class="kz-btn" id="tierListResetBtn">${kzt('tier.esvaziar')}</button><button class="kz-btn kz-btn-primary" id="tierListExportBtn">${dl}${kzt('tier.exportar')}</button>` })}
    <div class="kz-tier-rows">${state.tierList.tiers.map((t,i,a)=>renderTierRow(t,i,a)).join('')}</div>
    <button class="kz-btn kz-nvt-add" id="tierAddBtn">${kzt('tier.adicionarRank')}</button>
    <div class="tier-pool">
      <div class="kz-nvt-poolhead"><span class="kz-label">${kzt('tier.semTier', { n: unrankedChars.length })}</span><span class="kz-nvt-hint">${kzt('tier.arrasteDaqui')}</span></div>
      <div class="tier-pool-items" data-tier="unranked">${unrankedChars.map(renderTierItem).join('')}</div>
    </div>
  </section>`;
}
function renderTierListTab(){
  if(visualNovo()) return renderTierListTabNovo();
  const unrankedChars = (state.tierList.unranked||[]).map(getChar).filter(Boolean);
  return `
  <section class="kz-page">
    <div class="kz-page-head">
      <div>
        <h1 class="kz-title">${kzt('nav.tierlist')}</h1>
        <div class="kz-subtitle">${kzt('tier.subAntigo')}</div>
      </div>
      <div class="kz-head-actions">
        <button class="kz-btn" id="tierSuggestBtn">${kzt('tier.sugestao')}</button>
        <button class="kz-btn" id="tierListResetBtn">${kzt('tier.esvaziar')}</button>
        <button class="kz-btn" id="tierListExportBtn">${kzt('tier.exportar')}</button>
      </div>
    </div>
    <div class="kz-tier-rows">${state.tierList.tiers.map((t,i,a)=>renderTierRow(t,i,a)).join('')}</div>
    <button class="kz-btn kz-btn-sm" id="tierAddBtn" style="align-self:flex-start;">${kzt('tier.adicionarRank')}</button>
    <div class="tier-pool">
      <span class="kz-label">${kzt('tier.semTier', { n: unrankedChars.length })}</span>
      <div class="tier-pool-items" data-tier="unranked">${unrankedChars.map(renderTierItem).join('')}</div>
    </div>
  </section>`;
}

// Reagrupa pela raridade: Ultimate/Lendário/Limitado → 1º rank, SSR → 2º, SR → 3º, R → 4º
// (limitado ao número de ranks que existirem).
function suggestTierListByRarity(){
  if(!state.tierList.tiers.length) state.tierList = makeDefaultTierList();
  const tiers = state.tierList.tiers;
  tiers.forEach(t=>{ t.items = []; });
  sortByRarity(state.characters).forEach(c=>{
    const r = rarityRank(c.rarity);
    const idx = Math.min(r <= 2 ? 0 : r - 2, tiers.length - 1);
    tiers[idx].items.push(c.id);
  });
  state.tierList.unranked = [];
  saveTierList();
}

// Encolhe a fonte do nome do rank até caber na altura mínima da fileira, medindo numa
// "sonda" fora da tela (o label real é esticado pelo flex, então o scrollHeight dele não serve).
const TIER_LABEL_MAX_HEIGHT = 124;
const TIER_LABEL_MAX_FONT = 54;
const TIER_LABEL_MIN_FONT = 12;
// Acha o maior tamanho de fonte em que o nome do rank cabe na fileira: texto curto cresce, texto
// longo diminui. Só quebra linha entre palavras (sem cortar palavra no meio nem hifenizar); só se
// uma única palavra não couber nem no tamanho mínimo é que ela é quebrada, como último recurso.
// Mede numa "sonda" fora da tela (o label real é esticado pelo flex, então o scrollHeight dele não serve).
function fitTierLabelFont(el){
  const probe = document.createElement('div');
  probe.lang = KZ_LANG === 'en' ? 'en' : 'pt-BR';
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;'
    + `width:${el.offsetWidth || 130}px;padding:8px 10px;box-sizing:border-box;`
    + "font-family:'Kaushan Script',cursive;line-height:1.1;"
    + 'overflow-wrap:normal;word-break:normal;hyphens:none;text-align:center;';
  probe.textContent = el.textContent || '?';
  document.body.appendChild(probe);
  // largura útil (sem o padding) e a palavra mais larga medida no canvas, que é exato (o scrollWidth da sonda deixa passar estouro de 1 palavra)
  const cs = getComputedStyle(el);
  const contentW = (el.offsetWidth || 130) - (parseFloat(cs.paddingLeft) || 10) - (parseFloat(cs.paddingRight) || 10);
  const words = (el.textContent || '?').split(/\s+/).filter(Boolean);
  const mctx = document.createElement('canvas').getContext('2d');
  const widestWord = size => { mctx.font = `${size}px 'Kaushan Script', cursive`; return Math.max(0, ...words.map(wd=>mctx.measureText(wd).width)); };
  const fits = ()=> probe.scrollHeight <= TIER_LABEL_MAX_HEIGHT && widestWord(fontSize) <= contentW - 1;
  let fontSize = visualNovo() ? 84 : TIER_LABEL_MAX_FONT;   // visual novo: letra grande como no canvas
  probe.style.fontSize = fontSize + 'px';
  while(!fits() && fontSize > TIER_LABEL_MIN_FONT){
    fontSize -= 1;
    probe.style.fontSize = fontSize + 'px';
  }
  const wordTooWide = widestWord(fontSize) > contentW - 1;
  document.body.removeChild(probe);
  el.style.fontSize = fontSize + 'px';
  el.style.overflowWrap = wordTooWide ? 'anywhere' : 'normal';
}

function attachTierListHandlers(){
  const view = document.getElementById('view');
  if(!view || state.tab !== 'tierlist') return;

  view.querySelectorAll('.tier-item').forEach(item=>{
    item.addEventListener('dragstart', e=>{
      dragTierItemId = item.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragTierItemId);
      requestAnimationFrame(()=>item.classList.add('dragging'));
    });
    item.addEventListener('dragend', ()=>{
      dragTierItemId = null;
      render();
    });
  });

  view.querySelectorAll('.tier-items, .tier-pool-items').forEach(zone=>{
    zone.addEventListener('dragover', e=>{
      if(dragTierItemId===null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', ()=> zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e=>{
      e.preventDefault();
      zone.classList.remove('drag-over');
      if(dragTierItemId===null) return;
      moveTierItem(dragTierItemId, zone.dataset.tier);
    });
  });

  // Nome do rank é editado direto no label colorido (contenteditable) — salva ao sair
  // do campo, sem re-render (senão perde o foco/cursor no meio da digitação).
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ view.querySelectorAll('.tier-label[contenteditable]').forEach(fitTierLabelFont); });
  view.querySelectorAll('.tier-label[contenteditable]').forEach(el=>{
    fitTierLabelFont(el);
    el.addEventListener('input', ()=> fitTierLabelFont(el));
    el.addEventListener('blur', ()=> renameTier(el.dataset.tier, el.textContent.trim()));
    el.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); el.blur(); } });
  });

  view.querySelectorAll('.tier-remove-btn').forEach(btn=> btn.addEventListener('click', ()=> removeTier(btn.dataset.tier)));
  view.querySelectorAll('.tier-move-btn').forEach(btn=> btn.addEventListener('click', ()=> moveTierBy(btn.dataset.tier, parseInt(btn.dataset.dir, 10))));

  // Reordenar ranks arrastando pela alça ⋮⋮: a linha de destaque mostra se entra antes ou depois.
  const clearRowMarks = ()=> view.querySelectorAll('.tier-row').forEach(r=>r.classList.remove('drop-before','drop-after','row-dragging'));
  view.querySelectorAll('.tier-handle').forEach(handle=>{
    const row = handle.closest('.tier-row');
    handle.addEventListener('dragstart', e=>{
      dragTierRowId = handle.dataset.tier;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'tier:' + dragTierRowId);
      try{ e.dataTransfer.setDragImage(row, 40, 30); }catch(_){}
      requestAnimationFrame(()=> row.classList.add('row-dragging'));
    });
    handle.addEventListener('dragend', ()=>{ dragTierRowId = null; clearRowMarks(); });
  });
  view.querySelectorAll('.tier-row').forEach(row=>{
    const isAfter = e=>{ const r = row.getBoundingClientRect(); return e.clientY > r.top + r.height / 2; };
    row.addEventListener('dragover', e=>{
      if(dragTierRowId === null || row.dataset.tierRow === dragTierRowId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const after = isAfter(e);
      row.classList.toggle('drop-after', after);
      row.classList.toggle('drop-before', !after);
    });
    row.addEventListener('dragleave', e=>{ if(!row.contains(e.relatedTarget)) row.classList.remove('drop-before','drop-after'); });
    row.addEventListener('drop', e=>{
      if(dragTierRowId === null) return;
      e.preventDefault();
      const id = dragTierRowId, after = isAfter(e);
      dragTierRowId = null;
      clearRowMarks();
      moveTierRow(id, row.dataset.tierRow, after);
    });
  });

  const addBtn = document.getElementById('tierAddBtn');
  if(addBtn) addBtn.addEventListener('click', addTier);

  const suggestBtn = document.getElementById('tierSuggestBtn');
  if(suggestBtn) suggestBtn.addEventListener('click', ()=>{
    customConfirm(kzt('tier.sugestaoConfirma'), ()=>{
      suggestTierListByRarity();
      render();
    });
  });

  const resetBtn = document.getElementById('tierListResetBtn');
  if(resetBtn) resetBtn.addEventListener('click', ()=>{
    customConfirm(kzt('tier.esvaziarConfirma'), ()=>{
      state.tierList.tiers.forEach(t=>{ t.items = []; });
      state.tierList.unranked = state.characters.map(c=>c.id);
      saveTierList();
      render();
    });
  });

  const exportBtn = document.getElementById('tierListExportBtn');
  if(exportBtn) exportBtn.addEventListener('click', exportTierListImage);
}

// Desenha um texto centralizado, quebrando linha se passar de maxWidth (canvas não quebra sozinho).
function wrapCanvasText(ctx, text, cx, cy, maxWidth, lineHeight){
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach(w=>{
    const test = line ? line + ' ' + w : w;
    if(line && ctx.measureText(test).width > maxWidth){
      lines.push(line);
      line = w;
    } else line = test;
  });
  if(line) lines.push(line);
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i)=> ctx.fillText(l, cx, startY + i * lineHeight));
}

// Escolhe o maior tamanho de fonte (12–40px) em que o nome do rank cabe sem cortar palavra:
// quebra só entre palavras e confere largura e altura. Devolve a fonte e as linhas.
function fitCanvasLabel(ctx, text, maxW, maxH, maxSize, minSize){
  maxSize = maxSize || 40; minSize = minSize || 12;
  const words = String(text).split(/s+/).filter(Boolean);
  for(let size = maxSize; size >= minSize; size--){
    ctx.font = `${size}px 'Kaushan Script', cursive`;
    const lines = []; let line = '';
    words.forEach(w=>{
      const test = line ? line + ' ' + w : w;
      if(line && ctx.measureText(test).width > maxW){ lines.push(line); line = w; } else line = test;
    });
    if(line) lines.push(line);
    const lh = Math.round(size * 1.1);
    const widest = Math.max(...lines.map(l=>ctx.measureText(l).width), 0);
    if(widest <= maxW && lines.length * lh <= maxH) return { font: ctx.font, lines, lineHeight: lh };
  }
  ctx.font = `${minSize}px 'Kaushan Script', cursive`;
  return { font: ctx.font, lines: words.length ? words : ['?'], lineHeight: Math.round(minSize * 1.15) };
}

// Exporta a tier list como PNG. Abrindo o arquivo direto do disco o navegador pode bloquear
// a leitura das artes (canvas "tainted") — aí avisa em vez de falhar quieto.
// Reduz a arte em etapas (metade por vez) antes do desenho final: os retratos têm ~1000px e vão
// pra ~190px, e um único passo grande fica serrilhado/borrado.
function downscaleImage(img, w, h){
  let cur = img, cw = img.naturalWidth || img.width, ch = img.naturalHeight || img.height;
  while(cw / 2 > w && ch / 2 > h){
    const step = document.createElement('canvas');
    cw = Math.max(w, Math.round(cw / 2)); ch = Math.max(h, Math.round(ch / 2));
    step.width = cw; step.height = ch;
    const sctx = step.getContext('2d');
    sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(cur, 0, 0, cw, ch);
    cur = step;
  }
  return cur;
}

// Exporta a tier list como PNG em alta resolução (3×: 3000px de largura, retratos reamostrados com
// qualidade). Abrindo o arquivo direto do disco o navegador pode bloquear a leitura das artes
// (canvas "tainted") — aí avisa em vez de falhar quieto.
async function exportTierListImage(){
  const S = 3;                                   // fator de resolução
  const ITEM_W = 64*S, ITEM_H = Math.round(ITEM_W * 4/3), GAP = 6*S, LABEL_W = 110*S, PADDING = 14*S;
  const canvasWidth = 1000*S;
  const itemsPerRow = Math.max(1, Math.floor((canvasWidth - LABEL_W - PADDING*2 - GAP) / (ITEM_W + GAP)));
  showToast(kzt('tier.gerando'));

  try{ if(document.fonts && document.fonts.load) await document.fonts.load("40px 'Kaushan Script'"); }catch(e){}

  const usedIds = state.tierList.tiers.flatMap(t=>t.items);
  const chars = usedIds.map(getChar).filter(Boolean);
  const imgCache = {};
  await Promise.all(chars.map(c=>new Promise(resolve=>{
    const img = new Image();
    img.onload = ()=>{ imgCache[c.id] = img; resolve(); };
    img.onerror = ()=>{ imgCache[c.id] = null; resolve(); };
    img.src = portraitSrc(c);
  })));

  function rowHeight(count){
    const rows = Math.max(1, Math.ceil(count / itemsPerRow));
    return Math.max(rows * (ITEM_H + GAP) + GAP, ITEM_H + GAP*2);
  }
  let totalHeight = PADDING;
  state.tierList.tiers.forEach(t=>{ totalHeight += rowHeight(t.items.length); });
  totalHeight += PADDING;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = Math.max(totalHeight, 120*S);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = PADDING;
  state.tierList.tiers.forEach(t=>{
    const h = rowHeight(t.items.length);
    ctx.fillStyle = t.color;
    ctx.fillRect(PADDING, y, LABEL_W, h);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fit = fitCanvasLabel(ctx, t.label || '?', LABEL_W - 14*S, h - 10*S, 54*S, 12*S);
    ctx.font = fit.font;
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowOffsetY = 2*S; ctx.shadowBlur = 0;
    fit.lines.forEach((l, li)=> ctx.fillText(l, PADDING + LABEL_W/2, y + h/2 - ((fit.lines.length - 1) * fit.lineHeight) / 2 + li * fit.lineHeight));
    ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#0e0c16';
    ctx.fillRect(PADDING + LABEL_W, y, canvasWidth - PADDING*2 - LABEL_W, h);
    ctx.fillStyle = 'rgba(255,150,50,.25)';
    ctx.fillRect(PADDING, y + h - S, canvasWidth - PADDING*2, S);

    t.items.forEach((id, i)=>{
      const col = i % itemsPerRow, row = Math.floor(i / itemsPerRow);
      const x = PADDING + LABEL_W + GAP + col * (ITEM_W + GAP);
      const iy = y + GAP + row * (ITEM_H + GAP);
      const img = imgCache[id];
      const c = getChar(id);
      if(img){
        // mantém a proporção da arte dentro do quadro do card
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        const k = Math.min(ITEM_W / iw, ITEM_H / ih);
        const dw = Math.round(iw * k), dh = Math.round(ih * k);
        ctx.drawImage(downscaleImage(img, dw, dh), x + Math.round((ITEM_W - dw) / 2), iy + Math.round((ITEM_H - dh) / 2), dw, dh);
      } else {
        ctx.fillStyle = '#2a1d3a';
        ctx.fillRect(x, iy, ITEM_W, ITEM_H);
        ctx.fillStyle = '#fff3da';
        ctx.font = `${13*S}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials(c ? c.name : '?'), x + ITEM_W/2, iy + ITEM_H/2);
      }
    });
    y += h;
  });

  try{
    const blob = await new Promise((res, rej)=> canvas.toBlob(b=> b ? res(b) : rej(new Error('sem blob')), 'image/png'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tier-list-zenkyo.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 10000);
    showToast(kzt('tier.imagemSalva', { w: canvas.width, h: canvas.height }));
  }catch(e){
    showToast(kzt('tier.erroImagem'));
  }
}

/* ======================= PAPÉIS EM BATALHA + MONTAGEM AUTOMÁTICA ======================= */
// Lê o texto das habilidades (Habilidade, Suprema, passiva única, passivas do Supremo e ★4) e classifica o
// guerreiro em papéis. É uma leitura automática por palavras-chave — serve de guia, não de verdade absoluta.
const ROLE_ORDER = ['dano','dot','tank','sobrevivencia','cura','suporte','controle'];
const ROLE_INFO = {
  dano:     { label:kzt('papel.dano'),          full:kzt('papel.danoFull'), glyph:'攻', rgb:['192,57,43','#ef8b7f'],  pillar:'dano',     thr:7,
    about:kzt('sobre.dano') },
  dot:      { label:kzt('papel.dot'), full:kzt('papel.dot'),    glyph:'炎', rgb:['217,123,42','#f0a05f'], pillar:'dano',     thr:4,
    about:kzt('sobre.dot') },
  tank:     { label:kzt('papel.tank'),          full:kzt('papel.tank'),             glyph:'守', rgb:['59,130,196','#86c0f0'], pillar:'tank',     thr:8,
    about:kzt('sobre.tank') },
  sobrevivencia: { label:kzt('papel.sobrevivencia'), full:kzt('papel.sobrevivencia'), glyph:'生', rgb:['46,170,140','#7fe0c8'], pillar:'tank', thr:2,
    about:kzt('sobre.sobrevivencia') },
  cura:     { label:kzt('papel.cura'),          full:kzt('papel.curaFull'),       glyph:'癒', rgb:['63,174,90','#86e3a2'],  pillar:'suporte',  thr:3,
    about:kzt('sobre.cura') },
  suporte:  { label:kzt('papel.suporte'),       full:kzt('papel.suporte'),          glyph:'援', rgb:['201,162,55','#e8cf6f'], pillar:'suporte',  thr:4,
    about:kzt('sobre.suporte') },
  controle: { label:kzt('papel.controle'),      full:kzt('papel.controle'),         glyph:'縛', rgb:['139,95,191','#c3aaf0'], pillar:'controle', thr:4,
    about:kzt('sobre.controle') },
};
// Um time equilibrado cobre quatro frentes (alvos pensados para 6 guerreiros).
const PILLARS = {
  dano:     { label:kzt('papel.dano'),     target:2,   weight:0.30, cap:4 },
  tank:     { label:kzt('papel.tank'),     target:1.5, weight:0.30, cap:3 },
  suporte:  { label:kzt('papel.suporte'),  target:1,   weight:0.25, cap:3 },
  controle: { label:kzt('papel.controle'), target:1,   weight:0.15, cap:3 },
};
const PILLAR_ORDER = ['dano','tank','suporte','controle'];
const ROLE_WEIGHTS = [1, 0.6, 0.4];           // principal, secundário, terciário
// Correções à mão (nome do guerreiro → papéis, do principal pro último) caso a leitura automática erre.
const ROLE_OVERRIDES = {};

const RB_VERB = '(aumenta|concede|ganha|ganham|recupera|restaura|fornece|adiciona|aplica|protege|recebem|libera|garante|d[aá]|empresta|reduz o custo)';
const RB_STAT = '(atq|ataque|def|defesa|f[uú]ria|raiva|dano|redu[cç][aã]o|cr[ií]t|vel|esquiv|escudo|ki\\b|resist|bloque|pv|vida|cura)';
// [papel, regex, alvo exigido ('aliado'|'proprio'|'inimigo'|null), peso, exclusão]
const ROLE_RULES = [
  ['dano', /dano adicional|dano extra|\+\s?\d+(,\d+)?% (de )?dano|aumenta[^.]*\bdano\b|dano (aumenta|escala)|dano de (habilidade|supremo|sequência|ataque)|maior o dano|maior dano|taxa de cr[ií]t|dano cr[ií]t|intensidade de cr[ií]t|multiplica/, null, 1, /redu[cç][aã]o de dano|dano recebido|reduz[^.]*dano|dano sofrido|menos dano/],
  ['dano', /(aumenta|\+\s?\d+(,\d+)?%|ganha)[^.]*\b(atq|ataque)\b/, 'proprio', 1, /reduz|dano recebido/],
  ['dano', /ataca (todos|uma fileira|uma coluna|toda)|todos os inimigos|coluna de inimigos|fileira de inimigos|fileira da frente|linha frontal|dano em [aá]rea/, null, 0.8],
  ['dano', /ignora (a )?(defesa|def)|penetra|perfura|quebra de defesa/, null, 1],

  ['tank', /redu[cç][aã]o de dano|dano recebido|dano sofrido|bloque|imun[ei]|reflex|contra-?ataque|esquiva|invulner|(aumenta|\+|ganha)[^.]*\b(def|defesa|pv|vida)\b/, 'proprio', 1, /inimig|do alvo|dos alvos|reduz|roubo de vida/],
  ['tank', /protege (os )?aliad|absorve[^.,]*\bdo dano\b|assume o dano|provoc|cobre aliad|divide o dano|compartilh/, null, 2.5, /do alvo|dos alvos|adicional/],
  ['tank', /escudo/, null, 1, /remove|dissip|quebra|quebrador|quebram|destr/],
  ['sobrevivencia', /recupera[^.]*(vida|pv)|restaura[^.]*(vida|pv)|vida por turno|\bregenera|roubo de vida|absor[cç][aã]o de vida|dano[^.]*em vida|vampir/, null, 2, /aliad|equipe|recebid/],

  ['cura', /\bcura (todos|os |a |aos|as |2 |1 |um |uma |o guerreiro|a equipe|toda)|aplica cura|restaura (pv|vida)[^.]*(aliad|equipe|guerreiros|menor)|restaura pv para|recupera a vida d[oa][^.]*alia|converte[^.]*dano em vida[^.]*(fileira|aliad|equipe)|efeito de cura aumentado|recupera [^.]*(pv|vida) d[eo] (todos|\d)/, null, 3, /cura recebida|reduz[^.]*cura|efeito de cura (reduz|diminui)/],
  ['cura', /revive|reanima|ressuscita/, 'aliado', 2],

  ['suporte', new RegExp(RB_VERB + '[^.]*' + RB_STAT + '[^.]*alia|' + RB_VERB + '[^.]*alia[^.]*' + RB_STAT + '|(f[uú]ria|raiva)[^.]*(1 guerreiro|um guerreiro|2 guerreiros|aleat)[^.]*alia|aumenta aleatoriamente[^.]*(f[uú]ria|raiva)|alia[^.]*(ganham|recebem)'), 'aliado', 1.5, /reduz[^.]*(alvo|inimig)|derrotad|morr|abatid/],
  ['suporte', /remove[^.]*(efeitos negativos|debuff|anormal)|dissipa os efeitos de \[controle\]|purifica|concede \[|refor[cç]o/, 'aliado', 1],
  ['suporte', /guardi[aã]o|prote[cç][aã]o\][^.]*assum|assum[a-z]*[^.]*\bdano\b|protege[^.]*alia|alia[^.]*recebem[^.]*\bdano\b|compartilh[^.]*\bdano\b/, null, 3, /imun|inimig/],
  ['suporte', /imun[ie]|imunidade|invulner/, 'aliado', 1.5, /inimig|alvo|reduz|\bpr[oó]pri/],

  ['controle', /atordo|sil[eê]ncio|silencia|paralis|petrific|confus|imobiliza|enraiz|encant|cegueira|pesadelo|supress[aã]o de supremo|\[suprimir\]|congel|adormec|\bmedo\b/, 'inimigo', 2, /imun|resist|res\. anormal|remove|dissip|purific|contra alvos|em alvos|alvos (em|com|sob)|estado de|sob controle|se acertar|aumenta para|alvo de|taxa de (resist|res)|ao morrer/],
  ['controle', /(reduz|diminui|drena|rouba|zera|corta|reduzindo)[^.]*(f[uú]ria|raiva)|(f[uú]ria|raiva) d[oe]s? (alvo|inimig)[^.]*(reduz|-\s?\d)|desacelera|reduz a velocidade|recupera[cç][aã]o de (f[uú]ria|raiva)[^.]*(reduz|-)/, 'inimigo', 1.5, /recupera \d+ (de )?(f|r)|pr[oó]pria? (f[uú]ria|raiva)|rouba[^.]*pr[oó]pria/],

  ['controle', /(reduz|diminui|-\s?\d+(,\d+)?%|drena|reduzindo)[^.]*(atq|ataque|\bdef|defesa|redu[cç][aã]o de dano|cura|taxa de cr|velocidade|vel\b|dano d[eo]|taxa de dano|resist)/, 'inimigo', 1.5, /pr[oó]pri|dano recebido|reduz[^.]*dano (sofrido|recebido)/],
  ['controle', /inflige \[(julgamento|marca|enfraquec|vulnerab)|amaldi[cç]o|enfraquece|vulnerab|\[suprimir\]|repress[aã]o/, null, 1.5],

  ['dot', /queima|sangr|veneno|envenen|corro|dano cont[ií]nuo|a cada turno[^.]*dano|no in[ií]cio de cada turno[^.]*(dano|causa)|chamas? (azul|azuis|extintora)/, 'inimigo', 2, /imun|resist|remove|dissip|\breduz\b[^.]*queima|aliad|pr[oó]pri|contra alvos|em alvos|alvos (em|com)|absorve/],
];
const ROLE_CC_WEIGHT = 2;   // peso da regra de efeito de controle (atordoamento, silêncio...) — cai pela metade com chance baixa
const ROLE_TEXT_CAP = 6;   // um mesmo texto não pode pesar mais que isso num papel
// Sobrevivência: entra quem REVIVE (ou sobrevive à morte) ou tem pelo menos 2 habilidades/passivas de autocura (cura própria ou roubo de vida).
const SURV_REVIVE = /\brevive\b|renasc|ressurge|ressuscit|volta à vida|sobreviv|n[aã]o morre|imortal/;
const SURV_MIN_ABILITIES = 2;

// Textos que valem pra classificação: a versão mais evoluída de cada habilidade.
function roleTexts(c){
  const p = ABILITY_PROGRESSION[c.name];
  const out = [];
  const add = o => { if(o && typeof o.desc === 'string') out.push(o.desc); else if(typeof o === 'string') out.push(o); };
  if(p){
    if(p.habilidade) add(p.habilidade.max || p.habilidade.base);
    if(p.suprema) add(p.suprema.smax || p.suprema.max || p.suprema.base);
    if(p.passivaUnica) add(p.passivaUnica.max || p.passivaUnica.base);
    (p.passivasSupremo || []).forEach(add);
    if(p.passivaQuatroEstrelas) add(p.passivaQuatroEstrelas.max || p.passivaQuatroEstrelas.base || p.passivaQuatroEstrelas);
  } else {
    [c.skill, c.supreme].forEach(a => a && a.desc && out.push(a.desc));
  }
  return out;
}
function roleDamageMult(c){
  const p = ABILITY_PROGRESSION[c.name];
  if(!p) return 0;
  const pick = o => o && o.dano;
  const arr = [pick(p.habilidade && (p.habilidade.max || p.habilidade.base)), pick(p.suprema && (p.suprema.smax || p.suprema.max || p.suprema.base))];
  return arr.map(s => parseFloat(String(s || '').replace(',', '.'))).filter(n => !isNaN(n)).reduce((a, b) => a + b, 0);
}
function roleClauses(t){
  return t.replace(/\[[^\]]*\]/g, m => m.replace(/\./g, '')).split(/[.;]|\n|\s—\s/).map(s => s.trim()).filter(Boolean);
}
// Tira a condição ("quando X morre,", "se houver Y:", "para cada Z,") pra olhar só o que a habilidade FAZ e em quem.
function roleMainPart(s){
  if(/^(quando|se |caso|para cada|sempre que|ao |após|enquanto|no in[ií]cio|a cada|com |sem |início|fim|[\[(]?passiva)/.test(s)){
    const m = s.match(/[,:]\s*(.{12,})$/);
    if(m) return m[1];
  }
  return s;
}
function roleTarget(s){
  const t = {
    aliado: /aliad|equipe|retaguarda aliada|\ba si\b|time/.test(s),
    proprio: /pr[oó]pri|\ba si\b|si mesm|\bganha\b|\brecebe\b|\bentra\b/.test(s),
    inimigo: /inimig|alvo|oponent|\binflige\b|causa \[/.test(s),
  };
  if(!t.aliado && !t.inimigo) t.proprio = true;
  return t;
}
const _roleCache = new Map();
function analyzeRoles(c){
  const key = [c.id, c.name, c.type, c.skill && c.skill.desc, c.supreme && c.supreme.desc].join('|');
  const hit = _roleCache.get(key);
  if(hit) return hit;
  const score = {}, why = {};
  ROLE_ORDER.forEach(r => { score[r] = 0; why[r] = []; });
  let reviveHit = false, survTexts = 0;
  roleTexts(c).forEach(txt => {
    const tscore = {};
    // golpe em área (todos os inimigos, fileira, coluna, "de cada inimigo"): a chance vale pra cada alvo, então não é "chance baixa"
    const aoe = /ataca (todos|uma fileira|uma coluna|toda)|todos os inimigos|de cada inimigo|fileira de inimigos|coluna de inimigos|fileira inimiga|coluna inimiga/i.test(txt);
    roleClauses(txt).forEach(raw => {
      _roleEvSrc.set(raw, txt);
      const cl = roleMainPart(raw.toLowerCase());
      const tg = roleTarget(cl);
      const chm = cl.match(/(\d+(?:,\d+)?)% de chance/);
      const lowChance = !!chm && !aoe && parseFloat(chm[1].replace(',', '.')) < 40;
      const best = {};
      ROLE_RULES.forEach(([role, re, need, w, ex]) => {
        if(!re.test(cl)) return;
        if(ex && ex.test(cl)) return;
        if(need && !tg[need]) return;
        const ww = (role === 'controle' && w === ROLE_CC_WEIGHT && lowChance) ? w / 2 : w;
        if(!best[role] || ww > best[role]) best[role] = ww;
      });
      if(SURV_REVIVE.test(cl) && !/aliad|equipe|inimig/.test(cl)){ reviveHit = true; if(why.sobrevivencia.length < 3) why.sobrevivencia.push(raw); }
      Object.keys(best).forEach(role => {
        tscore[role] = (tscore[role] || 0) + best[role];
        if(why[role].length < 3) why[role].push(raw);
      });
    });
    if(tscore.sobrevivencia) survTexts++;
    Object.keys(tscore).forEach(r => { if(r !== 'sobrevivencia') score[r] += Math.min(ROLE_TEXT_CAP, tscore[r]); });
  });
  score.sobrevivencia = reviveHit ? Math.max(ROLE_INFO.sobrevivencia.thr, survTexts) : (survTexts >= SURV_MIN_ABILITIES ? survTexts : 0);
  const mult = roleDamageMult(c);
  if(mult) score.dano += Math.max(0, Math.min(4, (mult - 350) / 80));
  if(c.type === 'Ataque') score.dano += 2;
  if(c.type === 'Ataque') score.tank *= 0.75;
  if(c.type === 'Defesa') score.tank += 2;
  if(c.type === 'Habilidade'){ score.suporte += 0.8; score.controle += 0.4; }

  // Sobrevivência (autocura, roubo de vida, reviver) aparece em muita gente: entra sempre como complemento, nunca como papel principal.
  const norm = r => score[r] / ROLE_INFO[r].thr;
  const list = ROLE_ORDER.filter(r => r !== 'sobrevivencia').map(r => [r, norm(r)]).sort((a, b) => b[1] - a[1]);
  // Dano Contínuo é marca registrada: se o guerreiro aplica sangramento/queimadura/veneno de verdade, entra mesmo que o dano dele seja bem maior
  let keep = list.filter(([r, n], i) => n >= 1 && (i === 0 || n >= list[0][1] * 0.55 || r === 'dot')).slice(0, 3).map(x => x[0]);
  if(!keep.length) keep = [list[0][0]];
  if(norm('sobrevivencia') >= 1) keep = keep.slice(0, 3).concat('sobrevivencia');
  const ov = ROLE_OVERRIDES[c.name];
  if(ov && ov.length) keep = ov.slice(0, 3);
  const pillars = { dano:0, tank:0, suporte:0, controle:0 };
  keep.forEach((r, i) => { pillars[ROLE_INFO[r].pillar] += ROLE_WEIGHTS[i] || 0.3; });
  const res = { roles: keep, primary: keep[0], score, why, pillars };
  _roleCache.set(key, res);
  return res;
}
function rolesOf(c){ return analyzeRoles(c).roles; }

function rolePillHtml(role, small){
  const info = ROLE_INFO[role], r = info.rgb;
  return `<span class="kz-role${small ? ' sm' : ''}" style="background:linear-gradient(rgba(${r[0]},.22),rgba(${r[0]},.22)),#0c0a14;color:${r[1]};border-color:rgba(${r[0]},.65);" title="${escapeAttr(info.full + ' — ' + info.about)}"><span class="g">${info.glyph}</span>${escapeHtml(info.label)}</span>`;
}
function rolePillsHtml(c, max, small){
  return rolesOf(c).slice(0, max || 3).map(r => rolePillHtml(r, small)).join('');
}
const _roleEvSrc = new Map();
function roleEvidence(txt){
  let s = String(txt || '').trim();
  if(KZ_LANG !== 'pt'){
    // o trecho é um pedaço do texto em português: mostra o texto de origem traduzido
    const src = _roleEvSrc.get(txt);
    const tr = src ? kzTrad(src) : null;
    if(tr && tr !== src) s = tr.trim();
  }
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if(s.length > 150) s = s.slice(0, 150).replace(/\s+\S*$/, '') + '…';
  return s;
}
// Bloco "Papel em batalha" da ficha: os papéis, o que cada um significa e os trechos das habilidades que levaram a isso.
function renderRoleCard(c){
  const a = analyzeRoles(c);
  const rows = a.roles.map((r, i) => {
    const ev = a.why[r].slice(0, 2);
    return `<div class="kz-role-row">
      <div class="kz-role-row-head">${rolePillHtml(r)}<span class="kz-role-rank">${i === 0 ? kzt('papel.papelPrincipal') : kzt('papel.papelSecundario')}</span></div>
      <div class="kz-role-about">${escapeHtml(ROLE_INFO[r].about)}</div>
      ${ev.length ? `<ul class="kz-role-ev">${ev.map(e => `<li>${escapeHtml(roleEvidence(e))}</li>`).join('')}</ul>` : `<div class="kz-role-ev kz-muted">${kzt('papel.definidoPorTipo', { tipo: escapeHtml(c.type || '—') })}</div>`}
    </div>`;
  }).join('');
  return `<div class="kz-role-card">
    <div class="kz-role-card-head"><span class="kz-label">${kzt('papel.emBatalha')}</span></div>
    <div class="kz-role-rows">${rows}</div>
    ${synergyCardHtml(c)}
  </div>`;
}


/* ---------- Sinergias entre habilidades ----------
   Tirado dos textos das habilidades: quem fortalece um grupo de aliados (Malignos, Saiyajins, Fusão, SS4…)
   e duplas/trios que se ajudam pelo nome (Goku SS4 + Vegeta SS4, Kale + Caulifla…). "peso" é o quanto vale
   com o efeito completo (1 = muito forte); nos de grupo, o valor cresce com cada aliado do grupo até "max". */
const SYNERGY_GROUPS = {
  maligno:    { label:kzt('grupo.maligno'),          test:c=>(c.tags||[]).includes('Guerreiro Maligno') },
  saiyajin:   { label:kzt('grupo.saiyajin'),         test:c=>c.element === 'Saiyajin' },
  fusao:      { label:kzt('grupo.fusao'),          test:c=>(c.tags||[]).includes('Guerreiro de Fusão') },
  fusao_ss4:  { label:kzt('grupo.fusaoSS4'),    test:c=>(c.tags||[]).includes('Guerreiro de Fusão') || (c.tags||[]).includes('SS4') },
  orgulho:    { label:kzt('grupo.orgulho'), test:c=>(c.tags||[]).includes('Tropa do Orgulho') },
  lendario:   { label:kzt('grupo.lendario'),         test:c=>(c.tags||[]).includes('Guerreiro Lendário') },
  artista:    { label:kzt('grupo.artista'), test:c=>(c.tags||[]).includes('Artista Marcial') },
  guerreiras: { label:kzt('grupo.guerreiras'),        test:c=>c.gender === 'Feminino' },
  androide:   { label:kzt('grupo.androide'),         test:c=>c.element === 'Androide' },
  divino:     { label:kzt('grupo.divino'), test:c=>(c.tags||[]).includes('Anjo') || (c.tags||[]).includes('Deus da Destruição') },
  raio:       { label:kzt('grupo.raio'), test:c=>c.affinity === 'Raio' },
};
const SYNERGY_RULES = {
  'Goku SS4':          [{ com:['Vegeta SS4'], peso:1, txt:'libera o Supremo combinado com Vegeta SS4' }],
  'Vegeta SS4':        [{ com:['Goku SS4'], peso:1, txt:'libera o Supremo combinado com Goku SS4' }],
  'Goku SSGSS':        [{ com:['Vegeta SSGSS'], peso:0.9, txt:'resiste a um golpe fatal com Vegeta SSGSS no time' }],
  'Vegeta SSGSS':      [{ com:['Goku SSGSS'], peso:0.9, txt:'resiste a um golpe fatal com Goku SSGSS no time' }],
  'Caulifla':          [{ com:['Kale'], peso:0.8, txt:'revive a Kale' }, { grupo:'guerreiras', peso:0.3, max:3, txt:'acelera a Fúria das Guerreiras' }],
  'Tenshinhan':        [{ com:['Yamcha', 'Mestre Kame'], todos:true, peso:0.7, txt:'com Yamcha e Mestre Kame, +15% de ATQ para os três' }, { grupo:'artista', peso:0.3, max:3, txt:'limpa debuffs dos Artistas Marciais' }],
  'Whis':              [{ com:['Beerus'], peso:0.6, txt:'cura e protege Beerus' }, { com:['Vados'], peso:0.4, txt:'com Vados, Artistas Marciais ganham Retrocesso Temporal' }],
  'Vados':             [{ grupo:'divino', peso:0.4, max:2, txt:'bônus dobrado para Anjos e Deuses da Destruição' }],
  'Android 17':        [{ com:['Android 18'], peso:0.5, txt:'deixa Android 18 usar habilidade logo após o Supremo' }],
  'Goku Black':        [{ com:['Goku Black (Rose)'], peso:0.4, txt:'+30% de recuperação de Fúria com Goku Black (Rose)' }],
  'Zamasu':            [{ com:['Goku Black'], peso:0.4, txt:'chance de atordoar com Goku Black em campo' }],
  'Piccolo':           [{ prefixo:'Gohan', peso:0.5, txt:'+12% de dano e de redução de dano com Gohan em campo' }],
  'Goku':              [{ prefixo:'Vegeta', peso:0.3, txt:'+15% de dano com Vegeta em campo' }],
  'Trunks do Futuro':  [{ prefixo:'Vegeta', peso:0.3, txt:'limpa debuffs e dá Fúria a Vegeta' }],
  'Kuririn':           [{ prefixo:'Goku', peso:0.3, txt:'ao cair, dá 1000 de Fúria ao Goku' }, { grupo:'artista', peso:0.3, max:3, txt:'+10% de intensidade crítica para Artistas Marciais' }],
  'Jiren':             [{ com:['Toppo'], peso:0.15, txt:'recuperação dobrada se Toppo cair' }],
  'Toppo':             [{ com:['Jiren'], peso:0.15, txt:'recuperação dobrada se Jiren cair' }],
  'Gogeta SS4':        [{ grupo:'fusao_ss4', peso:0.6, max:3, txt:'fortalece aliados de Fusão e SS4' }],
  'SSGSS Gogeta':      [{ grupo:'fusao', peso:0.4, max:2, txt:'Supremos de aliados de Fusão tiram controle dele' }],
  'Kefla':             [{ grupo:'fusao', peso:0.3, max:2, txt:'cura e fortalece aliados de Fusão (LR)' }],
  'Kale':              [{ grupo:'lendario', peso:0.4, max:3, txt:'+10% de Resistência a Supremo para Lendários' }],
  'Broly (DBS)':       [{ grupo:'lendario', peso:0.4, max:3, txt:'aumenta a DEF dos Lendários' }],
  'Broly SS4':         [{ grupo:'saiyajin', peso:0.5, max:4, txt:'+7% de crítico por Saiyajin aliado' }, { grupo:'maligno', peso:0.4, max:4, txt:'+7% de bloqueio por Maligno aliado' }],
  'Cooler Dourado':    [{ grupo:'maligno', peso:0.5, max:4, txt:'dá Fúria aos Malignos' }],
  'Super Syn Shenlong':[{ grupo:'maligno', peso:0.3, minimo:3, txt:'+20% de resistência a Supremo com 3 ou mais Malignos' }],
  // Passiva única e passiva do Supremo: ao entrar, com 2 ou mais aliados do grupo (confirmado por quem joga), ganha o bônus do grupo (o dos Saiyajins também vai para um Saiyajin aleatório)
  'Goku Instinto':     [
    { grupo:'saiyajin', peso:0.4, minimo:2, txt:'com 2 ou mais Saiyajins: Reforço de Equipe para ele e um Saiyajin aleatório (+20% de recuperação de Fúria)' },
    { grupo:'maligno',  peso:0.4, minimo:2, txt:'com 2 ou mais Malignos: +20% de Taxa de Crítico' },
    { grupo:'orgulho',  peso:0.4, minimo:2, txt:'com 2 ou mais da Tropa do Orgulho: Perseverança (+30% de dano com PV baixo)' },
    { grupo:'fusao',    peso:0.4, minimo:2, txt:'com 2 ou mais de Fusão: +20% de Chance de Habilidade e +5% de roubo de vida por habilidade' },
  ],
  'Goku Black (Rose)': [{ grupo:'maligno', peso:0.6, max:4, txt:'aumenta o Dano de Supremo dos Malignos' }],
  'Goku SS3 (Rose)':   [{ grupo:'maligno', peso:0.6, max:3, txt:'revive quando Malignos usam Supremo' }],
  'Janemba':           [{ grupo:'maligno', peso:0.2, max:3, txt:'fica mais forte quando um Maligno cai' }],
  'Vegeta SSG':        [{ grupo:'saiyajin', peso:0.4, max:3, txt:'fortalece Saiyajins da fileira de trás' }],
  'Beerus':            [{ grupo:'saiyajin', peso:0.5, max:4, txt:'+7% de intensidade crítica por Saiyajin aliado' }],
  'Cell':              [{ grupo:'maligno', peso:0.5, max:4, txt:'dá escudo aos Malignos' }],
  'Goku SS3':          [{ grupo:'saiyajin', peso:0.5, max:2, txt:'dá habilidade extra a um Saiyajin' }],
  'Dabura':            [{ grupo:'maligno', peso:0.5, max:3, txt:'pode reviver um Maligno' }],
  'Ribrianne':         [{ grupo:'guerreiras', peso:0.5, minimo:3, contaProprio:true, txt:'+20% de cura para a equipe com 3 ou mais Guerreiras' }],
  'Mestre Kame':       [{ grupo:'artista', peso:0.5, max:4, txt:'+10% de dano para Artistas Marciais' }],
  'Yamcha':            [{ grupo:'artista', peso:0.3, max:4, txt:'+12% de DEF por Artista Marcial' }],
  'Goku (Criança)':    [{ grupo:'saiyajin', peso:0.3, max:4, txt:'+5% de Dano de Supremo para Saiyajins' }],
  'Vegeta':            [{ grupo:'saiyajin', peso:0.4, max:4, txt:'ganha habilidade extra com Supremos de Saiyajins' }],
  'Freeza':            [{ grupo:'maligno', peso:0.3, minimo:3, txt:'+20% de acerto de debuff com 3 ou mais Malignos' }],
  'Cumber':            [{ grupo:'maligno', peso:0.5, max:4, txt:'dá escudo aos Malignos' }],
  'Moro':              [{ grupo:'maligno', peso:0.4, max:3, txt:'fortalece os Malignos da retaguarda' }],
  'Towa':              [{ grupo:'maligno', peso:0.3, max:3, txt:'+5% de Resistência a Supremo para Malignos da retaguarda' }],
  'Super Mira':        [{ grupo:'maligno', peso:0.5, max:4, txt:'Supremos de Malignos aumentam o dano do Vórtice' }],
  'Gohan':             [{ grupo:'saiyajin', peso:0.15, max:2, txt:'+4% de Dano de Supremo quando um Saiyajin cai' }],
  'Android 21':        [{ grupo:'androide', peso:0.4, max:3, txt:'aumenta o ATQ dos Androides' }],
  'SSG Trunks':        [{ grupo:'guerreiras', peso:0.15, max:3, txt:'+2,5% de PV para Guerreiras' }],
  'Demigra Demoníaco': [{ grupo:'raio', peso:0.15, max:4, txt:'+5% de dano para aliados de afinidade Raio' }],
};
// "Vegeta" vale para todas as versões do Vegeta (não para o Vegetto); "Goku" não inclui Goku Black/Rosé.
function synergyPrefixMatch(name, prefixo){
  if(!(name === prefixo || name.startsWith(prefixo + ' '))) return false;
  return !(prefixo === 'Goku' && /Black|Rose/.test(name));
}
function synergyRuleTargets(rule, owner, members){
  if(rule.grupo){ const g = SYNERGY_GROUPS[rule.grupo]; return members.filter(o=>o !== owner && g && g.test(o)); }
  if(rule.prefixo) return members.filter(o=>o !== owner && synergyPrefixMatch(o.name, rule.prefixo));
  return members.filter(o=>o !== owner && (rule.com || []).includes(o.name));
}
// Sinergias ativas numa equipe: [{de, nome, alvos:[ids], txt, val}] e a soma dos valores.
function synergyReport(team){
  const members = (team || []).filter(Boolean).map(getChar).filter(Boolean);
  const ativos = [];
  let total = 0;
  members.forEach(m=>{
    (SYNERGY_RULES[m.name] || []).forEach(r=>{
      const alvos = synergyRuleTargets(r, m, members);
      let val = 0;
      if(r.grupo){
        const n = alvos.length + (r.contaProprio && SYNERGY_GROUPS[r.grupo].test(m) ? 1 : 0);
        if(r.minimo) val = n >= r.minimo ? r.peso : 0;
        else if(alvos.length) val = r.peso * Math.min(alvos.length, r.max || 4) / (r.max || 4);
      } else if(r.todos){
        if((r.com || []).every(nm=>members.some(o=>o.name === nm))) val = r.peso;
      } else if(alvos.length) val = r.peso;
      if(val > 0){ total += val; ativos.push({ de:m.id, nome:kzNome(m.name), alvos:alvos.map(o=>o.id), txt:r.txt, val }); }
    });
  });
  ativos.sort((a, b)=>b.val - a.val);
  return { total, ativos };
}
// 0 a 1: ~2,2 pontos de sinergia numa equipe cheia já é muito.
function synergyNorm(team){
  const n = (team || []).filter(Boolean).length;
  return n ? Math.min(1, synergyReport(team).total / (2.2 * Math.max(n, 2) / 6)) : 0;
}
function synergyItemHtml(a){
  const alvos = a.alvos.map(id=>getChar(id)).filter(Boolean);
  const quem = alvos.length && alvos.length <= 3 ? ` <span style="opacity:.8">(${alvos.map(o=>escapeHtml(kzNome(o.name))).join(', ')})</span>` : alvos.length > 3 ? ` <span style="opacity:.8">(${alvos.length} aliados)</span>` : '';
  return `<span class="g">✦</span><b>${escapeHtml(a.nome)}</b>: ${escapeHtml(kzTrad(a.txt))}${quem}`;
}
// Na ficha: o que o guerreiro faz pela equipe e quem fortalece ele.
function synergyInfo(c){
  const proprias = (SYNERGY_RULES[c.name] || []).map(r=>{
    if(r.grupo){ const g = SYNERGY_GROUPS[r.grupo]; const n = state.characters.filter(o=>o.id !== c.id && g.test(o)).length; return `${escapeHtml(kzTrad(r.txt))} <span class="rx">${kzt('sin.nGuerreiros', { n, grupo: escapeHtml(g.label) })}</span>`; }
    return escapeHtml(kzTrad(r.txt));
  });
  const recebe = [];
  state.characters.forEach(o=>{
    if(o.id === c.id) return;
    (SYNERGY_RULES[o.name] || []).forEach(r=>{ if(synergyRuleTargets(r, o, [o, c]).includes(c)) recebe.push(o.name); });
  });
  return { proprias, recebe:[...new Set(recebe)] };
}
function synergyCardHtml(c){
  const { proprias, recebe:unicos } = synergyInfo(c);
  if(!proprias.length && !unicos.length) return '';
  return `<div class="kz-role-syn">
    <span class="kz-label">${kzt('sin.titulo')}</span>
    ${proprias.length ? `<ul>${proprias.map(t=>`<li>${t}</li>`).join('')}</ul>` : ''}
    ${unicos.length ? `<div class="rx">${kzt('sin.fortalecidoPor')}: ${unicos.slice(0, 8).map(n => escapeHtml(kzNome(n))).join(', ')}${unicos.length > 8 ? ` ${kzt('geral.eMais', { n: unicos.length - 8 })}` : ''}.</div>` : ''}
  </div>`;
}

/* ---------- Equilíbrio da equipe ---------- */
function teamPillars(team){
  const v = { dano:0, tank:0, suporte:0, controle:0 };
  (team || []).forEach(id => {
    const c = id && getChar(id);
    if(!c) return;
    const p = analyzeRoles(c).pillars;
    PILLAR_ORDER.forEach(k => { v[k] += p[k]; });
  });
  return v;
}
// 0 a 1. Cada frente conta até o alvo (ajustado ao tamanho da equipe); passar muito do limite tira um pouco.
function balanceScore(team){
  const n = (team || []).filter(Boolean).length;
  if(!n) return 0;
  const scale = n / 6;
  const v = teamPillars(team);
  let s = 0;
  PILLAR_ORDER.forEach(k => {
    const P = PILLARS[k];
    s += P.weight * Math.min(1, v[k] / (P.target * scale));
    s -= 0.05 * Math.max(0, v[k] - P.cap * scale);
  });
  return Math.max(0, Math.min(1, s));
}
// Frentes que ainda faltam (abaixo de 70% do alvo), da mais importante pra menos.
function missingPillars(team){
  const n = (team || []).filter(Boolean).length;
  if(!n) return [];
  const v = teamPillars(team), scale = Math.max(n / 6, 0.5);
  return PILLAR_ORDER.filter(k => v[k] < PILLARS[k].target * scale * 0.7);
}
function compositionHtml(teamArg){
  const team = teamArg || state.team;
  if(!team.some(Boolean)) return '';
  const v = teamPillars(team), miss = missingPillars(team);
  const bal = Math.round(balanceScore(team) * 100);
  const chips = PILLAR_ORDER.map(k => {
    const info = ROLE_INFO[k === 'suporte' ? 'suporte' : k === 'controle' ? 'controle' : k];
    const r = info.rgb, isMiss = miss.includes(k);
    return `<span class="kz-comp-chip${isMiss ? ' miss' : ''}" style="border-color:rgba(${r[0]},${isMiss ? .35 : .7});color:${isMiss ? '#9a93a3' : r[1]};"><span class="g">${info.glyph}</span>${PILLARS[k].label} <b>${(Math.round(v[k] * 10) / 10).toString().replace('.', KZ_DECIMAL)}</b></span>`;
  }).join('');
  const note = !miss.length ? kzt('comp.equilibradaPonto') : kzt('comp.falta', { lista: miss.map(k => PILLARS[k].label).join(', ') });
  const syn = synergyReport(team).ativos;
  return `<div class="kz-comp" title="${kzt('comp.tituloAjuda')}">
    <span class="kz-label">${kzt('comp.composicao')}</span>${chips}<span class="kz-comp-note ${miss.length ? 'warn' : 'ok'}">${note}</span><span class="kz-comp-bal">${kzt('comp.equilibrio')} <b>${bal}%</b></span>
  </div>${syn.length ? `<div class="kz-comp-syn"><span class="t">${kzt('comp.sinergiasAtivas', { n: syn.length })}</span>${syn.slice(0, 4).map(a=>`<div class="kz-syn-line">${synergyItemHtml(a)}</div>`).join('')}${syn.length > 4 ? `<div class="kz-syn-line">${kzt('comp.eMaisN', { n: syn.length - 4 })}</div>` : ''}</div>` : ''}`;
}

/* ---------- Montagem automática (completa a equipe a partir de 1 a 5 guerreiros) ---------- */
const AUTO_MODES = {
  equilibrado: { label:kzt('auto.equilibrado'),    wc:0.45, wb:0.35, ws:0.2,  hint:kzt('auto.equilibradoDica') },
  combos:      { label:kzt('auto.maisCombos'),    wc:0.85, wb:0.1,  ws:0.05, hint:kzt('auto.maisCombosDica') },
  sinergias:   { label:kzt('auto.maisSinergias'), wc:0.3,  wb:0.2,  ws:0.5,  hint:kzt('auto.maisSinergiasDica') },
};
function autoObjective(team, mode){
  const m = AUTO_MODES[mode] || AUTO_MODES.equilibrado;
  const n = team.filter(Boolean).length;
  const st = comboStatsFor(team);
  const ref = Math.max(1, 66 * Math.pow(n / 6, 2));
  const comboNorm = Math.min(1, st.total / ref);
  const bal = balanceScore(team);
  const syn = synergyNorm(team);
  return { score: m.wc * comboNorm + m.wb * bal + (m.ws || 0) * syn, combos: st.total, longest: st.longest, balance: bal, synergy: syn };
}
// Busca em feixe: a cada passo experimenta cada guerreiro do elenco em cada casa livre e guarda as melhores
// equipes parciais. No fim, reordena as 3 melhores pra render o máximo de combos.
function buildTeamOptions(mode, rarity, maxOptions){
  const base = [...state.team];
  const empties = base.map((id, i) => id ? -1 : i).filter(i => i > -1);
  if(!empties.length || !base.some(Boolean)) return [];
  const inTeam = new Set(base.filter(Boolean));
  const pool = state.characters.filter(c => !inTeam.has(c.id) && (!rarity || rarity === 'all' || rarityLabel(c.rarity) === rarity));
  if(!pool.length) return [];
  const WIDTH = 12;
  let beam = [{ team: base, obj: autoObjective(base, mode) }];
  for(let step = 0; step < empties.length; step++){
    const seen = new Map();
    beam.forEach(st => {
      const free = empties.filter(i => !st.team[i]);
      const used = new Set(st.team.filter(Boolean));
      pool.forEach(c => {
        if(used.has(c.id)) return;
        free.forEach(slot => {
          const t = [...st.team];
          t[slot] = c.id;
          const key = t.filter(Boolean).sort().join(',');
          const obj = autoObjective(t, mode);
          const prev = seen.get(key);
          if(!prev || obj.score > prev.obj.score) seen.set(key, { team: t, obj });
        });
      });
    });
    if(!seen.size) break;   // elenco filtrado acabou: devolve a equipe parcial do passo anterior
    beam = [...seen.values()].sort((a, b) => b.obj.score - a.obj.score).slice(0, WIDTH);
  }
  // Opções bem diferentes entre si: uma nova opção só entra se trocar pelo menos 2 guerreiros em relação às já escolhidas.
  const want = Math.max(maxOptions || 3, 1), cands = beam.filter(b => b.team.filter(Boolean).length > inTeam.size);
  const diff = (x, y) => { const sx = new Set(x.team.filter(Boolean)); return y.team.filter(id => id && !sx.has(id)).length; };
  const picked = [];
  cands.forEach(b => { if(picked.length < want && picked.every(p => diff(p, b) >= 2)) picked.push(b); });
  cands.forEach(b => { if(picked.length < want && !picked.includes(b)) picked.push(b); });
  const out = picked.map(b => {
    const best = optimizeTeamOrder(b.team);
    const team = best && best.changed ? best.team : b.team;
    const obj = autoObjective(team, mode);
    return { team, ...obj, pillars: teamPillars(team), missing: missingPillars(team), syn: synergyReport(team).ativos };
  });
  return out.sort((a, b) => b.score - a.score);
}
// Linha de ajustes da montagem automática (pequena) + as sugestões geradas, em linhas compactas.
function renderAutoBar(){
  const filled = state.team.filter(Boolean).length;
  if(!filled) return '';
  const mode = state.autoMode || 'equilibrado';
  const rar = state.recRarity || 'all';
  const opts = (state.autoOpts && state.autoOpts.base === JSON.stringify(state.team)) ? state.autoOpts.list : null;
  const modeOpts = Object.entries(AUTO_MODES).map(([k, m]) => `<option value="${k}" ${mode === k ? 'selected' : ''}>${m.label}</option>`).join('');
  const rarOpts = [['all', kzt('auto.todas')], ['SSR', kzt('auto.soSSR')], ['SR', kzt('auto.soSR')], ['R', kzt('auto.soR')]].map(([v, l]) => `<option value="${v}" ${rar === v ? 'selected' : ''}>${l}</option>`).join('');
  let rows = '';
  if(opts){
    rows = opts.length
      ? `<div class="kz-auto-rows">${opts.map((o, i) => renderAutoOptionRow(o, i)).join('')}</div>`
      : `<div class="kz-muted" style="font-size:12.5px;">${kzt('auto.nadaEncontrado')}</div>`;
  }
  return `<div class="kz-auto">
    <div class="kz-auto-bar">
      <span class="kz-auto-lbl" title="${kzt('auto.tituloAjuda')}">${kzt('auto.montagem')}</span>
      <label>${kzt('auto.foco')} <select class="kz-select-sm" id="autoModeSelect" title="${escapeAttr(AUTO_MODES[mode].hint)}">${modeOpts}</select></label>
      <label>${kzt('auto.novosGuerreiros')} <select class="kz-select-sm" id="autoRarSelect">${rarOpts}</select></label>
      ${opts ? `<button type="button" class="kz-com-link" id="autoCloseBtn">${kzt('auto.fechar')}</button>` : ''}
    </div>
    ${rows}
  </div>`;
}
function renderAutoOptionRow(o, i){
  const comboMax = comboMaxFor(o.team).max;
  const core = new Set((state.autoOpts && state.autoOpts.core) || []);
  const minis = o.team.map((id, slot) => {
    const c = id && getChar(id);
    return c ? `<span class="kz-auto-mini${core.has(id) ? ' core' : ''}" title="${escapeAttr(kzt('time.casaNome', { n: slot + 1, nome: kzNome(c.name) }))}">${portraitInner(c)}</span>` : '<span class="kz-auto-mini empty"></span>';
  }).join('');
  return `<div class="kz-auto-row${i === 0 ? ' top' : ''}">
    <div class="kz-auto-row-team">${minis}</div>
    <div class="kz-auto-row-info"><b>${i === 0 ? kzt('auto.melhor') : kzt('auto.opcao', { n: i + 1 })}</b>
      <span>${kzt('auto.linhaOpcao', { combos: '<b>' + o.combos + '</b>', max: comboMax, cadeia: '<b>' + (o.longest + 1) + '</b>', bal: '<b>' + Math.round(o.balance * 100) + '</b>' })}${o.missing.length ? ` · <span class="warn">${kzt('auto.falta', { lista: o.missing.map(k => PILLARS[k].label).join(', ') })}</span>` : ''}</span></div>
    <button type="button" class="kz-btn kz-btn-sm kz-btn-primary" data-auto-apply="${i}">${kzt('auto.usar')}</button>
    ${(o.syn || []).length ? `<div class="kz-auto-syn">${o.syn.slice(0, 3).map(a=>`<div class="kz-syn-line">${synergyItemHtml(a)}</div>`).join('')}${o.syn.length > 3 ? `<div class="kz-syn-line">${kzt(o.syn.length - 3 > 1 ? 'auto.maisSinergiasPl' : 'auto.maisSinergia', { n: o.syn.length - 3 })}</div>` : ''}</div>` : ''}
  </div>`;
}
function runAutoBuild(){
  const filled = state.team.filter(Boolean);
  if(!filled.length){ showToast(kzt('auto.toastMinimo')); return; }
  if(filled.length === 6){ showToast(kzt('auto.toastCompleta')); return; }
  showToast(kzt('auto.toastMontando'));
  setTimeout(() => {
    const list = buildTeamOptions(state.autoMode || 'equilibrado', state.recRarity || 'all', 3);
    state.autoOpts = { base: JSON.stringify(state.team), core: filled, list };
    render();
  }, 30);
}
function applyAutoOption(i){
  const o = state.autoOpts && state.autoOpts.list[i];
  if(!o) return;
  const prev = [...state.team];
  commitTeam([...o.team]);
  state.optUndo = { before: prev, after: [...o.team] };
  state.optInfo = kzt('auto.infoMontada', { combos: o.combos, hits: o.longest + 1, bal: Math.round(o.balance * 100) }) + (o.missing.length ? ' · ' + kzt('auto.falta', { lista: o.missing.map(k => PILLARS[k].label).join(', ') }) : '') + '.';
  render();
  showToast(kzt('auto.toastMontada'));
}

/* ======================= DESCREVA O TIME ======================= */
// A pessoa escreve o que quer ("quero um time de queimadura", "time feminino de Fogo") e o site monta a equipe.
// Sem IA externa: lê o texto por palavras-chave e escolhe guerreiros pelo que está nos dados (habilidades, gênero, raça,
// afinidade, papéis). Gênero/raça/afinidade/raridade/grupo são filtros; efeito, papel e tipo pontuam; o resto vem do Montador.
const DESC_MECHS = [
  { key:'queimadura', label:kzt('mec.queimadura'),    q:/queim|burn|incendi|ardente|fogo continuo|em chamas|on fire/,  d:/queima/ },
  { key:'sangramento', label:kzt('mec.sangramento'),  q:/sangr|bleed|hemorrag|laceraca|ferida/,                d:/sangr|lacera|ferimento|ferida mortal/ },
  { key:'veneno',     label:kzt('mec.veneno'),        q:/venen|venom|poison|toxic/,                                  d:/envenen|veneno/ },
  { key:'atordoamento', label:kzt('mec.atordoamento'), q:/atordo|stun|desmaiar|apagar o inimigo/,              d:/atordo/ },
  { key:'silencio',   label:kzt('mec.silencio'),      q:/silenc|calar|travar (o )?(supremo|ultimate)|bloquear (o )?supremo/, d:/sil[eê]nc|suprim|supress/ },
  { key:'paralisia',  label:kzt('mec.paralisia'),     q:/paralis|imobiliz|prender|prisao|travar (o )?inimigo|congel|paraly|immobil|freez|frozen/, d:/paralis|imobiliza|prisão|preso/ },
  { key:'petrificacao', label:kzt('mec.petrificacao'), q:/petrific|pedra no inimigo/,                           d:/petrific/ },
  { key:'confusao',   label:kzt('mec.confusao'),      q:/confus/,                                              d:/confus/ },
  { key:'encanto',    label:kzt('mec.encanto'),       q:/encant|charme|enfeiti/,                               d:/encant/ },
  { key:'cegueira',   label:kzt('mec.cegueira'),      q:/cegueira|cegar|cego|blind/,                                 d:/cegueira/ },
  { key:'escudo',     label:kzt('mec.escudo'),        q:/escudo|shield|barreira|protecao/,                     d:/escudo|muralha de energia|parede de energia/ },
  { key:'critico',    label:kzt('mec.critico'),       q:/critic|crit\b/,                                       d:/cr[ií]t/ },
  { key:'furia',      label:kzt('mec.furia'),   q:/furia|raiva|rage|ki rapido|carregar rapido|encher a barra/, d:/raiva|f[uú]ria/ },
  { key:'derrubada',  label:kzt('mec.derrubada'),     q:/derrub|knock|jogar no chao/,                          d:/derrub/ },
  { key:'empurrao',   label:kzt('mec.empurrao'),      q:/empurr|push|jogar pra tras|jogar para tras/,          d:/empurr/ },
  { key:'elevacao',   label:kzt('mec.elevacao'),      q:/eleva|juggle|aereo|jogar (pro|para o) (alto|ar)|pro alto|no ar(?!\w)|pro ar(?!\w)|para o ar(?!\w)|levantar o inimigo|launch|airborne|in the air|into the air/, d:/eleva[cç]/ },
];
const DESC_ROLES = [
  ['tank', /\btank|resistente|aguent|defensiv|linha de frente|frontline|protege|\bsegurar\b|\bsegura\b/],
  ['suporte', /suporte|buff|apoio|support|fortalec|aumentar (o )?(ataque|status)/],
  ['controle', /control|\bcc\b|crowd|travar|incapacit|debuff|enfraquec/],
  ['cura', /\bcura\b|curar|curandeir|healer|\bheal|regenera|recuper(ar|a) vida/],
  ['sobrevivencia', /reviv|sobreviv|surviv|imortal|immortal|nao morre|ressusc/],
  ['dot', /dano continuo|dano por turno|\bdot\b|dano ao longo|damage over time|over time/],
  ['dano', /\bdano\b|ofensiv|agressiv|\bdps\b|burst|\bforte\b|bater forte|matar rapido|glass cannon/],
];
const DESC_TYPES = [['Ataque', /tipo ataque|\bde ataque\b|atacantes?\b|attack type|attackers?\b/], ['Defesa', /tipo defesa|\bde defesa\b|defen[sc]e type/], ['Habilidade', /tipo habilidade|\bde habilidade\b|skill type/]];
const DESC_RACES = [['Saiyajin', /saiyajin|saiyan|sayajin|saiya\b/], ['Androide', /androide|android/], ['Humano', /humano|human/]];
const DESC_TAGS = [
  ['Guerreiro Maligno', /malign|\bvila(o|s|oes)\b|do mal\b|sombri|trevas|\bevil\b|villain/], ['Guerreiro de Fusão', /fusa|fusion|fundid/], ['Guerreiro Dourado', /dourad|golden/],
  ['Artista Marcial', /artista marcial|artistas marciais|lutador|martial art/], ['Anjo', /\banjos?\b|\bangels?\b/], ['SSG', /\bssg\b|super saiyajin god|deus saiyajin/],
  ['SS4', /\bss4\b|\bssj4\b|super saiyajin 4/], ['Tropa do Orgulho', /orgulho|pride/], ['Deus da Destruição', /deus(es)? da destrui|\bhakai\b|gods? of destruction/],
];
const DESC_AFFS = [['Fogo', /\bfogo\b|vermelh|\bred\b|\bfire\b/], ['Raio', /\braio\b|eletric|amarel|\byellow\b|lightning|thunder/], ['Pedra', /\bpedra\b|\bterra\b|\bverde\b|\bgreen\b|\brock\b|\bstone\b|\bearth\b/], ['Luz', /\bluz\b|branc|\bwhite\b|\blight\b/]];
// em inglês "no tanks" nega; em português "no ar" / "no time" não (por isso o "no" só vale em /en/)
const DESC_NEG = KZ_LANG === 'en'
  ? /\b(sem|exceto|menos|nao quero|nem|tirando|fora|without|except|excluding|dont want|do not want|no|not|avoid|exclude)\b/
  : /\b(sem|exceto|menos|nao quero|nem|tirando|fora|without|except|excluding|dont want|do not want)\b/;
const DESC_GERAL = /melhor time|time forte|time completo|equilibrad|qualquer time|time bom|monte um time|monta um time|me ajuda|me sugere|sugest|best team|strong team|complete team|balanced|any team|good team|build a team|help me|suggest/;
function descNorm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
// Lê um trecho do texto (já sem acento) e devolve os filtros encontrados.
function descLerTrecho(t){
  const crit = { mechs:[], roles:[], types:[], genders:[], races:[], tags:[], affs:[], rars:[], labels:[] };
  DESC_MECHS.forEach(m => { if(m.q.test(t)){ crit.mechs.push(m); crit.labels.push(m.label); } });
  DESC_ROLES.forEach(([r, re]) => { if(re.test(t)){ crit.roles.push(r); crit.labels.push(ROLE_INFO[r].label); } });
  DESC_TYPES.forEach(([ty, re]) => { if(re.test(t)){ crit.types.push(ty); crit.labels.push(kzt('desc.tipo', { t: kzTermo(ty) })); } });
  if(/feminin|mulher|garota|menina|guerreira|dama|\belas\b|female|woman|women|\bgirls?\b|\bshe\b/.test(t)){ crit.genders.push('Feminino'); crit.labels.push(kzTermo('Feminino')); }
  else if(/masculin|homens|\bhomem\b|\beles\b|\bmarmanj|\bmale\b|\bmen\b|\bman\b/.test(t)){ crit.genders.push('Masculino'); crit.labels.push(kzTermo('Masculino')); }
  DESC_RACES.forEach(([r, re]) => { if(re.test(t)){ crit.races.push(r); crit.labels.push(kzTermo(r)); } });
  DESC_TAGS.forEach(([g, re]) => { if(re.test(t)){ crit.tags.push(g); crit.labels.push(kzTermo(g.replace(/^Guerreiro (de |)/, ''))); } });
  DESC_AFFS.forEach(([a, re]) => { if(re.test(t)){ crit.affs.push(a); crit.labels.push(kzt('desc.afinidade', { a: kzTermo(a) })); } });
  if(/\bssr\b/.test(t)){ crit.rars.push('SSR'); crit.labels.push('SSR'); }
  else if(/\bsr\b/.test(t)){ crit.rars.push('SR'); crit.labels.push('SR'); }
  if(/limitad|limited/.test(t)){ crit.rars.push('SSR [Limitado]'); crit.labels.push(kzTermo('Limitado')); }
  if(/lendari|legendary/.test(t)){ crit.rars.push('SSR [Lendário]'); crit.labels.push(kzTermo('Lendário')); }
  if(/ultimate/.test(t)){ crit.rars.push('SSR [Ultimate]'); crit.labels.push(kzTermo('Ultimate')); }
  return crit;
}
const DESC_PALAVRAS_SOLTAS = /^(time|times|equipe|equipes|quero|pra|para|com|sem|que|uma|uns|das|dos|ssr|tipo|forte|bom|jogo|cartas|monte|monta|montar|sobre|ajuda|jogar|alguem|fazer|alguma|melhor|possivel|inimigo|inimigos|pessoal)$/;
function parseTeamPrompt(text){
  const t = descNorm(text);
  // "sem X": o que vem depois do marcador (até vírgula, "mas" ou "quero") é o que NÃO pode entrar
  const m = t.match(DESC_NEG);
  let pos = t, neg = '';
  if(m){
    const resto = t.slice(m.index + m[0].length);
    const fim = resto.search(/[,.;]|\bmas\b|\bporem\b|\bquero\b/);
    neg = fim >= 0 ? resto.slice(0, fim) : resto;
    pos = t.slice(0, m.index) + ' ' + (fim >= 0 ? resto.slice(fim) : '');
  }
  // guerreiros citados pelo nome completo ("com Vegetto SSGSS") entram obrigatoriamente; o nome sai do texto antes de ler os filtros,
  // senão "Gogeta SS4" viraria também o filtro do grupo SS4 e "Goku SS4" puxaria o "Goku" comum
  const nomesCitados = [];
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let posLimpo = pos, posRefs = pos;   // posRefs: só tira os nomes com mais de uma palavra ("time do goku" continua valendo para todas as versões)
  const candidatos = [];
  (state.characters || []).forEach(c => { [c.name, kzNome(c.name)].forEach(n => { const nn = descNorm(n); if(nn.length >= 4 && !candidatos.some(x => x.nn === nn && x.id === c.id)) candidatos.push({ id:c.id, nn }); }); });
  candidatos.sort((a, b) => b.nn.length - a.nn.length).forEach(({ id, nn }) => {
    const re = new RegExp('(^|[^a-z0-9])' + escRe(nn) + '(?=[^a-z0-9]|$)', 'g');
    if(re.test(posLimpo)){
      if(!nomesCitados.includes(id)) nomesCitados.push(id);
      posLimpo = posLimpo.replace(re, '$1 ');
      if(nn.includes(' ')) posRefs = posRefs.replace(re, '$1 ');
    }
  });
  const crit = { ...descLerTrecho(posLimpo), names:[], refs:[], mode:'equilibrado', excl:null, geral:false };
  if(neg){
    const ex = descLerTrecho(neg);
    const total = ex.mechs.length + ex.roles.length + ex.types.length + ex.genders.length + ex.races.length + ex.tags.length + ex.affs.length + ex.rars.length;
    if(total){ crit.excl = ex; crit.labels = crit.labels.concat(ex.labels.map(l => kzt('desc.sem', { l }))); }
  }
  if(/combo/.test(posLimpo)) crit.mode = 'combos'; else if(/sinergia|synerg/.test(posLimpo)) crit.mode = 'sinergias';
  crit.names = nomesCitados;
  // só o primeiro nome ("time do goku"): todas as versões ganham pontos, a equipe escolhe as que fazem sentido
  const palavras = posRefs.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !DESC_PALAVRAS_SOLTAS.test(w));
  const primeiros = new Set((state.characters || []).filter(c => !crit.names.includes(c.id)).map(c => descNorm(c.name).split(/[^a-z0-9]+/)[0]));
  crit.refs = [...new Set(palavras.filter(w => primeiros.has(w)))];
  // "time do goku": a palavra sozinha vale para todas as versões (refs); não força o "Goku" comum além das 3 versões mais raras
  crit.names = crit.names.filter(id => { const c = getChar(id), nn = c ? descNorm(c.name) : ''; return !(nn && !nn.includes(' ') && crit.refs.includes(nn)); });
  crit.refs.forEach(w => { crit.labels.push(kzt('desc.citado', { w: w.charAt(0).toUpperCase() + w.slice(1) })); });
  crit.geral = DESC_GERAL.test(pos);
  crit.vazio = !(crit.mechs.length || crit.roles.length || crit.types.length || crit.genders.length || crit.races.length || crit.tags.length
    || crit.affs.length || crit.rars.length || crit.names.length || crit.refs.length || crit.excl || crit.geral);
  return crit;
}
function descCasa(c, f){
  if(f.genders.length && f.genders.includes(c.gender)) return true;
  if(f.races.length && f.races.includes(c.element)) return true;
  if(f.tags.length && f.tags.some(g => (c.tags || []).includes(g))) return true;
  if(f.affs.length && f.affs.includes(c.affinity)) return true;
  if(f.rars.length && f.rars.some(r => r === 'SSR' ? rarityLabel(c.rarity) === 'SSR' : c.rarity === r)) return true;
  if(f.types.length && f.types.includes(c.type)) return true;
  return false;
}
function descHardOk(c, crit){
  if(crit.genders.length && !crit.genders.includes(c.gender)) return false;
  if(crit.races.length && !crit.races.includes(c.element)) return false;
  if(crit.tags.length && !crit.tags.some(g => (c.tags || []).includes(g))) return false;
  if(crit.affs.length && !crit.affs.includes(c.affinity)) return false;
  if(crit.rars.length && !crit.rars.some(r => r === 'SSR' ? rarityLabel(c.rarity) === 'SSR' : c.rarity === r)) return false;
  if(crit.excl){
    if(descCasa(c, crit.excl)) return false;
    if(crit.excl.mechs.length || crit.excl.roles.length){
      const e = descRelevance(c, { mechs:crit.excl.mechs, roles:crit.excl.roles, types:[], refs:[] });
      if(e.rel > 0) return false;
    }
  }
  return true;
}
// Quanto o guerreiro combina com o que foi pedido em efeitos, papéis, tipo e nomes citados (0 a 1) e por quê.
function descRelevance(c, crit){
  const texts = roleTexts(c).map(x => String(x).toLowerCase());
  const roles = rolesOf(c);
  let sum = 0, n = 0;
  const tags = [];
  crit.mechs.forEach(m => {
    n++;
    const v = Math.min(1, texts.filter(x => m.d.test(x)).length / 2);
    if(v > 0){ sum += v; tags.push(m.label); }
  });
  crit.roles.forEach(r => {
    n++;
    const i = roles.indexOf(r);
    if(i >= 0){ sum += i === 0 ? 1 : 0.6; tags.push(ROLE_INFO[r].label); }
  });
  (crit.types || []).forEach(ty => { n++; if(c.type === ty){ sum += 1; tags.push(kzt('desc.tipo', { t: kzTermo(ty) })); } });
  if((crit.refs || []).length){
    n++;
    const primeiro = descNorm(c.name).split(/[^a-z0-9]+/)[0];
    if(crit.refs.includes(primeiro) && (!crit._refOk || crit._refOk.has(c.id))){ sum += 1; tags.push(kzt('desc.citadoTag')); }
  }
  return { rel: n ? sum / n : 0, tags, soft: n > 0 };
}
function buildDescribedTeams(crit, maxOptions){
  const mode = crit.mode;
  const hasSoft = !!(crit.mechs.length || crit.roles.length || crit.types.length || (crit.refs || []).length);
  // "time do Goku": só as 3 versões mais raras de cada nome citado ganham pontos, pra equipe não virar 6 versões do mesmo guerreiro
  crit._refOk = new Set();
  (crit.refs || []).forEach(w => state.characters.filter(c => descNorm(c.name).split(/[^a-z0-9]+/)[0] === w)
    .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity)).slice(0, 3).forEach(c => crit._refOk.add(c.id)));
  const info = new Map();
  state.characters.forEach(c => info.set(c.id, descRelevance(c, crit)));
  const hardPool = state.characters.filter(c => descHardOk(c, crit) || crit.names.includes(c.id));
  const byRel = [...hardPool].sort((a, b) => info.get(b.id).rel - info.get(a.id).rel || rarityRank(a.rarity) - rarityRank(b.rarity));
  const relevantN = hasSoft ? byRel.filter(c => info.get(c.id).rel > 0).length : byRel.length;
  // se faltar gente com o efeito pedido, completa a equipe com os melhores do filtro
  const pool = byRel.slice(0, hasSoft ? Math.max(relevantN + 8, 16) : 40).slice(0, 36);
  // quem a pessoa citou pelo nome sempre entra no conjunto, mesmo sem combinar com os outros filtros do pedido
  crit.names.forEach(id => { const c = hardPool.find(x => x.id === id); if(c && !pool.includes(c)) pool.push(c); });
  if(!pool.length) return { list:[], hardN:hardPool.length, relevantN:0, hasSoft };
  const forced = crit.names.filter(id => pool.some(c => c.id === id)).slice(0, 6);
  const base = [null, null, null, null, null, null];
  forced.forEach((id, i) => { base[i] = id; });
  const objective = team => {
    const o = autoObjective(team, mode);
    const ids = team.filter(Boolean);
    const rel = ids.reduce((s, id) => s + info.get(id).rel, 0) / Math.max(ids.length, 1);
    const com = crit._com ? ids.reduce((s2, id) => s2 + Math.min(1, (crit._com.get(id) || 0) / 2), 0) / Math.max(ids.length, 1) : 0;
    const sc = hasSoft ? 0.55 * rel + 0.45 * o.score : o.score;
    return { ...o, rel, score: sc + 0.08 * com };   // times da Comunidade parecidos com o pedido dão um empurrãozinho
  };
  const steps = Math.min(6 - forced.length, pool.length - forced.length);
  let beam = [{ team:base, obj:objective(base) }];
  for(let step = 0; step < steps; step++){
    const seen = new Map();
    beam.forEach(st => {
      const slot = st.team.indexOf(null);
      const used = new Set(st.team.filter(Boolean));
      pool.forEach(c => {
        if(used.has(c.id)) return;
        const t = [...st.team]; t[slot] = c.id;
        const key = t.filter(Boolean).sort().join(',');
        const obj = objective(t);
        const prev = seen.get(key);
        if(!prev || obj.score > prev.obj.score) seen.set(key, { team:t, obj });
      });
    });
    if(!seen.size) break;
    beam = [...seen.values()].sort((a, b) => b.obj.score - a.obj.score).slice(0, 12);
  }
  const want = Math.max(maxOptions || 3, 1), cands = beam.filter(b => b.team.filter(Boolean).length > 0);
  const diff = (x, y) => { const sx = new Set(x.team.filter(Boolean)); return y.team.filter(id => id && !sx.has(id)).length; };
  const picked = [];
  cands.forEach(b => { if(picked.length < want && picked.every(p => diff(p, b) >= 2)) picked.push(b); });
  cands.forEach(b => { if(picked.length < want && !picked.includes(b)) picked.push(b); });
  const list = picked.map(b => {
    const best = optimizeTeamOrder(b.team);
    const team = best && best.changed ? best.team : b.team;
    const obj = objective(team);
    return { team, ...obj, missing: missingPillars(team), syn: synergyReport(team).ativos,
      why: team.filter(Boolean).map(id => ({ id, tags: info.get(id).tags })),
      match: team.filter(Boolean).filter(id => !hasSoft || info.get(id).rel > 0).length };
  }).sort((a, b) => b.score - a.score);
  return { list, hardN:hardPool.length, relevantN, hasSoft };
}
// Times da Comunidade que combinam com o pedido: pelo que a descrição/título fala, pelo que os guerreiros do time fazem e pelas curtidas.
function descPostsParecidos(crit, texto){
  const posts = (state.communityPosts || []).filter(p => p.kind === 'team' && (p.reports || 0) < 3);
  if(!posts.length) return [];
  const quer = new Set(crit.labels.filter(l => !l.startsWith(kzt('desc.sem', { l: '' })) && !l.startsWith(kzt('desc.citado', { w: '' }))));
  const palavras = descNorm(texto).split(/[^a-z0-9]+/).filter(w => w.length >= 5 && !DESC_PALAVRAS_SOLTAS.test(w));
  const temSoft = !!(crit.mechs.length || crit.roles.length || crit.types.length);
  const out = [];
  posts.forEach(p => {
    const team = communityTeamStats(p).team.filter(Boolean);
    const chars = team.map(getChar).filter(Boolean);
    if(chars.length < 2 || !chars.every(c => descHardOk(c, crit))) return;
    const hay = descNorm(p.title + ' ' + p.desc);
    const lido = new Set(descLerTrecho(hay).labels);
    const falaDe = [...quer].filter(l => lido.has(l));
    const palavrasHit = palavras.filter(w => hay.includes(w)).length;
    const meanRel = temSoft ? chars.reduce((a, c) => a + descRelevance(c, crit).rel, 0) / chars.length : 0;
    const texto01 = quer.size ? falaDe.length / quer.size : 0;
    const score = 0.5 * texto01 + 0.35 * meanRel + Math.min(0.2, palavrasHit * 0.1) + Math.min(0.15, Math.log10(1 + (p.likes || 0)) * 0.1);
    if(!falaDe.length && !palavrasHit && meanRel < 0.5) return;   // nem a descrição fala disso, nem os guerreiros fazem
    if(score < 0.3) return;
    out.push({ post:p, team, score, falaDe, palavrasHit, meanRel });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}
function descPostsBonus(coms){
  const m = new Map();
  coms.forEach(c => c.team.forEach(id => m.set(id, (m.get(id) || 0) + 1)));
  return m;
}
function renderDescComunidade(coms){
  if(!coms || !coms.length) return '';
  const rows = coms.map(c => {
    const minis = c.team.map(id => { const ch = getChar(id); return ch ? `<span class="kz-auto-mini" title="${escapeAttr(kzNome(ch.name))}">${portraitInner(ch)}</span>` : ''; }).join('');
    const motivo = c.falaDe.length ? kzt('desc.motivoFala', { lista: c.falaDe.map(escapeHtml).join(', ') }) : c.palavrasHit ? kzt('desc.motivoPalavras') : kzt('desc.motivoGuerreiros');
    return `<div class="kz-auto-row">
      <div class="kz-auto-row-team">${minis}</div>
      <div class="kz-auto-row-info"><b>${escapeHtml(c.post.title)}</b>
        <span>${kzt('desc.porAutor', { autor: escapeHtml(c.post.author), likes: c.post.likes || 0, motivo })}</span>${c.post.desc ? `<span class="kz-desc-postdesc">“${escapeHtml(c.post.desc.length > 110 ? c.post.desc.slice(0, 110) + '…' : c.post.desc)}”</span>` : ''}</div>
      <button type="button" class="kz-btn kz-btn-sm kz-btn-primary" data-desc-com="${escapeAttr(c.post.id)}">${kzt('auto.usar')}</button>
    </div>`;
  }).join('');
  return `<div class="kz-desc-com"><span class="kz-label">${kzt('desc.daComunidade')}</span><div class="kz-auto-rows">${rows}</div></div>`;
}
/* ---------- IA do montador (Gemini, pela função "ia-montador" do Supabase) ---------- */
// A IA só faz duas coisas: (1) traduz o pedido em filtros e nomes do elenco; (2) explica os times que o SITE montou, a partir dos dados reais.
// Quem escolhe os guerreiros continua sendo o Montador. Se a IA falhar, passar do limite gratuito do dia ou estiver desligada,
// tudo funciona com a leitura por palavras-chave e a explicação feita pelas regras (descExplicaLocal).
const IA_FUNCAO = 'ia-montador';
function iaDisponivel(){ return !state.iaOff && isSupabaseConfigured() && !!(window.__sb && window.__sb.client); }
// Devolve o JSON da função ou null. Em limite diário/IA desligada, deixa de tentar até recarregar a página.
async function iaChamar(corpo){
  try{
    const { data, error } = await window.__sb.client.functions.invoke(IA_FUNCAO, { body: { idioma: KZ_LANG, ...corpo } });
    if(!error && data && !data.erro) return data;
    let j = data || null;
    if(error){ try{ j = await error.context.json(); }catch(e){ j = null; } }
    if(!j || j.limite === 'diario' || j.limite === 'global' || /não configurada|not configured/i.test(String(j.erro || ''))) state.iaOff = true;
    state.iaAviso = (j && j.limite && j.limite !== 'minuto') ? kzt('ia.limiteAcabou') : kzt('ia.indisponivel');
    return null;
  }catch(e){
    state.iaAviso = kzt('ia.indisponivel');
    return null;
  }
}
// Filtros que a IA devolveu → mesmo formato que descLerTrecho() devolve (para mesclar com a leitura local).
function descCritDeIa(o){
  const c = { mechs:[], roles:[], types:[], genders:[], races:[], tags:[], affs:[], rars:[], labels:[] };
  ((o && o.efeitos) || []).forEach(k => { const m = DESC_MECHS.find(x => x.key === k); if(m){ c.mechs.push(m); c.labels.push(m.label); } });
  ((o && o.papeis) || []).forEach(r => { if(ROLE_INFO[r]){ c.roles.push(r); c.labels.push(ROLE_INFO[r].label); } });
  ((o && o.tipos) || []).forEach(ty => { c.types.push(ty); c.labels.push(kzt('desc.tipo', { t: kzTermo(ty) })); });
  ((o && o.generos) || []).forEach(g => { c.genders.push(g); c.labels.push(kzTermo(g)); });
  ((o && o.racas) || []).forEach(r => { c.races.push(r); c.labels.push(kzTermo(r)); });
  ((o && o.grupos) || []).forEach(g => { c.tags.push(g); c.labels.push(kzTermo(g.replace(/^Guerreiro (de |)/, ''))); });
  ((o && o.afinidades) || []).forEach(a => { c.affs.push(a); c.labels.push(kzt('desc.afinidade', { a: kzTermo(a) })); });
  ((o && o.raridades) || []).forEach(r => { c.rars.push(r); c.labels.push(r === 'SSR' || r === 'SR' ? r : kzTermo(r.replace(/^SSR \[(.*)\]$/, '$1'))); });
  return c;
}
const DESC_LISTAS = ['mechs', 'roles', 'types', 'genders', 'races', 'tags', 'affs', 'rars'];
function descJuntar(dst, src){
  DESC_LISTAS.forEach(k => src[k].forEach(v => { if(!dst[k].includes(v)) dst[k].push(v); }));
  src.labels.forEach(l => { if(!dst.labels.includes(l)) dst.labels.push(l); });
}
// Soma o que a IA entendeu ao que a leitura local já achou (a local continua valendo: nomes completos, "sem X" etc.).
function descMesclarIa(crit, ia, porNome){
  descJuntar(crit, descCritDeIa(ia));
  const ex = descCritDeIa(ia.excluir);
  if(ex.labels.length){
    if(!crit.excl) crit.excl = { mechs:[], roles:[], types:[], genders:[], races:[], tags:[], affs:[], rars:[], labels:[] };
    descJuntar(crit.excl, ex);
    ex.labels.forEach(l => { const t = kzt('desc.sem', { l }); if(!crit.labels.includes(t)) crit.labels.push(t); });
  }
  (ia.principais || []).forEach(n => { const id = porNome.get(n); if(id && !crit.names.includes(id)) crit.names.push(id); });
  crit.principais = (ia.principais || []).map(n => porNome.get(n)).filter(Boolean);
  if(crit.mode === 'equilibrado' && ia.foco && ia.foco !== 'equilibrado') crit.mode = ia.foco;
  crit.vazio = !(crit.mechs.length || crit.roles.length || crit.types.length || crit.genders.length || crit.races.length || crit.tags.length
    || crit.affs.length || crit.rars.length || crit.names.length || crit.refs.length || crit.excl || crit.geral);
  return crit;
}
// Resumo dos times (só dados do site) que vai para a IA escrever a explicação.
function iaTimesPayload(list, crit){
  return list.map(o => {
    const pil = teamPillars(o.team);
    return {
      membros: o.team.filter(Boolean).map(id => { const c = getChar(id); return { nome: kzNome(c.name), papeis: rolesOf(c).slice(0, 3).map(r => ROLE_INFO[r].label), principal: crit.names.includes(id) }; }),
      pilares: Object.fromEntries(PILLAR_ORDER.map(k => [PILLARS[k].label, Math.round(pil[k] * 10) / 10])),
      faltam: missingPillars(o.team).map(k => PILLARS[k].label),
      combos: o.combos, maiorCadeia: (o.longest || 0) + 1,
      sinergias: synergyReport(o.team).ativos.slice(0, 4).map(a => `${a.nome}: ${kzTrad(a.txt)}`),
    };
  });
}
// Explicação feita só pelas regras (reserva quando a IA não responde): frentes fortes/fracas, combos e sinergias do time.
function descExplicaLocal(o, crit){
  const ids = o.team.filter(Boolean), n = ids.length, scale = Math.max(n / 6, 0.5);
  const pil = teamPillars(o.team), miss = missingPillars(o.team);
  const fortes = [], fracos = [];
  PILLAR_ORDER.forEach(k => { if(pil[k] >= PILLARS[k].target * scale && !miss.includes(k)) fortes.push(kzt('exp.forte.' + k)); });
  if(o.combos >= 30) fortes.push(kzt('exp.forteCombos', { n: o.combos, c: (o.longest || 0) + 1 }));
  const syn = synergyReport(o.team).ativos;
  if(syn.length) fortes.push(kzt('exp.forteSinergias', { n: syn.length }));
  miss.forEach(k => fracos.push(kzt('exp.fraco.' + k)));
  if(!fracos.length) fracos.push(kzt('exp.fracoNenhum'));
  const principais = (crit.principais && crit.principais.length ? crit.principais : crit.names.filter(id => ids.includes(id))).map(getChar).filter(Boolean).slice(0, 2);
  const topo = PILLAR_ORDER.slice().sort((a, b) => pil[b] / PILLARS[b].target - pil[a] / PILLARS[a].target)[0];
  const titulo = principais.length ? kzt('exp.tituloPrincipal', { nome: kzNome(principais[0].name) }) + ' · ' + kzt('exp.tituloFoco', { p: PILLARS[topo].label })
    : crit.mode === 'combos' ? kzt('exp.tituloCombos')
    : !miss.length ? kzt('exp.tituloEquilibrado') : kzt('exp.tituloPilar', { p: PILLARS[topo].label });
  const comp = PILLAR_ORDER.map(k => PILLARS[k].label + ' ' + (Math.round(pil[k] * 10) / 10).toString().replace('.', KZ_DECIMAL)).join(' · ');
  const resumo = kzt('exp.resumo', { n, comp, combos: o.combos, c: (o.longest || 0) + 1 });
  return { titulo, resumo, como_jogar: '', pontos_fortes: fortes.slice(0, 3), pontos_fracos: fracos.slice(0, 3), ia: false };
}
// Pede à IA a explicação dos times já montados; quando chega, troca a explicação local pela da IA (se o pedido ainda for o mesmo).
async function iaExplicarTimes(r){
  if(!iaDisponivel() || !r.list.length) return;
  r.iaEstado = 'carregando'; render();
  const resp = await iaChamar({ acao:'explicar', texto: r.texto, times: iaTimesPayload(r.list, r.crit) });
  if(state.descRes !== r) return;
  if(resp && Array.isArray(resp.times) && resp.times.length === r.list.length){ r.ia = resp.times; r.iaEstado = 'ok'; }
  else { r.iaEstado = 'falhou'; r.iaMsg = state.iaAviso || ''; }
  render();
}
async function runDescribeTeam(text){
  const txt = String(text || '').trim().slice(0, 200);
  state.descText = txt;
  if(!txt){ state.descRes = null; render(); return; }
  state.iaAviso = '';
  let crit = parseTeamPrompt(txt);
  // IA: entende pedidos mais soltos ("com X como principal", "sem controle fraco") e soma ao que a leitura local achou
  let usouIa = false;
  if(iaDisponivel()){
    showToast(kzt('desc.montandoToast'));
    const porNome = new Map(state.characters.map(c => [kzNome(c.name), c.id]));
    const r = await iaChamar({ acao:'interpretar', texto: txt, elenco: [...porNome.keys()] });
    if(r && r.crit && !r.vazio){ crit = descMesclarIa(crit, r.crit, porNome); usouIa = true; }
  }
  // ideias da Comunidade: carrega os posts se ainda não vieram
  if(isSupabaseConfigured() && !state.communityLoaded && !state.communityLoading){ try{ await refreshCommunity(); }catch(e){} }
  const coms = descPostsParecidos(crit, txt);
  if(crit.vazio){ state.descRes = { texto:txt, crit, vazio:true, list:[], com:coms }; render(); return; }
  crit._com = descPostsBonus(coms);
  showToast(kzt('desc.montandoToast'));
  setTimeout(() => {
    const r = buildDescribedTeams(crit, 3);
    const res = { texto:txt, crit, ...r, com:coms, usouIa, iaEstado: '', iaMsg: state.iaAviso || '' };
    state.descRes = res;
    render();
    iaExplicarTimes(res);
  }, 30);
}
function renderDescExplica(o, i, r){
  const ia = r.ia && r.ia[i];
  const e = ia ? { ...ia, ia: true } : descExplicaLocal(o, r.crit);
  const lista = (cls, itens) => itens && itens.length ? `<ul class="${cls}">${itens.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '';
  const tag = ia ? `<span class="kz-ia-tag" title="${escapeAttr(kzt('ia.tagAjuda'))}">${kzt('ia.tag')}</span>`
    : r.iaEstado === 'carregando' ? `<span class="kz-ia-tag wait">${kzt('ia.gerando')}</span>` : '';
  return `<div class="kz-desc-exp">
    <div class="kz-desc-exp-tit"><b>${escapeHtml(e.titulo)}</b>${tag}</div>
    <p>${escapeHtml(e.resumo)}</p>
    ${e.como_jogar ? `<p class="como"><b>${kzt('exp.comoJogar')}</b> ${escapeHtml(e.como_jogar)}</p>` : ''}
    <div class="kz-desc-exp-cols">${lista('fortes', e.pontos_fortes)}${lista('fracos', e.pontos_fracos)}</div>
  </div>`;
}
function applyDescOption(i){
  const o = state.descRes && state.descRes.list[i];
  if(!o) return;
  const prev = [...state.team];
  commitTeam([...o.team]);
  state.optUndo = { before:prev, after:[...o.team] };
  state.optInfo = kzt('desc.infoMontada', { texto: escapeHtml(state.descRes.texto), combos: o.combos, bal: Math.round(o.balance * 100) });
  render();
  showToast(kzt('auto.toastMontada'));
}
const DESC_EXAMPLES = kzt('desc.exemplos').split('|');
function renderDescribePanel(){
  const r = state.descRes;
  let out = '';
  if(r){
    if(r.vazio){
      out = (r.com && r.com.length ? `<p class="kz-desc-msg">${kzt('desc.naoMontou')}</p>`
        : `<p class="kz-desc-msg warn">${kzt('desc.naoEntendi')}</p>`) + renderDescComunidade(r.com);
    } else {
      const chips = r.crit.labels.concat(r.crit.names.map(id => { const c = getChar(id); return c ? kzNome(c.name) : ''; }).filter(Boolean)).map(l => `<span class="kz-desc-chip">${escapeHtml(l)}</span>`).join('');
      const aviso = !r.list.length ? kzt('desc.nenhumAtende')
        : (r.hasSoft && r.relevantN < 6) ? kzt(r.relevantN === 1 ? 'desc.poucos1' : 'desc.poucosN', { n: r.relevantN })
        : (!r.hasSoft && r.hardN < 6) ? kzt(r.hardN === 1 ? 'desc.filtros1' : 'desc.filtrosN', { n: r.hardN }) : '';
      out = `<div class="kz-desc-understood"><span>${kzt('desc.entendi')}</span>${chips}</div>
        ${aviso ? `<p class="kz-desc-msg warn">${aviso}</p>` : ''}
        ${r.list.length && (r.ia || r.usouIa) ? `<p class="kz-ia-nota">${kzt('ia.nota')}</p>` : r.list.length && r.iaMsg ? `<p class="kz-ia-nota">${escapeHtml(r.iaMsg)}</p>` : ''}
        ${r.list.length ? `<div class="kz-auto-rows">${r.list.map((o, i) => renderDescOptionRow(o, i, r)).join('')}</div>` : ''}
        ${renderDescComunidade(r.com)}`;
    }
  }
  return `<section class="kz-desc" aria-label="${kzt('desc.titulo')}">
    <div class="kz-desc-head"><span class="kz-label">${kzt('desc.titulo')}</span><span class="kz-desc-sub">${kzt('desc.sub')}</span></div>
    <form class="kz-desc-form" id="descForm" autocomplete="off">
      <label for="descInput" class="kz-sr">${kzt('desc.srLabel')}</label>
      <input type="text" id="descInput" class="kz-input" maxlength="200" placeholder="${kzt('desc.placeholder')}" value="${escapeAttr(state.descText || '')}">
      <button type="submit" class="kz-btn kz-btn-primary" id="descBtn">${kzt('desc.montar')}</button>
      ${r ? `<button type="button" class="kz-btn" id="descClear">${kzt('desc.limpar')}</button>` : ''}
    </form>
    <div class="kz-desc-ex"><span>${kzt('desc.exemplosLabel')}</span>${DESC_EXAMPLES.map(e => `<button type="button" class="kz-desc-exbtn" data-desc-ex="${escapeAttr(e)}">${escapeHtml(e)}</button>`).join('')}</div>
    ${out}
  </section>`;
}
function renderDescOptionRow(o, i, r){
  const minis = o.team.map((id, slot) => {
    const c = id && getChar(id);
    return c ? `<span class="kz-auto-mini" title="${escapeAttr(kzt('time.casaNome', { n: slot + 1, nome: kzNome(c.name) }))}">${portraitInner(c)}</span>` : '<span class="kz-auto-mini empty"></span>';
  }).join('');
  const why = o.why.map(w => { const c = getChar(w.id); return c ? `<div class="kz-desc-why"><b>${escapeHtml(kzNome(c.name))}</b>${w.tags.length ? ' — ' + w.tags.map(escapeHtml).join(', ') : ''}</div>` : ''; }).join('');
  return `<div class="kz-auto-row${i === 0 ? ' top' : ''}">
    <div class="kz-auto-row-team">${minis}</div>
    <div class="kz-auto-row-info"><b>${i === 0 ? kzt('auto.melhor') : kzt('auto.opcao', { n: i + 1 })}</b>
      <span>${r.hasSoft ? `${kzt('desc.combinam', { m: '<b>' + o.match + '</b>', n: o.team.filter(Boolean).length })} · ` : ''}${kzt('desc.linhaCombos', { combos: '<b>' + o.combos + '</b>', bal: '<b>' + Math.round(o.balance * 100) + '</b>' })}</span></div>
    <button type="button" class="kz-btn kz-btn-sm kz-btn-primary" data-desc-apply="${i}">${kzt('auto.usar')}</button>
    ${renderDescExplica(o, i, r)}
    <div class="kz-desc-whys">${why}</div>
  </div>`;
}

/* ======================= COMUNIDADE (times e tier lists compartilhados) ======================= */
// Qualquer um vê; pra publicar, curtir ou denunciar precisa estar logado com Discord. Tudo mora no Supabase
// (tabelas community_posts / community_likes / community_reports — SQL no comentário de instalação lá em cima).
// O que vem do banco é tratado como NÃO confiável: passa por sanitizeCommunityData e sempre sai com escapeHtml.
const COMMUNITY = { title: 60, desc: 300, maxPostsPerUser: 30, cooldownMs: 60000, fetchLimit: 80, minTeam: 2, minTierItems: 3,
  teamLimit: 2, teamLimitSupporter: 5, supporterMin: 10 };
// Times publicados ao mesmo tempo: 2 pra todo mundo; quem apoiou com R$ 10+ (acumulado, apoio vinculado ao login) tem 5.
// A regra de verdade mora no banco (policy do SQL); aqui é só pra avisar a pessoa antes de tentar.
function communityTeamLimit(){
  const me = state.discordUser && state.discordUser.id;
  if(!me) return COMMUNITY.teamLimit;
  const total = state.myDonationTotal != null ? state.myDonationTotal : (state.donors || []).filter(d => d.linkedUserId === me && d.active !== false).reduce((n, d) => n + (Number(d.amount) || 0), 0);
  return total >= COMMUNITY.supporterMin ? COMMUNITY.teamLimitSupporter : COMMUNITY.teamLimit;
}
function communityMyTeamCount(){
  const me = state.discordUser && state.discordUser.id;
  return me ? (state.communityPosts || []).filter(p => p.userId === me && p.kind === 'team').length : 0;
}
function communityTeamLimitMsg(){
  const lim = communityTeamLimit();
  return lim < COMMUNITY.teamLimitSupporter
    ? kzt('com.limiteMsg1', { lim, valor: kzValorBRL(COMMUNITY.supporterMin), max: COMMUNITY.teamLimitSupporter })
    : kzt('com.limiteMsg2', { lim });
}

function communityIdOk(id){ return typeof id === 'string' && /^[\w.:\-]{1,64}$/.test(id); }
function sanitizeCommunityData(kind, data){
  if(!data || typeof data !== 'object') return null;
  if(kind === 'team'){
    if(!Array.isArray(data.team)) return null;
    const t = data.team.slice(0, 6).map(id => communityIdOk(id) ? id : null);
    while(t.length < 6) t.push(null);
    // nível de estrela (1 a 10: 1-5 douradas, 6-10 azuis) de cada guerreiro, vindo da Coleção de quem postou
    const levels = {};
    if(data.levels && typeof data.levels === 'object') t.filter(Boolean).forEach(id => {
      const v = Math.floor(Number(data.levels[id]));
      if(v >= 1 && v <= 15) levels[id] = v;
    });
    return t.some(Boolean) ? { team: t, levels } : null;
  }
  if(kind === 'tierlist'){
    if(!Array.isArray(data.tiers)) return null;
    const tiers = data.tiers.slice(0, 10).map(t => ({
      label: String((t && t.label) || '').slice(0, 16),
      color: /^#[0-9a-f]{6}$/i.test((t && t.color) || '') ? t.color : '#5b7fa6',
      items: Array.isArray(t && t.items) ? t.items.filter(communityIdOk).slice(0, 100) : [],
    })).filter(t => t.items.length);
    return tiers.length ? { tiers } : null;
  }
  return null;
}
// O que seria publicado agora (equipe do campo ou tier list atual); null se estiver vazio demais.
// Guerreiros que a pessoa marcou como adquiridos na Coleção (só eles podem entrar num time compartilhado).
function communityOwnedChars(){
  return sortByRarity(state.characters.filter(c => getEntry(c.id).owned));
}
// Cinco estrelas: douradas no nível 1-5, azuis no 6-10 (igual à aba Coleção).
function communityStarsHtml(lv){
  lv = Math.floor(Number(lv)) || 0;
  if(lv < 1 || lv > 15) return '';
  const phase = starPhase(lv), n = starFilled(lv);
  return `<span class="kz-com-stars ${phase === 'gold' ? 'gold' : phase}" title="${kzt('com.estrelasTitulo', { fase: STAR_PHASE_NAME[phase], n, lv })}"><span class="s">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span><span class="n">${kzt('com.nivelCurto', { lv })}</span></span>`;
}
// Sempre 6 casas, na ordem das casas (1 a 6); posição vazia é null.
function communityNormTeam(t){
  const a = (Array.isArray(t) ? t : []).slice(0, 6).map(x => x || null);
  while(a.length < 6) a.push(null);
  return a;
}
// O que seria publicado agora. Time: os guerreiros escolhidos no formulário (compose.team), todos da Coleção, com o
// nível de estrela que cada um tem lá. Tier list: a tier list atual. null se estiver vazio demais.
function communityShareData(kind, compose){
  if(kind === 'team'){
    // mantém a posição de cada casa; guerreiro que não está adquirido na Coleção vira casa vazia
    const ids = communityNormTeam(compose && compose.team).map(id => (id && getChar(id) && getEntry(id).owned) ? id : null);
    if(ids.filter(Boolean).length < COMMUNITY.minTeam) return null;
    const levels = {};
    ids.filter(Boolean).forEach(id => { const lv = Math.floor(Number(getEntry(id).level)) || 0; if(lv > 0) levels[id] = Math.min(15, lv); });
    return sanitizeCommunityData('team', { team: ids, levels });
  }
  const known = new Set(state.characters.map(c => c.id));
  const d = sanitizeCommunityData('tierlist', { tiers: ((state.tierList && state.tierList.tiers) || []).map(t => ({ label: t.label, color: t.color, items: (t.items || []).filter(id => known.has(id)) })) });
  return d && d.tiers.reduce((n, t) => n + t.items.length, 0) >= COMMUNITY.minTierItems ? d : null;
}
function communityPostFromRow(r){
  const kind = r && (r.kind === 'tierlist' ? 'tierlist' : r.kind === 'team' ? 'team' : null);
  if(!kind) return null;
  const data = sanitizeCommunityData(kind, r.data);
  if(!data) return null;
  const cnt = a => (Array.isArray(a) && a[0] && Number(a[0].count)) || 0;
  return {
    id: String(r.id), userId: r.user_id || null, kind, data,
    title: String(r.title || '').slice(0, COMMUNITY.title),
    desc: String(r.description || '').slice(0, COMMUNITY.desc),
    author: String(r.author_name || kzt('com.anonimo')).slice(0, 40),
    createdAt: r.created_at || '',
    likes: cnt(r.community_likes), reports: cnt(r.community_reports),
  };
}
function communityAgo(iso){
  const t = Date.parse(iso);
  if(!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if(s < 60) return kzt('com.agora');
  if(s < 3600) return kzt('com.haMin', { n: Math.floor(s / 60) });
  if(s < 86400) return kzt('com.haH', { n: Math.floor(s / 3600) });
  if(s < 86400 * 30) return kzt('com.haD', { n: Math.floor(s / 86400) });
  return new Date(t).toLocaleDateString(KZ_LOCALE);
}

async function refreshCommunity(){
  if(!isSupabaseConfigured() || state.communityLoading) return;
  state.communityLoading = true;
  const me = state.discordUser ? state.discordUser.id : null;
  try{
    const { data, error } = await window.__sb.client.from('community_posts')
      .select('id,user_id,kind,title,description,data,author_name,created_at,community_likes(count),community_reports(count)')
      .order('created_at', { ascending: false }).limit(COMMUNITY.fetchLimit);
    if(error) throw error;
    state.communityPosts = (data || []).map(communityPostFromRow).filter(Boolean);
    state.communityMyLikes = [];
    if(me){
      const r = await window.__sb.client.from('community_likes').select('post_id').eq('user_id', me);
      if(!r.error) state.communityMyLikes = (r.data || []).map(x => x.post_id);
    }
    state.communityError = null;
  }catch(e){
    console.error('Não consegui carregar a Comunidade', e);
    state.communityError = kzt('com.erroCarregar');
  }
  state.communityLoading = false;
  state.communityLoaded = true;
  state.communityFor = me;
  if(state.tab === 'comunidade') render();
}

function communityTeamStats(p){
  if(p._stats) return p._stats;
  const team = p.data.team.map(id => (id && getChar(id)) ? id : null);
  const st = comboStatsFor(team);
  p._stats = {
    team, filled: team.filter(Boolean).length, missingChars: p.data.team.filter(Boolean).length - team.filter(Boolean).length,
    combos: st.total, max: comboMaxFor(team).max, longest: st.longest + 1,
    balance: Math.round(balanceScore(team) * 100), missing: missingPillars(team),
  };
  return p._stats;
}
function communityPostHay(p){
  if(p._hay) return p._hay;
  const ids = p.kind === 'team' ? p.data.team.filter(Boolean) : p.data.tiers.flatMap(t => t.items);
  const names = ids.map(id => { const c = getChar(id); return c ? c.name : ''; });
  p._hay = [p.title, p.desc, p.author, ...names].join(' ').toLowerCase();
  return p._hay;
}
function communityVisiblePosts(){
  const q = (state.communitySearch || '').trim().toLowerCase();
  let list = (state.communityPosts || []).filter(p =>
    (state.communityFilter === 'all' || p.kind === state.communityFilter) && (!q || communityPostHay(p).includes(q)));
  list = [...list].sort((a, b) => state.communitySort === 'likes'
    ? (b.likes - a.likes) || (Date.parse(b.createdAt) - Date.parse(a.createdAt))
    : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return list;
}
function communityThumb(id, big){
  const c = getChar(id);
  if(!c) return '';
  return `<span class="kz-com-thumb${big ? ' big' : ''}" title="${escapeAttr(kzNome(c.name))}">${portraitInner(c)}</span>`;
}
// Mesmo visual do Montador de Combos: casas 4-5-6 na coluna da esquerda e 1-2-3 na da direita, cada uma com
// retrato, nome, papéis, Persegue/Causa — e aqui também o nível de estrela de cada guerreiro.
function renderCommunityTeamBody(p){
  const s = communityTeamStats(p);
  const lvs = p.data.levels || {};
  const slots = SLOT_VISUAL_ORDER.map(i => {
    const id = p.data.team[i], c = id && getChar(id);
    return slotCardHtml(c || null, i, { ro: true, attrs: '', draggable: false, stars: c ? communityStarsHtml(lvs[id]) : '', hint: kzt('com.vazia') });
  }).join('');
  return `${comboCountHtml(s.team)}${compositionHtml(s.team)}
    ${visualNovo() ? nvLineupHtml(p.data.team) : ''}
    <div class="kz-slots kz-com-slotsview">${slots}</div>
    ${s.missingChars ? `<div class="kz-muted" style="font-size:12px;">${kzt('com.guerreirosAusentes', { n: s.missingChars })}${''}</div>` : ''}`;
}
function renderCommunityTierBody(p){
  return `<div class="kz-com-tiers">${p.data.tiers.map(t => `
    <div class="kz-com-tier"><span class="kz-com-tier-label" style="background:${t.color};">${escapeHtml(t.label || '—')}</span>
      <span class="kz-com-tier-items">${t.items.map(id => communityThumb(id)).join('')}</span></div>`).join('')}</div>`;
}
// Autor clicável: abre o popup com o perfil dele.
function communityAuthorLink(p){
  return `<button type="button" class="kz-com-author" data-com-profile="${escapeAttr(p.userId || '')}" title="${escapeAttr(kzt('com.verPerfilDe', { nome: p.author }))}">${escapeHtml(p.author)}</button>`;
}
function communityDonorOf(userId){
  return userId ? (state.donors || []).find(d => d.linkedUserId === userId) || null : null;
}
// Prévia curta pra lista: 6 retratos na ordem das casas (time) ou os ranks com quantos guerreiros cada um tem (tier list).
function renderCommunityPreview(p){
  if(p.kind === 'team' && visualNovo()) return nvLineupHtml(p.data.team, true);
  if(p.kind === 'team'){
    return `<div class="kz-com-pv-team">${p.data.team.map(id => { const c = id && getChar(id); return c ? `<span class="kz-com-thumb big" title="${escapeAttr(kzNome(c.name))}">${portraitInner(c)}</span>` : `<span class="kz-com-thumb big empty"></span>`; }).join('')}</div>`;
  }
  const tiers = p.data.tiers;
  const top = tiers[0].items.slice(0, 6);
  return `<div class="kz-com-pv-tier"><div class="kz-com-pv-chips">${tiers.slice(0, 6).map(t => `<span class="kz-com-pv-chip" style="background:${t.color};">${escapeHtml(t.label || '—')}<b>${t.items.length}</b></span>`).join('')}</div>
    <div class="kz-com-pv-team">${top.map(id => communityThumb(id, true)).join('')}</div></div>`;
}
// Card da lista no visual novo (canvas): autor, tipo, título, formação em faixas (ou os 3 primeiros ranks), a maior
// cadeia do time e as ações (curtir, abrir no montador / copiar a tier list). Clicar fora dos botões abre o post.
function renderCommunityCardNovo(p){
  const donor = communityDonorOf(p.userId);
  const liked = (state.communityMyLikes || []).includes(p.id);
  let corpo = '';
  if(p.kind === 'team'){
    const team = p.data.team.map(id => id && getChar(id) ? id : null);
    const s = team.some(Boolean) ? comboSummary(team) : null;
    const bc = s && s.best && getChar(s.best.charId);
    corpo = nvLineupHtml(p.data.team, true)
      + (bc ? `<div class="kz-nvco-chain"><span class="kz-nvco-hit">${kzt('com.maiorCadeia', { n: s.best.n + 1 })}</span>${kzt('com.maiorCadeiaDe')} ${escapeHtml(kzNome(bc.name))} (${ABILITY_LABEL[s.best.key]})</div>` : '');
  } else {
    corpo = `<div class="kz-nvco-tiers">${p.data.tiers.slice(0, 3).map(t => `<div class="kz-nvco-tr"><span class="r" style="--tc:${t.color}">${escapeHtml(t.label || '—')}</span><div class="row">${t.items.slice(0, 9).map(id => communityThumb(id)).join('')}${t.items.length > 9 ? `<span class="more">+${t.items.length - 9}</span>` : ''}</div></div>`).join('')}</div>`;
  }
  return `
  <article class="kz-com-card kz-nvco" data-com-open="${escapeAttr(p.id)}" tabindex="0" role="button" aria-label="${escapeAttr(kzt('com.abrirPost', { titulo: p.title }))}">
    <div class="kz-nvco-who"><span class="av" aria-hidden="true">${escapeHtml(initials(p.author))}</span><div><span class="wn">${communityAuthorLink(p)}${donor ? ' ' + patenteBadgeHtml(donor, '', linkedProfileFor(donor)) : ''}</span><span class="ws">${escapeHtml(communityAgo(p.createdAt))}</span></div><span class="kind${p.kind === 'team' ? '' : ' tl'}">${p.kind === 'team' ? kzt('com.tipoTime') : kzt('banda.tierlist')}</span></div>
    <h3 class="kz-nvco-pt">${escapeHtml(p.title)}</h3>
    ${corpo}
    ${p.desc ? `<p class="kz-nvco-desc">${escapeHtml(p.desc)}</p>` : ''}
    <div class="kz-nvco-act">
      <button type="button" class="kz-nvco-like${liked ? ' on' : ''}" data-com-like="${escapeAttr(p.id)}" aria-pressed="${liked}"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="${liked ? '#FFF4E6' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"/></svg>${liked ? kzt('com.curtido') : kzt('com.curtir')}<b>${p.likes}</b></button>
      ${p.kind === 'team'
        ? `<button type="button" class="kz-btn" data-com-load="${escapeAttr(p.id)}"><span class="kj" aria-hidden="true">連</span>${kzt('com.abrirMontador')}</button>`
        : `<button type="button" class="kz-btn" data-com-copy="${escapeAttr(p.id)}"><span class="kj" aria-hidden="true">番</span>${kzt('com.copiarTier')}</button>`}
    </div>
  </article>`;
}
function communityCtaHtml(){
  return `
  <div class="kz-nvco-cta">
    <span class="kj" aria-hidden="true">社</span>
    <h3>${nvTtl(kzt('com.mostreSeuTime'))}</h3>
    <p>${kzt('com.ctaTexto')}</p>
    <button type="button" class="kz-btn kz-btn-primary" data-com-cta>${kzt('com.montarTime')}</button>
  </div>`;
}
// Card da lista: só o essencial. Clicar abre o post; clicar no nome do autor abre o perfil dele.
function renderCommunityCard(p){
  if(visualNovo()) return renderCommunityCardNovo(p);
  const donor = communityDonorOf(p.userId);
  return `
  <article class="kz-com-card clean" data-com-open="${escapeAttr(p.id)}" tabindex="0" role="button" aria-label="${escapeAttr(kzt('com.abrirPost', { titulo: p.title }))}">
    ${renderCommunityPreview(p)}
    <div class="kz-com-card-top"><span class="kz-com-kind ${p.kind}">${p.kind === 'team' ? kzt('com.rotuloTime') : kzt('com.rotuloTier')}</span><span class="kz-com-likes">♥ ${p.likes}</span></div>
    <h3 class="kz-com-title">${escapeHtml(p.title)}</h3>
    <div class="kz-com-card-by">${communityAuthorLink(p)}${donor ? ' ' + patenteBadgeHtml(donor, '', linkedProfileFor(donor)) : ''}<span class="kz-com-ago">${escapeHtml(communityAgo(p.createdAt))}</span></div>
  </article>`;
}
// Tela do post: time/tier list completos + ações.
function renderCommunityActions(p){
  const me = state.discordUser ? state.discordUser.id : null;
  const liked = (state.communityMyLikes || []).includes(p.id);
  const mine = me && p.userId === me;
  const canDelete = mine || isDonorAdmin();
  const reported = (state.communityReported || []).includes(p.id);
  return `
    <footer class="kz-com-foot">
      <button type="button" class="kz-com-like${liked ? ' on' : ''}" data-com-like="${escapeAttr(p.id)}" title="${liked ? kzt('com.tirarCurtida') : kzt('com.curtir')}"><span class="h">♥</span><b>${p.likes}</b></button>
      ${p.kind === 'team'
        ? `<button type="button" class="kz-btn kz-btn-sm kz-btn-primary" data-com-load="${escapeAttr(p.id)}">${kzt('com.usarTime')}</button>`
        : `<button type="button" class="kz-btn kz-btn-sm kz-btn-primary" data-com-copy="${escapeAttr(p.id)}">${kzt('com.copiarParaMinha')}</button>`}
      <span class="kz-com-spacer"></span>
      ${isDonorAdmin() && p.reports ? `<span class="kz-com-reports" title="Denúncias recebidas">⚑ ${p.reports}</span>` : ''}
      ${!mine ? `<button type="button" class="kz-com-link" data-com-report="${escapeAttr(p.id)}" ${reported ? 'disabled' : ''}>${reported ? kzt('com.denunciado') : kzt('com.denunciar')}</button>` : ''}
      ${canDelete ? `<button type="button" class="kz-com-link danger" data-com-del="${escapeAttr(p.id)}">${kzt('com.excluir')}</button>` : ''}
    </footer>`;
}
function renderCommunityDetail(p){
  const donor = communityDonorOf(p.userId);
  return `
  <section class="kz-page">
    <div class="kz-com-detail-top"><button type="button" class="kz-back-btn" id="comBackBtn"><span class="arr">←</span><span>${kzt('com.voltar')}</span></button></div>
    <article class="kz-panel kz-com-detail" data-com-id="${escapeAttr(p.id)}">
      <header class="kz-com-head">
        <span class="kz-com-kind ${p.kind}">${p.kind === 'team' ? kzt('com.rotuloTime') : kzt('com.rotuloTier')}</span>
        <span class="kz-com-by">${kzt('com.por')} ${communityAuthorLink(p)}${donor ? ' ' + patenteBadgeHtml(donor, '', linkedProfileFor(donor)) : ''}<span class="kz-com-ago">${escapeHtml(communityAgo(p.createdAt))}</span></span>
      </header>
      <h1 class="kz-com-detail-title">${escapeHtml(p.title)}</h1>
      ${p.desc ? `<p class="kz-com-desc">${escapeHtml(p.desc)}</p>` : ''}
      ${p.kind === 'team' ? renderCommunityTeamBody(p) : renderCommunityTierBody(p)}
      ${p.kind === 'team' && !Object.keys(p.data.levels || {}).length && state.discordUser && state.discordUser.id === p.userId ? `<div class="kz-muted" style="font-size:12.5px;">${kzt('com.semNiveis')}</div>` : ''}
      ${renderCommunityActions(p)}
    </article>
  </section>`;
}

// Perfil do autor (popup). Dados públicos só quando a própria pessoa marcou o perfil como público; o resto vem dos posts.
function communityProfileModalHtml(userId){
  const posts = (state.communityPosts || []).filter(p => p.userId === userId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const prof = (state.profiles || []).find(x => x.id === userId && x.public) || null;
  const donor = communityDonorOf(userId);
  const linked = donor ? linkedProfileFor(donor) : null;
  const name = (prof && prof.nickname) || (posts[0] && posts[0].author) || kzt('com.jogador');
  const me = state.discordUser && state.discordUser.id === userId;
  const teams = posts.filter(p => p.kind === 'team').length, tiers = posts.length - teams;
  const likes = posts.reduce((n, p) => n + p.likes, 0);
  const socials = prof && prof.showSocials ? [prof.instagram, prof.twitch, prof.youtube].filter(Boolean) : [];
  return `
  <div class="modal-overlay" id="comProfileOverlay">
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <h2>${escapeHtml(name)}</h2>
        <button class="kz-close-btn" id="closeComProfileBtn" aria-label="${kzt('comum.fechar')}">✕</button>
      </div>
      <div class="modal-body" style="align-items:center;text-align:center;">
        <span class="kz-donor-avatar" style="width:72px;height:72px;font-size:24px;">${donorAvatarInner(name)}</span>
        <div class="kz-pill-row" style="justify-content:center;">
          ${donor ? patenteBadgeHtml(donor, '', linked) : ''}
          ${donor && (donor.honras || []).length ? donor.honras.map(honraBadgeHtml).join('') : ''}
          ${me ? `<span class="kz-com-me-tag">${kzt('com.esseEVoce')}</span>` : ''}
        </div>
        ${prof && prof.servidor ? `<div class="kz-donate-note">${kzt('com.servidor')} <b>${escapeHtml(prof.servidor)}</b></div>` : ''}
        ${prof && prof.bio ? `<div class="kz-profile-quote">"${escapeHtml(prof.bio)}"</div>` : ''}
        ${socials.length ? `<div class="kz-donate-note">${socials.map(escapeHtml).join(' · ')}</div>` : ''}
        ${!prof ? `<div class="kz-donate-note">${kzt('com.perfilNaoPublico')}</div>` : ''}
        <div class="kz-com-pstats"><span>${kzt(teams === 1 ? 'com.time1' : 'com.timeN', { n: '<b>' + teams + '</b>' })}</span><span>${kzt(tiers === 1 ? 'com.tier1' : 'com.tierN', { n: '<b>' + tiers + '</b>' })}</span><span>${kzt(likes === 1 ? 'com.curtida1' : 'com.curtidaN', { n: '<b>' + likes + '</b>' })}</span></div>
        ${posts.length ? `<div class="kz-com-pposts"><span class="kz-label">${kzt('com.publicacoes')}</span>${posts.slice(0, 8).map(p => `<button type="button" class="kz-com-ppost" data-com-open="${escapeAttr(p.id)}"><span class="kz-com-kind ${p.kind}">${p.kind === 'team' ? '連' : '番'}</span><span class="t">${escapeHtml(p.title)}</span><span class="l">♥ ${p.likes}</span></button>`).join('')}</div>` : ''}
        ${me ? `<button type="button" class="kz-btn kz-btn-sm" id="comEditProfileBtn">${kzt('com.editarPerfil')}</button>` : ''}
      </div>
    </div>
  </div>`;
}
function renderCommunityProfileModal(){
  const root = document.getElementById('modalRoot');
  if(!root) return;
  root.innerHTML = communityProfileModalHtml(state.communityProfileUser);
  document.getElementById('closeComProfileBtn').addEventListener('click', closeCommunityProfile);
  document.getElementById('comProfileOverlay').addEventListener('click', e => { if(e.target.id === 'comProfileOverlay') closeCommunityProfile(); });
  root.querySelectorAll('[data-com-open]').forEach(b => b.addEventListener('click', () => { state.communityProfileUser = null; openCommunityPost(b.dataset.comOpen); }));
  const edit = document.getElementById('comEditProfileBtn');
  if(edit) edit.addEventListener('click', () => { state.communityProfileUser = null; goTab('perfil'); });
}
function openCommunityProfile(userId){ if(!userId) return; state.communityProfileUser = userId; render(); }
function closeCommunityProfile(){ state.communityProfileUser = null; render(); }
function openCommunityPost(id){ state.communityOpenPost = id; render(); window.scrollTo(0, 0); }

function renderCommunityList(){
  if(state.communityError) return `<div class="kz-panel kz-com-empty">${escapeHtml(state.communityError)}</div>`;
  if(!state.communityLoaded) return `<div class="kz-panel kz-com-empty">${kzt('com.carregando')}</div>`;
  const list = communityVisiblePosts();
  if(!list.length){
    const msg = (state.communityPosts || []).length ? kzt('com.nadaFiltros') : kzt('com.vazioInicial');
    if(visualNovo()) return `<div class="kz-nvco-grid"><div class="kz-panel kz-com-empty">${msg}</div>${communityCtaHtml()}</div>`;
    return `<div class="kz-panel kz-com-empty">${msg}</div>`;
  }
  if(visualNovo()) return `<div class="kz-nvco-grid">${list.map(renderCommunityCard).join('')}${communityCtaHtml()}</div>`;
  return `<div class="kz-com-grid">${list.map(renderCommunityCard).join('')}</div>`;
}
function renderCommunityPickerGrid(c){
  const q = (c.search || '').trim().toLowerCase();
  const sel = new Set(communityNormTeam(c.team).filter(Boolean));
  const list = communityOwnedChars().filter(ch => !q || ch.name.toLowerCase().includes(q));
  if(!list.length) return `<div class="kz-muted">${kzt('com.nenhumGuerreiro')}</div>`;
  return list.map(ch => `<button type="button" class="kz-com-pick${sel.has(ch.id) ? ' on' : ''}" draggable="true" data-com-pick="${escapeAttr(ch.id)}" title="${escapeAttr(kzNome(ch.name))}"><span class="kz-com-thumb">${portraitInner(ch)}</span><span class="nm">${escapeHtml(kzNome(ch.name))}</span>${communityStarsHtml(getEntry(ch.id).level)}</button>`).join('');
}
function renderComposeSlots(c){
  const team = communityNormTeam(c.team);
  return `<div class="kz-slots kz-com-composeslots">${SLOT_VISUAL_ORDER.map(i => {
    const id = team[i], ch = id && getChar(id);
    return slotCardHtml(ch || null, i, {
      sel: c.slotSel === i, attrs: `data-com-slot="${i}"`, removeAttr: `data-com-remove="${i}"`,
      stars: ch ? communityStarsHtml(getEntry(id).level) : '', hint: c.slotSel === i ? kzt('com.escolhaLista') : kzt('com.cliqueEscolha'),
    });
  }).join('')}</div>`;
}
function renderCommunityTeamPart(c){
  c.team = communityNormTeam(c.team);
  if(!communityOwnedChars().length){
    return `<div class="kz-com-nocoll">${kzt('com.semColecao', { coll: '<button type="button" class="kz-com-link" data-com-gocoll>' + kzt('nav.colecao') + '</button>' })}</div>`;
  }
  const filled = c.team.filter(Boolean).length;
  const data = communityShareData('team', c);
  return `<div><span class="kz-label">${kzt('com.seuTime', { n: filled })}</span>
      <div class="kz-muted" style="font-size:12px;margin:2px 0 8px;">${kzt('com.dicaSlots')}</div>
      ${renderComposeSlots(c)}</div>
    <div class="kz-com-pick-tools">
      <input type="text" class="kz-input" id="comPickSearch" placeholder="${kzt('com.buscarColecao')}" value="${escapeAttr(c.search || '')}">
      <button type="button" class="kz-btn kz-btn-sm" id="comFillBtn" title="${kzt('com.usarEquipeTitulo')}">${kzt('com.usarEquipe')}</button>
    </div>
    <div class="kz-com-picker" id="comPicker">${renderCommunityPickerGrid(c)}</div>
    ${data ? '' : `<div class="kz-muted">${kzt('com.escolhaPeloMenos', { n: COMMUNITY.minTeam })}</div>`}`;
}
function renderCommunityCompose(){
  const c = state.communityCompose;
  if(!c) return '';
  c.team = communityNormTeam(c.team);
  const data = c.kind === 'team' ? communityShareData('team', c) : communityShareData('tierlist');
  const lim = communityTeamLimit(), used = communityMyTeamCount();
  const teamFull = c.kind === 'team' && used >= lim;
  let middle;
  if(c.kind === 'team'){
    middle = `<div><span class="kz-label">${kzt('com.previa')}</span><div id="comPreview">${data ? renderCommunityTeamBody({ data }) : ''}</div></div><div class="kz-com-quota${teamFull ? ' full' : ''}">${kzt('com.cota', { n: '<b>' + used + '/' + lim + '</b>' })}${lim < COMMUNITY.teamLimitSupporter ? ' — ' + kzt('com.cotaApoie', { valor: kzValorBRL(COMMUNITY.supporterMin), max: COMMUNITY.teamLimitSupporter }) : ' ' + kzt('com.cotaLimiteApoiador')}${teamFull ? ' ' + kzt('com.cotaExclua') : ''}</div>
      <div id="comTeamPart" class="kz-com-teampart">${renderCommunityTeamPart(c)}</div>`;
  } else {
    middle = `<div><span class="kz-label">${kzt('com.previa')}</span>${data ? renderCommunityTierBody({ data }) : `<div class="kz-muted">${kzt('com.classifique', { n: COMMUNITY.minTierItems })}</div>`}</div>`;
  }
  return `<div class="kz-panel kz-com-compose">
    <div class="kz-com-compose-kinds">
      <button type="button" class="kz-fchip ${c.kind === 'team' ? 'active' : ''}" data-com-kind="team">${kzt('com.meuTime')}</button>
      <button type="button" class="kz-fchip ${c.kind === 'tierlist' ? 'active' : ''}" data-com-kind="tierlist">${kzt('com.minhaTier')}</button>
    </div>
    <div><label class="field-label">${kzt('com.titulo', { n: COMMUNITY.title })}</label>
      <input type="text" id="comTitleInput" maxlength="${COMMUNITY.title}" value="${escapeAttr(c.title)}" placeholder="${kzt('com.tituloPlaceholder')}"></div>
    <div><label class="field-label">${kzt('com.descricao', { n: '<span id="comDescCount">' + c.desc.length + '</span>', max: COMMUNITY.desc })}</label>
      <textarea id="comDescInput" maxlength="${COMMUNITY.desc}" rows="3" placeholder="${kzt('com.descPlaceholder')}">${escapeHtml(c.desc)}</textarea>
      <div class="field-hint" style="font-size:12px;color:var(--text-faint);margin-top:4px;">${kzt('com.descDica')}</div></div>
    ${middle}
    <div class="kz-com-compose-actions">
      <button type="button" class="kz-btn kz-btn-primary" id="comPublishBtn" ${data && !teamFull ? '' : 'disabled'}>${kzt('com.publicar')}</button>
      <button type="button" class="kz-btn" id="comCancelBtn">${kzt('comum.cancelar')}</button>
      <span class="kz-muted" style="font-size:12px;">${kzt('com.seuNome', { nome: escapeHtml(communityAuthorName()) })}</span>
    </div>
  </div>`;
}
// Atualiza só a parte do time (slots + lista + prévia) pra não perder o foco nem a rolagem da lista.
// Atualiza só a parte do time (casas + lista) pra não perder o foco nem a rolagem da lista; a prévia e o botão
// Publicar acompanham.
function refreshComposeTeamPart(){
  const c = state.communityCompose, box = document.getElementById('comTeamPart');
  if(!c || !box){ render(); return; }
  const pk = document.getElementById('comPicker');
  const top = pk ? pk.scrollTop : 0;
  box.innerHTML = renderCommunityTeamPart(c);
  attachComposeTeamHandlers(box);
  const pk2 = document.getElementById('comPicker');
  if(pk2) pk2.scrollTop = top;
  const data = communityShareData('team', c);
  const pub = document.getElementById('comPublishBtn');
  if(pub) pub.disabled = !data || communityMyTeamCount() >= communityTeamLimit();
  const prev = document.getElementById('comPreview');
  if(prev) prev.innerHTML = data ? renderCommunityTeamBody({ data }) : '';
}
// Mesma lógica do Montador: sem casa escolhida, clicar em quem já está tira e senão vai pra primeira casa vazia;
// com casa escolhida, o guerreiro vai pra ela (trocando de lugar se já estava em outra).
function placeComposePick(id){
  const c = state.communityCompose;
  if(!c) return;
  const team = communityNormTeam(c.team);
  const cur = team.indexOf(id);
  let target = c.slotSel;
  if(target === null || target === undefined){
    if(cur > -1){ team[cur] = null; c.team = team; refreshComposeTeamPart(); return; }
    target = team.indexOf(null);
    if(target === -1){ showToast(kzt('com.timeCheio')); return; }
  }
  if(cur > -1) team[cur] = team[target];
  team[target] = id;
  c.slotSel = null;
  c.team = team;
  refreshComposeTeamPart();
}
function swapComposeSlots(a, b){
  const c = state.communityCompose;
  if(!c || a === b) return;
  const team = communityNormTeam(c.team);
  [team[a], team[b]] = [team[b], team[a]];
  c.team = team; c.slotSel = null;
  refreshComposeTeamPart();
}
function attachComposeTeamHandlers(root){
  const c = state.communityCompose;
  const pickClick = b => b.addEventListener('click', () => placeComposePick(b.dataset.comPick));
  root.querySelectorAll('[data-com-pick]').forEach(b => {
    pickClick(b);
    b.addEventListener('dragstart', e => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', 'char:' + b.dataset.comPick); });
  });
  root.querySelectorAll('[data-com-slot]').forEach(s => {
    const idx = parseInt(s.dataset.comSlot, 10);
    s.addEventListener('click', e => {
      if(e.target.closest('[data-com-remove]')) return;
      if(c.slotSel !== null && c.slotSel !== undefined && c.slotSel !== idx){ swapComposeSlots(c.slotSel, idx); return; }
      c.slotSel = c.slotSel === idx ? null : idx;
      refreshComposeTeamPart();
    });
    s.addEventListener('dragstart', e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'slot:' + idx); });
    s.addEventListener('dragover', e => { e.preventDefault(); s.classList.add('drag-over'); });
    s.addEventListener('dragleave', () => s.classList.remove('drag-over'));
    s.addEventListener('drop', e => {
      e.preventDefault(); s.classList.remove('drag-over');
      const [kind, val] = String(e.dataTransfer.getData('text/plain')).split(':');
      if(kind === 'slot') swapComposeSlots(parseInt(val, 10), idx);
      else if(kind === 'char' && communityIdOk(val)){ c.slotSel = idx; placeComposePick(val); }
    });
  });
  root.querySelectorAll('[data-com-remove]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const team = communityNormTeam(c.team);
    team[parseInt(b.dataset.comRemove, 10)] = null;
    c.team = team; c.slotSel = null;
    refreshComposeTeamPart();
  }));
  const go = root.querySelector('[data-com-gocoll]');
  if(go) go.addEventListener('click', () => goTab('collection'));
  const search = root.querySelector('#comPickSearch');
  if(search) search.addEventListener('input', () => {
    c.search = search.value;
    const pk = document.getElementById('comPicker');
    pk.innerHTML = renderCommunityPickerGrid(c);
    pk.querySelectorAll('[data-com-pick]').forEach(b => {
      pickClick(b);
      b.addEventListener('dragstart', e => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', 'char:' + b.dataset.comPick); });
    });
  });
  const fill = root.querySelector('#comFillBtn');
  if(fill) fill.addEventListener('click', () => {
    const field = state.team.map(id => id || null);
    const kept = field.map(id => (id && getChar(id) && getEntry(id).owned) ? id : null);
    const lost = field.filter(Boolean).length - kept.filter(Boolean).length;
    c.team = communityNormTeam(kept); c.slotSel = null;
    if(lost) showToast(kzt('com.ficaramDeFora', { n: lost }));
    else if(!field.some(Boolean)) showToast(kzt('com.ninguemEmCampo'));
    refreshComposeTeamPart();
  });
}
function communityAuthorName(){
  const p = state.myProfile;
  const nick = p && p.public && p.nickname ? p.nickname : '';
  return (nick || (state.discordUser && state.discordUser.username) || kzt('com.anonimo')).slice(0, 40);
}
function renderComunidadeTab(){
  const head = `<div class="kz-page-head">
    <div><h1 class="kz-title">${kzt('nav.comunidade')}</h1>
    <div class="kz-subtitle">${kzt('com.subtitulo')}</div></div>
  </div>`;
  if(!isSupabaseConfigured()){
    return `<section class="kz-page">${head}<div class="kz-panel kz-com-empty">${kzt('com.precisaConta')}</div></section>`;
  }
  const openPost = state.communityOpenPost && (state.communityPosts || []).find(p => p.id === state.communityOpenPost);
  if(openPost) return renderCommunityDetail(openPost);
  const f = state.communityFilter, s = state.communitySort;
  const chip = (attr, val, cur, label) => `<button type="button" class="kz-fchip ${cur === val ? 'active' : ''}" ${attr}="${val}">${label}</button>`;
  const share = state.discordUser
    ? `<button type="button" class="kz-btn kz-btn-primary" id="comOpenBtn">${kzt('com.compartilhar')}</button>`
    : `<button type="button" class="kz-btn kz-btn-primary" id="comLoginBtn">${kzt('com.entrarCompartilhar')}</button>`;
  if(visualNovo()) return `
  <section class="kz-page kz-nvp kz-nvcom">
    ${nvPageHeadHtml({ key:'comunidade', kanji:'社', tag:kzt('deco.comunidade'), title:kzt('nav.comunidade'), size:112, kanjiStyle:'right:26%;top:-60px;font-size:380px',
      sub:kzt('com.subtitulo'), side: share })}
    <div class="kz-nv-toolbar kz-nvco-bar">
      <div class="kz-nv-chipgrp">${chip('data-com-filter', 'all', f, kzt('com.fTudo'))}${chip('data-com-filter', 'team', f, kzt('com.fTimes'))}${chip('data-com-filter', 'tierlist', f, kzt('com.fTiers'))}</div>
      <span class="kz-nvco-sep" aria-hidden="true"></span>
      <div class="kz-nv-chipgrp">${chip('data-com-sort', 'recent', s, kzt('com.sRecentes'))}${chip('data-com-sort', 'likes', s, kzt('com.sCurtidos'))}</div>
      <div class="kz-nv-search sm kz-nvco-find"><div>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFC21A" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>
        <label for="comSearch" class="kz-sr">${kzt('com.buscarNaCom')}</label>
        <input type="text" id="comSearch" placeholder="${kzt('com.buscaNovo')}" value="${escapeAttr(state.communitySearch)}" autocomplete="off">
      </div></div>
      <button type="button" class="kz-nvco-like kz-nvco-refresh" id="comRefreshBtn" title="${kzt('com.recarregar')}" aria-label="${kzt('com.recarregar')}"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg></button>
    </div>
    ${renderCommunityCompose()}
    <div id="comList">${renderCommunityList()}</div>
  </section>`;
  return `<section class="kz-page">${head}
    <div class="kz-com-toolbar">
      <div class="kz-com-chips">
        ${chip('data-com-filter', 'all', f, kzt('com.fTudo'))}${chip('data-com-filter', 'team', f, kzt('com.fTimes'))}${chip('data-com-filter', 'tierlist', f, kzt('com.fTiers'))}
        <span class="kz-com-sep"></span>
        ${chip('data-com-sort', 'recent', s, kzt('com.sRecentes'))}${chip('data-com-sort', 'likes', s, kzt('com.sCurtidos'))}
      </div>
      <input type="text" class="kz-input kz-com-search" id="comSearch" placeholder="${kzt('com.buscaAntigo')}" value="${escapeAttr(state.communitySearch)}">
      <button type="button" class="kz-btn kz-btn-sm" id="comRefreshBtn" title="${kzt('com.recarregar')}">↻</button>
      ${share}
    </div>
    ${renderCommunityCompose()}
    <div id="comList">${renderCommunityList()}</div>
  </section>`;
}

function communityRequireLogin(){
  if(state.discordUser) return true;
  showToast(kzt('com.entreDiscord'));
  return false;
}
async function publishCommunityPost(){
  const c = state.communityCompose;
  if(!c || !communityRequireLogin()) return;
  const title = (c.title || '').trim(), desc = (c.desc || '').trim();
  if(title.length < 3){ showToast(kzt('com.tituloMinimo')); return; }
  const data = communityShareData(c.kind, c);
  if(!data){ showToast(kzt('com.nadaCompartilhar')); return; }
  let last = 0;
  try{ last = Number(localStorage.getItem('kiai_community_last')) || 0; }catch(e){}
  if(Date.now() - last < COMMUNITY.cooldownMs){ showToast(kzt('com.calma')); return; }
  if(c.kind === 'team' && communityMyTeamCount() >= communityTeamLimit()){ showToast(communityTeamLimitMsg()); return; }
  if((state.communityPosts || []).filter(p => p.userId === state.discordUser.id).length >= COMMUNITY.maxPostsPerUser){
    showToast(kzt('com.limitePosts', { n: COMMUNITY.maxPostsPerUser })); return;
  }
  try{
    const { error } = await window.__sb.client.from('community_posts').insert({
      user_id: state.discordUser.id, kind: c.kind, title: title.slice(0, COMMUNITY.title),
      description: desc ? desc.slice(0, COMMUNITY.desc) : null, data, author_name: communityAuthorName(),
    });
    if(error) throw error;
    try{ localStorage.setItem('kiai_community_last', String(Date.now())); }catch(e){}
    state.communityCompose = null;
    state.communityLoaded = false;
    showToast(kzt('com.publicado'));
    render();
    await refreshCommunity();
  }catch(e){
    console.error('Não consegui publicar', e);
    // 42501 = o banco recusou pela regra de limite (ex.: lista local desatualizada)
    showToast(e && e.code === '42501' ? (c.kind === 'team' ? communityTeamLimitMsg() : kzt('com.limitePostsSemN')) : kzt('com.erroPublicar'));
  }
}
async function toggleCommunityLike(id){
  if(!communityRequireLogin()) return;
  const p = (state.communityPosts || []).find(x => x.id === id);
  if(!p) return;
  const had = (state.communityMyLikes || []).includes(id);
  const apply = on => {
    state.communityMyLikes = on ? [...state.communityMyLikes, id] : state.communityMyLikes.filter(x => x !== id);
    p.likes = Math.max(0, p.likes + (on ? 1 : -1));
  };
  apply(!had);
  render();
  try{
    const q = window.__sb.client.from('community_likes');
    const { error } = had ? await q.delete().eq('post_id', id).eq('user_id', state.discordUser.id) : await q.insert({ post_id: id, user_id: state.discordUser.id });
    if(error) throw error;
  }catch(e){
    console.error('Curtida falhou', e);
    apply(had);
    render();
    showToast(kzt('com.erroCurtida'));
  }
}
function deleteCommunityPost(id){
  const p = (state.communityPosts || []).find(x => x.id === id);
  if(!p) return;
  const me = state.discordUser && state.discordUser.id;
  if(!(me && p.userId === me) && !isDonorAdmin()) return;
  customConfirm(kzt('com.excluirConfirma', { titulo: p.title }), async () => {
    try{
      const { error } = await window.__sb.client.from('community_posts').delete().eq('id', id);
      if(error) throw error;
      state.communityPosts = state.communityPosts.filter(x => x.id !== id);
      if(state.communityOpenPost === id) state.communityOpenPost = null;
      showToast(kzt('com.postExcluido'));
      render();
    }catch(e){
      console.error('Exclusão falhou', e);
      showToast(kzt('com.erroExcluir'));
    }
  });
}
async function reportCommunityPost(id){
  if(!communityRequireLogin()) return;
  try{
    const { error } = await window.__sb.client.from('community_reports').insert({ post_id: id, user_id: state.discordUser.id });
    if(error && !/duplicate|23505/i.test((error.code || '') + ' ' + (error.message || ''))) throw error;
    state.communityReported = [...(state.communityReported || []), id];
    showToast(error ? kzt('com.jaDenunciou') : kzt('com.denunciaEnviada'));
    render();
  }catch(e){
    console.error('Denúncia falhou', e);
    showToast(kzt('com.erroDenuncia'));
  }
}
function useCommunityTeam(id){
  const p = (state.communityPosts || []).find(x => x.id === id);
  if(!p || p.kind !== 'team') return;
  const team = communityTeamStats(p).team;
  const go = () => { commitTeam([...team]); goTab('combos'); showToast(kzt('com.timeCarregado')); };
  if(state.team.some(Boolean)) customConfirm(kzt('com.substituirEquipe'), go); else go();
}
function copyCommunityTierList(id){
  const p = (state.communityPosts || []).find(x => x.id === id);
  if(!p || p.kind !== 'tierlist') return;
  customConfirm(kzt('com.substituirTier'), () => {
    state.tierList = {
      tiers: p.data.tiers.map((t, i) => ({ id: 't_c' + i, label: t.label, color: t.color, items: [...t.items] })),
      unranked: [],
    };
    ensureTierListIntegrity();
    saveTierList();
    goTab('tierlist');
    showToast(kzt('com.tierCopiada'));
  });
}

function attachCommunityListHandlers(root){
  const on = (sel, fn) => root.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => fn(b)));
  on('[data-com-like]', b => toggleCommunityLike(b.dataset.comLike));
  on('[data-com-load]', b => useCommunityTeam(b.dataset.comLoad));
  on('[data-com-copy]', b => copyCommunityTierList(b.dataset.comCopy));
  on('[data-com-report]', b => reportCommunityPost(b.dataset.comReport));
  on('[data-com-del]', b => deleteCommunityPost(b.dataset.comDel));
  on('[data-com-profile]', b => openCommunityProfile(b.dataset.comProfile));
  on('[data-com-cta]', () => goTab('combos'));
  // botões dentro do card (visual novo): fazem só a ação deles, sem abrir o post
  root.querySelectorAll('[data-com-profile], [data-com-open] [data-com-like], [data-com-open] [data-com-load], [data-com-open] [data-com-copy]').forEach(b => b.addEventListener('click', e => e.stopPropagation()));
  root.querySelectorAll('[data-com-open]').forEach(card => {
    card.addEventListener('click', () => openCommunityPost(card.dataset.comOpen));
    card.addEventListener('keydown', e => { if((e.key === 'Enter' || e.key === ' ') && e.target === card){ e.preventDefault(); openCommunityPost(card.dataset.comOpen); } });
  });
  const back = document.getElementById('comBackBtn');
  if(back) back.addEventListener('click', () => { state.communityOpenPost = null; render(); window.scrollTo(0, 0); });
}
function attachComunidadeHandlers(){
  const view = document.getElementById('view');
  if(!view || state.tab !== 'comunidade') return;
  // carrega (ou recarrega, se o login mudou desde a última leitura)
  const me = state.discordUser ? state.discordUser.id : null;
  if(isSupabaseConfigured() && !state.communityLoading && (!state.communityLoaded || state.communityFor !== me)) refreshCommunity();
  const on = (sel, fn) => view.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => fn(b)));
  on('[data-com-filter]', b => { state.communityFilter = b.dataset.comFilter; render(); });
  on('[data-com-sort]', b => { state.communitySort = b.dataset.comSort; render(); });
  const search = document.getElementById('comSearch');
  if(search) search.addEventListener('input', () => {
    state.communitySearch = search.value;
    const box = document.getElementById('comList');
    box.innerHTML = renderCommunityList();
    attachCommunityListHandlers(box);
  });
  const refresh = document.getElementById('comRefreshBtn');
  if(refresh) refresh.addEventListener('click', () => { state.communityLoaded = false; render(); });
  const login = document.getElementById('comLoginBtn');
  if(login) login.addEventListener('click', signInWithDiscord);
  const open = document.getElementById('comOpenBtn');
  if(open) open.addEventListener('click', () => {
    if(!state.communityCompose){
      // já vem preenchido com o que está em campo na aba Combos (só quem está na Coleção)
      const team = communityNormTeam(state.team.map(id => (id && getChar(id) && getEntry(id).owned) ? id : null));
      state.communityCompose = { kind: team.filter(Boolean).length >= COMMUNITY.minTeam ? 'team' : (communityShareData('tierlist') ? 'tierlist' : 'team'), title: '', desc: '', team, search: '', slotSel: null };
    }
    render();
  });
  const c = state.communityCompose;
  if(c){
    on('[data-com-kind]', b => { c.kind = b.dataset.comKind; render(); });
    const tp = document.getElementById('comTeamPart');
    if(tp) attachComposeTeamHandlers(tp);
    const t = document.getElementById('comTitleInput');
    if(t) t.addEventListener('input', () => { c.title = t.value; });
    const d = document.getElementById('comDescInput'), cnt = document.getElementById('comDescCount');
    if(d) d.addEventListener('input', () => { c.desc = d.value; if(cnt) cnt.textContent = d.value.length; });
    const pub = document.getElementById('comPublishBtn');
    if(pub) pub.addEventListener('click', publishCommunityPost);
    const cancel = document.getElementById('comCancelBtn');
    if(cancel) cancel.addEventListener('click', () => { state.communityCompose = null; render(); });
  }
  attachCommunityListHandlers(view);
}

/* ======================= COMBOS (MONTADOR) ======================= */
// Coloca um guerreiro do elenco: na casa selecionada (trocando de lugar se ele já estava em
// campo) ou na primeira casa vazia. Sem casa selecionada, clicar em quem já está em campo tira.
function placeChar(id){
  const team = [...state.team];
  const cur = team.indexOf(id);
  let target = state.slotSel;
  if(target === null){
    if(cur > -1){ team[cur] = null; commitTeam(team); return; }
    target = team.indexOf(null);
    if(target === -1){ showToast(kzt('cb.equipeCompleta')); return; }
  }
  if(cur > -1) team[cur] = team[target];
  team[target] = id;
  state.slotSel = null;
  commitTeam(team);
}
function commitTeam(team){
  state.team = team;
  state.simCharId = null;
  saveTeamState();
  render();
}

// Ordem visual fixa das 6 casas no grid de 2 colunas (sem noção de fileira/frente):
// coluna esquerda = 4,5,6 · coluna direita = 1,2,3.
const SLOT_VISUAL_ORDER = [3,0,4,1,5,2];

/* ---------- Montador no visual novo (canvas "Montador de Combos") ---------- */
// Cadeias: número grande de combos, teto da equipe e a maior cadeia.
function nvComboCountHtml(team){
  if(!team.some(Boolean)) return '';
  const s = comboSummary(team), m = comboMaxFor(team);
  const bc = s.best && getChar(s.best.charId);
  return `
      <div class="kz-nvcb-chains">
        <span class="kz-nv-lb">${kzt('cb.cadeias')}</span>
        <div class="kz-nvcb-big"><span class="ctr">${s.total}</span><span class="lbl"><span>${kzt(s.total === 1 ? 'cb.combo1' : 'cb.comboN')}</span><small>${kzt('cb.de', { n: m.max })}</small></span></div>
        <p class="kz-nvcb-txt">${kzt(s.starts === 1 ? 'cb.inicios1' : 'cb.iniciosN', { n: s.starts, a: m.starters, b: m.abilities })}</p>
        ${bc ? `<p class="kz-nvcb-best">${kzt('cb.maiorCadeia', { hit: '<span class="kz-nvco-hit">' + kzt('com.maiorCadeia', { n: s.best.n + 1 }) + '</span>', nome: escapeHtml(kzNome(bc.name)), hab: ABILITY_LABEL[s.best.key] })}</p>`
             : `<p class="kz-nvcb-best">${kzt('cb.nenhumaAtiva')}</p>`}
      </div>`;
}
// Composição: um medidor de 12 tracinhos por papel (cada tracinho = 0,5), equilíbrio e o que falta.
function nvCompositionHtml(team){
  if(!team.some(Boolean)) return '';
  const v = teamPillars(team), miss = missingPillars(team);
  const bal = Math.round(balanceScore(team) * 100);
  const rows = PILLAR_ORDER.map(k=>{
    const info = ROLE_INFO[k], val = Math.round(v[k] * 10) / 10, n = Math.max(0, Math.min(12, Math.round(val * 2)));
    return `<span class="kz-nvcb-rp" style="--c:${info.rgb[0]};--t:${info.rgb[1]}"><span class="g">${info.glyph}</span>${escapeHtml(PILLARS[k].label)}</span>`
      + `<div class="kz-nvcb-gauge" style="--c:${info.rgb[0]}" role="img" aria-label="${escapeAttr(PILLARS[k].label)} ${String(val).replace('.', KZ_DECIMAL)}">${Array.from({ length:12 }, (_, i)=>`<i${i < n ? ' class="f"' : ''}></i>`).join('')}</div>`
      + `<b${val ? '' : ' class="zero"'}>${String(val).replace('.', KZ_DECIMAL)}</b>`;
  }).join('');
  return `
      <div class="kz-nvcb-comp" title="${kzt('comp.tituloAjuda')}">
        <div class="hd"><span class="kz-nv-lb">${kzt('comp.composicao')}</span><span class="bal">${kzt('comp.equilibrio')} <b>${bal}%</b></span></div>
        <div class="kz-nvcb-rows">${rows}</div>
        <span class="kz-nvcb-miss${miss.length ? '' : ' ok'}">${miss.length ? kzt('comp.faltaSemPonto', { lista: miss.map(k => PILLARS[k].label).join(', ') }) : kzt('comp.equilibrada')}</span>
      </div>`;
}
function nvSynergyListHtml(team){
  const syn = synergyReport(team).ativos;
  if(!syn.length) return '';
  return `
      <div class="kz-nvcb-syn">
        <span class="kz-nv-lb">${kzt('comp.sinergiasAtivas', { n: syn.length })}</span>
        <ul>${syn.map(a=>`<li>${synergyItemHtml(a)}</li>`).join('')}</ul>
      </div>`;
}
// Rostinho redondo da cadeia: ícone da pasta Icones; sem ele, a carta.
function nvFaceHtml(c){
  const ico = iconeSrc(c);
  return `<img class="hf" src="${ico || `portraits/mini/${slug(c.name)}.webp`}" alt="" loading="lazy" data-onerr="hide">`;
}
function renderRecommendationsNovo(){
  const filled = state.team.filter(Boolean).length;
  if(!filled) return '';
  const full = filled === 6;
  const rar = state.recRarity || 'all';
  const { miss: faltam, fill, recs } = recListaFor(rar, 8);
  const head = `
      <div class="kz-nvcb-rechead">
        <div><h2>${nvTtl(full ? kzt('cb.quemTroca') : kzt('cb.quemEncaixa'))}</h2>
        <p>${kzt('cb.ordenado')}</p></div>
        <div class="kz-nv-chipgrp"><span class="kz-nv-lb">${kzt('cb.sugerir')}</span>${[['all',kzt('auto.todas')],['SSR',kzt('auto.soSSR')],['SR',kzt('auto.soSR')],['R',kzt('auto.soR')]].map(([v,l])=>`<button type="button" class="kz-fchip ${rar===v?'active':''}" data-rec-rarity="${v}">${l}</button>`).join('')}</div>
      </div>${recFillBarHtml(faltam, fill, true)}`;
  if(!recs.length){
    const msg = full ? (rar !== 'all' ? kzt('cb.nenhumaTrocaRar', { rar }) : kzt('cb.nenhumaTroca'))
      : (rar !== 'all' ? kzt('cb.nenhumGuerreiroRar', { rar }) : kzt('cb.nenhumGuerreiro'));
    return `<section class="kz-rec kz-nvcb-rec">${head}<div class="kz-muted">${msg}</div></section>`;
  }
  const miss = missingPillars(state.team);
  const cards = recs.map((r, i)=>{
    const c = r.char, rep = r.replacedId ? getChar(r.replacedId) : null;
    const p = analyzeRoles(c).pillars, fill = miss.filter(k => p[k] >= 0.6);
    const best = chainsWithChar(r.team, c.id)[0];
    const chain = best ? `
          <div class="kz-nvcb-chainbox"><span class="kz-nv-lb">${kzt('cb.melhorCadeia', { n: '<b>' + best.chain.length + '</b>' })}</span>
          <ol class="kz-nvcb-chain">${best.chain.map((s, j)=>`<li>${j ? '<span class="zap" aria-hidden="true">›</span>' : ''}<span class="hit${s.charId === c.id ? ' me' : ''}"><b>${j + 1}</b>${nvFaceHtml(s.char)}${escapeHtml(kzNome(s.char.name))}${j === 0 ? ` (${ABILITY_LABEL[best.abilityKey]})` : ''}</span></li>`).join('')}</ol></div>` : '';
    return `
      <div class="kz-rec-card kz-nvcb-sug${i === 0 ? ' top' : ''}">
        <div class="art">${portraitInner(c)}</div>
        <div class="body">
          <div class="top"><span class="nm">${escapeHtml(kzNome(c.name))}</span><span class="kz-nvco-hit">${recMotivoLabel(r)}</span><span class="kz-nv-lb mut">${kzt('slot.casa', { n: r.slot + 1 })}</span></div>
          <div class="tags">${rolePillsHtml(c, 2, true)}${fill.length ? `<span class="kz-fill-tag">${kzt('cb.preenche', { lista: fill.map(k => PILLARS[k].label).join(', ') })}</span>` : ''}${effLineHtml(kzt('sf.persegue'), c.combo.triggers)}${effLineHtml(kzt('sf.causa'), c.combo.effects)}</div>
          ${chain}
          ${(r.sinergias || []).slice(0, 2).map(a=>`<div class="kz-syn-line">${synergyItemHtml(a)}</div>`).join('')}
        </div>
        <button type="button" class="kz-btn${i === 0 ? ' kz-btn-primary' : ''}" data-rec-place="${c.id}" data-rec-slot="${r.slot}">${rep ? kzt('cb.trocarCom', { nome: escapeHtml(kzNome(rep.name)), n: r.slot + 1 }) : kzt('cb.colocarNa', { n: r.slot + 1 })}</button>
      </div>`;
  }).join('');
  return `<section class="kz-rec kz-nvcb-rec">${head}<div class="kz-nvcb-sugs">${cards}</div></section>`;
}
function renderCombosTabNovo(){
  const filledCount = state.team.filter(Boolean).length;
  const hint = state.slotSel !== null ? kzt('cb.ateCasa', { n: state.slotSel+1 }) : kzt('cb.emCampoNovo', { n: '<b>' + filledCount + '</b>' });
  const team = state.team;
  return `
  <section class="kz-page kz-nvp kz-nvcb">
    ${nvPageHeadHtml({ key:'combos', kanji:'連', tag:kzt('deco.combos'), title:kzt('cb.titulo'), size:98, kanjiStyle:'right:4%;top:-60px;font-size:380px',
      sub:kzt('cb.subtitulo'),
      side:`<button class="kz-btn kz-btn-primary" id="saveFormationBtn">${kzt('cb.salvarFormacao')}</button><button class="kz-btn" id="clearTeamBtn">${kzt('cb.limpar')}</button>` })}
    ${state.formations.length ? `
    <div class="kz-formations">
      <span class="kz-label">${kzt('cb.formacoesSalvas')}</span>
      ${state.formations.map((f,i)=>`<span class="kz-formation-pill"><button class="load" data-load-formation="${i}">${escapeHtml(f.name)}</button><button class="del" data-del-formation="${i}" title="${kzt('com.excluir')}">✕</button></span>`).join('')}
    </div>` : ''}
    <div class="kz-combos-layout">
      <aside class="kz-panel kz-roster">
        <div class="kz-roster-head"><span class="kz-label">${kzt('cb.elenco')}</span><span class="kz-roster-hint">${hint}</span></div>
        <div class="kz-nv-search sm"><div>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFC21A" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>
          <label for="rosterSearch" class="kz-sr">${kzt('cb.buscarElenco')}</label>
          <input type="text" id="rosterSearch" placeholder="${kzt('coll.buscarPlaceholder')}" value="${escapeAttr(state.rosterSearch)}" autocomplete="off">
        </div></div>
        ${renderSF('roster')}
        <div class="kz-roster-grid" id="rosterList">${renderRosterList(state.rosterSearch)}</div>
      </aside>
      <div class="kz-combos-main">
        ${renderDescribePanel()}
        <div class="kz-nvcb-teamhead">
          <h2>${nvTtl(kzt('cb.equipe'))}</h2>
          <button type="button" class="kz-btn" id="autoBuildBtn" ${filledCount === 0 || filledCount === 6 ? 'disabled' : ''} title="${filledCount === 0 ? kzt('cb.minUm') : filledCount === 6 ? kzt('cb.jaCompleta') : kzt('cb.completaAjuda')}">⚡ ${state.autoOpts && state.autoOpts.base === JSON.stringify(state.team) ? kzt('cb.gerarDeNovo') : kzt('cb.completar')}</button>
          <button type="button" class="kz-btn kz-opt-btn" id="optimizeBtn" ${filledCount<2?'disabled':''} title="${filledCount<2?kzt('cb.minDois'):kzt('cb.otimizarAjuda')}">✦ ${kzt('cb.melhorOrdem')}</button>
          ${canUndoOptimize() ? `<button type="button" class="kz-btn" id="undoOptBtn" title="${kzt('cb.voltarOrdem')}">↶ ${kzt('cb.desfazerOrdem')}</button>` : ''}
          <button type="button" class="kz-btn kz-btn-primary kz-sim-open" id="openSimBtn"><span class="glyph">連</span><span>${kzt('cb.verCombos')}</span><span class="cnt">${filledCount}/6</span></button>
        </div>
        ${renderAutoBar()}
        ${nvLineupHtml(team, false, true)}
        ${filledCount ? `<div class="kz-nvcb-stats">${nvComboCountHtml(team)}${nvCompositionHtml(team)}</div>` : ''}
        ${state.optInfo && canUndoOptimize() ? `<div class="kz-opt-info">${state.optInfo}</div>` : ''}
        ${nvSynergyListHtml(team)}
        <div class="kz-slots">${SLOT_VISUAL_ORDER.map(renderSlot).join('')}</div>
        <div class="kz-nvcb-legend"><span>${kzt('cb.persegueCausa')}</span>${['derrubada','empurrao','elevacao_alta','elevacao_baixa'].map(effPillHtml).join('')}</div>
        ${renderRecommendationsNovo()}
      </div>
    </div>
  </section>`;
}
function renderCombosTab(){
  if(visualNovo()) return renderCombosTabNovo();
  const filledCount = state.team.filter(Boolean).length;
  const hint = state.slotSel !== null ? kzt('cb.ateCasa', { n: state.slotSel+1 }) : kzt('cb.emCampoNovo', { n: filledCount });
  return `
  <section class="kz-page">
    <div class="kz-page-head">
      <div>
        <h1 class="kz-title">${kzt('cb.titulo')}</h1>
        <div class="kz-subtitle">${kzt('cb.subtitulo')}</div>
      </div>
      <div class="kz-head-actions">
        <button class="kz-btn kz-btn-primary" id="saveFormationBtn">${kzt('cb.salvarFormacao')}</button>
        <button class="kz-btn" id="clearTeamBtn">${kzt('cb.limpar')}</button>
      </div>
    </div>
    ${state.formations.length ? `
    <div class="kz-formations">
      <span class="kz-label">${kzt('cb.formacoesSalvas')}</span>
      ${state.formations.map((f,i)=>`<span class="kz-formation-pill"><button class="load" data-load-formation="${i}">${escapeHtml(f.name)}</button><button class="del" data-del-formation="${i}" title="${kzt('com.excluir')}">✕</button></span>`).join('')}
    </div>` : ''}
    <div class="kz-combos-layout">
      <aside class="kz-panel kz-roster">
        <div class="kz-roster-head"><span class="kz-label">${kzt('cb.elenco')}</span><span class="kz-roster-hint">${hint}</span></div>
        <input type="text" class="kz-input" id="rosterSearch" placeholder="${kzt('coll.buscarPlaceholder')}" value="${escapeAttr(state.rosterSearch)}">
        ${renderSF('roster')}
        <div class="kz-roster-grid" id="rosterList">${renderRosterList(state.rosterSearch)}</div>
      </aside>
      <div class="kz-combos-main">
        <div class="kz-field">
          <div class="kz-field-head">
            <span class="kz-label">${kzt('cb.equipe')}</span>
            <div class="kz-field-actions">
              <button type="button" class="kz-btn kz-btn-primary" id="autoBuildBtn" ${filledCount === 0 || filledCount === 6 ? 'disabled' : ''} title="${filledCount === 0 ? kzt('cb.minUm') : filledCount === 6 ? kzt('cb.jaCompleta') : kzt('cb.completaAjuda')}">⚡ ${state.autoOpts && state.autoOpts.base === JSON.stringify(state.team) ? kzt('cb.gerarDeNovo') : kzt('cb.completar')}</button>
              <button type="button" class="kz-btn kz-opt-btn" id="optimizeBtn" ${filledCount<2?'disabled':''} title="${filledCount<2?kzt('cb.minDois'):kzt('cb.otimizarAjuda')}">✦ ${kzt('cb.melhorOrdem')}</button>
              ${canUndoOptimize() ? `<button type="button" class="kz-btn" id="undoOptBtn" title="${kzt('cb.voltarOrdem')}">↶ ${kzt('cb.desfazerOrdem')}</button>` : ''}
              <button type="button" class="kz-btn kz-btn-primary kz-sim-open" id="openSimBtn"><span class="glyph">連</span><span>${kzt('cb.verCombos')}</span><span class="cnt">${filledCount}/6</span></button>
            </div>
          </div>
          ${renderAutoBar()}
          ${comboCountHtml()}
          ${compositionHtml()}
          ${state.optInfo && canUndoOptimize() ? `<div class="kz-opt-info">${state.optInfo}</div>` : ''}
          ${visualNovo() ? nvLineupHtml(state.team) : ''}
          <div class="kz-slots">${SLOT_VISUAL_ORDER.map(renderSlot).join('')}</div>
          ${renderRecommendations()}
        </div>
      </div>
    </div>
  </section>`;
}

function renderRosterList(filterText){
  const q = (filterText||'').toLowerCase();
  const filtrados = sortByRarity(state.characters.filter(c=>(!q || charMatchesText(c, q)) && matchSF(c, state.sf.roster)));
  // quem já está em campo vem primeiro (na ordem das casas), o resto segue por raridade
  const naFormacao = state.team.map(id => filtrados.find(c => c.id === id)).filter(Boolean);
  const chars = naFormacao.concat(filtrados.filter(c => !state.team.includes(c.id)));
  if(!chars.length) return `<div class="kz-muted" style="grid-column:1/-1;font-size:13px;">${kzt('cb.nenhumEncontrado')}</div>`;
  return chars.map(c=>{
    const at = state.team.indexOf(c.id);
    return `
    <div class="kz-roster-item ${at>-1?'placed':''}" data-id="${c.id}" title="${escapeAttr(kzNome(c.name) + ' — ' + rolesOf(c).map(r=>ROLE_INFO[r].label).join(' / '))}" draggable="true">
      <div class="kz-roster-art">${portraitInner(c)}</div>
      <div class="kz-roster-name">${escapeHtml(kzNome(c.name))}</div>
      ${at>-1 ? `<span class="kz-roster-casa">${kzt('slot.casa', { n: at+1 })}</span>` : ''}
    </div>`;
  }).join('');
}

// Persegue / Causa do Ataque Combinado (e o que a Habilidade e a Suprema causam) direto na casa,
// pra reconhecer rápido o encaixe de cada guerreiro.
function slotEffectsHtml(c){
  const k = c.combo || {};
  const pills = arr => (arr && arr.length) ? `<span class="pills">${arr.map(effPillHtml).join('')}</span>` : '<span class="none">—</span>';
  return `<div class="kz-slot-eff">
    <div class="col"><span class="lbl">${kzt('sf.persegue')}</span>${pills(k.triggers)}</div>
    <div class="col"><span class="lbl">${kzt('sf.causa')}</span>${pills(k.effects)}</div>
  </div>`;
}

// Uma casa do campo (bolinha da casa, retrato, nome, papéis, Persegue/Causa). Usada no Montador e na Comunidade.
// o = { sel, ro (só leitura), draggable, attrs (atributos do container), removeAttr, stars, hint }
function slotCardHtml(c, idx, o){
  o = o || {};
  const attrs = o.attrs !== undefined ? o.attrs : `data-slot="${idx}"`;
  const rm = o.removeAttr !== undefined ? o.removeAttr : `data-remove-slot="${idx}"`;
  const drag = o.draggable !== undefined ? o.draggable : !!c;
  return `
  <div class="kz-slot ${c?'filled':''} ${o.sel?'selected':''} ${o.ro?'ro':''}" ${attrs} ${c && drag ? 'draggable="true"' : ''} title="${kzt('slot.casa', { n: idx+1 })}">
    <img class="kz-slot-ball" src="${ballSrc(idx+1)}" alt="${kzt('slot.casa', { n: idx+1 })}" draggable="false">
    ${c ? `
    ${o.ro ? '' : `<button class="kz-slot-remove" ${rm} title="${kzt('cb.remover')}">✕</button>`}
    <div class="kz-slot-art">${portraitInner(c)}</div>
    <div class="kz-slot-info">${visualNovo() ? `<span class="kz-slot-casa">${kzt('slot.casa', { n: idx+1 })}</span>` : ''}<div class="kz-slot-name">${escapeHtml(kzNome(c.name))}</div>${o.stars || ''}<div class="kz-slot-roles">${rolePillsHtml(c, 2, true)}</div></div>${slotEffectsHtml(c)}`
    : `<span class="kz-slot-plus">${o.ro ? '' : '+'}</span><span class="kz-slot-hint">${o.hint || (o.sel ? kzt('cb.escolhaElenco') : kzt('cb.escolhaGuerreiro'))}</span>`}
  </div>`;
}
function renderSlot(idx){
  const c = state.team[idx] ? getChar(state.team[idx]) : null;
  return slotCardHtml(c, idx, { sel: state.slotSel === idx });
}

// Igual ao "Det. ATQ Comb." do jogo: escolhe um guerreiro do time e vê, lado a lado, quem
// no time entra depois da Habilidade dele e quem entra depois da Suprema — um passo por vez,
// em vez de tentar adivinhar a "melhor" cadeia inteira sozinho.
// Toda linha de efeito deixa explícito se é o que ATIVA o golpe (persegue) ou o que ele
// CAUSA — sem isso, o chip sozinho não deixa claro qual das duas pontas ele representa.
function effLineHtml(label, effs){
  if(!effs || !effs.length) return '';
  return `<div class="kz-atk-effline"><span class="lbl">${label}</span>${effs.map(effPillHtml).join('')}</div>`;
}

function renderAtkSection(charId, abilityKey){
  const c = getChar(charId);
  const ability = c[abilityKey];
  const label = ABILITY_LABEL[abilityKey];
  const continuations = comboContinuations(charId, abilityKey);
  const chain = simulateCombo(charId, abilityKey);
  const priorityId = chain[1] && chain[1].charId; // quem a cadeia de verdade escolheria (menor casa)
  const startCard = `
    <div class="kz-atk-card start">
      <div class="kz-atk-art">${portraitInner(c)}</div>
      <div class="kz-atk-name">${escapeHtml(kzTrad(ability.name)) || label}</div>
      <div class="kz-atk-kind">${label}</div>
      ${effLineHtml(kzt('sf.causa'), ability.effects)}
    </div>`;
  const contCards = continuations.map(({char:tc, triggeredBy})=>{
    const isPriority = tc.id === priorityId;
    return `
    <div class="kz-atk-card ${isPriority?'priority':''}">
      ${isPriority ? `<span class="kz-atk-priority-tag">${kzt('cb.prioridade')}</span>` : ''}
      <div class="kz-atk-art">${portraitInner(tc)}</div>
      <div class="kz-atk-name">${escapeHtml(kzTrad(tc.combo.name)) || kzt('cb.ataqueComb')}</div>
      <div class="kz-atk-kind">${escapeHtml(kzNome(tc.name))}</div>
      ${effLineHtml(kzt('sf.persegue'), [triggeredBy])}
      ${effLineHtml(kzt('sf.causa'), tc.combo.effects)}
    </div>`;
  }).join('');
  const note = !(ability.effects||[]).length
    ? kzt('cb.naoCausa', { hab: label.toLowerCase() })
    : (!continuations.length ? kzt('cb.semGatilho') : '');
  const chainHtml = chain.length > 1 ? `
    <div class="kz-atk-chain-wrap">
      <div class="kz-label" style="font-size:12px;">${kzt('cb.cadeiaCompleta', { n: chain.length })}</div>
      <div class="kz-atk-chain">${chain.map((step,i)=>{
        const causes = step.ability.effects || [];
        return `
        ${i>0 ? '<span class="kz-atk-chain-arrow">→</span>' : ''}
        <div class="kz-atk-chain-step">
          <div class="kz-atk-chain-art">${portraitInner(step.char)}</div>
          <div class="kz-atk-chain-info">
            <span class="nm">${escapeHtml(kzNome(step.char.name))}${step.uso > 1 ? ` <small class="uso">${kzt('cb.ativacao', { n: step.uso })}</small>` : ''}</span>
            ${effLineHtml(kzt('sf.persegue'), step.triggeredBy ? [step.triggeredBy] : null)}
            ${effLineHtml(kzt('sf.causa'), causes)}
          </div>
        </div>`;
      }).join('')}</div>
    </div>` : '';
  return `
  <div class="kz-atk-section">
    <div class="kz-label">${kzt('cb.ataqueCombDe', { hab: label })}</div>
    <div class="kz-atk-row">${startCard}${contCards}</div>
    ${note ? `<div class="kz-muted" style="font-size:13px;">${note}</div>` : ''}
    ${chainHtml}
  </div>`;
}

/* ---------- Recomendações: quem encaixa na equipe pra render mais combos ---------- */
// Soma, pra cada guerreiro em campo e cada início (Habilidade/Suprema), quantos aliados a cadeia
// consegue puxar. É a nota que a recomendação tenta aumentar.
function comboScoreFor(team){
  const bak = state.team;
  state.team = team;
  let total = 0;
  try{
    team.forEach(id=>{
      if(!id) return;
      STARTER_KEYS.forEach(k=>{ total += Math.max(0, simulateCombo(id, k).length - 1); });
    });
  } finally { state.team = bak; }
  return total;
}
// Nota da equipe + a maior cadeia que ela forma (critério de desempate do otimizador).
function comboStatsFor(team){
  const bak = state.team;
  state.team = team;
  let total = 0, longest = 0;
  try{
    team.forEach(id=>{
      if(!id) return;
      STARTER_KEYS.forEach(k=>{
        const n = Math.max(0, simulateCombo(id, k).length - 1);
        total += n;
        if(n > longest) longest = n;
      });
    });
  } finally { state.team = bak; }
  return { total, longest };
}
// Resumo do que a equipe atual já rende: encadeamentos (aliados puxados), quantos inícios (Habilidade/Suprema)
// formam combo e qual é a maior cadeia.
function comboSummary(team){
  const bak = state.team;
  state.team = team;
  let total = 0, starts = 0, best = null;
  try{
    team.forEach(id=>{
      if(!id) return;
      STARTER_KEYS.forEach(k=>{
        const ch = simulateCombo(id, k);
        const n = ch.length - 1;
        if(n > 0){ total += n; starts++; if(!best || n > best.n) best = { n, charId:id, key:k }; }
      });
    });
  } finally { state.team = bak; }
  return { total, starts, best };
}
// Teto da equipe atual: só conta como início a Habilidade/Suprema que causa efeito de combo, e cada cadeia puxa no
// máximo 1 Ataque Combinado por guerreiro em campo (quem iniciou também persegue uma vez; o texto pode permitir mais, ver comboUsos).
function comboMaxFor(team){
  const filled = team.filter(Boolean);
  let starters = 0;
  filled.forEach(id=>{ const c = getChar(id); if(c) STARTER_KEYS.forEach(k=>{ if(c[k] && (c[k].effects||[]).length) starters++; }); });
  // cada guerreiro entra 1 vez por cadeia (2 ou mais se o texto do Ataque Combinado permitir)
  const perChain = filled.reduce((n, id) => n + comboUsos(getChar(id)), 0);
  return { max: starters * perChain, starters, abilities: filled.length * STARTER_KEYS.length, perChain };
}
function comboCountHtml(teamArg){
  const team = teamArg || state.team;
  if(!team.some(Boolean)) return '';
  const s = comboSummary(team);
  const m = comboMaxFor(team);
  const tip = kzt(m.starters===1 ? 'cb.dicaMax1' : 'cb.dicaMaxN', { a: m.starters, b: m.perChain, max: m.max });
  const startersTxt = kzt('cb.iniciamCombo', { a: '<b>' + m.starters + '</b>', b: m.abilities });
  if(!s.total) return `<div class="kz-combo-count none" title="${escapeAttr(tip)}"><b>0</b> ${kzt('cb.combosMinN')}<span class="max"> / ${m.max}</span><span class="sub">${startersTxt} · ${kzt('cb.nenhumaAtiva2')}</span></div>`;
  const bc = getChar(s.best.charId);
  return `<div class="kz-combo-count" title="${escapeAttr(tip)}"><span class="big"><b>${s.total}</b> ${kzt(s.total>1 ? 'cb.combosMinN' : 'cb.combosMin1')}<span class="max"> / ${m.max}</span></span><span class="sub">${kzt('cb.subResumo', { inicios: kzt(s.starts>1 ? 'cb.inicioMinN' : 'cb.inicioMin1', { n: '<b>' + s.starts + '</b>' }), starters: startersTxt, hits: '<b>' + kzt('com.maiorCadeia', { n: s.best.n+1 }) + '</b>', nome: escapeHtml(kzNome(bc.name)), hab: ABILITY_LABEL[s.best.key] })}</span></div>`;
}
// Reordena SÓ quem já está em campo (as mesmas casas ocupadas) testando todas as ordens possíveis
// — no máx. 6! = 720. Vence a que soma mais encadeamentos; empate: a cadeia mais longa; empate de novo:
// a que mexe em menos guerreiros em relação à ordem atual.
function optimizeTeamOrder(teamArg){
  const team = [...(teamArg || state.team)];
  const slots = team.map((id,i)=>id ? i : -1).filter(i=>i>-1);
  if(slots.length < 2) return null;
  const ids = slots.map(i=>team[i]);
  const before = comboStatsFor(team);
  let best = null;
  const perm = (arr, rest) => {
    if(!rest.length){
      const t = [...team];
      slots.forEach((s,k)=>{ t[s] = arr[k]; });
      const st = comboStatsFor(t);
      const moved = arr.reduce((n,id,k)=> n + (id !== ids[k] ? 1 : 0), 0);
      if(!best || st.total > best.st.total || (st.total === best.st.total && (st.longest > best.st.longest || (st.longest === best.st.longest && moved < best.moved)))){
        best = { team:t, st, moved };
      }
      return;
    }
    rest.forEach((id,i)=> perm([...arr, id], [...rest.slice(0,i), ...rest.slice(i+1)]));
  };
  perm([], ids);
  return { team:best.team, before, after:best.st, changed: best.moved > 0 };
}
function canUndoOptimize(){
  const u = state.optUndo;
  return !!(u && JSON.stringify(u.after) === JSON.stringify(state.team));
}
function runOptimizeTeam(){
  const r = optimizeTeamOrder();
  if(!r){ showToast(kzt('cb.toastMin2')); return; }
  if(!r.changed){
    state.optUndo = null; state.optInfo = null;
    showToast(r.before.total ? kzt('cb.ordemJaMelhor') : kzt('cb.semCombos'));
    render();
    return;
  }
  const prev = [...state.team];
  commitTeam(r.team);
  state.optUndo = { before:prev, after:[...r.team] };
  state.optInfo = r.after.total > r.before.total
    ? kzt('cb.novaOrdem', { a: r.after.total, b: r.before.total, h: r.after.longest + 1 })
    : kzt('cb.jaMaxima', { a: r.after.total, h: r.after.longest + 1 });
  render();
  showToast(kzt('cb.ordemOtimizada'));
}
function undoOptimizeTeam(){
  if(!canUndoOptimize()) return;
  const before = state.optUndo.before;
  state.optUndo = null; state.optInfo = null;
  commitTeam([...before]);
}
// Cadeias (da equipe 'team') em que o guerreiro 'cid' participa, da mais longa pra mais curta.
function chainsWithChar(team, cid){
  const bak = state.team;
  state.team = team;
  const out = [];
  try{
    team.forEach(id=>{
      if(!id) return;
      STARTER_KEYS.forEach(k=>{
        const ch = simulateCombo(id, k);
        if(ch.length > 1 && ch.some(s=>s.charId === cid)) out.push({ abilityKey:k, chain:ch });
      });
    });
  } finally { state.team = bak; }
  return out.sort((a,b)=>b.chain.length - a.chain.length);
}
// Candidatos fora da equipe, ordenados pelo quanto aumentam os encadeamentos. Com casa livre,
// testa cada casa vazia (casa menor tem prioridade na cadeia); equipe cheia, testa trocar por cada
// membro. Só entra quem melhora a nota.
function recommendForTeam(limit, rarity){
  const team = [...state.team];
  if(!team.some(Boolean)) return [];
  const base = comboScoreFor(team);
  const baseSyn = synergyReport(team).total;
  const baseBal = balanceScore(team);
  // quanto vale o equilíbrio na nota: no foco "combos" pesa pouco; se a equipe já tem frente faltando, pesa mais
  const pesoBal = ({ equilibrado: 30, combos: 8, sinergias: 15 })[state.autoMode || 'equilibrado'] * (missingPillars(team).length ? 1.5 : 1);
  const empties = team.map((id,i)=>id ? -1 : i).filter(i=>i>-1);
  const slots = empties.length ? empties : team.map((_,i)=>i);
  const inTeam = new Set(team.filter(Boolean));
  const res = [];
  state.characters.forEach(c=>{
    if(inTeam.has(c.id)) return;
    if(rarity && rarity !== 'all' && rarityLabel(c.rarity) !== rarity) return;
    let best = null;
    slots.forEach(s=>{
      const t = [...team];
      const replaced = t[s];
      t[s] = c.id;
      const gain = comboScoreFor(t) - base;
      const syn = synergyReport(t).total - baseSyn;
      const balGain = balanceScore(t) - baseBal;
      const nota = gain + 5 * syn + pesoBal * balGain;   // uma dupla forte (Goku SS4 + Vegeta SS4) vale como ~10 encadeamentos
      if(!best || nota > best.nota) best = { gain, syn, balGain, nota, slot:s, replaced, team:t };
    });
    // entra quem aumenta combos, quem tem sinergia ou quem tapa um buraco da equipe (ganho de equilíbrio)
    if(best && (best.gain > 0 || best.syn >= 0.15 || best.balGain >= 0.05)){
      const sinergias = synergyReport(best.team).ativos.filter(a=>a.de === c.id || a.alvos.includes(c.id));
      res.push({ char:c, slot:best.slot, replacedId:best.replaced, gain:best.gain, syn:best.syn, balGain:best.balGain, nota:best.nota, sinergias, team:best.team, bal:balanceScore(best.team) });
    }
  });
  res.sort((a,b)=> b.nota - a.nota || b.gain - a.gain || (b.bal - a.bal) || rarityRank(a.char.rarity) - rarityRank(b.char.rarity) || a.char.name.localeCompare(b.char.name));
  return res.slice(0, limit || 8);
}
// Quem a equipe precisa: com uma frente faltando (ex.: controle), filtra só quem preenche ela (papel >= 0,6 naquela frente).
function recPreenche(r, k){ return analyzeRoles(r.char).pillars[k] >= 0.6; }
function recListaFor(rarity, limit){
  const miss = missingPillars(state.team);
  const fill = state.recFill && miss.includes(state.recFill) ? state.recFill : null;
  const todos = recommendForTeam(fill ? 60 : limit, rarity);
  return { miss, fill, recs: fill ? todos.filter(r => recPreenche(r, fill)).slice(0, limit) : todos };
}
function recFillBarHtml(miss, fill, novo){
  if(!miss.length) return '';
  const chips = miss.map(k => `<button type="button" class="kz-fchip ${fill === k ? 'active' : ''}" data-rec-fill="${k}">${PILLARS[k].label}</button>`).join('');
  const todos = `<button type="button" class="kz-fchip ${fill ? '' : 'active'}" data-rec-fill="">${kzt('auto.todas')}</button>`;
  return novo
    ? `<div class="kz-nv-chipgrp kz-rec-fillbar"><span class="kz-nv-lb warn">${kzt('cb.faltaNaEquipe', { lista: miss.map(k => PILLARS[k].label).join(', ') })}</span>${todos}${chips}</div>`
    : `<div class="kz-rec-filter kz-rec-fillbar"><span class="kz-label warn">${kzt('cb.faltaNaEquipe', { lista: miss.map(k => PILLARS[k].label).join(', ') })}</span>${todos}${chips}</div>`;
}
function recMotivoLabel(r){
  return r.gain > 0 ? kzt(r.gain > 1 ? 'cb.maisEncN' : 'cb.maisEnc1', { n: r.gain }) : r.syn >= 0.15 ? kzt('cb.sinergia') : kzt('cb.equilibrioMais');
}
function renderRecommendations(){
  const filled = state.team.filter(Boolean).length;
  if(!filled) return '';
  const full = filled === 6;
  const rar = state.recRarity || 'all';
  const { miss: faltam, fill, recs } = recListaFor(rar, 8);
  const head = `<div class="kz-rec-head"><h3>${kzt('cb.quemEncaixaEquipe')}</h3><span class="kz-muted" style="font-size:13px;">${kzt('cb.ordenadoAntigo')}</span></div>
  <div class="kz-rec-filter"><span class="kz-label">${kzt('cb.sugerir')}</span>${[['all',kzt('auto.todas')],['SSR',kzt('auto.soSSR')],['SR',kzt('auto.soSR')],['R',kzt('auto.soR')]].map(([v,l])=>`<button type="button" class="kz-fchip ${rar===v?'active':''}" data-rec-rarity="${v}">${l}</button>`).join('')}</div>${recFillBarHtml(faltam, fill, false)}`;
  if(!recs.length){
    const msg = full ? (rar !== 'all' ? kzt('cb.nenhumaTrocaRar', { rar }) : kzt('cb.nenhumaTroca')) : (rar !== 'all' ? kzt('cb.nenhumElencoRar', { rar }) : kzt('cb.nenhumElenco'));
    return `<div class="kz-rec">${head}<div class="kz-muted">${msg}</div></div>`;
  }
  const miss = missingPillars(state.team);
  const fillTag = c => { const p = analyzeRoles(c).pillars; const f = miss.filter(k => p[k] >= 0.6); return f.length ? `<span class="kz-fill-tag">${kzt('cb.preenche', { lista: f.map(k => PILLARS[k].label).join(', ') })}</span>` : ''; };
  const cards = recs.map((r,i)=>{
    const c = r.char, rep = r.replacedId ? getChar(r.replacedId) : null;
    const best = chainsWithChar(r.team, c.id)[0];
    const chainTxt = best ? best.chain.map((s,j)=>{
      const nm = escapeHtml(kzNome(s.char.name));
      const tag = j === 0 ? ` <small>(${ABILITY_LABEL[best.abilityKey]})</small>` : '';
      return s.charId === c.id ? `<b>${nm}</b>${tag}` : `${nm}${tag}`;
    }).join('<span class="arr">→</span>') : '';
    return `
    <div class="kz-rec-card ${i===0?'top':''}">
      <div class="kz-rec-top">
        <div class="kz-rec-art">${portraitInner(c)}</div>
        <div>
          <div class="kz-rec-name">${escapeHtml(kzNome(c.name))}</div>
          <span class="kz-rec-gain">${recMotivoLabel(r)} · ${kzt('slot.casa', { n: r.slot+1 })}</span>
        </div>
      </div>
      <div class="kz-rec-roles">${rolePillsHtml(c, 2, true)}${fillTag(c)}</div>
      <div class="kz-rec-eff">${effLineHtml(kzt('sf.persegue'), c.combo.triggers)}${effLineHtml(kzt('sf.causa'), c.combo.effects)}</div>
      ${chainTxt ? `<div class="kz-rec-chain">${kzt('cb.melhorCadeiaTxt', { cadeia: chainTxt, hits: '<small>(' + kzt('com.maiorCadeia', { n: best.chain.length }) + ')</small>' })}</div>` : ''}
      ${(r.sinergias || []).slice(0, 2).map(a=>`<div class="kz-syn-line">${synergyItemHtml(a)}</div>`).join('')}
      <button type="button" class="kz-btn kz-btn-sm" data-rec-place="${c.id}" data-rec-slot="${r.slot}">${rep ? kzt('cb.trocarCom', { nome: escapeHtml(kzNome(rep.name)), n: r.slot+1 }) : kzt('cb.colocarNa', { n: r.slot+1 })}</button>
    </div>`;
  }).join('');
  return `<div class="kz-rec">${head}<div class="kz-rec-grid">${cards}</div></div>`;
}

function renderSimPanel(noHead){
  const teamChars = state.team.map(id=> id ? getChar(id) : null).filter(Boolean);
  const head = noHead ? '' : `<div class="kz-sim-head"><span class="glyph">連</span><h2>${kzt('cb.simular')}</h2></div>`;
  if(!teamChars.length){
    return head + `<div class="kz-muted">${kzt('cb.monteParaVer')}</div>`;
  }
  const sel = (state.simCharId && teamChars.find(c=>c.id===state.simCharId)) ? state.simCharId : teamChars[0].id;
  return `
  ${head}
  <div class="kz-sim-roster">${teamChars.map(c=>`
    <button class="kz-sim-char ${c.id===sel?'active':''}" data-sim-char="${c.id}" title="${escapeAttr(kzNome(c.name))}">
      <span class="kz-sim-char-art">${portraitInner(c)}</span>
      <span class="kz-sim-char-name">${escapeHtml(kzNome(c.name))}</span>
    </button>`).join('')}</div>
  ${STARTER_KEYS.map(key=>renderAtkSection(sel, key)).join('')}`;
}

function attachRosterItemHandlers(root){
  root.querySelectorAll('.kz-roster-item').forEach(item=>{
    item.addEventListener('click', ()=>{ if(dragRosterId !== null) return; placeChar(item.dataset.id); });
    item.addEventListener('dragstart', e=>{
      dragRosterId = item.dataset.id;
      dragWasDropped = false;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', dragRosterId);
      requestAnimationFrame(()=>item.classList.add('dragging'));
    });
    item.addEventListener('dragend', ()=>{
      item.classList.remove('dragging');
      dragRosterId = null;
      dragWasDropped = false;
    });
  });
}

function attachCombosHandlers(){
  const view = document.getElementById('view');
  if(!view || state.tab !== 'combos') return;

  const rosterSearch = document.getElementById('rosterSearch');
  if(rosterSearch) rosterSearch.addEventListener('input', e=>{
    state.rosterSearch = e.target.value;
    const list = document.getElementById('rosterList');
    list.innerHTML = renderRosterList(state.rosterSearch);
    attachRosterItemHandlers(list);
  });
  attachRosterItemHandlers(view);
  attachSF('roster', view, render);
  view.querySelectorAll('[data-rec-rarity]').forEach(b=>b.addEventListener('click', ()=>{ state.recRarity = b.dataset.recRarity; state.autoOpts = null; render(); }));
  view.querySelectorAll('[data-rec-fill]').forEach(b=>b.addEventListener('click', ()=>{ state.recFill = b.dataset.recFill || null; render(); }));
  view.querySelectorAll('[data-rec-place]').forEach(b=>b.addEventListener('click', ()=>{
    state.slotSel = parseInt(b.dataset.recSlot, 10);
    placeChar(b.dataset.recPlace);
    showToast(kzt('cb.posicionado'));
  }));
  const openSim = document.getElementById('openSimBtn');
  if(openSim) openSim.addEventListener('click', openSimModal);
  const autoMode = document.getElementById('autoModeSelect');
  if(autoMode) autoMode.addEventListener('change', ()=>{ state.autoMode = autoMode.value; state.autoOpts = null; render(); });
  const autoRar = document.getElementById('autoRarSelect');
  if(autoRar) autoRar.addEventListener('change', ()=>{ state.recRarity = autoRar.value; state.autoOpts = null; render(); });
  const autoClose = document.getElementById('autoCloseBtn');
  if(autoClose) autoClose.addEventListener('click', ()=>{ state.autoOpts = null; render(); });
  const autoBtn = document.getElementById('autoBuildBtn');
  if(autoBtn) autoBtn.addEventListener('click', runAutoBuild);
  const descForm = document.getElementById('descForm');
  if(descForm) descForm.addEventListener('submit', e=>{ e.preventDefault(); runDescribeTeam(document.getElementById('descInput').value); });
  view.querySelectorAll('[data-desc-ex]').forEach(b=>b.addEventListener('click', ()=> runDescribeTeam(b.dataset.descEx)));
  view.querySelectorAll('[data-desc-apply]').forEach(b=>b.addEventListener('click', ()=> applyDescOption(parseInt(b.dataset.descApply, 10))));
  view.querySelectorAll('[data-desc-com]').forEach(b=>b.addEventListener('click', ()=> useCommunityTeam(b.dataset.descCom)));
  const descClear = document.getElementById('descClear');
  if(descClear) descClear.addEventListener('click', ()=>{ state.descText = ''; state.descRes = null; render(); });
  view.querySelectorAll('[data-auto-apply]').forEach(b=>b.addEventListener('click', ()=> applyAutoOption(parseInt(b.dataset.autoApply, 10))));
  const optBtn = document.getElementById('optimizeBtn');
  if(optBtn) optBtn.addEventListener('click', runOptimizeTeam);
  const undoOpt = document.getElementById('undoOptBtn');
  if(undoOpt) undoOpt.addEventListener('click', undoOptimizeTeam);

  view.querySelectorAll('.kz-slot, .kz-nv-lineup.edit .ln').forEach(slot=>{
    slot.addEventListener('click', e=>{
      if(e.target.closest('[data-remove-slot]')) return;
      if(dragSlotIdx !== null) return; // clique logo depois de arrastar
      const idx = parseInt(slot.dataset.slot, 10);
      // Com o layout em coluna única o elenco fica lá em cima — abre o seletor em modal em
      // vez de obrigar a rolar até ele.
      const layout = view.querySelector('.kz-combos-layout');
      const singleColumn = layout && getComputedStyle(layout).gridTemplateColumns.trim().split(/\s+/).length === 1;
      if(singleColumn){ state.slotSel = null; state.pickerSlot = idx; render(); return; }
      state.slotSel = state.slotSel === idx ? null : idx;
      render();
    });

    slot.addEventListener('dragstart', e=>{
      if(!slot.classList.contains('filled')){ e.preventDefault(); return; }
      dragSlotIdx = parseInt(slot.dataset.slot, 10);
      dragWasDropped = false;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragSlotIdx));
      requestAnimationFrame(()=>slot.classList.add('dragging'));
    });
    slot.addEventListener('dragover', e=>{
      if(dragSlotIdx === null && dragRosterId === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = dragRosterId !== null ? 'copy' : 'move';
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', ()=> slot.classList.remove('drag-over'));
    slot.addEventListener('drop', e=>{
      e.preventDefault();
      slot.classList.remove('drag-over');
      const toIdx = parseInt(slot.dataset.slot, 10);
      if(dragRosterId !== null){
        dragWasDropped = true;
        state.slotSel = toIdx;
        const id = dragRosterId;
        dragRosterId = null;
        placeChar(id);
        return;
      }
      if(dragSlotIdx === null) return;
      dragWasDropped = true;
      const fromIdx = dragSlotIdx;
      if(fromIdx !== toIdx){
        const tmp = state.team[toIdx];
        state.team[toIdx] = state.team[fromIdx];
        state.team[fromIdx] = tmp;
        state.simCharId = null;
        saveTeamState();
      }
    });
    slot.addEventListener('dragend', ()=>{
      if(!dragWasDropped && dragSlotIdx !== null){
        // soltou fora de qualquer casa -> tira da equipe
        state.team[dragSlotIdx] = null;
        state.simCharId = null;
        saveTeamState();
      }
      dragSlotIdx = null;
      dragWasDropped = false;
      render();
    });
  });

  view.querySelectorAll('[data-remove-slot]').forEach(b=>{
    b.addEventListener('click', e=>{
      e.stopPropagation();
      const idx = parseInt(b.dataset.removeSlot, 10);
      const t = [...state.team];
      t[idx] = null;
      if(state.slotSel === idx) state.slotSel = null;
      commitTeam(t);
    });
  });

  const clearBtn = document.getElementById('clearTeamBtn');
  if(clearBtn) clearBtn.addEventListener('click', ()=>{
    customConfirm(kzt('cb.limparConfirma'), ()=>{
      state.slotSel = null;
      commitTeam(Array(6).fill(null));
    });
  });

  const saveFormBtn = document.getElementById('saveFormationBtn');
  if(saveFormBtn) saveFormBtn.addEventListener('click', ()=>{
    if(state.team.every(t=>!t)){ showToast(kzt('cb.monteAntes')); return; }
    customPrompt(kzt('cb.nomeFormacao'), name=>{
      state.formations.push({name, team:[...state.team]});
      saveFormations();
      render();
      showToast(kzt('cb.formacaoSalva'));
    });
  });

  view.querySelectorAll('[data-load-formation]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const f = state.formations[parseInt(b.dataset.loadFormation, 10)];
      if(!f) return;
      state.team = [...f.team];
      state.simCharId = null;
      state.slotSel = null;
      saveTeamState();
      render();
      showToast(kzt('cb.formacaoCarregada', { nome: f.name }));
    });
  });
  view.querySelectorAll('[data-del-formation]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const i = parseInt(b.dataset.delFormation, 10);
      const f = state.formations[i];
      if(!f) return;
      customConfirm(kzt('cb.excluirFormacao', { nome: f.name }), ()=>{
        state.formations.splice(i, 1);
        saveFormations();
        render();
      });
    });
  });

  view.querySelectorAll('[data-sim-char]').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.simCharId = b.dataset.simChar;
      render();
    });
  });
}

/* ======================= GUIAS ======================= */
const GUIDE_PROGRESS = [
  [1,kzt('gp.1')],[2,kzt('hab.passivaPadrao')],[3,kzt('hab.passivaUnicaTitulo')],[4,kzt('gp.4')],
  [5,kzt('gp.5')],[6,kzt('gp.6')],[7,kzt('gp.7')],[8,kzt('gp.8')],
  [9,kzt('gp.7')],[10,kzt('gp.10')],
];
function renderGuiasCombos(){
  const C = state.characters;
  const effCards = EFFECTS.map(k=>{
    const n = C.filter(c=>(c.combo.triggers||[]).includes(k)).length;
    const s = EFF_STYLE[k];
    return `
    <div class="kz-guide-eff">
      <span class="kz-eff-dot" style="background:${s.bg};color:${s.fg};">${EFFECT_ABBR[k]}</span>
      <span class="txt"><span class="n">${EFFECT_LABELS[k]}</span><span class="c">${kzt(n===1 ? 'guia.reage1' : 'guia.reageN', { n })}</span></span>
    </div>`;
  }).join('');
  const scan = priorityOrder().map(i=>i+1).join(' → ');
  const stat = (title, vals, field) => `
    <div class="kz-guide-stat">
      <span class="kz-label">${title}</span>
      <div class="kz-pill-row" style="gap:10px;">${vals.map(v=>{
        const r = PILL_RGB[v] || ['201,162,75','#e0c070'];
        const n = C.filter(c=>c[field]===v).length;
        return `<span class="kz-pill" style="background:rgba(${r[0]},.22);color:${r[1]};border-color:rgba(${r[0]},.7);">${kzTermo(v)}<span class="count">${n}</span></span>`;
      }).join('')}</div>
    </div>`;
  return `
    <div class="kz-guide-grid">
      <article class="kz-guide-card">
        <div class="kz-guide-head"><span class="glyph">連</span><h2>${kzt('guia.cadeiaTitulo')}</h2></div>
        <p>${kzt('guia.cadeiaTexto')}</p>
        <div class="kz-guide-effects">${effCards}</div>
      </article>
      <article class="kz-guide-card">
        <div class="kz-guide-head"><span class="glyph">陣</span><h2>${kzt('guia.formacaoTitulo')}</h2></div>
        <p>${kzt('guia.formacaoTexto')}</p>
        <div class="kz-guide-formation">
          <div class="kz-guide-slots">${SLOT_VISUAL_ORDER.map(i=>`<span class="cell">${i+1}</span>`).join('')}</div>
        </div>
        <div class="kz-guide-note">${kzt('guia.varredura', { ordem: scan })}</div>
      </article>
      <article class="kz-guide-card">
        <div class="kz-guide-head"><span class="glyph">星</span><h2>${kzt('guia.estrelasTitulo')}</h2></div>
        <p>${kzt('guia.estrelasTexto')}</p>
        <div class="kz-guide-prog">
          ${GUIDE_PROGRESS.map(([r,t])=>`<div class="kz-guide-prog-row">${textStarsHtml(r)}<span class="t">${t}</span></div>`).join('')}
        </div>
      </article>
      <article class="kz-guide-card">
        <div class="kz-guide-head"><span class="glyph">気</span><h2>${kzt('guia.tiposTitulo')}</h2></div>
        ${stat(kzt('guia.tipos'), TYPES, 'type')}
        ${stat(kzt('guia.afinidades'), AFFINITIES, 'affinity')}
      </article>
    </div>`;
}

// ---- Guias do jogo: 12 sistemas (guias/guias.json, carregado só quando a aba é aberta) ----
let guiasData = null, guiasLoading = false, guiasError = false;
function guideBySlug(id){ return guiasData ? guiasData.guias.find(g=>g.id === id) : null; }
async function loadGuias(){
  if(guiasData || guiasLoading || guiasError) return;
  guiasLoading = true;
  try{
    // em inglês lê guias/guias-en.json (mesma estrutura e mesmos ids); se não abrir, cai para o português
    let r = KZ_LANG === 'en' ? await fetch('guias/guias-en.json', { cache:'no-cache' }).catch(()=>null) : null;
    if(!r || !r.ok) r = await fetch('guias/guias.json', { cache:'no-cache' });
    if(!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    if(!j || !Array.isArray(j.guias)) throw new Error('formato inesperado');
    guiasData = { edicao:String(j.edicao||''), guias:j.guias.filter(g=>g && typeof g.id === 'string' && typeof g.titulo === 'string') };
  }catch(e){ guiasError = true; console.error('Não consegui carregar os guias', e); }
  guiasLoading = false;
  if(state.tab === 'guias') render();
}
function guideCover(g){ return 'guias/img/' + encodeURIComponent(g.n) + '.webp'; }
function guideLabel(g){ return g.rotulo ? String(g.rotulo) : kzt('guia.rotulo', { n: g.n }); }
function guideImgSrc(s){ return /^guias\/img\/[a-z0-9\/-]+\.webp$/.test(String(s||'')) ? s : ''; }
function guideBlocksText(bs){
  return (bs||[]).map(b=> (b.t === 'ul' || b.t === 'ol') ? (b.items||[]).join(' ') : b.t === 'callout' ? [b.titulo||''].concat(b.x||[]).join(' ') : b.t === 'details' ? [b.titulo||'', b.sub||'', guideBlocksText(b.blocos)].join(' ') : (b.t === 'icons' || b.t === 'img') ? '' : b.t === 'apoios' ? (b.itens||[]).map(i=>[i.nome, i.frag + ' fragmentos', i.papel].join(' ')).join(' ') : b.t === 'conjuntos' ? (b.itens||[]).map(i=>[i.nome, i.efeito, i.quem, (i.ex||[]).map(e=>e.nome||e.texto||'').join(' ')].join(' ')).join(' ') : b.t === 'table' ? [(b.head||[]).join(' ')].concat((b.rows||[]).map(r=>r.join(' '))).join(' ') : (b.x||'')).join(' ');
}
function guideSearchNorm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function guideIndex(g){
  if(!g._ix) g._ix = {
    all: guideSearchNorm([g.titulo, g.subtitulo, g.resumo, guideBlocksText(g.visao), guideBlocksText(g.observacoes)].join(' ') + ' ' + (g.secoes||[]).map(s=>s.titulo + ' ' + guideBlocksText(s.blocos)).join(' ')),
    secs: (g.secoes||[]).map(s=>guideSearchNorm(s.titulo + ' ' + guideBlocksText(s.blocos))),
  };
  return g._ix;
}
// Guias que batem com todas as palavras buscadas, e as seções onde elas aparecem.
function guideSearch(q){
  const words = guideSearchNorm(q).split(/\s+/).filter(Boolean);
  const list = guiasData ? guiasData.guias : [];
  if(!words.length) return list.map(g=>({ g, secs:[] }));
  return list.map(g=>{
    const ix = guideIndex(g);
    if(!words.every(w=>ix.all.includes(w))) return null;
    const secs = [];
    ix.secs.forEach((t, i)=>{ if(words.every(w=>t.includes(w))) secs.push(i); });
    return { g, secs };
  }).filter(Boolean);
}
function guideCardsHtml(q){
  const res = guideSearch(q);
  if(!res.length) return `<div class="kz-empty">${kzt('guia.nenhum')}</div>`;
  return res.map(({g, secs})=>`
    <button type="button" class="kz-gl-card" data-guide="${escapeAttr(g.id)}">
      <img class="kz-gl-cover" src="${guideCover(g)}" alt="" loading="lazy" data-onerr="hide">
      <span class="kz-gl-body">
        <span class="kz-gl-num">${escapeHtml(visualNovo() && !g.rotulo ? String(g.n) : guideLabel(g))}</span>
        <h3>${escapeHtml(g.titulo)}</h3>
        <p>${escapeHtml(g.resumo)}</p>
        ${secs.length ? `<span class="kz-gl-hits">${secs.slice(0,4).map(i=>`<span class="kz-gl-hit">${escapeHtml(g.secoes[i].titulo)}</span>`).join('')}${secs.length>4?`<span class="kz-gl-hit">+${secs.length-4}</span>`:''}</span>` : ''}
        <span class="kz-gl-lock">${kzt('guia.desbloqueio', { n: +g.nivel || 0 })}</span>
      </span>
    </button>`).join('');
}
// Guia de Assistência: o nome de cada apoio ganha o ícone dele (nos textos e nas tabelas). guideChips é montado por renderGuideReader.
let guideChips = null;
function guideChipsFor(g){
  const ap = [];
  (g.secoes||[]).forEach(sc=> (sc.blocos||[]).forEach(b=>{ if(b.t === 'apoios') (b.itens||[]).forEach(i=> ap.push(i)); }));
  if(!ap.length) return null;
  const mapa = new Map(ap.map(i=>[i.nome, i]));
  const nomes = [...mapa.keys()].sort((a, b)=> b.length - a.length);
  const esc = n=> escapeHtml(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { mapa, re: new RegExp('(?<![\\p{L}\\p{N}])(' + nomes.map(esc).join('|') + ')(?![\\p{L}\\p{N}])', 'gu') };
}
function guideApoioIcone(i){ return guideImgSrc('guias/img/assistencia/' + String(i.slug||'').replace(/[^a-z0-9-]/g, '') + '-icone.webp'); }
function guideApoioCartao(i){ return guideImgSrc('guias/img/assistencia/' + String(i.slug||'').replace(/[^a-z0-9-]/g, '') + '.webp'); }
// recebe texto JÁ escapado e devolve com os ícones (só no guia que tem catálogo de apoios)
function guideTexto(html){
  if(!guideChips) return html;
  return html.replace(guideChips.re, (_, n)=>{
    const i = guideChips.mapa.get(n.replace(/&amp;/g, '&'));
    const ic = i && guideApoioIcone(i);
    return ic ? `<span class="kz-ap-chip"><img src="${ic}" alt="" width="20" height="20" loading="lazy" data-onerr="hide">${n}</span>` : n;
  });
}
function guideApoiosHtml(b){
  const por = new Map();
  (b.itens||[]).forEach(i=>{ const k = +i.frag || 0; if(!por.has(k)) por.set(k, []); por.get(k).push(i); });
  return `<div class="kz-ap">${[...por.keys()].sort((x, y)=> x - y).map(k=>`
    <div class="kz-ap-grupo">
      <div class="kz-ap-tier">${kzt('guia.fragmentos', { k: '<b>' + k + '</b>' })}<small>${kzt('guia.nApoios', { n: por.get(k).length })}</small></div>
      <div class="kz-ap-grid">${por.get(k).map(i=>{
        const cart = guideApoioCartao(i), ic = guideApoioIcone(i);
        return `<article class="kz-ap-card">
          ${cart ? `<img class="kz-ap-art" src="${cart}" alt="${escapeAttr(kzt('guia.cartaoDe', { nome: i.nome }))}" width="200" height="258" loading="lazy" data-onerr="hide">` : ''}
          <div class="kz-ap-info"><div class="kz-ap-nm">${ic ? `<img src="${ic}" alt="" width="28" height="28" loading="lazy" data-onerr="hide">` : ''}<b>${escapeHtml(i.nome)}</b></div>
          <p>${escapeHtml(i.papel)}</p></div>
        </article>`;
      }).join('')}</div>
    </div>`).join('')}</div>`;
}
// Guia de Acessórios: para quem usar cada conjunto (dicas de quem joga). Os exemplos viram ícones; os que são guerreiros do site abrem a ficha.
function guideConjuntosHtml(b){
  const chip = e=>{
    if(e.texto) return `<span class="kz-cj-chip txt"><b>${escapeHtml(e.texto)}</b></span>`;
    const nome = escapeHtml(kzNome(e.nome || ''));   // e.nome continua em português nos dados (é a chave do guerreiro); o nome mostrado é o do idioma
    if(e.apoio){
      const a = guideImgSrc('guias/img/assistencia/' + String(e.apoio).replace(/[^a-z0-9-]/g, '') + '-icone.webp');
      return `<span class="kz-cj-chip" title="${kzt('guia.apoioAssistencia')}">${a ? `<img src="${a}" alt="" width="28" height="28" loading="lazy" data-onerr="hide">` : ''}<b>${nome}</b></span>`;
    }
    const ch = state.characters.find(x=>x.name === e.nome);
    if(!ch) return `<span class="kz-cj-chip" title="${kzt('guia.aindaNaoNoSite')}"><span class="ini">${escapeHtml(initials(e.nome || ''))}</span><b>${nome}</b></span>`;
    const ico = iconeSrc(ch) || `portraits/mini/${slug(ch.name)}.webp`;
    return `<button type="button" class="kz-cj-chip" data-guia-char="${escapeAttr(ch.id)}" title="${escapeAttr(kzt('chars.verFicha', { nome: kzNome(ch.name) }))}"><img src="${escapeAttr(ico)}" alt="" width="28" height="28" loading="lazy" data-onerr="hide"><b>${nome}</b></button>`;
  };
  return `<div class="kz-cj">${(b.itens||[]).map(i=>{
    const ic = guideImgSrc(i.icone);
    return `<article class="kz-cj-card">
      <div class="kz-cj-top">${ic ? `<img src="${ic}" alt="" width="44" height="44" loading="lazy" data-onerr="hide">` : ''}<div><span class="n">${escapeHtml(i.n)}</span><b>${escapeHtml(i.nome)}</b><small>${escapeHtml(i.efeito)}</small></div></div>
      <p><span class="lb">${kzt('guia.idealPara')}</span>${escapeHtml(i.quem)}</p>
      <div class="kz-cj-ex"><span class="lb">${kzt('guia.exemplos')}</span><div class="fila">${(i.ex||[]).map(chip).join('')}</div></div>
    </article>`;
  }).join('')}</div>`;
}
function guideBlockHtml(b){
  if(!b) return '';
  if(b.t === 'apoios') return guideApoiosHtml(b);
  if(b.t === 'conjuntos') return guideConjuntosHtml(b);
  if(b.t === 'p') return `<p>${guideTexto(escapeHtml(b.x))}</p>`;
  if(b.t === 'note') return `<p class="note">${guideTexto(escapeHtml(b.x))}</p>`;
  if(b.t === 'h') return `<h3>${escapeHtml(b.x)}</h3>`;
  if(b.t === 'ul') return `<ul>${(b.items||[]).map(i=>`<li>${guideTexto(escapeHtml(i))}</li>`).join('')}</ul>`;
  if(b.t === 'ol') return `<ol>${(b.items||[]).map(i=>`<li>${guideTexto(escapeHtml(i))}</li>`).join('')}</ol>`;
  if(b.t === 'callout') return `<div class="kz-gr-callout">${b.titulo ? `<strong>${escapeHtml(b.titulo)}</strong>` : ''}${(b.x||[]).map(t=>`<p>${escapeHtml(t)}</p>`).join('')}</div>`;
  if(b.t === 'img'){
    const s = guideImgSrc(b.src);
    return s ? `<a class="kz-gr-imglink" href="${s}" target="_blank" rel="noopener"><img class="kz-gr-img" src="${s}" alt="${escapeAttr(b.alt||'')}" loading="lazy" data-onerr="hide"></a>` : '';
  }
  if(b.t === 'details'){
    const ic = guideImgSrc(b.icone);
    return `<details class="kz-gd"><summary>${ic ? `<img src="${ic}" alt="" width="40" height="40" loading="lazy" data-onerr="hide">` : ''}<span class="tx"><b>${escapeHtml(b.titulo)}</b>${b.sub ? `<small>${escapeHtml(b.sub)}</small>` : ''}</span></summary><div class="kz-gd-body">${(b.blocos||[]).map(guideBlockHtml).join('')}</div></details>`;
  }
  if(b.t === 'icons') return `<div class="kz-gr-icons">${(b.items||[]).map(i=>{ const s = guideImgSrc(i.src); return s ? `<figure><img src="${s}" alt="${escapeAttr(i.r)}" width="48" height="48" loading="lazy" data-onerr="hide"><figcaption>${escapeHtml(i.r)}</figcaption></figure>` : ''; }).join('')}</div>`;
  if(b.t === 'table') return `<div class="kz-gt-wrap"><table class="kz-gt${(b.head||[]).length >= 3 && (b.rows||[]).some(r=>r.some(c=>String(c).length > 90)) ? ' kz-gt-long' : ''}"><thead><tr>${(b.head||[]).map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${(b.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${guideTexto(escapeHtml(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return '';
}
function renderGuideReader(g){
  guideChips = guideChipsFor(g);
  const list = guiasData.guias, i = list.indexOf(g);
  const prev = list[i-1], next = list[i+1];
  const sec = (g.secoes||[]);
  return `
  <div class="kz-gr">
    <div><button class="kz-back-btn" id="guideBackBtn"><span class="arr">←</span><span>${kzt('guia.voltar')}</span></button></div>
    <div class="kz-gr-head">
      <img src="${guideCover(g)}" alt="" data-onerr="hide">
      <div class="txt">
        <span class="kz-gl-num">${escapeHtml(guideLabel(g))}</span>
        <h1>${escapeHtml(g.titulo)}</h1>
        <span class="sub">${escapeHtml(g.subtitulo)}</span>
        <span class="kz-gl-lock" style="margin-top:4px;">${kzt('guia.desbloqueio', { n: +g.nivel || 0 })}</span>
        ${(g.stats||[]).length ? `<div class="kz-gr-stats">${g.stats.map(s=>`<div class="st"><b>${escapeHtml(s[0])}</b><span>${escapeHtml(s[1])}</span></div>`).join('')}</div>` : ''}
        ${(g.verTambem||[]).map(id=>{ const o = guideBySlug(id); return o ? `<button type="button" class="kz-gr-also" data-guide="${escapeAttr(o.id)}">${kzt('guia.vejaTambem', { titulo: '<b>' + escapeHtml(o.titulo) + '</b>' })}</button>` : ''; }).join('')}
      </div>
    </div>
    <div class="kz-gr-layout">
      <nav class="kz-gr-toc" aria-label="${kzt('guia.nestaPagina')}">
        <span class="lbl">${kzt('guia.nestaPagina')}</span>
        <button type="button" class="kz-gr-top" data-gtop><span class="n">↑</span><span>${kzt('guia.topo')}</span></button>
        ${sec.map((s,k)=>`<button type="button" data-gsec="${k}"><span class="n${s.num ? '' : ' dot'}">${s.num ? escapeHtml(s.num) : '•'}</span><span>${escapeHtml(s.titulo)}</span></button>`).join('')}
        ${(g.observacoes||[]).length ? `<button type="button" data-gsec="obs"><span class="n">!</span><span>${kzt('guia.observacoes')}</span></button>` : ''}
      </nav>
      <div class="kz-gr-main">
        <p>${escapeHtml(g.resumo)}</p>
        ${(g.visao||[]).map(guideBlockHtml).join('')}
        ${sec.map((s,k)=>`
        <section class="kz-gr-sec" id="gsec-${k}">
          <h2>${s.num ? `<span class="n">${escapeHtml(s.num)}</span>` : ''}<span>${escapeHtml(s.titulo)}</span></h2>
          ${(s.blocos||[]).map(guideBlockHtml).join('')}
        </section>`).join('')}
        ${(g.observacoes||[]).length ? `<section class="kz-gr-obs" id="gsec-obs"><h2>${kzt('guia.observacoes')}</h2>${g.observacoes.map(guideBlockHtml).join('')}</section>` : ''}
        ${g.edicao ? `<div class="kz-gr-edicao">${escapeHtml(g.edicao)}</div>` : ''}
        <div class="kz-gr-pager">
          ${prev ? `<button type="button" data-guide="${escapeAttr(prev.id)}"><span class="k">${kzt('guia.anterior', { rotulo: escapeHtml(guideLabel(prev)) })}</span><span class="t">${escapeHtml(prev.titulo)}</span></button>` : '<span></span>'}
          ${next ? `<button type="button" class="next" data-guide="${escapeAttr(next.id)}"><span class="k">${kzt('guia.proximo', { rotulo: escapeHtml(guideLabel(next)) })}</span><span class="t">${escapeHtml(next.titulo)}</span></button>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}
function renderGuiasSistemas(){
  loadGuias();
  if(!guiasData) return guiasError
    ? `<div class="kz-empty">${kzt('guia.erroCarregar')} <button class="kz-link-btn" id="guiasRetryBtn">${kzt('guia.tentarDeNovo')}</button></div>`
    : `<div class="kz-empty">${kzt('guia.carregando')}</div>`;
  const g = state.guideId ? guideBySlug(state.guideId) : null;
  if(g) return renderGuideReader(g);
  if(visualNovo()) return `<div class="kz-gl-grid" id="guideGrid">${guideCardsHtml(state.guideQuery)}</div>`;   // busca fica na linha das abas
  return `
    <div class="kz-gl-tools">
      <input type="search" class="kz-input" id="guideSearch" placeholder="${kzt('guia.buscarAntigo')}" value="${escapeAttr(state.guideQuery)}" autocomplete="off">
      <span class="kz-gl-count">${kzt('guia.contagemAntigo', { n: guiasData.guias.length, ed: escapeHtml(guiasData.edicao) })}</span>
    </div>
    <div class="kz-gl-grid" id="guideGrid">${guideCardsHtml(state.guideQuery)}</div>`;
}
// Guias no formato do canvas: topo novo, abas e busca na mesma linha, cartões grandes em 3 colunas.
function renderGuiasTabNovo(){
  const views = [['sistemas','星',kzt('guia.sistemas')],['combos','連',kzt('guia.combosFormacao')]];
  const lista = state.guiasView !== 'combos' && guiasData;
  const busca = lista ? `
      <div class="kz-nvg-find">
        <div class="kz-nv-search sm"><span class="kz-nv-scan" aria-hidden="true"></span><div>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFC21A" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>
          <label for="guideSearch" class="kz-sr">${kzt('guia.buscarSr')}</label>
          <input type="search" id="guideSearch" placeholder="${kzt('guia.buscarNovo')}" value="${escapeAttr(state.guideQuery)}" autocomplete="off">
        </div></div>
        <span class="kz-nvg-count">${kzt('guia.contagemNovoHtml', { n: '<b>' + guiasData.guias.length + ' ' + kzt('guia.guias') + '</b>', ed: escapeHtml(guiasData.edicao) })}</span>
      </div>` : '';
  return `
  <section class="kz-page kz-nvp kz-nvg">
    ${nvPageHeadHtml({ key:'guias', kanji:'書', tag:kzt('deco.guias'), title:kzt('nav.guias'), kanjiStyle:'right:6%;top:-60px;font-size:380px',
      sub:kzt('guia.subtitulo') })}
    <div class="kz-nvg-bar">
      <div class="kz-tabs" role="tablist" aria-label="${kzt('guia.tipoDeGuia')}">
        ${views.map(([k,gl,l])=>`<button class="kz-tab ${state.guiasView===k?'active':''}" data-guias-view="${k}" role="tab" aria-selected="${state.guiasView===k}"><span class="glyph">${gl}</span><span>${l}</span></button>`).join('')}
      </div>
      ${busca}
    </div>
    ${state.guiasView === 'combos' ? renderGuiasCombos() : renderGuiasSistemas()}
  </section>`;
}
function renderGuiasTab(){
  const lendo = state.guiasView === 'sistemas' && state.guideId;
  if(visualNovo() && !lendo) return renderGuiasTabNovo();
  const views = [['sistemas','星',kzt('guia.sistemas')],['combos','連',kzt('guia.combosFormacao')]];
  return `
  <section class="kz-page">
    ${lendo ? '' : `<div>
      <h1 class="kz-title">${kzt('nav.guias')}</h1>
      <div class="kz-subtitle">${kzt('guia.subtitulo')}</div>
    </div>
    <div class="kz-tabs" role="tablist">
      ${views.map(([k,gl,l])=>`<button class="kz-tab ${state.guiasView===k?'active':''}" data-guias-view="${k}" role="tab" aria-selected="${state.guiasView===k}"><span class="glyph">${gl}</span><span>${l}</span></button>`).join('')}
    </div>`}
    ${state.guiasView === 'combos' ? renderGuiasCombos() : renderGuiasSistemas()}
  </section>`;
}
function setGuideHash(id){ /* o endereço do guia é cuidado por setRouteHash() a cada desenho da tela */ }
function openGuide(id, secIdx){
  state.tab = 'guias'; state.guiasView = 'sistemas'; state.guideId = id;
  if(isNarrowLayout()) state.navCompact = true;
  setGuideHash(id); saveUiTab(); render();
  if(secIdx != null) scrollToGuideSec(secIdx); else window.scrollTo(0, 0);
}
function closeGuide(){ state.guideId = null; setGuideHash(null); render(); window.scrollTo(0, 0); }
function scrollToGuideSec(k){
  const el = document.getElementById('gsec-' + k);
  if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
}
// Abrir um link direto (zenkyo.com.br/#guia-colecao).
function applyGuideHash(){
  const m = /^#guia-([a-z0-9-]{1,40})$/.exec((typeof location !== 'undefined' && location.hash) || '');
  if(!m) return;
  state.tab = 'guias'; state.guiasView = 'sistemas'; state.guideId = m[1];
}
// Destaca no índice a seção que está na tela e mantém o item visível na faixa do índice.
let guideSpyBound = false, guideSpyRaf = 0;
function updateGuideSpy(){
  const toc = document.querySelector('.kz-gr-toc');
  if(!toc) return;
  const lim = 130;
  let cur = null;
  const secs = [...document.querySelectorAll('.kz-gr-main [id^="gsec-"]')];
  secs.forEach(el=>{ if(el.getBoundingClientRect().top <= lim) cur = el.id.slice(5); });
  if(secs.length && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = secs[secs.length-1].id.slice(5);
  let ativo = null;
  toc.querySelectorAll('[data-gsec]').forEach(b=>{ const on = b.dataset.gsec === cur; b.classList.toggle('on', on); if(on) ativo = b; });
  if(ativo && ativo.dataset.spy !== '1'){
    toc.querySelectorAll('[data-spy]').forEach(b=>{ delete b.dataset.spy; });
    ativo.dataset.spy = '1';
    if(toc.scrollWidth > toc.clientWidth + 2) toc.scrollTo({ left: Math.max(0, ativo.offsetLeft - 40), behavior:'smooth' });
    else if(toc.scrollHeight > toc.clientHeight + 2) toc.scrollTo({ top: Math.max(0, ativo.offsetTop - 60), behavior:'smooth' });
  }
}
function attachGuiasHandlers(){
  const view = document.getElementById('view');
  if(!view || state.tab !== 'guias') return;
  view.querySelectorAll('[data-guia-char]').forEach(b=>b.addEventListener('click', ()=> openCharDetail(b.dataset.guiaChar)));
  view.querySelectorAll('[data-guias-view]').forEach(b=>b.addEventListener('click', ()=>{ state.guiasView = b.dataset.guiasView; state.guideId = null; setGuideHash(null); render(); }));
  view.querySelectorAll('[data-guide]').forEach(b=>b.addEventListener('click', ()=> openGuide(b.dataset.guide)));
  const back = document.getElementById('guideBackBtn');
  if(back) back.addEventListener('click', closeGuide);
  const retry = document.getElementById('guiasRetryBtn');
  if(retry) retry.addEventListener('click', ()=>{ guiasError = false; render(); });
  view.querySelectorAll('[data-gsec]').forEach(b=>b.addEventListener('click', ()=> scrollToGuideSec(b.dataset.gsec)));
  view.querySelectorAll('[data-gtop]').forEach(b=>b.addEventListener('click', ()=> window.scrollTo({ top:0, behavior:'smooth' })));
  if(!guideSpyBound && typeof window.addEventListener === 'function' && typeof requestAnimationFrame === 'function'){
    guideSpyBound = true;
    window.addEventListener('scroll', ()=>{ if(guideSpyRaf) return; guideSpyRaf = requestAnimationFrame(()=>{ guideSpyRaf = 0; if(state.tab === 'guias' && state.guideId) updateGuideSpy(); }); }, { passive:true });
  }
  if(state.guideId) updateGuideSpy();
  const search = document.getElementById('guideSearch');
  if(search) search.addEventListener('input', e=>{
    state.guideQuery = e.target.value;
    const grid = document.getElementById('guideGrid');
    if(grid){ grid.innerHTML = guideCardsHtml(state.guideQuery); grid.querySelectorAll('[data-guide]').forEach(b=>b.addEventListener('click', ()=> openGuide(b.dataset.guide))); }
  });
}

/* ======================= FAVORITOS ======================= */
// Ordem dos Favoritos no visual novo: 'recentes' (guardados por último primeiro), 'raridade' ou 'nome'. Fica só neste navegador.
const FAV_SORTS = [['recentes',kzt('fav.guardadosPorUltimo')],['raridade',kzt('filtro.raridade')],['nome',kzt('fav.nome')]];
function favSortKey(){
  try{ const v = localStorage.getItem('kiai_favs_ordem'); if(FAV_SORTS.some(s=>s[0] === v)) return v; }catch(e){}
  return 'recentes';
}
function sortedFavChars(){
  const favs = state.characters.filter(c=>isFav(c.id));
  const k = favSortKey();
  if(k === 'raridade') return sortByRarity(favs);
  if(k === 'nome') return favs.slice().sort((a, b)=> a.name.localeCompare(b.name, KZ_LOCALE));
  const pos = new Map(state.favs.map((id, i)=>[id, i]));
  return favs.slice().sort((a, b)=> pos.get(b.id) - pos.get(a.id));
}
function renderFavCardNovo(c){
  return `
  <div class="kz-card kz-nvfav" data-id="${c.id}" title="${kzt('chars.verFichaCompleta')}">
    <div class="kz-card-art">${portraitInner(c)}</div>
    <div class="kz-card-body">
      <div class="kz-card-name">${escapeHtml(kzNome(c.name))||kzt('geral.semNome')}</div>
      <div class="kz-nvfav-row">
        <span class="kz-card-meta">${nvMetaHtml(c)}</span>
        <button type="button" class="kz-nvfav-btn" data-fav="${c.id}" aria-pressed="true" aria-label="${escapeAttr(kzt('fav.tirarNome', { nome: kzNome(c.name) }))}" title="${kzt('fav.tirar')}"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="#FFC21A"><path d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.5L12 17l-5.8 3.4 1.4-6.5-4.9-4.4 6.5-.7z"/></svg></button>
      </div>
    </div>
  </div>`;
}
function renderFavsTabNovo(){
  const favChars = sortedFavChars(), n = favChars.length, k = favSortKey();
  const ordenar = n > 1 ? `<label class="kz-nv-lb kz-nvfav-sort">${kzt('fav.ordenar')}<select id="favSort">${FAV_SORTS.map(([v, l])=>`<option value="${v}"${v === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : '';
  const mais = `
      <button type="button" class="kz-nvfav-more" id="favGoChars">
        <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFC21A" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.5L12 17l-5.8 3.4 1.4-6.5-4.9-4.4 6.5-.7z"/></svg>
        <b>${n ? kzt('fav.guardarMais') : kzt('fav.nenhum')}</b>
        <span>${kzt('fav.dicaEstrela')}</span>
      </button>`;
  return `
  <section class="kz-page kz-nvp">
    ${nvPageHeadHtml({ key:'favs', kanji:'星', tagKanji:'★', tag:kzt('deco.favs'), title:kzt('nav.favoritos'),
      after: nvCountHtml(n, n === 1 ? kzt('fav.guerreiroGuardado') : kzt('fav.guerreirosGuardados')), side: ordenar, kanjiStyle:'right:8%;top:-50px' })}
    <div class="kz-grid kz-nvfav-grid">${favChars.map(renderFavCardNovo).join('')}${mais}</div>
  </section>`;
}
function renderFavsTab(){
  if(visualNovo()) return renderFavsTabNovo();
  const favChars = sortByRarity(state.characters.filter(c=>isFav(c.id)));
  const n = favChars.length;
  return `
  <section class="kz-page">
    <div>
      <h1 class="kz-title">${kzt('nav.favoritos')}</h1>
      <div class="kz-subtitle">${n} ${n===1?kzt('fav.guerreiroGuardado'):kzt('fav.guerreirosGuardados')}</div>
    </div>
    ${n ? `<div class="kz-grid">${favChars.map(visualNovo() ? renderCharCardNovo : renderCharCard).join('')}</div>` : `
    <div class="kz-fav-empty">
      <img src="${ballSrc(5)}" alt="">
      <div class="txt">
        <div class="t1">${kzt('fav.nenhum')}</div>
        <div class="t2">${kzt('fav.dicaEstrelaLonga')}</div>
        <button class="kz-btn kz-btn-primary kz-btn-sm" id="favGoChars" style="align-self:flex-start;">${kzt('fav.verPersonagens')}</button>
      </div>
    </div>`}
  </section>`;
}
function attachFavsHandlers(){
  const view = document.getElementById('view');
  if(!view || state.tab !== 'favs') return;
  attachCharCardHandlers(view);
  const go = document.getElementById('favGoChars');
  if(go) go.addEventListener('click', ()=> goTab('chars'));
  const sort = document.getElementById('favSort');
  if(sort) sort.addEventListener('change', ()=>{
    try{ localStorage.setItem('kiai_favs_ordem', sort.value); }catch(e){}
    render();
  });
}

/* ======================= DOAR ======================= */
// Doações pelo Mercado Pago (Checkout Pro). O site chama a Edge Function "mp-doacao" (Supabase), que cria a
// preferência com o Access Token guardado só no servidor e devolve o init_point; a pessoa paga na página do Mercado
// Pago (Pix, cartão ou saldo) e volta com ?doacao=aprovada|pendente|recusada. Quem lança o apoio na Aliança Z é o
// webhook "mp-webhook", depois de conferir o pagamento no próprio Mercado Pago — a volta para o site só mostra o aviso.
// Logado com Discord: soma no apoiador ligado ao perfil. Sem login: com nome entra no mural; anônimo fica fora dele.
// Em inglês a doação é em dólar pelo Ko-fi (que repassa para a conta do dono). O Ko-fi não deixa o site criar o pagamento
// nem voltar para cá: a pessoa doa na página do Ko-fi e cola na mensagem o código ZK-XXXXXXXX do perfil dela; quem lança o
// apoio é o webhook "kofi-webhook" (Supabase), que lê o código e soma no apoiador (a patente sobe sozinha). Sem código, entra
// no mural pelo nome digitado no Ko-fi. Os valores ficam guardados em reais (taxa fixa KZ_USD_BRL), igual nos dois idiomas.
const PAG_USD = KZ_LANG === 'en';
// Endereço da página do Ko-fi do dono, ex.: 'https://ko-fi.com/seunome'. Vazio = a aba de /en/ mostra "em breve".
const KOFI_URL = 'https://ko-fi.com/ahllysin';
const PAG_EM_BREVE = PAG_USD && !/^https:\/\/ko-fi\.com\/[A-Za-z0-9_.-]+\/?$/.test(KOFI_URL);
const PAG_HOST = /^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.br)?\//i;
const MP_VALORES = [10, 20, 50, 100];
const MP_VALOR_MIN = 5, MP_VALOR_MAX = 5000;
const MP_RETORNOS = {
  aprovada: ['ok', kzt('pag.retornoAprovada')],
  pendente: ['wait', kzt('pag.retornoPendente')],
  recusada: ['err', kzt('pag.retornoRecusada')],
};
function mpValorEscolhido(){
  const d = state.mpDoacao;
  if(!d.outro) return d.valor;
  const v = Number(String(d.outroValor || '').replace(',', '.'));
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN;
}
// rótulo de valor redondo (botões e limites): "R$ 20"
function mpRotulo(n){ return 'R$ ' + n.toLocaleString('pt-BR'); }
// Código do perfil para colar na mensagem do Ko-fi: ZK- + os 8 primeiros caracteres do id (o banco acha o perfil por ele).
function kofiCodigo(id){
  const h = String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  return /^[0-9A-F]{8}$/.test(h) ? 'ZK-' + h : '';
}
// Bloco de doação do site em inglês: botão para o Ko-fi + o código do perfil (logado) ou o aviso de como entrar no mural.
function kofiDoacaoHtml(){
  if(PAG_EM_BREVE) return `<p class="kz-mp-metodos">${kzt('pag.emBreve')}</p>`;
  const cod = state.discordUser ? kofiCodigo(state.discordUser.id) : '';
  const codigo = cod
    ? `<div class="kz-kofi-codigo"><span>${kzt('pag.kofiSeuCodigo')}</span><code id="kofiCodigo">${cod}</code><button type="button" class="kz-fchip" id="kofiCopiar">${kzt('pag.kofiCopiar')}</button></div>
        <p class="kz-mp-dica">${kzt('pag.kofiCole')}</p>`
    : `<p class="kz-mp-dica">${kzt('pag.kofiSemLogin')}</p>`;
  return `
        <p class="kz-mp-metodos">${kzt('pag.metodos')}</p>
        <p class="kz-mp-pixdica">${kzt('pag.dica')}</p>
        ${codigo}
        <p class="kz-mp-dica">${kzt('pag.kofiAnonimo')}</p>
        <a class="kz-donate-cta" id="kofiBtn" data-mp-checkout-cta="kofi" href="${escapeAttr(KOFI_URL)}" target="_blank" rel="noopener noreferrer"><span>気</span><span>${kzt('pag.botao')}</span></a>
        <button type="button" class="kz-fchip" id="kofiAtualizar">${kzt('pag.kofiAtualizar')}</button>
        <div class="kz-mp-status" id="mpStatus" role="status" aria-live="polite"></div>`;
}
function mpValorValido(v){ return Number.isFinite(v) && v >= MP_VALOR_MIN && v <= MP_VALOR_MAX; }
// Bloco de doação (mesmo conteúdo no visual novo e no antigo). O botão leva a marca data-mp-checkout-cta.
function mpDoacaoHtml(){
  if(PAG_USD) return kofiDoacaoHtml();
  const d = state.mpDoacao, v = mpValorEscolhido(), ok = mpValorValido(v);
  const ret = state.mpRetorno && MP_RETORNOS[state.mpRetorno];
  const quem = state.discordUser
    ? `<p class="kz-mp-quem">${kzt('pag.vaiPerfil', { nome: escapeHtml((state.myProfile && state.myProfile.nickname) || state.discordUser.username || kzt('pag.voce')) })}</p>`
    : `<label class="kz-mp-campo"><span>${kzt('pag.seuNome')}</span><input type="text" id="mpNome" maxlength="40" autocomplete="nickname" placeholder="${escapeAttr(kzt('pag.seuNomePh'))}" value="${escapeAttr(d.nome)}"${d.anonimo ? ' disabled' : ''}></label>
        <p class="kz-mp-dica">${kzt('pag.semNome')}</p>`;
  const carregando = d.estado === 'carregando';
  return `
        ${ret ? `<div class="kz-mp-retorno ${ret[0]}" role="status">${escapeHtml(ret[1])}</div>` : ''}
        <p class="kz-mp-metodos">${kzt('pag.metodos')}</p>
        <p class="kz-mp-pixdica">${kzt('pag.dica')}</p>
        <div class="kz-mp-valores" role="group" aria-label="${escapeAttr(kzt('pag.valorAria'))}">
          ${MP_VALORES.map(x=>{ const on = !d.outro && d.valor === x; return `<button type="button" class="kz-fchip${on ? ' active' : ''}" data-mp-valor="${x}" aria-pressed="${on}">${mpRotulo(x)}</button>`; }).join('')}
          <button type="button" class="kz-fchip${d.outro ? ' active' : ''}" data-mp-outro aria-pressed="${d.outro}">${kzt('pag.outroValor')}</button>
        </div>
        ${d.outro ? `<label class="kz-mp-campo"><span>${kzt('pag.outroLabel', { min: mpRotulo(MP_VALOR_MIN), max: mpRotulo(MP_VALOR_MAX) })}</span><input type="number" id="mpOutroValor" inputmode="decimal" min="${MP_VALOR_MIN}" max="${MP_VALOR_MAX}" step="1" placeholder="${escapeAttr(kzt('pag.outroPh'))}" value="${escapeAttr(d.outroValor)}"></label>` : ''}
        <p class="kz-mp-total">${kzt('pag.total')} <strong id="mpTotal">${ok ? formatBRL(v) : '—'}</strong></p>
        ${quem}
        <label class="kz-honor-check kz-mp-anon"><input type="checkbox" id="mpAnonimo"${d.anonimo ? ' checked' : ''}> ${kzt('pag.anonimo')}</label>
        <button type="button" class="kz-donate-cta" id="mpDoarBtn" data-mp-checkout-cta="checkout-pro" aria-label="${escapeAttr(kzt('pag.botao'))}"${carregando ? ' disabled aria-busy="true"' : ''}><span>気</span><span>${carregando ? kzt('pag.botaoAbrindo') : kzt('pag.botao')}</span></button>
        <div class="kz-mp-status${d.estado === 'erro' ? ' err' : ''}" id="mpStatus" role="status" aria-live="polite">${d.estado === 'erro' ? escapeHtml(d.msg) : ''}</div>`;
}
// Ao voltar do Mercado Pago: abre a aba Doar com o aviso e limpa o endereço (o registro de verdade vem do webhook).
function applyDoacaoRetorno(){
  let r = null, pid = '';
  try{
    const q = new URLSearchParams(location.search);
    r = q.get('doacao');
    pid = String(q.get('payment_id') || q.get('collection_id') || '').replace(/\D/g, '');   // o Mercado Pago devolve o número do pagamento
  }catch(e){}
  if(!r || !MP_RETORNOS[r]) return;
  state.tab = 'doar';
  state.mpRetorno = r;
  try{ history.replaceState(null, '', location.pathname + location.hash); }catch(e){}
  if(pid.length >= 6) confirmarRetornoMP(pid);
  if(r === 'aprovada' && typeof setTimeout === 'function'){
    [5000, 15000].forEach(ms=> setTimeout(()=>{ Promise.resolve(refreshDonorsRemote()).then(()=>{ if(state.tab === 'doar') render(); }).catch(()=>{}); }, ms));
  }
}
// Segundo caminho, independente do webhook: a função mp-retorno NÃO confia no número da volta; consulta o pagamento no
// próprio Mercado Pago e só então lança o apoio no mural. Roda sozinha, sem ninguém clicar em nada.
async function confirmarRetornoMP(pid){
  const rodar = async ()=>{
    try{
      const { data, error } = await window.__sb.client.functions.invoke('mp-retorno', { body: { pagamento: pid } });
      if(error) throw error;
      if(data && data.status === 'approved'){ await refreshDonorsRemote(); if(state.tab === 'doar') render(); }
    }catch(e){ console.error('Não consegui confirmar o pagamento na volta', e); }
  };
  if(window.__sb && window.__sb.client) return rodar();
  window.addEventListener('supabase-ready', rodar, { once:true });
}
// Pede à Edge Function (Checkout Pro) a preference da doação. Devolve { init_point } ou null (o erro aparece no bloco).
async function criarPreferenceMP(funcao){
  const d = state.mpDoacao;
  if(d.estado === 'carregando') return null;
  const valor = mpValorEscolhido();
  const falha = msg => { d.estado = 'erro'; d.msg = msg; render(); return null; };
  if(!mpValorValido(valor)) return falha(kzt('pag.escolhaValor', { min: mpRotulo(MP_VALOR_MIN), max: mpRotulo(MP_VALOR_MAX) }));
  if(!isSupabaseConfigured() || !window.__sb || !window.__sb.client) return falha(kzt('pag.indisponivel'));
  d.estado = 'carregando'; d.msg = ''; state.mpRetorno = null; render();
  try{
    const { data, error } = await window.__sb.client.functions.invoke(funcao, {
      body: { valor, nome: state.discordUser || d.anonimo ? '' : String(d.nome || '').trim().slice(0, 40), anonimo: !!d.anonimo },
    });
    if(error){
      let msg = '';
      try{ msg = (await error.context.json()).erro || ''; }catch(e){}
      return falha(msg || kzt('pag.naoAbriu'));
    }
    const url = data && data.init_point;
    if(typeof url !== 'string' || !PAG_HOST.test(url)) return falha(kzt('pag.inesperado'));
    return { init_point: url };
  }catch(e){
    return falha(kzt('pag.naoAbriu'));
  }
}
function attachMpDoacaoHandlers(view){
  const d = state.mpDoacao;
  view.querySelectorAll('[data-mp-valor]').forEach(b=> b.addEventListener('click', ()=>{ d.valor = Number(b.dataset.mpValor); d.outro = false; if(d.estado === 'erro') d.estado = ''; render(); }));
  const outro = view.querySelector('[data-mp-outro]');
  if(outro) outro.addEventListener('click', ()=>{ d.outro = true; if(d.estado === 'erro') d.estado = ''; render(); const i = document.getElementById('mpOutroValor'); if(i) i.focus(); });
  const ov = document.getElementById('mpOutroValor');
  if(ov) ov.addEventListener('input', ()=>{ d.outroValor = ov.value; const t = document.getElementById('mpTotal'); const v = mpValorEscolhido(); if(t) t.textContent = mpValorValido(v) ? formatBRL(v) : '—'; });
  const nome = document.getElementById('mpNome');
  if(nome) nome.addEventListener('input', ()=>{ d.nome = nome.value; });
  const anon = document.getElementById('mpAnonimo');
  if(anon) anon.addEventListener('change', ()=>{ d.anonimo = anon.checked; const n = document.getElementById('mpNome'); if(n) n.disabled = d.anonimo; });
  const btn = view.querySelector('#mpDoarBtn');
  // Checkout Pro: a função "mp-doacao" cria a preference no servidor; o botão leva para o init_point devolvido
  if(btn) btn.addEventListener('click', ()=> criarPreferenceMP('mp-doacao').then(pref => { if(pref && pref.init_point) window.location.assign(pref.init_point); }));
  // Ko-fi (site em inglês): copiar o código do perfil e reler o mural depois de doar
  const status = msg => { const s = document.getElementById('mpStatus'); if(s) s.textContent = msg; };
  const copiar = document.getElementById('kofiCopiar');
  if(copiar) copiar.addEventListener('click', async ()=>{
    const cod = (document.getElementById('kofiCodigo') || {}).textContent || '';
    try{ await navigator.clipboard.writeText(cod); status(kzt('pag.kofiCopiado')); }
    catch(e){ try{ const el = document.getElementById('kofiCodigo'); const sel = window.getSelection(); const rg = document.createRange(); rg.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(rg); status(kzt('pag.kofiSelecionado')); }catch(e2){} }
  });
  const atualizar = document.getElementById('kofiAtualizar');
  if(atualizar) atualizar.addEventListener('click', ()=>{
    Promise.resolve(refreshDonorsRemote()).then(()=>{ if(state.tab === 'doar'){ render(); status(kzt('pag.kofiAtualizado')); } }).catch(()=>{});
  });
}

// Patentes: sobem conforme o total doado (acumulado), do primeiro apoio até o topo.
// Inspirado no "Muro dos Aliados" do labninja.com.br, mas com progressão de poder do
// próprio Dragon Ball em vez de ranks ninja — mais reconhecível pra quem manja de DB.
const PATENTES = [
  { key:'guerreiro_z', min:0, label:kzt('pat.guerreiro_z'), desc:kzt('pat.guerreiro_zDesc') },
  { key:'saiyajin', min:20, label:kzt('pat.saiyajin'), desc:kzt('pat.saiyajinDesc') },
  { key:'ssj', min:50, label:kzt('pat.ssj'), desc:kzt('pat.ssjDesc') },
  { key:'ssj_god', min:100, label:kzt('pat.ssj_god'), desc:kzt('pat.ssj_godDesc') },
  { key:'ssj_blue', min:200, label:kzt('pat.ssj_blue'), desc:kzt('pat.ssj_blueDesc') },
  { key:'ultra', min:350, label:kzt('pat.ultra'), desc:kzt('pat.ultraDesc'),
    forms:['Ultra Instinto','Ultra Ego','Beast'], customColor:true, defaultColor:'#8cb4ff',
    note:kzt('pat.ultraNota') },
  { key:'deus_destruicao', min:600, label:kzt('pat.deus_destruicao'), desc:kzt('pat.deus_destruicaoDesc') },
  { key:'anjo', min:1000, label:kzt('pat.anjo'), desc:kzt('pat.anjoDesc'),
    customColor:true, defaultColor:'#e8f1ff', note:kzt('pat.anjoNota') },
];
// Trilha de Honra: reconhecimento pra quem contribui sem doar dinheiro — concedido à mão
// pelo admin, igual ao ranking por Pix. Cada chave é independente (uma pessoa pode ter várias).
const HONOR_BADGES = {
  cacador_erros: { label:kzt('honra.cacador_erros'), glyph:'⚑', desc:kzt('honra.cacador_errosDesc') },
  revisor_combo: { label:kzt('honra.revisor_combo'), glyph:'連', desc:kzt('honra.revisor_comboDesc') },
  escriba: { label:kzt('honra.escriba'), glyph:'書', desc:kzt('honra.escribaDesc') },
  mestre_kame: { label:kzt('honra.mestre_kame'), glyph:'亀', desc:kzt('honra.mestre_kameDesc') },
};

function formatBRL(n){
  if(KZ_LANG === 'en') return '$' + (Number(n||0) / KZ_USD_BRL).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:2});
  return 'R$ ' + Number(n||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}
// Mural público: só quem está ativo (devolução total desativa o apoio). A aba Admin pede com incluirInativos para ver todos.
function sortedDonors(incluirInativos){ return state.donors.filter(d=> incluirInativos || (d.active !== false && !isZenoh(d))).sort((a,b)=> (isZenoh(b) - isZenoh(a)) || (b.amount - a.amount)); }
// Ícone de quem apoia: a foto de perfil escolhida; para o próprio dono da conta, a foto do Discord; senão as iniciais.
function donorAvatarHtml(d, prof, nome){
  const foto = prof && avatarFoto(prof.avatarCharId);
  if(foto) return avatarFotoImg(foto);
  if(state.discordUser && d && d.linkedUserId === state.discordUser.id && state.discordUser.avatarUrl)
    return `<img src="${escapeAttr(state.discordUser.avatarUrl)}" alt="" data-onerr="hide" style="width:100%;height:100%;object-fit:cover;">`;
  return escapeHtml(initials(nome));
}
function donorAvatarInner(name){
  return `<span class="avatar-fallback" style="width:100%;height:100%;font-size:inherit;">${initials(name)}</span>`;
}
// Patente é sempre calculada do valor acumulado (nunca escolhida à mão) — quem doou mais
// sobe sozinho, "ser ultrapassado rebaixa" igual no site de referência.
// Patente única do criador do site: não existe por valor nenhum, só o dono pode ter (o banco também garante isso).
const PATENTE_ZENOH = { key:'zenoh', min:Infinity, label:"Zen'oh", desc:kzt('pat.zenoh'), unica:true };
function isZenoh(d){ return !!(d && typeof d === 'object' && d.patenteManual === 'zenoh' && (!window.ADMIN_DISCORD_ID || d.linkedUserId === window.ADMIN_DISCORD_ID)); }
// Aceita o apoiador (usa a patente manual, se o dono tiver definido) ou só o valor acumulado.
function patenteFor(x){
  const obj = x && typeof x === 'object' ? x : null;
  const amount = obj ? obj.amount : x;
  if(isZenoh(obj)) return PATENTE_ZENOH;
  if(obj && obj.patenteManual && obj.patenteManual !== 'zenoh'){ const m = PATENTES.find(p => p.key === obj.patenteManual); if(m) return m; }
  let cur = PATENTES[0];
  for(const p of PATENTES){ if(amount >= p.min) cur = p; }
  return cur;
}
// Só aceita #rrggbb — a cor vem do perfil de outra pessoa, nunca vira CSS solto.
function patenteHex(hex){ return /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : null; }
function patenteColorVars(hex){
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = v => Math.round(v + (255 - v) * 0.55);
  return `--pc:${r},${g},${b};--pctx:rgb(${mix(r)},${mix(g)},${mix(b)});`;
}
// Patente + o que a própria pessoa escolheu no Perfil: forma (Ultra Instinto/Ultra Ego/Beast) ou cor (Anjo).
function patenteLook(amount, prof){
  const p = patenteFor(amount);   // 'amount' pode ser o apoiador inteiro
  let label = p.label, style = '';
  if(p.forms && prof && p.forms.includes(prof.patenteForma)) label = kzTermo(prof.patenteForma);
  if(p.customColor) style = patenteColorVars(patenteHex(prof && prof.patenteCor) || p.defaultColor);
  return { p, label, style };
}
function patenteBadgeHtml(amount, extraClass, prof){
  const look = patenteLook(amount, prof);
  return `<span class="kz-patente-badge patente-${look.p.key} ${extraClass||''}"${look.style ? ` style="${look.style}"` : ''}>${escapeHtml(look.label)}</span>`;
}
function honraBadgeHtml(key){
  const h = HONOR_BADGES[key];
  if(!h) return '';
  return `<span class="kz-honra-badge" title="${escapeAttr(h.desc)}"><span class="glyph">${h.glyph}</span>${escapeHtml(h.label)}</span>`;
}

/* ======================= ALIANÇA Z: SUPABASE + DISCORD (opcional) ======================= */
// Backend opcional — ver o comentário HTML acima do <script type="module"> do Supabase pra
// configurar. Sem isso preenchido, a Aliança Z inteira roda só em window.storage (local),
// exatamente como antes; o botão "Entrar com Discord" some sozinho.
let supabaseAvailable = false;
function isSupabaseConfigured(){ return supabaseAvailable && !!window.__sb; }
function newDonorId(){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : uid(); }

window.addEventListener('supabase-unavailable', ()=>{ supabaseAvailable = false; if(loaded) render(); });
window.addEventListener('supabase-ready', async ()=>{
  supabaseAvailable = true;
  const { client } = window.__sb;
  try{
    const { data:{ session } } = await client.auth.getSession();
    applyDiscordSession(session);
    if(session){ await pullUserDataFromRemote(); await refreshMyProfile(); }
    refreshCharacters();
  }catch(e){ console.error(e); }
  client.auth.onAuthStateChange(async (_event, session)=>{
    const hadUser = !!state.discordUser;
    applyDiscordSession(session);
    if(session && (!hadUser || _event === 'SIGNED_IN')){ await pullUserDataFromRemote(); await refreshMyProfile(); await refreshDonorsRemote(); }
    if(!session) state.myDonationTotal = null;
    refreshCharacters();
    recomputeHeroFrames();
    if(session && isHeroAdmin()) loadHeroFramesRemote();
    render();
  });
  await refreshDonorsRemote();
  await refreshProfilesRemote();
  await loadHeroFramesRemote();
  if(loaded) render();
});

function applyDiscordSession(session){
  if(!session){ state.discordUser = null; return; }
  const u = session.user;
  const meta = u.user_metadata || {};
  state.discordUser = {
    id: u.id,
    username: meta.full_name || meta.name || (meta.custom_claims && meta.custom_claims.global_name) || kzt('conta.semNome'),
    avatarUrl: safeHttpsUrl(meta.avatar_url),
  };
}

// Toda chave que window.storage guarda — mesma lista usada por loadState() (do
// localStorage) e por pullUserDataFromRemote() (da conta Discord/Supabase), pra não ter
// duas versões da lógica de "aplicar esse valor salvo em cima do state ao vivo".
const SYNCED_KEYS = ['characters','team_state','formations','collection','tier_list','favs','donor_widget_collapsed','ui_tab'];
function applyStoredValue(key, raw){
  if(raw == null) return;
  try{
    switch(key){
      case 'characters': storedCharacters = JSON.parse(raw); break;   // só vale para o dono (ver siteCharacters)
      case 'team_state': { const p = JSON.parse(raw); state.team = p.team || Array(6).fill(null); break; }
      case 'formations': state.formations = JSON.parse(raw); break;
      case 'collection': state.collection = JSON.parse(raw); break;
      case 'tier_list': state.tierList = JSON.parse(raw); break;
      case 'favs': state.favs = JSON.parse(raw); break;
      case 'ui_tab': if(NAV_TABS.includes(raw)) state.tab = raw; break;
    }
  }catch(e){ console.error('Não consegui aplicar o dado salvo de "'+key+'"', e); }
}

// Salva local (window.storage) SEMPRE, e além disso manda pra conta Discord/Supabase
// quando logado — assim os dados pessoais (personagens, equipe, Coleção, tier list,
// favoritos) sincronizam entre qualquer aparelho em que a mesma pessoa entrar.
async function persist(key, rawValue){
  try{ await window.storage.set(key, rawValue); }catch(e){}
  if(!isSupabaseConfigured() || !state.discordUser) return;
  try{
    const { error } = await window.__sb.client.from('user_data').upsert({ user_id: state.discordUser.id, key, value: rawValue });
    if(error) throw error;
  }catch(e){
    console.error('Não consegui sincronizar "'+key+'" com o Supabase', e);
    showToast(kzt('conta.salvoLocal'));
  }
}

// Chamado logo após um login bem-sucedido — o que estiver salvo na conta manda por
// cima do que já estava neste navegador (mesmo comportamento de antes com a Coleção
// no Firebase, só que agora cobre o site inteiro).
async function pullUserDataFromRemote(){
  if(!isSupabaseConfigured() || !state.discordUser) return;
  try{
    const { data, error } = await window.__sb.client.from('user_data').select('key,value').eq('user_id', state.discordUser.id);
    if(error) throw error;
    for(const row of (data||[])){
      applyStoredValue(row.key, row.value);
      try{ await window.storage.set(row.key, row.value); }catch(e){}
    }
    refreshCharacters();
  }catch(e){
    console.error(kzt('conta.erroDados'), e);
    showToast(kzt('conta.erroDados'));
  }
}

// Chamado no fim de loadState() — cobre o caso raro de o módulo do Supabase (script
// assíncrono) já ter disparado 'supabase-ready' antes de loadState() terminar de rodar.
async function initDonorBackend(){
  if(isSupabaseConfigured()) await refreshDonorsRemote();
}

async function refreshDonorsRemote(){
  if(!isSupabaseConfigured()) return;
  try{
    const client = window.__sb.client;
    // Todo mundo lê a lista pela vista pública (valor arredondado pra faixa da patente); só o admin lê a tabela com o valor exato.
    // Se a vista ainda não foi criada no banco, cai pra tabela (comportamento antigo).
    const admin = isDonorAdmin();
    let res = admin ? await client.from('donations').select('*').order('amount', {ascending:false})
                    : await client.from('donations_public').select('*').order('amount', {ascending:false});
    if(res.error && !admin) res = await client.from('donations').select('*').order('amount', {ascending:false});
    if(res.error) throw res.error;
    const data = res.data;
    state.donors = (data||[]).map(row=>({
      id: row.id, number: row.number, name: row.name, amount: Number(row.amount)||0,
      quote: row.quote||'', discord: row.discord||'', link: row.link||'',
      honras: row.honras||[], active: row.active !== false, linkedUserId: row.user_id||null, patenteManual: row.patente_manual||'',
    }));
    state.nextDonorNumber = state.donors.reduce((m,d)=>Math.max(m, d.number||0), 0) + 1;
    // Total real do próprio login (só ele enxerga as próprias doações) — usado no limite de times da Comunidade.
    state.myDonationTotal = null;
    if(state.discordUser){
      const mine = await client.from('donations').select('amount,active').eq('user_id', state.discordUser.id);
      if(!mine.error) state.myDonationTotal = (mine.data||[]).filter(r=>r.active !== false).reduce((n,r)=>n + (Number(r.amount)||0), 0);
    }
  }catch(e){
    console.error('Não consegui carregar a Aliança Z do Supabase', e);
  }
}

/* ======================= PERFIL (identidade pública, Discord) ======================= */
// Cada pessoa loga com Discord e edita o próprio "cartão de identidade" (nick, servidor,
// bio, redes) na aba Perfil. O dono do site pode linkar esse perfil a um apoiador da
// Aliança Z (campo "Vincular perfil" no painel admin) — se a pessoa marcou o perfil como
// público, o mural passa a mostrar esses dados em vez do que foi digitado à mão.
const PROFILE_BIO_MAX = 220;
function blankProfile(){
  return { nickname:'', servidor:'', bio:'', instagram:'', twitch:'', youtube:'', avatarCharId:'', patenteForma:'', patenteCor:'', showSocials:false, public:false };
}
function profileFromRow(row){
  return {
    nickname: row.nickname||'', servidor: row.servidor||'', bio: row.bio||'',
    instagram: row.instagram||'', twitch: row.twitch||'', youtube: row.youtube||'',
    avatarCharId: row.avatar_char_id||'', patenteForma: row.patente_forma||'', patenteCor: row.patente_cor||'',
    showSocials: !!row.show_socials, public: !!row.is_public,
  };
}
async function refreshMyProfile(){
  if(!isSupabaseConfigured() || !state.discordUser){ state.myProfile = null; return; }
  try{
    const { data, error } = await window.__sb.client.from('profiles').select('*').eq('id', state.discordUser.id).maybeSingle();
    if(error) throw error;
    state.myProfile = data ? profileFromRow(data) : blankProfile();
  }catch(e){
    console.error('Não consegui carregar seu perfil', e);
    state.myProfile = blankProfile();
  }
}
async function refreshProfilesRemote(){
  if(!isSupabaseConfigured()){ state.profiles = []; return; }
  try{
    // Vista pública: já vem sem as redes de quem não quis mostrá-las. Plano B (vista ainda não criada): tabela, filtrando só os públicos.
    let res = await window.__sb.client.from('profiles_public').select('*');
    if(res.error) res = await window.__sb.client.from('profiles').select('*').eq('is_public', true);
    if(res.error) throw res.error;
    state.profiles = (res.data||[]).map(row=>({ id: row.id, ...profileFromRow(row) }));
  }catch(e){
    console.error('Não consegui carregar os perfis públicos', e);
  }
}
async function saveMyProfile(){
  if(!isSupabaseConfigured() || !state.discordUser) return;
  const p = state.myProfile;
  try{
    const row = {
      id: state.discordUser.id, nickname: p.nickname||null, servidor: p.servidor||null, bio: p.bio||null,
      instagram: p.instagram||null, twitch: p.twitch||null, youtube: p.youtube||null,
      avatar_char_id: p.avatarCharId||null, show_socials: !!p.showSocials, is_public: !!p.public,
    };
    let { error } = await window.__sb.client.from('profiles').upsert({ ...row, patente_forma: p.patenteForma||null, patente_cor: p.patenteCor||null });
    let semColunas = false;
    if(error){
      // Colunas novas (forma/cor da patente) ainda não criadas no Supabase: salva o resto do perfil mesmo assim.
      const r2 = await window.__sb.client.from('profiles').upsert(row);
      if(r2.error) throw r2.error;
      semColunas = true;
    }
    await refreshProfilesRemote();
    showToast(semColunas ? kzt('perfil.salvoSql') : kzt('perfil.salvo'));
  }catch(e){
    console.error('Não consegui salvar seu perfil', e);
    showToast(kzt('conta.salvoLocal'));
  }
}
// Só usa o perfil linkado se a própria pessoa marcou "público" — nunca mostra dado de
// quem não autorizou, mesmo que o admin tenha linkado o UID errado.
function linkedProfileFor(d){
  if(!d || !d.linkedUserId) return null;
  const p = (state.profiles||[]).find(x=>x.id===d.linkedUserId);
  return (p && p.public) ? p : null;
}

// Escolha de avatar por guerreiro desligada por enquanto: o campo some do perfil e o avatar volta a ser o do Discord.
// O valor já salvo (avatar_char_id) não é apagado — é só ligar de novo aqui.
const PROFILE_CHAR_AVATAR = false;
// Fotos de perfil prontas (assets/avatares/*.webp, recortes quadrados). O valor escolhido vai em avatar_char_id como "foto:<id>";
// o que vem do banco só vale se o id estiver nesta lista. Para incluir mais: coloque o .webp na pasta e acrescente uma linha aqui.
const AVATARES_FOTO = [
  { id:'foto:android-21', nome:'Android 21',  src:'assets/avatares/android-21.webp' },
  { id:'foto:broly-dbs',  nome:'Broly (DBS)', src:'assets/avatares/broly-dbs.webp' },
  { id:'foto:gohan-ssj2', nome:'Gohan SSJ2',  src:'assets/avatares/gohan-ssj2.webp' },
];
function avatarFoto(id){ return AVATARES_FOTO.find(a => a.id === id) || null; }
function avatarFotoImg(a){ return `<img src="${escapeAttr(a.src)}" alt="" loading="lazy" decoding="async" data-onerr="hide" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`; }
// Avatar do perfil: a foto escolhida, se houver; senão o que o chamador usaria (Discord ou iniciais).
function avatarFotoOr(prof, fallbackHtml){
  const a = prof && avatarFoto(prof.avatarCharId);
  return a ? avatarFotoImg(a) : fallbackHtml;
}
function avatarPickerHtml(p, discordHtml){
  const atual = (avatarFoto(p.avatarCharId) || {}).id || '';
  const opt = (id, nome, inner) => `<label class="kz-avpick-opt${atual === id ? ' on' : ''}" title="${escapeAttr(nome)}"><input type="radio" name="perfilAvatarFoto" value="${escapeAttr(id)}" ${atual === id ? 'checked' : ''}><span class="kz-avpick-img">${inner}</span><span class="kz-avpick-nm">${escapeHtml(nome)}</span></label>`;
  return `<div class="kz-avpick" role="radiogroup" aria-label="${kzt('perfil.fotoDePerfil')}">
    <span class="kz-nvpf-lb">${kzt('perfil.fotoDePerfil')}</span>
    <div class="kz-avpick-grid">${opt('', kzt('perfil.fotoDiscord'), discordHtml)}${AVATARES_FOTO.map(a => opt(a.id, a.nome, avatarFotoImg(a))).join('')}</div>
  </div>`;
}
// Apoio vinculado a este login (o admin liga o User UID na Aliança Z) — é dele que vem a patente.
function myDonorEntry(){
  if(!state.discordUser) return null;
  return (state.donors||[]).find(d=>d.linkedUserId === state.discordUser.id) || null;
}
// Campo de escolha da patente: forma pra quem está no patamar Ultra, cor pra quem é Anjo.
function patenteChoiceHtml(p){
  const d = myDonorEntry();
  if(!d) return '';
  const pat = patenteFor(d);
  let extra = '';
  if(pat.forms){
    const cur = pat.forms.includes(p.patenteForma) ? p.patenteForma : pat.forms[0];
    extra += `<div><label class="field-label">${kzt('perfil.formaPatente')}</label><select id="perfilPatenteForma">${pat.forms.map(f=>`<option value="${escapeAttr(f)}" ${f===cur?'selected':''}>${escapeHtml(kzTermo(f))}</option>`).join('')}</select></div>`;
  }
  if(pat.customColor){
    extra += `<div><label class="field-label">${kzt('perfil.corPatente')}</label><input type="color" id="perfilPatenteCor" value="${patenteHex(p.patenteCor) || pat.defaultColor}" style="width:72px;height:40px;padding:2px;cursor:pointer;"></div>`;
  }
  return `<div class="kz-patente-mine"><span class="kz-donate-note" style="margin:0;">${kzt('perfil.suaPatente', { p: '<b>' + escapeHtml(pat.label) + '</b>' })}</span></div>${extra}`;
}
function renderPerfilTab(){
  if(!isSupabaseConfigured()){
    return `<section class="kz-page"><h1 class="kz-title">${kzt('nav.perfil')}</h1><div class="kz-subtitle">${kzt('perfil.semLogin')}</div></section>`;
  }
  if(!state.discordUser){
    if(visualNovo()) return `<section class="kz-page kz-nvp">${nvPageHeadHtml({ key:'perfil', kanji:'印', tag:kzt('deco.perfil'), title:kzt('nav.perfil'), kanjiStyle:'right:8%;top:-60px;font-size:380px',
      sub:kzt('perfil.entreMontar') })}</section>`;
    return `<section class="kz-page">
      <h1 class="kz-title">${kzt('nav.perfil')}</h1>
      <div class="kz-subtitle">${kzt('perfil.entreMontar')}</div>
    </section>`;
  }
  const p = state.myProfile || blankProfile();
  const avatarChar = PROFILE_CHAR_AVATAR ? state.characters.find(c=>c.id===p.avatarCharId) : null;
  const bioLen = (p.bio||'').length;
  const myDonor = myDonorEntry();
  const myLook = myDonor ? patenteLook(myDonor, p) : { p: PATENTES[0], label: PATENTES[0].label, style: '' };
  if(visualNovo()){   // formato do canvas: formulário à esquerda, prévia em fogo à direita (mesmos ids dos campos)
    const nome = p.nickname || state.discordUser.username;
    const discordAv = state.discordUser.avatarUrl ? `<img src="${escapeAttr(state.discordUser.avatarUrl)}" alt="" data-onerr="hide">` : donorAvatarInner(nome);
    const av = avatarChar ? portraitInner(avatarChar) : avatarFotoOr(p, discordAv);
    const redes = p.showSocials && (p.instagram||p.twitch||p.youtube) ? [p.instagram,p.twitch,p.youtube].filter(Boolean).map(escapeHtml).join(' · ') : '';
    return `
  <section class="kz-page kz-nvp kz-nvpf">
    ${nvPageHeadHtml({ key:'perfil', kanji:'印', tag:kzt('deco.perfil'), title:kzt('nav.perfil'), kanjiStyle:'right:8%;top:-60px;font-size:380px',
      sub:kzt('perfil.monteComoAparece') })}
    <div class="kz-nvpf-grid">
      <div class="kz-nvpf-form">
        <div class="kz-nvpf-row two">
          <div><label class="kz-nvpf-lb" for="perfilNickInput">${kzt('perfil.apelido')}</label><input type="text" class="kz-input" id="perfilNickInput" value="${escapeAttr(p.nickname)}" placeholder="${kzt('perfil.comoAparecer')}" maxlength="40"></div>
          <div><label class="kz-nvpf-lb" for="perfilServidorInput">${kzt('perfil.servidor')}</label><input type="text" class="kz-input" id="perfilServidorInput" value="${escapeAttr(p.servidor)}" placeholder="${kzt('perfil.exServidor')}" maxlength="20"></div>
        </div>
        <div><label class="kz-nvpf-lb" for="perfilBioInput">${kzt('perfil.apresentacao', { n: '<span id="perfilBioCount">' + bioLen + '</span>', max: PROFILE_BIO_MAX })}</label><textarea id="perfilBioInput" maxlength="${PROFILE_BIO_MAX}" rows="3" placeholder="${kzt('perfil.umaFrase')}">${escapeHtml(p.bio)}</textarea></div>
        <div class="kz-nvpf-row three">
          <div><label class="kz-nvpf-lb" for="perfilInstaInput">Instagram</label><input type="text" class="kz-input" id="perfilInstaInput" value="${escapeAttr(p.instagram)}" placeholder="${kzt('perfil.usuario')}" maxlength="60"></div>
          <div><label class="kz-nvpf-lb" for="perfilTwitchInput">Twitch</label><input type="text" class="kz-input" id="perfilTwitchInput" value="${escapeAttr(p.twitch)}" placeholder="twitch.tv/…" maxlength="80"></div>
          <div><label class="kz-nvpf-lb" for="perfilYoutubeInput">YouTube</label><input type="text" class="kz-input" id="perfilYoutubeInput" value="${escapeAttr(p.youtube)}" placeholder="${kzt('perfil.linkCanal')}" maxlength="120"></div>
        </div>
        ${patenteChoiceHtml(p)}
        ${avatarPickerHtml(p, state.discordUser.avatarUrl ? `<img src="${escapeAttr(state.discordUser.avatarUrl)}" alt="" data-onerr="hide">` : donorAvatarInner(p.nickname || state.discordUser.username))}
        ${PROFILE_CHAR_AVATAR ? `<div><label class="kz-nvpf-lb" for="perfilAvatarSelect">${kzt('perfil.avatar')}</label><select id="perfilAvatarSelect"><option value="">${kzt('perfil.fotoDiscord')}</option>${state.characters.map(c=>`<option value="${c.id}" ${c.id===p.avatarCharId?'selected':''}>${escapeHtml(kzNome(c.name))}</option>`).join('')}</select></div>` : ''}
        <div class="kz-nvpf-checks">
          <label class="kz-honor-check"><input type="checkbox" id="perfilShowSocialsInput" ${p.showSocials?'checked':''}> ${kzt('perfil.mostrarRedes')}</label>
          <label class="kz-honor-check"><input type="checkbox" id="perfilPublicInput" ${p.public?'checked':''}> ${kzt('perfil.aparecer')}</label>
        </div>
        <div class="kz-nvpf-foot">
          <button class="kz-btn kz-btn-primary" id="savePerfilBtn">${kzt('perfil.salvar')}</button>
          <div class="kz-privacy-zone">
            <a href="${kzt('estatico.hrefPrivacidade')}" target="_blank" rel="noopener noreferrer">${kzt('estatico.privacidade')}</a>
            <button type="button" class="kz-com-link danger" id="deleteMyDataBtn" title="${kzt('perfil.apagarTitulo')}">${kzt('perfil.apagar')}</button>
          </div>
        </div>
      </div>
      <aside class="kz-nvpf-side">
        <span class="kz-nv-lb">${kzt('perfil.previaAlianca')}</span>
        <div class="kz-donor-list kz-nvpf-prev">
          <div class="kz-nv-rays" aria-hidden="true"></div>
          <div class="kz-donor-card kz-nvpf-card patente-${myLook.p.key}" style="pointer-events:none;${myLook.style}">
            <span class="kz-nvpf-av">${av}</span>
            ${nvTtl(nome)}
          </div>
          ${p.servidor ? `<span class="kz-nvpf-srv">${kzt('perfil.servidorNome', { nome: escapeHtml(p.servidor) })}</span>` : ''}
          ${myDonor ? patenteBadgeHtml(myDonor, '', p) : ''}
          ${p.bio ? `<p class="kz-nvpf-quote">“${escapeHtml(p.bio)}”</p>` : ''}
          ${redes ? `<span class="kz-nvpf-srv sm">${redes}</span>` : ''}
        </div>
        <p class="kz-nvpf-note">${kzt('perfil.notaPatente')}</p>
      </aside>
    </div>
    ${isSiteOwner() ? renderCrashLogPanel() : ''}
  </section>`;
  }
  return `
  <section class="kz-page">
    <div>
      <h1 class="kz-title">${kzt('nav.perfil')}</h1>
      <div class="kz-subtitle">${kzt('perfil.monteComoAparece')}</div>
    </div>
    <div class="kz-donate-layout">
      <div class="kz-panel kz-form-panel">
        <div>
          <label class="field-label">${kzt('perfil.apelido')}</label>
          <input type="text" id="perfilNickInput" value="${escapeAttr(p.nickname)}" placeholder="${kzt('perfil.comoAparecer')}" maxlength="40">
        </div>
        <div>
          <label class="field-label">${kzt('perfil.servidor')}</label>
          <input type="text" id="perfilServidorInput" value="${escapeAttr(p.servidor)}" placeholder="${kzt('perfil.exServidor')}" maxlength="20">
        </div>
        <div>
          <label class="field-label">${kzt('perfil.apresentacao', { n: '<span id="perfilBioCount">' + bioLen + '</span>', max: PROFILE_BIO_MAX })}</label>
          <textarea id="perfilBioInput" maxlength="${PROFILE_BIO_MAX}" rows="3" placeholder="${kzt('perfil.umaFrase')}">${escapeHtml(p.bio)}</textarea>
        </div>
        <div class="grid-2">
          <div><label class="field-label">Instagram</label><input type="text" id="perfilInstaInput" value="${escapeAttr(p.instagram)}" placeholder="${kzt('perfil.usuario')}" maxlength="60"></div>
          <div><label class="field-label">Twitch</label><input type="text" id="perfilTwitchInput" value="${escapeAttr(p.twitch)}" placeholder="twitch.tv/..." maxlength="80"></div>
        </div>
        <div>
          <label class="field-label">YouTube</label>
          <input type="text" id="perfilYoutubeInput" value="${escapeAttr(p.youtube)}" placeholder="${kzt('perfil.linkCanal')}" maxlength="120">
        </div>
        ${patenteChoiceHtml(p)}
        ${avatarPickerHtml(p, state.discordUser.avatarUrl ? `<img src="${escapeAttr(state.discordUser.avatarUrl)}" alt="" data-onerr="hide">` : donorAvatarInner(p.nickname || state.discordUser.username))}
        ${PROFILE_CHAR_AVATAR ? `<div>
          <label class="field-label">${kzt('perfil.avatar')}</label>
          <select id="perfilAvatarSelect">
            <option value="">${kzt('perfil.fotoDiscord')}</option>
            ${state.characters.map(c=>`<option value="${c.id}" ${c.id===p.avatarCharId?'selected':''}>${escapeHtml(kzNome(c.name))}</option>`).join('')}
          </select>
        </div>` : ''}
        <label class="kz-honor-check"><input type="checkbox" id="perfilShowSocialsInput" ${p.showSocials?'checked':''}> ${kzt('perfil.mostrarRedes')}</label>
        <label class="kz-honor-check"><input type="checkbox" id="perfilPublicInput" ${p.public?'checked':''}> ${kzt('perfil.aparecer')}</label>
        <button class="kz-btn kz-btn-primary kz-btn-sm" id="savePerfilBtn">${kzt('perfil.salvar')}</button>
        <div class="kz-privacy-zone">
          <a href="${kzt('estatico.hrefPrivacidade')}" target="_blank" rel="noopener noreferrer">${kzt('estatico.privacidade')}</a>
          <button type="button" class="kz-com-link danger" id="deleteMyDataBtn" title="${kzt('perfil.apagarTitulo')}">${kzt('perfil.apagar')}</button>
        </div>
      </div>
      <div class="kz-panel kz-donor-list">
        <span class="kz-label">${kzt('perfil.previa')}</span>
        <div class="kz-donor-card patente-${myLook.p.key}" style="pointer-events:none;${myLook.style}">
          <span class="kz-donor-avatar">${avatarChar ? portraitInner(avatarChar) : avatarFotoOr(p, donorAvatarInner(p.nickname||state.discordUser.username))}</span>
          <span class="kz-donor-name">${escapeHtml(p.nickname || state.discordUser.username)}</span>
          ${p.servidor ? `<span class="kz-donate-note" style="margin:0;">${escapeHtml(p.servidor)}</span>` : ''}
        </div>
        ${myDonor ? patenteBadgeHtml(myDonor, '', p) : ''}
        ${p.bio ? `<div class="kz-profile-quote">"${escapeHtml(p.bio)}"</div>` : ''}
        ${p.showSocials && (p.instagram||p.twitch||p.youtube) ? `<div class="kz-donate-note">${[p.instagram,p.twitch,p.youtube].filter(Boolean).map(escapeHtml).join(' · ')}</div>` : ''}
      </div>
    </div>
    ${isSiteOwner() ? renderCrashLogPanel() : ''}
  </section>`;
}

/* ---------- Painel do log de erros (só o dono, aba Perfil) ---------- */
function isSiteOwner(){ return isSupabaseConfigured() && !!(state.discordUser && state.discordUser.id === window.ADMIN_DISCORD_ID); }
function crashNavegador(ua){
  ua = String(ua || '');
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'outro';
  const so = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '?';
  return nav + ' · ' + so;
}
function renderCrashLogPanel(){
  const lista = state.crashLog;
  const quando = iso=>{ try{ return new Date(iso).toLocaleString('pt-BR'); }catch(e){ return String(iso || ''); } };
  const linhas = !lista ? '<div class="kz-muted">Clique em Carregar para ver os erros registrados no site.</div>'
    : !lista.length ? '<div class="kz-muted">Nenhum erro registrado.</div>'
    : lista.map(e=>{
        const x = e.extra || {};
        return `<div class="kz-crash-row${x.tipo === 'aviso' ? ' aviso' : ''}">
          <div class="kz-crash-top"><b>${escapeHtml(quando(e.created_at))}</b><span class="tag">${x.tipo === 'aviso' ? 'aviso' : 'erro'}</span>${x.aba ? `<span>aba ${escapeHtml(String(x.aba))}</span>` : ''}${e.user_id ? '<span>logado</span>' : ''}<span>${escapeHtml(crashNavegador(e.navegador))}</span></div>
          <div class="kz-crash-msg">${escapeHtml(e.msg)}</div>
          ${x.arquivo ? `<div class="kz-crash-det">${escapeHtml(String(x.arquivo))}${x.linha ? ':' + (+x.linha) : ''}${x.coluna ? ':' + (+x.coluna) : ''}</div>` : ''}
          ${e.stack ? `<details><summary>Detalhes</summary><pre>${escapeHtml(e.stack)}</pre></details>` : ''}
          <div class="kz-crash-det">${escapeHtml(e.pagina || '')} · versão ${escapeHtml(e.versao || '?')}</div>
        </div>`;
      }).join('');
  return `<div class="kz-panel kz-crash">
    <div class="kz-crash-head"><span class="kz-label">Log de erros do site · só você vê</span>
      <button type="button" class="kz-btn kz-btn-sm" id="crashLoadBtn">${lista ? 'Atualizar' : 'Carregar'}</button>
      ${lista && lista.length ? '<button type="button" class="kz-com-link danger" id="crashClearBtn">Limpar log</button>' : ''}
    </div>
    ${lista && lista.length ? `<div class="kz-muted" style="font-size:12.5px;">${lista.length} registro${lista.length > 1 ? 's' : ''} (os 100 mais recentes).</div>` : ''}
    <div class="kz-crash-list">${linhas}</div>
  </div>`;
}
async function loadCrashLog(){
  if(!isSiteOwner()) return;
  const { data, error } = await window.__sb.client.from('site_errors').select('*').order('id', { ascending:false }).limit(100);
  if(error){ showToast('Não consegui carregar o log de erros'); return; }
  state.crashLog = data || [];
  render();
}
async function clearCrashLog(){
  if(!isSiteOwner() || !confirm('Apagar todos os erros registrados?')) return;
  const { error } = await window.__sb.client.from('site_errors').delete().gt('id', 0);
  if(error){ showToast('Não consegui limpar o log'); return; }
  state.crashLog = [];
  render();
  showToast('Log de erros limpo');
}

function attachPerfilHandlers(){
  const view = document.getElementById('view');
  if(!view || state.tab !== 'perfil') return;
  const crashLoad = document.getElementById('crashLoadBtn');
  if(crashLoad) crashLoad.addEventListener('click', loadCrashLog);
  const crashClear = document.getElementById('crashClearBtn');
  if(crashClear) crashClear.addEventListener('click', clearCrashLog);
  const bioInput = document.getElementById('perfilBioInput');
  const bioCount = document.getElementById('perfilBioCount');
  if(bioInput && bioCount) bioInput.addEventListener('input', ()=>{ bioCount.textContent = bioInput.value.length; });
  // Prévia ao vivo da forma/cor escolhida
  const forma = document.getElementById('perfilPatenteForma');
  const cor = document.getElementById('perfilPatenteCor');
  const prevBadge = view.querySelector('.kz-donor-list .kz-patente-badge');
  const prevCard = view.querySelector('.kz-donor-list .kz-donor-card');
  if(forma && prevBadge) forma.addEventListener('change', ()=>{ prevBadge.textContent = forma.value; });
  if(cor && prevBadge && prevCard) cor.addEventListener('input', ()=>{
    const v = patenteColorVars(cor.value);
    prevBadge.setAttribute('style', v);
    prevCard.setAttribute('style', 'pointer-events:none;' + v);
  });
  const delBtn = document.getElementById('deleteMyDataBtn');
  if(delBtn) delBtn.addEventListener('click', () => {
    customConfirm(kzt('perfil.apagarConfirma'), async () => {
      const ok = await deleteMyOnlineData();
      if(ok){ showToast(kzt('perfil.dadosApagados')); await signOutDiscord(); }
      else showToast(kzt('perfil.erroApagar'));
    });
  });
  const save = document.getElementById('savePerfilBtn');
  if(!save) return;
  save.addEventListener('click', async ()=>{
    state.myProfile = {
      nickname: document.getElementById('perfilNickInput').value.trim(),
      servidor: document.getElementById('perfilServidorInput').value.trim(),
      bio: document.getElementById('perfilBioInput').value.trim().slice(0, PROFILE_BIO_MAX),
      instagram: document.getElementById('perfilInstaInput').value.trim(),
      twitch: document.getElementById('perfilTwitchInput').value.trim(),
      youtube: document.getElementById('perfilYoutubeInput').value.trim(),
      patenteForma: (document.getElementById('perfilPatenteForma') || {}).value || ((state.myProfile && state.myProfile.patenteForma) || ''),
      patenteCor: ((document.getElementById('perfilPatenteCor') || {}).value) || ((state.myProfile && state.myProfile.patenteCor) || ''),
      avatarCharId: PROFILE_CHAR_AVATAR ? document.getElementById('perfilAvatarSelect').value
        : document.querySelector('input[name="perfilAvatarFoto"]') ? ((document.querySelector('input[name="perfilAvatarFoto"]:checked') || {}).value || '')
        : ((state.myProfile && state.myProfile.avatarCharId) || ''),
      showSocials: document.getElementById('perfilShowSocialsInput').checked,
      public: document.getElementById('perfilPublicInput').checked,
    };
    await saveMyProfile();
    render();
  });
}

// Espelha local (window.storage) E manda pro Supabase quando configurado — sempre salva
// local primeiro, então mesmo se a sincronização falhar nada se perde deste aparelho.
async function syncDonorRemote(entryOrId, action){
  if(!isSupabaseConfigured() || !isDonorAdmin()) return;
  try{
    if(action === 'delete'){
      const { error } = await window.__sb.client.from('donations').delete().eq('id', entryOrId);
      if(error) throw error;
    } else {
      const d = entryOrId;
      const { error } = await window.__sb.client.from('donations').upsert({
        id: d.id, number: d.number, name: d.name, amount: d.amount,
        quote: d.quote || null, discord: d.discord || null, link: d.link || null,
        honras: d.honras || [], active: d.active !== false, user_id: d.linkedUserId || null,
      });
      if(error) throw error;
    }
  }catch(e){
    console.error('Não consegui sincronizar com o Supabase', e);
    showToast(kzt('conta.salvoLocal'));
  }
}

async function signInWithDiscord(){
  if(!isSupabaseConfigured()){ showToast(kzt('conta.semBackend')); return; }
  await window.__sb.client.auth.signInWithOAuth({ provider:'discord', options:{ redirectTo: window.location.origin + window.location.pathname } });
}
// Apaga do servidor tudo que pertence a este login: posts e curtidas da Comunidade, dados sincronizados e perfil.
// Os dados guardados neste aparelho continuam. A conta de login do Discord só some a pedido (ver política de privacidade).
async function deleteMyOnlineData(){
  if(!isSupabaseConfigured() || !state.discordUser) return false;
  const me = state.discordUser.id, c = window.__sb.client;
  try{
    // um de cada vez, na ordem; se algum falhar, para (nada de apagar o resto pela metade sem avisar)
    const steps = [
      () => c.from('community_posts').delete().eq('user_id', me),
      () => c.from('community_likes').delete().eq('user_id', me),
      () => c.from('user_data').delete().eq('user_id', me),
      () => c.from('profiles').delete().eq('id', me),
    ];
    for(const run of steps){ const { error } = await run(); if(error) throw error; }
    state.myProfile = blankProfile();
    state.communityPosts = (state.communityPosts || []).filter(p => p.userId !== me);
    state.communityMyLikes = [];
    return true;
  }catch(e){
    console.error('Não consegui apagar os dados online', e);
    return false;
  }
}
async function signOutDiscord(){
  if(!isSupabaseConfigured()) return;
  await window.__sb.client.auth.signOut();
  state.discordUser = null;
  render();
}

// Nota curta na aba Doar pra quem ainda não entrou — o botão de verdade fica só no
// topo da página (área de conta), pra não ter dois jeitos de logar na mesma tela.
function renderDiscordLoginNote(){
  if(!isSupabaseConfigured() || state.discordUser) return '';
  return `<div class="kz-donate-note">${kzt('conta.vincularApoio')}</div>`;
}

// Só o dono do site pode usar o painel de adicionar/remover apoiador e conceder Honras.
// Sem Supabase configurado não tem como saber quem é visitante, então o painel fica aberto
// pra qualquer um (igual já era) — com Supabase + Discord, só libera pro ADMIN_DISCORD_ID.
function isDonorAdmin(){
  if(!isSupabaseConfigured()) return true;
  return !!(state.discordUser && state.discordUser.id === window.ADMIN_DISCORD_ID);
}

// Visual novo: cor de cada patente (aura, brilho da figura, nome) e o guerreiro que aparece no cartão (assets/patentes/).
const NV_PATENTE_LOOK = {
  guerreiro_z:['#969BA5','rgba(199,203,211,.8)','#E6E8EC'], saiyajin:['#D97B2A','rgba(240,168,104,.8)','#F0A868'],
  ssj:['#FFD23F','rgba(255,210,63,.9)','#FFE9A8'], ssj_god:['#E0401F','rgba(224,64,31,.9)','#FF9A8A'],
  ssj_blue:['#2F7DEB','rgba(47,125,235,.9)','#8EC0FF'], ultra:['#8CB4FF','rgba(215,230,255,.9)','#D7E6FF'],
  deus_destruicao:['#8B5FBF','rgba(139,95,191,.9)','#C3AAF0'], anjo:['#FFFFFF','rgba(232,241,255,.9)','#FFFFFF'],
  zenoh:['#FFF4C2','rgba(255,236,150,.95)','#FFFFFF'],
};
// Pódio da Aliança Z: 2º, 1º e 3º lugar (lugar vazio = "Livre").
function nvPodiumHtml(list){
  const lugar = (pos, alto)=>{
    const d = list[pos - 1];
    let topo = `<span class="kz-nvd-free${pos === 1 ? ' gold' : ''}">${kzt('doar.livre')}</span>`;
    if(d){
      const prof = linkedProfileFor(d), nome = (prof && prof.nickname) || d.name;
      topo = `<button type="button" class="kz-nvd-who" data-open-donor="${d.id}" title="${escapeAttr(kzt('com.verPerfilDe', { nome }))}"><span class="av">${donorAvatarHtml(d, prof, nome)}</span><span class="nm">${escapeHtml(nome)}</span></button>`;
    }
    return `<div class="kz-nvd-place p${pos}">${pos === 1 ? `<img class="kz-nvd-ball" src="${ballSrc(4)}" alt="" aria-hidden="true">` : ''}${topo}<div class="kz-nvd-step" style="height:${alto}px">${nvTtl(String(pos))}</div></div>`;
  };
  return `<div class="kz-nvd-podium">${lugar(2, 130)}${lugar(1, 186)}${lugar(3, 100)}</div>`;
}
// A patente única Zen'oh aparece só como título (o dono não ocupa lugar no ranking nem no pódio).
function zenohTituloHtml(){
  const z = state.donors.find(d => d.active !== false && isZenoh(d));
  return z ? `<p class="kz-nvd-zenoh">${patenteBadgeHtml(z, '', linkedProfileFor(z))}<span>${kzt('doar.patenteUnica')}</span></p>` : '';
}
function renderDoarTabNovo(){
  const list = sortedDonors();
  const admin = isDonorAdmin();
  const limite = state.rankingAberto ? 10 : 5;
  const resto = list.slice(3, limite), maisRanking = list.slice(0, 10).length > 5;
  return `
  <section class="kz-page kz-nvp kz-nvd">
    ${nvPageHeadHtml({ key:'doar', kanji:'援', tag:kzt('deco.doar'), title:kzt('nav.doar'), kanjiStyle:'right:8%;top:-60px;font-size:380px',
      sub:kzt('doar.subtitulo') })}
    <div class="kz-nvd-top">
      <div class="kz-nvd-pn kz-nvd-pix">
        <span class="kz-nv-lb">Doar com Mercado Pago</span>
${mpDoacaoHtml()}
        <p class="kz-nvd-note">${kzt('doar.bonus', { valor: kzValorBRL(COMMUNITY.supporterMin), max: COMMUNITY.teamLimitSupporter, min: COMMUNITY.teamLimit })}</p>
        <p class="kz-nvd-note">${kzt('doar.valorOculto')}</p>
      </div>
      <div class="kz-nvd-pn kz-nvd-ally kz-donor-list">
        <div class="kz-nv-rays" aria-hidden="true"></div>
        <div class="kz-nvd-glow" aria-hidden="true"></div>
        <div class="kz-nvd-allyhead"><h2>${nvTtl(kzt('doar.aliancaZ'))}</h2><span>${kzt('doar.noMural', { n: '<b>' + list.length + '</b>', nomes: kzt(list.length === 1 ? 'doar.nome1' : 'doar.nomeN') })}</span></div>
        ${zenohTituloHtml()}
        ${nvPodiumHtml(list)}
        ${list.length ? '' : `<p class="kz-nvd-empty">${kzt('doar.aliancaVazia')}</p>`}
        ${resto.length ? `<div class="kz-donor-grid">${resto.map((d, i)=>renderDonorCard(d, i + 3)).join('')}</div>` : ''}
        ${maisRanking ? `<button type="button" class="kz-btn kz-btn-sm kz-nvd-more" id="rankingToggle" aria-expanded="${state.rankingAberto}">${state.rankingAberto ? kzt('doar.menos') : kzt('doar.top10')}</button>` : ''}
        ${admin ? `<p class="kz-nvd-note mut">${kzt('doar.voceEDono')}</p>` : ''}
      </div>
    </div>
    <section class="kz-nvd-sec">
      <div><h2 class="kz-nvd-h2">${nvTtl(kzt('doar.patentes'))}</h2><p class="kz-nvd-sub">${kzt('doar.patentesSubNovo')}</p></div>
      <div class="kz-nvd-pats">
        ${PATENTES.map((p, i)=>{
          const [aura, glow, cor] = NV_PATENTE_LOOK[p.key] || ['#FF6A13','rgba(255,106,19,.8)','#FFF4E6'];
          const meter = Array.from({ length:8 }, (_, k)=> k <= i ? `<i style="background:${aura};box-shadow:0 0 8px ${aura}"></i>` : '<i></i>').join('');
          return `
        <article class="kz-nvd-pat${p.key === 'anjo' ? ' top' : ''}">
          <span class="aura" aria-hidden="true" style="background:${aura}"></span>
          <img class="ch" src="assets/patentes/${p.key}.webp" alt="" aria-hidden="true" style="--g:${glow}" data-onerr="hide">
          <div class="meter" aria-hidden="true">${meter}</div>
          <h3 style="color:${cor}">${escapeHtml(p.label)}</h3>
          <p class="pd">${escapeHtml(p.desc)}</p>
          ${p.note ? `<p class="px">${escapeHtml(p.note)}</p>` : ''}
          <span class="pv" style="color:${cor}">${p.min > 0 ? kzt('doar.aPartirDe', { valor: formatBRL(p.min) }) : kzt('doar.qualquerApoio')}</span>
        </article>`;
        }).join('')}
      </div>
    </section>
    <section class="kz-nvd-sec">
      <div><h2 class="kz-nvd-h2">${nvTtl(kzt('doar.trilhaHonra'))}</h2><p class="kz-nvd-sub">${kzt('doar.honraSub')}</p></div>
      <div class="kz-nvd-hons">
        ${Object.values(HONOR_BADGES).map(h=>`
        <article class="kz-nvd-hon"><span class="kz-nvf-seal" aria-hidden="true">${h.glyph}</span><div><h3>${escapeHtml(h.label)}</h3><p class="pd">${escapeHtml(h.desc)}</p></div></article>`).join('')}
      </div>
    </section>
  </section>`;
}
// Painel do dono do site na Aliança Z (adicionar apoiador e conceder Honras).
function renderDonorAdminHtml(){
  return `
        <div class="kz-donor-admin">
          <span class="kz-label" style="font-size:11px;">Painel do dono do site</span>
          <div class="kz-donate-note">Doações feitas pelo botão do Mercado Pago entram sozinhas no mural. Use este painel para apoios recebidos por fora (ex.: Pix direto) ou para conceder uma Honra sem valor nenhum, pra quem ajudou de outro jeito.</div>
          <div class="kz-donor-admin-row">
            <input type="text" id="donorNameInput" placeholder="Nome do apoiador">
            <input type="number" id="donorAmountInput" placeholder="Valor (R$)" min="0" step="0.01">
          </div>
          <div class="kz-donor-admin-row">
            <input type="text" id="donorQuoteInput" placeholder="Frase/citação (opcional)">
          </div>
          <div class="kz-donor-admin-row">
            <input type="text" id="donorDiscordInput" placeholder="Discord (opcional)">
            <input type="text" id="donorLinkInput" placeholder="Link de rede social (opcional)">
          </div>
          <div class="kz-donor-admin-row">
            <input type="text" id="donorLinkedUidInput" placeholder="Vincular perfil (User UID, opcional)">
          </div>
          <div class="kz-donor-admin-row kz-honor-checks">
            ${Object.entries(HONOR_BADGES).map(([key,h])=>`
            <label class="kz-honor-check"><input type="checkbox" data-honor-key="${key}"><span class="glyph">${h.glyph}</span>${escapeHtml(h.label)}</label>`).join('')}
          </div>
          <div class="kz-donor-admin-row">
            <button class="kz-btn kz-btn-primary kz-btn-sm" id="addDonorBtn">Adicionar à Aliança Z</button>
          </div>
        </div>`;
}
function renderDoarTab(){
  if(visualNovo()) return renderDoarTabNovo();
  const list = sortedDonors();
  const admin = isDonorAdmin();
  return `
  <section class="kz-page">
    <div>
      <h1 class="kz-title">${kzt('nav.doar')}</h1>
      <div class="kz-subtitle">${kzt('doar.subtitulo')}</div>
    </div>
    <div class="kz-donate-layout">
      <div class="kz-panel kz-donate-card">
        <span class="kz-label">Doar com Mercado Pago</span>
${mpDoacaoHtml()}
        <div class="kz-donate-note">${kzt('doar.bonus', { valor: kzValorBRL(COMMUNITY.supporterMin), max: COMMUNITY.teamLimitSupporter, min: COMMUNITY.teamLimit })}</div>
        <div class="kz-donate-note">${kzt('doar.valorOculto')}</div>
      </div>
      <div class="kz-panel kz-donor-list">
        <div class="kz-donor-list-head">
          <span class="kz-label">${kzt('doar.aliancaZ')}</span>
          <span class="kz-donate-note" style="margin:0;">${kzt('doar.noMural', { n: list.length, nomes: kzt(list.length === 1 ? 'doar.nome1' : 'doar.nomeN') })}</span>
        </div>
        ${list.length ? `<div class="kz-donor-grid">${list.map((d,i)=>renderDonorCard(d,i)).join('')}</div>`
          : `<div class="kz-muted">${kzt('doar.aliancaVazia')}</div>`}

        ${admin ? `<p class="kz-nvd-note mut">${kzt('doar.voceEDono')}</p>` : ''}
      </div>
    </div>

    <div class="kz-page-head" style="margin-top:6px;">
      <div><h2 class="kz-panel-title" style="font-size:36px;">${kzt('doar.patentes')}</h2><div class="kz-subtitle">${kzt('doar.patentesSub')}</div></div>
    </div>
    <div class="kz-patente-grid">
      ${PATENTES.map(p=>`
      <article class="kz-patente-card patente-${p.key}">
        <span class="kz-patente-name">${escapeHtml(p.label)}</span>
        <span class="kz-patente-desc">${escapeHtml(p.desc)}</span>
        ${p.note ? `<span class="kz-patente-note">${escapeHtml(p.note)}</span>` : ''}
        <span class="kz-patente-min">${p.min>0 ? kzt('doar.aPartirDe', { valor: formatBRL(p.min) }) : kzt('doar.qualquerApoio')}</span>
      </article>`).join('')}
    </div>

    <div class="kz-page-head" style="margin-top:6px;">
      <div><h2 class="kz-panel-title" style="font-size:36px;">${kzt('doar.trilhaHonra')}</h2><div class="kz-subtitle">${kzt('doar.honraSub')}</div></div>
    </div>
    <div class="kz-honra-grid">
      ${Object.values(HONOR_BADGES).map(h=>`
      <article class="kz-honra-card">
        <span class="glyph">${h.glyph}</span>
        <span class="kz-honra-name">${escapeHtml(h.label)}</span>
        <span class="kz-honra-desc">${escapeHtml(h.desc)}</span>
      </article>`).join('')}
    </div>
  </section>`;
}

function renderDonorCard(d, i){
  const prof = linkedProfileFor(d);
  const look = patenteLook(d, prof);
  const p = look.p;
  const name = (prof && prof.nickname) || d.name;
  const avatarChar = PROFILE_CHAR_AVATAR && prof && prof.avatarCharId ? state.characters.find(c=>c.id===prof.avatarCharId) : null;
  return `
  <button class="kz-donor-card patente-${p.key}" data-open-donor="${d.id}"${look.style ? ` style="${look.style}"` : ''}>
    <span class="kz-donor-number">${kzt('doar.numero', { n: d.number != null ? d.number : (i+1) })}</span>
    <span class="kz-donor-avatar">${avatarChar ? portraitInner(avatarChar) : avatarFotoOr(prof, donorAvatarInner(name))}</span>
    <span class="kz-donor-name">${escapeHtml(name)}</span>
    ${prof && prof.servidor ? `<span class="kz-donate-note" style="margin:0;">${escapeHtml(prof.servidor)}</span>` : ''}
    ${patenteBadgeHtml(d, '', prof)}
    ${(d.honras||[]).length ? `<span class="kz-donor-honras">${d.honras.map(k=>HORRA_GLYPH(k)).join('')}</span>` : ''}
  </button>`;
}
function HORRA_GLYPH(key){
  const h = HONOR_BADGES[key];
  return h ? `<span class="kz-mini-honra" title="${escapeAttr(h.label)}">${h.glyph}</span>` : '';
}

// HTML puro do popup de perfil, sem tocar no DOM — separado só pra dar pra testar
// (sandbox de teste não tem document de verdade) e reusar se precisar em outro lugar.
// Só o dono vê: define a patente de qualquer apoiador (Automática = pelo valor acumulado). Zen'oh só aparece para a conta do dono.
function donorPatenteSelectHtml(d){
  const opts = [['', 'Automática (pelo valor)']].concat(PATENTES.map(p => [p.key, p.label]));
  if(!window.ADMIN_DISCORD_ID || d.linkedUserId === window.ADMIN_DISCORD_ID) opts.push(['zenoh', PATENTE_ZENOH.label + ' (única)']);
  return `<div class="kz-donor-patsel"><label class="kz-nvpf-lb" for="donorPatenteSelect">Patente (só você vê este controle)</label>
    <select id="donorPatenteSelect">${opts.map(([k, l]) => `<option value="${escapeAttr(k)}" ${(d.patenteManual || '') === k ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('')}</select></div>`;
}
async function setDonorPatente(id, key){
  const d = state.donors.find(x => x.id === id);
  if(!d || !isDonorAdmin()) return;
  if(key === 'zenoh' && window.ADMIN_DISCORD_ID && d.linkedUserId !== window.ADMIN_DISCORD_ID){ showToast("Zen'oh é só da conta do dono."); return; }
  d.patenteManual = key || '';
  saveDonors();
  render();
  if(isSupabaseConfigured()){
    const { error } = await window.__sb.client.rpc('admin_definir_patente', { p_id: id, p_patente: key || null });
    if(error){ console.error('Patente não sincronizou', error); showToast('Salvo só neste aparelho — não consegui sincronizar com a nuvem'); return; }
  }
  showToast('Patente atualizada');
}
function donorProfileModalHtml(d){
  const p = patenteFor(d);
  const prof = linkedProfileFor(d);
  const name = (prof && prof.nickname) || d.name;
  const avatarChar = PROFILE_CHAR_AVATAR && prof && prof.avatarCharId ? state.characters.find(c=>c.id===prof.avatarCharId) : null;
  const quote = (prof && prof.bio) || d.quote;
  const socials = prof && prof.showSocials ? [prof.instagram, prof.twitch, prof.youtube].filter(Boolean) : [];
  return `
  <div class="modal-overlay" id="donorProfileOverlay">
    <div class="modal" style="max-width:460px;">
      <div class="modal-header">
        <h2>${escapeHtml(name)}</h2>
        <button class="kz-close-btn" id="closeDonorProfileBtn" aria-label="${kzt('comum.fechar')}">✕</button>
      </div>
      <div class="modal-body" style="align-items:center;text-align:center;">
        <span class="kz-donor-avatar" style="width:72px;height:72px;font-size:24px;">${avatarChar ? portraitInner(avatarChar) : avatarFotoOr(prof, donorAvatarInner(name))}</span>
        <span class="kz-donor-number">${kzt('doar.numero', { n: d.number })}</span>
        ${prof && prof.servidor ? `<div class="kz-donate-note">${escapeHtml(prof.servidor)}</div>` : ''}
        ${patenteBadgeHtml(d, '', prof)}
        <div class="kz-donate-note" style="max-width:320px;">${escapeHtml(p.desc)}</div>
        ${isDonorAdmin() ? donorPatenteSelectHtml(d) : ''}
        ${quote ? `<div class="kz-profile-quote">"${escapeHtml(quote)}"</div>` : ''}
        ${(d.honras||[]).length ? `<div class="kz-pill-row" style="justify-content:center;">${d.honras.map(honraBadgeHtml).join('')}</div>` : ''}
        ${d.discord ? `<div class="kz-donate-note">Discord: ${escapeHtml(d.discord)}</div>` : ''}
        ${socials.length ? `<div class="kz-donate-note">${socials.map(escapeHtml).join(' · ')}</div>` : ''}
        ${d.link ? (safeHttpUrl(d.link) ? `<a class="kz-donate-note" href="${escapeAttr(safeHttpUrl(d.link))}" target="_blank" rel="noopener noreferrer" style="color:var(--gold-light);">${escapeHtml(d.link)}</a>` : `<div class="kz-donate-note">${escapeHtml(d.link)}</div>`) : ''}
        ${!d.active ? `<div class="kz-locked-tag" style="align-self:center;">Histórico preservado</div>` : ''}
      </div>
      ${isDonorAdmin() ? `<div class="modal-footer"><button class="btn btn-ghost btn-danger btn-sm" id="removeDonorProfileBtn">Remover da Aliança Z</button></div>` : ''}
    </div>
  </div>`;
}

function renderDonorProfileModal(){
  const d = state.donors.find(x=>x.id===state.donorProfileId);
  const root = document.getElementById('modalRoot');
  if(!d){ state.donorProfileId = null; closeModalDOM(); return; }
  if(!root) return;
  root.innerHTML = donorProfileModalHtml(d);
  document.getElementById('closeDonorProfileBtn').addEventListener('click', closeDonorProfile);
  document.getElementById('donorProfileOverlay').addEventListener('click', e=>{ if(e.target.id==='donorProfileOverlay') closeDonorProfile(); });
  const patSel = document.getElementById('donorPatenteSelect');
  if(patSel) patSel.addEventListener('change', ()=> setDonorPatente(d.id, patSel.value));
  const rm = document.getElementById('removeDonorProfileBtn');
  if(rm) rm.addEventListener('click', ()=>{
    customConfirm(`Remover "${d.name}" da Aliança Z?`, ()=>{
      removeDonor(d.id);
      closeDonorProfile();
    });
  });
}
function openDonorProfile(id){ state.donorProfileId = id; render(); }
function closeDonorProfile(){ state.donorProfileId = null; render(); }

function removeDonor(id){
  state.donors = state.donors.filter(x=>x.id!==id);
  saveDonors();
  syncDonorRemote(id, 'delete');
  render();
}

function attachDoarHandlers(){
  const view = document.getElementById('view');
  if(!view || (state.tab !== 'doar' && state.tab !== 'admin')) return;   // o painel do mural mora na aba Admin
  attachMpDoacaoHandlers(view);
  const rankBtn = document.getElementById('rankingToggle');
  if(rankBtn) rankBtn.addEventListener('click', ()=>{ state.rankingAberto = !state.rankingAberto; render(); });
  const addBtn = document.getElementById('addDonorBtn');
  if(addBtn) addBtn.addEventListener('click', ()=>{
    const name = document.getElementById('donorNameInput').value.trim();
    const amount = parseFloat((document.getElementById('donorAmountInput').value||'0').replace(',', '.')) || 0;
    const quote = document.getElementById('donorQuoteInput').value.trim();
    const discord = document.getElementById('donorDiscordInput').value.trim();
    const link = document.getElementById('donorLinkInput').value.trim();
    const linkedUserId = document.getElementById('donorLinkedUidInput').value.trim() || null;
    const honras = [...view.querySelectorAll('[data-honor-key]:checked')].map(c=>c.dataset.honorKey);
    if(!name){ showToast('Digite o nome do apoiador.'); return; }
    if(amount <= 0 && !honras.length){ showToast('Digite um valor ou marque pelo menos uma Honra.'); return; }
    const entry = { id: newDonorId(), number: state.nextDonorNumber, name, amount, quote, discord, link, honras, active: true, linkedUserId };
    state.donors.push(entry);
    state.nextDonorNumber++;
    saveDonors();
    saveNextDonorNumber();
    syncDonorRemote(entry, 'upsert');
    render();
    showToast('Apoiador adicionado à Aliança Z');
  });
  view.querySelectorAll('[data-open-donor]').forEach(b=>{
    b.addEventListener('click', ()=> openDonorProfile(b.dataset.openDonor));
  });
}

/* ======================= ADMIN (só o dono) ======================= */
// Doações do Mercado Pago (lista, filtros, totais) e o painel do mural. Os dados vêm da função admin_listar_doacoes do
// Supabase, que só responde para a conta do dono (sem e-mail de ninguém); esconder a aba aqui é só conveniência.
// Devoluções e estornos feitos no Mercado Pago chegam pelo webhook e descontam o apoio do mural sozinhos.
const ADM_STATUS = {
  aprovado:['Aprovado','ok'], criado:['Aguardando','wait'], pending:['Pendente','wait'], in_process:['Em análise','wait'],
  rejected:['Recusado','err'], cancelled:['Cancelado','err'], devolvido:['Devolvido','info'], estornado:['Estornado','err'], erro:['Falhou','err'],
};
const ADM_FILTROS = [['pagas','Pagas'],['devolvidas','Devolvidas'],['aguardando','Aguardando'],['recusadas','Recusadas'],['todas','Todas']];
const ADM_GRUPOS = {
  pagas:['aprovado','devolvido','estornado'], devolvidas:['devolvido','estornado'],
  aguardando:['criado','pending','in_process'], recusadas:['rejected','cancelled','erro'],
};
function admStatusInfo(s){ return ADM_STATUS[s] || [String(s || '—'), 'wait']; }
function admFiltrar(lista, filtro, busca){
  const q = String(busca || '').trim().toLowerCase();
  return (lista || []).filter(d=>{
    if(filtro !== 'todas' && !(ADM_GRUPOS[filtro] || []).includes(d.status)) return false;
    return !q || String(d.nome || (d.anonimo ? 'anônimo' : '')).toLowerCase().includes(q);
  });
}
function admResumo(lista){
  let recebido = 0, devolvido = 0, pagas = 0, aguardando = 0;
  (lista || []).forEach(d=>{
    const v = Number(d.valor) || 0, dev = Number(d.devolvido) || 0;
    if(d.status === 'aprovado'){ recebido += v - dev; devolvido += dev; pagas++; }
    else if(d.status === 'devolvido' || d.status === 'estornado'){ devolvido += dev; pagas++; }
    else if(ADM_GRUPOS.aguardando.includes(d.status)) aguardando++;
  });
  return { recebido, devolvido, pagas, aguardando };
}
// Pedidos que nunca foram pagos (link aberto e abandonado, recusado, falhou) com mais de 1 dia: o botão "Limpar" apaga estes.
const ADM_NAO_PAGOS = ['criado','pending','in_process','rejected','cancelled','erro'];
// Pedidos abertos há mais de 10 minutos (até 7 dias) sem confirmação: o aviso do Mercado Pago pode não ter chegado.
const ADM_ABERTOS = ['criado','pending','in_process'];
function admAbertos(lista, agora){
  const t = agora || Date.now();
  return (lista || []).filter(d=> !d.aprovado_em && ADM_ABERTOS.includes(d.status)
    && t - new Date(d.criado).getTime() > 10 * 60 * 1000 && t - new Date(d.criado).getTime() < 7 * 24 * 3600 * 1000).length;
}
function admAvisoAbertosHtml(lista){
  const n = admAbertos(lista);
  if(!n) return '';
  const r = state.admin.reconResp ? `<span class="kz-nva-reconresp">${escapeHtml(state.admin.reconResp)}</span>` : '';
  return `<div class="kz-nva-aviso kz-nva-aviso-warn" role="alert">⚠ <b>${n} pedido${n === 1 ? '' : 's'}</b> aberto${n === 1 ? '' : 's'} há mais de 10 minutos sem confirmação. Pode ser gente que desistiu de pagar ou um aviso do Mercado Pago que não chegou.
    <button type="button" class="kz-btn kz-btn-sm" id="admReconBtn">Conferir agora</button> ${r}</div>`;
}
async function reconciliarPagamentos(){
  const { data, error } = await window.__sb.client.functions.invoke('mp-reconciliar', { body: {} });
  if(error){
    let msg = '';
    try{ msg = (await error.context.json()).erro || ''; }catch(e){}
    throw new Error(msg || 'Não consegui conferir agora.');
  }
  return data || {};
}
function admReconTexto(r){
  if(!r.conferidos) return 'Nada para conferir.';
  const partes = [`${r.conferidos} conferido${r.conferidos === 1 ? '' : 's'}`];
  if(r.lancados) partes.push(`${r.lancados} lançado${r.lancados === 1 ? '' : 's'} no mural`);
  if(r.atualizados) partes.push(`${r.atualizados} com status atualizado`);
  if(r.sem_pagamento) partes.push(`${r.sem_pagamento} sem pagamento no Mercado Pago (desistiram)`);
  if(r.falhas) partes.push(`${r.falhas} com falha`);
  return partes.join(' · ') + '.';
}
async function rodarReconciliacao(){
  const a = state.admin;
  if(a.reconRodando) return;
  a.reconRodando = true; a.reconResp = 'Conferindo com o Mercado Pago…'; refreshAdminDoacoes();
  try{
    const r = await reconciliarPagamentos();
    a.reconResp = admReconTexto(r);
    if(r.lancados || r.atualizados){ await refreshDonorsRemote(); }
    a.reconRodando = false;
    await loadAdminDoacoes();
  }catch(e){
    a.reconRodando = false; a.reconResp = e.message || 'Não consegui conferir agora.'; refreshAdminDoacoes();
  }
}
function admLimpaveis(lista, agora){
  const corte = (agora || Date.now()) - 24 * 3600 * 1000;
  return (lista || []).filter(d=> !d.aprovado_em && ADM_NAO_PAGOS.includes(d.status) && new Date(d.criado).getTime() < corte).length;
}
function admDataHtml(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function admLinhaHtml(d){
  const [rot, cls] = admStatusInfo(d.status);
  const quem = d.anonimo ? '<i class="mut">anônimo</i>' : d.nome ? escapeHtml(d.nome) : '<i class="mut">sem nome</i>';
  const dev = Number(d.devolvido) || 0;
  return `<tr>
      <td data-l="Data">${admDataHtml(d.aprovado_em || d.criado)}</td>
      <td data-l="Quem">${quem}${d.user_id ? ' <span class="kz-nva-tag">Discord</span>' : ''}</td>
      <td data-l="Valor" class="num">${formatBRL(d.valor)}${dev > 0 ? `<small>devolvido ${formatBRL(dev)}</small>` : ''}</td>
      <td data-l="Status"><span class="kz-nva-st ${cls}">${escapeHtml(rot)}</span></td>
    </tr>`;
}
function admDoacoesHtml(){
  const a = state.admin;
  if(a.erro) return `<div class="kz-nva-aviso err">${escapeHtml(a.erro)} <button type="button" class="kz-link-btn" id="admRecarregar">Tentar de novo</button></div>`;
  if(a.carregando || !a.lista) return `<div class="kz-nva-aviso">Carregando as doações…</div>`;
  const res = admResumo(a.lista), vis = admFiltrar(a.lista, a.filtro, a.busca), limpaveis = admLimpaveis(a.lista);
  return `
    ${admAvisoAbertosHtml(a.lista)}
    <div class="kz-nva-cards">
      <div class="kz-nva-card"><span>Recebido</span><b>${formatBRL(res.recebido)}</b><small>valor bruto, sem a tarifa do Mercado Pago</small></div>
      <div class="kz-nva-card"><span>Pagamentos</span><b>${res.pagas}</b><small>aprovados, devolvidos e estornados</small></div>
      <div class="kz-nva-card"><span>Devolvido</span><b>${formatBRL(res.devolvido)}</b><small>já descontado do mural</small></div>
      <div class="kz-nva-card"><span>Aguardando</span><b>${res.aguardando}</b><small>abriram o link e não pagaram</small></div>
    </div>
    <div class="kz-nva-bar">
      <div class="kz-nva-filtros">${ADM_FILTROS.map(([k, l])=>`<button type="button" class="kz-fchip${a.filtro === k ? ' active' : ''}" data-adm-filtro="${k}" aria-pressed="${a.filtro === k}">${l}</button>`).join('')}</div>
      <input type="search" class="kz-input" id="admBusca" placeholder="Buscar por nome…" value="${escapeAttr(a.busca)}" autocomplete="off">
      <button type="button" class="kz-btn kz-btn-sm" id="admRecarregar">↻ Atualizar</button>
      <button type="button" class="kz-btn kz-btn-sm" id="admLimpar"${limpaveis ? '' : ' disabled'} title="Apaga os pedidos que nunca foram pagos e têm mais de 1 dia. Pagamentos aprovados, devolvidos e estornados nunca são apagados.">🧹 Limpar não pagos (${limpaveis})</button>
    </div>
    ${vis.length ? `<div class="kz-nva-tabela"><table><thead><tr><th>Data</th><th>Quem</th><th class="num">Valor</th><th>Status</th></tr></thead><tbody>${vis.map(admLinhaHtml).join('')}</tbody></table></div>`
                 : `<div class="kz-nva-aviso">Nenhuma doação neste filtro.</div>`}
    <p class="kz-nva-nota">Devoluções e estornos feitos no painel do Mercado Pago chegam por aviso automático e já descontam o apoio do mural. Mostra as ${a.lista.length} doações mais recentes. Pedidos que ninguém pagou são apagados sozinhos depois de 30 dias.</p>`;
}
/* ---------- IA do montador no Admin (só o dono): uso do dia e aviso quando o limite gratuito acaba ---------- */
// O aviso vem da função ia-montador (tabela ia_avisos). O dono vê a bolinha no menu Admin, um aviso na tela e um toast uma vez por visita.
const IA_MOTIVO_DIARIO = 'limite_gemini_diario';
function iaAvisoHoje(ia){ return !!(ia && (ia.avisos || []).find(a => a.dia === ia.hoje && a.motivo === IA_MOTIVO_DIARIO)); }
async function carregarIaAdmin(){
  const a = state.admin;
  if(!isSupabaseConfigured() || !window.__sb || !window.__sb.client || !state.discordUser) return null;
  try{
    const { data, error } = await window.__sb.client.rpc('admin_ia_status');
    if(error) throw error;
    a.ia = data || null; a.iaErro = '';
  }catch(e){
    console.error('Não consegui carregar o uso da IA', e);
    a.iaErro = 'Não consegui carregar o uso da IA agora.';
  }
  a.iaAlerta = iaAvisoHoje(a.ia);
  return a.ia;
}
async function verificarAvisoIa(){
  const a = state.admin;
  if(a.iaVerificado) return;
  a.iaVerificado = true;
  await carregarIaAdmin();
  const nav = document.getElementById('navAdminBtn');
  if(nav) nav.classList.toggle('kz-alerta', !!a.iaAlerta);
  if(a.iaAlerta) showToast('⚠ A IA do montador atingiu o limite gratuito de hoje. Veja na aba Admin.');
  refreshAdminIa();
}
function admIaHtml(){
  const a = state.admin, ia = a.ia;
  if(a.iaErro) return `<div class="kz-nva-aviso err">${escapeHtml(a.iaErro)} <button type="button" class="kz-link-btn" id="admIaRecarregar">Tentar de novo</button></div>`;
  if(!ia) return `<div class="kz-nva-aviso">Carregando o uso da IA…</div>`;
  const hoje = (ia.dias || []).find(d => d.dia === ia.hoje), chamadas = hoje ? Number(hoje.qtd) || 0 : 0;
  const aviso = (ia.avisos || []).find(x => x.dia === ia.hoje && x.motivo === IA_MOTIVO_DIARIO);
  const alerta = aviso
    ? `<div class="kz-nva-aviso kz-nva-aviso-warn" role="alert">⚠ <b>O limite gratuito da IA acabou hoje</b> (aviso às ${admDataHtml(aviso.criado_em).split(' ').slice(-1)[0] || ''}). Novos pedidos usam a leitura simples até amanhã. Veja o uso no Google AI Studio e decida se vale pagar. Nada foi cobrado.</div>`
    : '';
  const ultimo = !aviso && (ia.avisos || []).find(x => x.motivo === IA_MOTIVO_DIARIO);
  const nota = ultimo ? `<p class="kz-nva-nota">Último aviso de limite: ${escapeHtml(String(ultimo.dia).split('-').reverse().join('/'))}.</p>` : '';
  const dias = (ia.dias || []).map(d => `<span class="kz-nva-ap"><b>${escapeHtml(String(d.dia).split('-').reverse().slice(0, 2).join('/'))}</b><span>${Number(d.qtd) || 0} chamadas</span></span>`).join('');
  return `${alerta}
    <div class="kz-nva-cards">
      <div class="kz-nva-card"><span>Hoje</span><b>${chamadas}</b><small>chamadas à IA (cada pedido usa 2)</small></div>
      <div class="kz-nva-card"><span>Visitantes hoje</span><b>${Number(ia.visitantes_hoje) || 0}</b><small>pessoas que usaram a IA</small></div>
      <div class="kz-nva-card"><span>Limite gratuito</span><b>${aviso ? 'Atingido' : 'Ok'}</b><small>${aviso ? 'a IA volta amanhã' : 'sem aviso hoje'}</small></div>
    </div>
    ${dias ? `<div class="kz-nva-mural">${dias}</div>` : ''}
    ${nota}
    <p class="kz-nva-nota">Quando o plano gratuito do Gemini acaba (ou o limite diário definido na função), a IA para sozinha até o dia seguinte e o site usa a leitura simples. A chave é de um projeto sem cobrança, então nada é cobrado.</p>`;
}
function refreshAdminIa(){
  const box = document.getElementById('admIa');
  if(!box || state.tab !== 'admin') return;
  box.innerHTML = admIaHtml();
  const b = box.querySelector('#admIaRecarregar');
  if(b) b.addEventListener('click', async ()=>{ state.admin.iaErro = ''; state.admin.ia = null; refreshAdminIa(); await carregarIaAdmin(); refreshAdminIa(); const nav = document.getElementById('navAdminBtn'); if(nav) nav.classList.toggle('kz-alerta', !!state.admin.iaAlerta); });
}
function renderAdminTab(){
  if(!isDonorAdmin()) return `<section class="kz-page"><div class="kz-empty">Esta área é só para o dono do site.</div></section>`;
  const cab = visualNovo()
    ? nvPageHeadHtml({ key:'admin', kanji:'王', tag:'Só para o dono', title:'Admin', kanjiStyle:'right:8%;top:-60px;font-size:380px',
        sub:'Doações do Mercado Pago, devoluções e o mural da Aliança Z.' })
    : `<div><h1 class="kz-title">Admin</h1><div class="kz-subtitle">Doações do Mercado Pago, devoluções e o mural da Aliança Z.</div></div>`;
  const donors = sortedDonors(true), noMural = donors.filter(d=> d.active !== false && !isZenoh(d)).length;
  return `
  <section class="kz-page kz-nvp kz-nva">
    ${cab}
    <div class="kz-nva-sec">
      <h2 class="kz-nva-h2">Doações</h2>
      <div id="admDoacoes">${admDoacoesHtml()}</div>
      <form class="kz-nva-conferir" id="admConferirForm" autocomplete="off">
        <label for="admConferirNum">Conferir pagamento</label>
        <input type="text" id="admConferirNum" class="kz-input" inputmode="numeric" placeholder="Número da operação no Mercado Pago" maxlength="24">
        <button type="submit" class="kz-btn kz-btn-sm" id="admConferirBtn">Conferir e lançar</button>
        <p class="kz-nva-nota">Use se um pagamento aprovado não apareceu no mural: o site consulta o Mercado Pago e lança o apoio (uma vez só, mesmo se você repetir). O número da operação está em Seu negócio → Atividades.</p>
        <div class="kz-nva-resp" id="admConferirResp" role="status" aria-live="polite"></div>
      </form>
    </div>
    <div class="kz-nva-sec">
      <h2 class="kz-nva-h2">IA do montador</h2>
      <div id="admIa">${admIaHtml()}</div>
    </div>
    <div class="kz-nva-sec">
      <h2 class="kz-nva-h2">Mural e apoiadores <small>${noMural} no mural</small></h2>
      <div class="kz-nva-aviso kz-nva-dica">Aqui você adiciona apoios recebidos por fora (Pix direto, por exemplo), concede Honras e ajusta quem já está. Clique num nome para abrir o perfil e editar ou remover.</div>
      ${donors.length ? `<div class="kz-nva-mural">${donors.map(d=>{
        const prof = linkedProfileFor(d), look = patenteLook(d, prof);
        return `<button type="button" class="kz-nva-ap" data-open-donor="${escapeAttr(d.id)}"><b>${escapeHtml((prof && prof.nickname) || d.name)}</b><span>${formatBRL(d.amount)} · ${escapeHtml(look.p.label)}${d.active === false ? ' · fora do mural' : ''}</span></button>`;
      }).join('')}</div>` : ''}
      ${renderDonorAdminHtml()}
    </div>
  </section>`;
}
async function loadAdminDoacoes(){
  const a = state.admin;
  if(a.carregando) return;
  if(!isSupabaseConfigured() || !window.__sb || !window.__sb.client || !state.discordUser){
    a.erro = 'Entre com o Discord da conta do dono para ver as doações.'; a.lista = null; return refreshAdminDoacoes();
  }
  a.carregando = true; a.erro = ''; refreshAdminDoacoes();
  try{
    const { data, error } = await window.__sb.client.rpc('admin_listar_doacoes', { p_limite: 500 });
    if(error) throw error;
    a.lista = Array.isArray(data) ? data : [];
    // há pedidos abertos? confere sozinho uma vez por visita à aba, sem precisar clicar
    if(!a.autoConferido && admAbertos(a.lista)){ a.autoConferido = true; setTimeout(rodarReconciliacao, 50); }
  }catch(e){
    console.error('Não consegui carregar as doações', e);
    a.lista = null; a.erro = e && e.code === '42501' ? 'Esta conta não é a do dono do site.' : 'Não consegui carregar as doações agora.';
  }
  a.carregando = false;
  refreshAdminDoacoes();
}
function refreshAdminDoacoes(){
  const box = document.getElementById('admDoacoes');
  if(!box || state.tab !== 'admin') return;
  box.innerHTML = admDoacoesHtml();
  attachAdminDoacoesHandlers(box);
}
function attachAdminDoacoesHandlers(root){
  const a = state.admin;
  const recon = root.querySelector('#admReconBtn');
  if(recon) recon.addEventListener('click', rodarReconciliacao);
  root.querySelectorAll('[data-adm-filtro]').forEach(b=> b.addEventListener('click', ()=>{ a.filtro = b.dataset.admFiltro; refreshAdminDoacoes(); }));
  const busca = root.querySelector('#admBusca');
  if(busca) busca.addEventListener('input', ()=>{
    a.busca = busca.value;
    const pos = busca.selectionStart;
    refreshAdminDoacoes();
    const nova = document.getElementById('admBusca');
    if(nova){ nova.focus(); try{ nova.setSelectionRange(pos, pos); }catch(e){} }
  });
  root.querySelectorAll('#admRecarregar').forEach(b=> b.addEventListener('click', ()=>{ a.erro = ''; loadAdminDoacoes(); }));
  const limpar = root.querySelector('#admLimpar');
  if(limpar) limpar.addEventListener('click', ()=>{
    const n = admLimpaveis(a.lista);
    if(!n) return;
    customConfirm(`Apagar ${n} pedido${n === 1 ? '' : 's'} que nunca ${n === 1 ? 'foi pago' : 'foram pagos'} (mais de 1 dia)? Pagamentos aprovados, devolvidos e estornados não são apagados. Não dá pra desfazer.`, async ()=>{
      try{
        const { data, error } = await window.__sb.client.rpc('admin_limpar_aguardando', { p_dias: 1 });
        if(error) throw error;
        showToast(`${Number(data) || 0} pedido(s) apagado(s)`);
      }catch(e){
        console.error('Não consegui limpar os pedidos', e);
        showToast('Não consegui limpar agora. Tente de novo.');
      }
      loadAdminDoacoes();
    });
  });
}
const ADM_RESULTADOS = { novo:'entrou no mural', somado:'somado ao apoio da conta no mural', anonimo:'doação anônima: registrada, fora do mural', sem_nome:'sem nome e sem login: registrada, fora do mural', ja_registrado_ou_inexistente:'já estava registrado, nada mudou', status_atualizado:'status atualizado' };
async function conferirPagamento(numero){
  const { data, error } = await window.__sb.client.functions.invoke('mp-conferir', { body: { pagamento: numero } });
  if(error){
    let msg = '';
    try{ msg = (await error.context.json()).erro || ''; }catch(e){}
    throw new Error(msg || 'Não consegui conferir agora. Tente de novo.');
  }
  return data || {};
}
function attachAdminConferir(view){
  const form = view.querySelector('#admConferirForm');
  if(!form) return;
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const inp = form.querySelector('#admConferirNum'), btn = form.querySelector('#admConferirBtn'), resp = form.querySelector('#admConferirResp');
    const numero = String(inp.value || '').replace(/\D/g, '');
    resp.className = 'kz-nva-resp';
    if(numero.length < 6){ resp.textContent = 'Digite o número da operação (só números).'; resp.classList.add('err'); return; }
    btn.disabled = true; resp.textContent = 'Consultando o Mercado Pago…';
    try{
      const r = await conferirPagamento(numero);
      const st = admStatusInfo(r.status === 'approved' ? 'aprovado' : r.status === 'refunded' ? 'devolvido' : r.status === 'charged_back' ? 'estornado' : r.status)[0];
      resp.textContent = `Pagamento ${st.toLowerCase()} de ${formatBRL(r.valor)}${r.nome ? ' (' + r.nome + ')' : ''}: ${ADM_RESULTADOS[String(r.resultado).split(' ')[0]] || r.resultado}.`;
      resp.classList.add('ok');
      inp.value = '';
      state.admin.lista = null; state.admin.erro = '';
      await refreshDonorsRemote();
      loadAdminDoacoes();
    }catch(err){
      resp.textContent = err.message; resp.classList.add('err');
    }
    btn.disabled = false;
  });
}
function attachAdminHandlers(){
  const view = document.getElementById('view');
  if(!view || state.tab !== 'admin' || !isDonorAdmin()) return;
  attachAdminConferir(view);
  attachAdminDoacoesHandlers(view);
  refreshAdminIa();
  if(!state.admin.ia && !state.admin.iaErro && state.admin.iaVerificado) carregarIaAdmin().then(refreshAdminIa);
  if(!state.admin.lista && !state.admin.carregando && !state.admin.erro) loadAdminDoacoes();
}

/* ======================= RENDER: MODAL (add/edit char) ======================= */
function abilityEditorHTML(key, label, iconClass, ability, withTriggers, iconText){
  const effField = withTriggers ? 'triggers' : 'effects';
  const effLabel = withTriggers ? 'Ativa com (gatilho)' : 'Efeitos causados';
  return `
  <div class="ability-editor" data-ability="${key}">
    <div class="ae-title"><span class="ability-icon ${iconClass}">${iconText || label[0]}</span>${label}</div>
    <div class="grid-2">
      <div>
        <label class="field-label">Nome da habilidade</label>
        <input type="text" data-field="name" value="${escapeAttr(ability.name)}" placeholder="Ex: Kamehameha">
      </div>
      <div></div>
    </div>
    <div style="margin-top:10px;">
      <label class="field-label">Descrição</label>
      <textarea data-field="desc" placeholder="Descreva o efeito e a mecânica da habilidade…">${escapeHtml(ability.desc)}</textarea>
    </div>
    <div style="margin-top:10px;">
      <label class="field-label">${effLabel}</label>
      <div class="effect-toggle-row" data-toggle-group="${effField}">
        ${EFFECTS.map(ef=>`<span class="effect-toggle ${ability[effField] && ability[effField].includes(ef)?'active':''}" data-eff="${ef}">${effectBadge(ef)} ${EFFECT_LABELS[ef]}</span>`).join('')}
      </div>
    </div>
    ${withTriggers ? `
    <div style="margin-top:10px;">
      <label class="field-label">Efeitos que este combinado também causa (para encadear outro combo)</label>
      <div class="effect-toggle-row" data-toggle-group="effects">
        ${EFFECTS.map(ef=>`<span class="effect-toggle ${ability.effects && ability.effects.includes(ef)?'active':''}" data-eff="${ef}">${effectBadge(ef)} ${EFFECT_LABELS[ef]}</span>`).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

// Tira o personagem de todo lugar que guarda o id dele (equipe, favoritos, coleção, tier list).
function deleteCharacter(id){
  if(!isHeroAdmin()) return;
  state.characters = state.characters.filter(c=>c.id!==id);
  state.team = state.team.map(t=> t===id ? null : t);
  state.favs = state.favs.filter(x=>x!==id);
  if(state.collection[id]){ delete state.collection[id]; saveCollection(); }
  if(state.viewingCharId === id) state.viewingCharId = null;
  if(state.heroCharId === id) state.heroCharId = null;
  ensureTierListIntegrity();
  saveCharacters(); saveTeamState(); saveFavs(); saveTierList();
}

function renderModal(){
  const c = state.editingChar;
  const isNew = state.editingIsNew;
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
  <div class="modal-overlay" id="modalOverlay">
    <div class="modal">
      <div class="modal-header">
        <h2>${isNew ? 'Novo personagem' : 'Editar personagem'}</h2>
        <button class="kz-close-btn" id="closeModalBtn" aria-label="${kzt('comum.fechar')}">✕</button>
      </div>
      <div class="modal-body">
        <div class="grid-2">
          <div>
            <label class="field-label">Nome</label>
            <input type="text" id="f_name" value="${escapeAttr(kzNome(c.name))}" placeholder="Ex: Son Goku">
          </div>
          <div>
            <label class="field-label">Gênero</label>
            <select id="f_gender">${GENDERS.map(g=>`<option value="${g}" ${c.gender===g?'selected':''}>${g}</option>`).join('')}</select>
          </div>
        </div>
        <div class="grid-2">
          <div>
            <label class="field-label">Raça</label>
            <select id="f_element">${ELEMENTS.map(el=>`<option value="${el}" ${c.element===el?'selected':''}>${el}</option>`).join('')}</select>
          </div>
          <div>
            <label class="field-label">Tags (separadas por vírgula)</label>
            <input type="text" id="f_tags" value="${escapeAttr(c.tags.join(', '))}" placeholder="Ex: saiyajin, deus, suporte">
          </div>
        </div>

        ${abilityEditorHTML('skill','Habilidade','ic-skill', c.skill, false, 'H')}
        ${abilityEditorHTML('supreme','Suprema','ic-supreme', c.supreme, false, 'S')}
        ${abilityEditorHTML('combo','Ataque Combinado','ic-combo', c.combo, true, 'C')}
      </div>
      <div class="modal-footer">
        ${!isNew ? `<button class="btn btn-ghost" id="dupCharBtn">Duplicar</button><button class="btn btn-ghost btn-danger" id="delCharBtn">Excluir</button><span class="spacer"></span>` : ''}
        <button class="btn btn-ghost" id="cancelModalBtn">Cancelar</button>
        <button class="btn btn-primary" id="saveCharBtn">Salvar personagem</button>
      </div>
    </div>
  </div>`;

  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e=>{ if(e.target.id==='modalOverlay') closeModal(); });

  document.querySelectorAll('.effect-toggle').forEach(t=>{
    t.addEventListener('click', ()=>{
      const group = t.closest('[data-toggle-group]');
      const abilityKey = t.closest('.ability-editor').dataset.ability;
      const field = group.dataset.toggleGroup;
      const eff = t.dataset.eff;
      const ability = state.editingChar[abilityKey];
      if(!ability[field]) ability[field] = [];
      const idx = ability[field].indexOf(eff);
      if(idx>-1) ability[field].splice(idx,1); else ability[field].push(eff);
      renderModal();
    });
  });

  const dupBtn = document.getElementById('dupCharBtn');
  if(dupBtn) dupBtn.addEventListener('click', ()=>{
    const orig = getChar(state.editingChar.id);
    if(!orig) return;
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = uid(); copy.name = copy.name + ' (cópia)';
    state.characters.push(copy);
    ensureTierListIntegrity();
    saveCharacters(); saveTierList();
    state.editingChar = null;
    render();
    showToast('Personagem duplicado');
  });
  const delBtn = document.getElementById('delCharBtn');
  if(delBtn) delBtn.addEventListener('click', ()=>{
    const id = state.editingChar.id;
    customConfirm('Excluir este personagem? Ele também sai da equipe, dos favoritos, da coleção e da tier list.', ()=>{
      deleteCharacter(id);
      state.editingChar = null;
      render();
      showToast('Personagem excluído');
    });
  });

  document.getElementById('saveCharBtn').addEventListener('click', ()=>{
    const c = state.editingChar;
    c.name = document.getElementById('f_name').value.trim();
    c.gender = document.getElementById('f_gender').value;
    c.element = document.getElementById('f_element').value;
    c.tags = document.getElementById('f_tags').value.split(',').map(s=>s.trim()).filter(Boolean);
    document.querySelectorAll('.ability-editor').forEach(ed=>{
      const key = ed.dataset.ability;
      c[key].name = ed.querySelector('[data-field=name]').value.trim();
      c[key].desc = ed.querySelector('[data-field=desc]').value.trim();
    });
    if(!c.name){ showToast('Dê um nome ao personagem antes de salvar.'); return; }
    if(!isHeroAdmin()){ state.editingChar = null; render(); return; }
    c._editado = true;

    const existingIdx = state.characters.findIndex(x=>x.id===c.id);
    if(existingIdx>-1) state.characters[existingIdx] = c; else state.characters.push(c);
    ensureTierListIntegrity();
    saveCharacters(); saveTierList();
    state.editingChar = null;
    render();
    showToast('Personagem salvo');
  });
}
function closeModal(){ state.editingChar = null; render(); }
function closeModalDOM(){ const root = document.getElementById('modalRoot'); if(root) root.innerHTML=''; }

/* ======================= ACESSIBILIDADE: FOCO EM MODAL ======================= */
// Prende o Tab dentro do modal e devolve o foco pro elemento de antes quando ele fecha.
let lastFocusedBeforeModal = null;
function trapFocus(containerEl){
  if(!containerEl) return;
  lastFocusedBeforeModal = document.activeElement;
  const sel = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
  const focusables = () => Array.from(containerEl.querySelectorAll(sel));
  const first = focusables()[0];
  (first || containerEl).focus();
  containerEl.addEventListener('keydown', e=>{
    if(e.key !== 'Tab') return;
    const items = focusables();
    if(!items.length) return;
    const f = items[0], l = items[items.length - 1];
    if(e.shiftKey && document.activeElement === f){ e.preventDefault(); l.focus(); }
    else if(!e.shiftKey && document.activeElement === l){ e.preventDefault(); f.focus(); }
  });
}
function restoreFocusAfterModal(){
  if(lastFocusedBeforeModal && document.body.contains(lastFocusedBeforeModal)) lastFocusedBeforeModal.focus();
  lastFocusedBeforeModal = null;
}
// Olha o DOM real de #modalRoot (cobre qualquer modal sem listar cada flag de estado).
let modalWasOpenLastRender = false;
function updateModalFocusTrap(){
  const modalEl = document.querySelector('#modalRoot .modal');
  if(modalEl && !modalWasOpenLastRender){
    trapFocus(modalEl);
    modalWasOpenLastRender = true;
  } else if(!modalEl && modalWasOpenLastRender){
    restoreFocusAfterModal();
    modalWasOpenLastRender = false;
  }
}

/* ======================= RENDER: MODAL (import/export JSON) ======================= */
function renderIOModal(){
  const root = document.getElementById('modalRoot');
  const example = JSON.stringify([{
    name:"Son Goku", element:"Saiyajin", gender:"Masculino", tags:["z fighter","principal"],
    skill:{name:"Teleporte Instantâneo", desc:"", effects:["elevacao_alta"]},
    supreme:{name:"Kamehameha 10x", desc:"", effects:["derrubada"]},
    combo:{name:"Combo Kaioken", desc:"", triggers:["derrubada"], effects:["elevacao_baixa"]}
  }], null, 2);

  root.innerHTML = `
  <div class="modal-overlay" id="ioOverlay">
    <div class="modal" style="max-width:620px;">
      <div class="modal-header">
        <h2>Importar / Exportar</h2>
        <button class="kz-close-btn" id="closeIOBtn" aria-label="${kzt('comum.fechar')}">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin:0;">
          Cole aqui uma lista de personagens em JSON (formato abaixo) e clique em Importar — é bem mais rápido
          que cadastrar um por um. Personagens com o mesmo nome são atualizados; os demais são criados.
          Também dá pra clicar em Exportar pra pegar um backup dos personagens atuais.
        </p>
        <textarea id="ioTextarea" style="min-height:260px;font-family:'JetBrains Mono',monospace;font-size:11.5px;" placeholder='${escapeAttr(example)}'></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="exportBtn">Exportar atual</button>
        <button class="btn btn-primary" id="importBtn">Importar (mesclar)</button>
      </div>
    </div>
  </div>`;

  document.getElementById('closeIOBtn').addEventListener('click', closeIOModal);
  document.getElementById('ioOverlay').addEventListener('click', e=>{ if(e.target.id==='ioOverlay') closeIOModal(); });

  document.getElementById('exportBtn').addEventListener('click', ()=>{
    document.getElementById('ioTextarea').value = JSON.stringify(state.characters, null, 2);
  });

  document.getElementById('importBtn').addEventListener('click', ()=>{
    if(!isHeroAdmin()) return;
    const raw = document.getElementById('ioTextarea').value.trim();
    if(!raw){ showToast('Cole um JSON antes de importar.'); return; }
    let parsed;
    try{ parsed = JSON.parse(raw); }catch(e){ showToast('JSON inválido — confira a formatação.'); return; }
    if(!Array.isArray(parsed)){ showToast('O JSON precisa ser uma lista (array) de personagens.'); return; }

    let added = 0, updated = 0;
    parsed.forEach(item=>{
      const base = blankChar();
      const merged = {
        ...base,
        ...item,
        id: item.id || base.id,
        tags: item.tags || [],
        skill: {...base.skill, ...(item.skill||{})},
        supreme: {...base.supreme, ...(item.supreme||{})},
        combo: {...base.combo, ...(item.combo||{})},
      };
      merged._editado = true;
      const existingIdx = state.characters.findIndex(c=>
        c.id===merged.id || (c.name && merged.name && c.name.toLowerCase()===merged.name.toLowerCase())
      );
      if(existingIdx>-1){
        merged.id = state.characters[existingIdx].id;
        state.characters[existingIdx] = merged;
        updated++;
      } else {
        state.characters.push(merged);
        added++;
      }
    });

    ensureTierListIntegrity();
    saveCharacters(); saveTierList();
    state.ioModalOpen = false;
    render();
    showToast(`Importado: ${added} novo(s), ${updated} atualizado(s)`);
  });
}
function closeIOModal(){ state.ioModalOpen = false; render(); }

/* ======================= RENDER: MODAL (escolher guerreiro, tela estreita) ======================= */
function pickerFilteredChars(q){
  q = (q||'').toLowerCase();
  return sortByRarity(state.characters.filter(c=>!q || c.name.toLowerCase().includes(q) || c.tags.some(t=>t.toLowerCase().includes(q))));
}
function renderPickerCards(q){
  const chars = pickerFilteredChars(q);
  if(!chars.length) return `<div class="kz-empty" style="padding:30px 12px;">${kzt('cb.nenhumEncontrado')}</div>`;
  return `<div class="picker-grid">${chars.map(c=>{
    const placedAt = state.team.indexOf(c.id);
    return `<div class="picker-card ${placedAt>-1?'placed':''}" data-id="${c.id}">
      <div class="sprite">${portraitInner(c)}</div>
      <div class="pc-name">${escapeHtml(kzNome(c.name))}</div>
      ${placedAt>-1 ? `<div class="pc-tag">${kzt('slot.casa', { n: placedAt+1 })}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}
function renderPickerModal(){
  const root = document.getElementById('modalRoot');
  const idx = state.pickerSlot;
  root.innerHTML = `
  <div class="modal-overlay" id="pickerOverlay">
    <div class="modal" style="max-width:640px;">
      <div class="modal-header">
        <h2>${kzt('slot.casa', { n: idx+1 })}</h2>
        <button class="kz-close-btn" id="closePickerBtn" aria-label="${kzt('comum.fechar')}">✕</button>
      </div>
      <div class="modal-body">
        <input type="text" id="pickerSearch" placeholder="${kzt('pick.buscar')}">
        <div id="pickerGrid">${renderPickerCards('')}</div>
      </div>
    </div>
  </div>`;

  const attachCardHandlers = ()=>{
    document.querySelectorAll('.picker-card').forEach(card=>{
      card.addEventListener('click', ()=>{
        state.pickerSlot = null;
        state.slotSel = idx;
        placeChar(card.dataset.id);
        showToast(kzt('cb.posicionado'));
      });
    });
  };
  attachCardHandlers();

  document.getElementById('closePickerBtn').addEventListener('click', closePickerModal);
  document.getElementById('pickerOverlay').addEventListener('click', e=>{ if(e.target.id==='pickerOverlay') closePickerModal(); });
  document.getElementById('pickerSearch').addEventListener('input', e=>{
    document.getElementById('pickerGrid').innerHTML = renderPickerCards(e.target.value);
    attachCardHandlers();
  });
}
function closePickerModal(){ state.pickerSlot = null; render(); }

// Popup com o Simulador de combo: assim dá pra ver as cadeias sem rolar a página.
function openSimModal(){ state.simModalOpen = true; render(); }
function closeSimModal(){ state.simModalOpen = false; render(); }
function renderSimModal(){
  const root = document.getElementById('modalRoot');
  if(!root) return;
  const n = state.team.filter(Boolean).length;
  root.innerHTML = `
  <div class="modal-overlay" id="simOverlay">
    <div class="modal kz-sim-modal" role="dialog" aria-label="${kzt('cb.simular')}">
      <div class="modal-header">
        <h2>${kzt('cb.simular')}</h2>
        <span class="kz-roster-hint">${kzt('cb.emCampoNovo', { n })}</span>
        <button class="kz-close-btn" id="closeSimBtn" aria-label="${kzt('comum.fechar')}">✕</button>
      </div>
      <div class="modal-body"><div class="kz-sim"><div id="simModalBody">${renderSimPanel(true)}</div></div></div>
    </div>
  </div>`;
  const wire = ()=>{
    root.querySelectorAll('[data-sim-char]').forEach(b=>b.addEventListener('click', ()=>{
      state.simCharId = b.dataset.simChar;
      const body = document.getElementById('simModalBody');
      if(body){ body.innerHTML = renderSimPanel(true); wire(); }
    }));
  };
  wire();
  document.getElementById('closeSimBtn').addEventListener('click', closeSimModal);
  document.getElementById('simOverlay').addEventListener('click', e=>{ if(e.target.id==='simOverlay') closeSimModal(); });
}

/* ======================= UTIL ======================= */
function escapeHtml(str){
  if(str==null) return '';
  return String(str).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(str){ return escapeHtml(str); }
// Só deixa passar endereço http(s). Sem esquema ("x.com/fulano") ganha https://. Qualquer outra coisa (javascript:, data:...) vira ''.
function safeHttpUrl(u){
  let s = String(u == null ? '' : u).trim();
  if(!s || /[\s<>"'`\\]/.test(s)) return '';            // espaço, aspas, < > ou barra invertida: não é endereço decente
  if(!/^[a-z][a-z0-9+.\-]*:/i.test(s)) s = 'https://' + s;
  return /^https?:\/\/[^\/?#]+/i.test(s) ? s : '';       // só http(s) e com host
}
function safeHttpsUrl(u){
  const s = safeHttpUrl(u);
  return s.startsWith('https://') ? s : '';
}

/* ======================= NAV LATERAL ======================= */
document.querySelectorAll('.kz-nav-btn[data-tab]').forEach(btn=>{
  btn.addEventListener('click', ()=> goTab(btn.dataset.tab));
});
document.querySelectorAll('.kz-nv-tb[data-tbtab]').forEach(btn=>{
  btn.addEventListener('click', ()=> goTab(btn.dataset.tbtab));
});
document.getElementById('tabbarMoreBtn').addEventListener('click', ()=>{
  state.navCompact = false;
  applyNavState();
});
document.getElementById('menuToggleBtn').addEventListener('click', ()=>{
  state.navCompact = !state.navCompact;
  applyNavState();
});
document.getElementById('navBackdrop').addEventListener('click', ()=>{
  state.navCompact = true;
  applyNavState();
});
document.getElementById('brandHome').addEventListener('click', ()=> goTab('chars'));
document.getElementById('headerDonateBtn').addEventListener('click', ()=> goTab('doar'));

// Arrasta a partir da borda esquerda da tela pra abrir a barra lateral (recolhida ela
// some por completo); arrasta pra esquerda com ela aberta pra fechar. Só no celular
// (a barra lateral no desktop empurra o conteúdo, não é um drawer por cima) e só rastreia
// gesto majoritariamente horizontal, pra não brigar com o scroll vertical da página.
let navTouchStartX = null, navTouchStartY = null, navTouchMode = null; // 'open' | 'close'
document.addEventListener('touchstart', e=>{
  if(!isNarrowLayout()) return;
  const t = e.touches[0];
  navTouchStartX = t.clientX;
  navTouchStartY = t.clientY;
  if(!state.navCompact) navTouchMode = 'close';
  else if(navTouchStartX <= 24) navTouchMode = 'open';
  else navTouchMode = null;
}, {passive:true});
document.addEventListener('touchmove', e=>{
  if(!navTouchMode || navTouchStartX===null) return;
  const t = e.touches[0];
  const dx = t.clientX - navTouchStartX, dy = t.clientY - navTouchStartY;
  if(Math.abs(dy) > Math.abs(dx)) return;
  if(navTouchMode === 'open' && dx > 60){ state.navCompact = false; applyNavState(); navTouchMode = null; }
  else if(navTouchMode === 'close' && dx < -60){ state.navCompact = true; applyNavState(); navTouchMode = null; }
}, {passive:true});
document.addEventListener('touchend', ()=>{
  navTouchStartX = null; navTouchStartY = null; navTouchMode = null;
});
if((window.innerWidth || 1200) < 900) state.navCompact = true;
applyNavState();

/* ======================= ACESSIBILIDADE: FECHAR COM ESC ======================= */
document.addEventListener('keydown', e=>{
  if((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey){
    const el = document.activeElement, tag = el && el.tagName;
    const typing = el && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable);
    const modalOpen = document.querySelector('#modalRoot .modal, body > .modal-overlay');
    if(!typing && !modalOpen && state.tab === 'chars' && state.viewingCharId){ e.preventDefault(); stepCharDetail(e.key === 'ArrowRight' ? 1 : -1); }
    return;
  }
  if(e.key !== 'Escape') return;
  // overlays de customConfirm/customPrompt ficam soltos direto em <body> — têm prioridade.
  const bodyOverlay = document.querySelector('body > .modal-overlay');
  if(bodyOverlay){ bodyOverlay.remove(); restoreFocusAfterModal(); return; }
  if(state.abilityPopupCharId !== null){ closeAbilityPopup(); return; }
  if(state.donorProfileId !== null){ closeDonorProfile(); return; }
  if(state.communityProfileUser){ closeCommunityProfile(); return; }
  if(state.tab === 'comunidade' && state.communityOpenPost){ state.communityOpenPost = null; render(); return; }
  if(state.simModalOpen){ closeSimModal(); return; }
  if(state.pickerSlot !== null){ closePickerModal(); return; }
  if(state.ioModalOpen){ closeIOModal(); return; }
  if(state.editingChar){ closeModal(); return; }
  if(state.slotSel !== null){ state.slotSel = null; render(); return; }
  if(!state.navCompact && isNarrowLayout()){ state.navCompact = true; applyNavState(); return; }
});

/* ======================= INIT ======================= */
loadState();


/* ---------- Modo offline: service worker (sw.js) guarda no aparelho o que não mudou ---------- */
function offlineSuportado(){ try{ return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof location !== 'undefined' && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'); }catch(e){ return false; } }
function registrarOffline(){
  if(!offlineSuportado()) return;
  const reg = () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('Modo offline indisponível', e));
  if(document.readyState === 'complete') reg(); else window.addEventListener('load', reg);
}
function swMensagem(tipo){
  return new Promise(resolve => {
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if(!sw){ resolve(null); return; }
    const ch = new MessageChannel();
    ch.port1.onmessage = e => resolve(e.data);
    sw.postMessage({ tipo }, [ch.port2]);
    setTimeout(() => resolve(null), 2500);
  });
}
async function abrirModoOffline(){
  if(!offlineSuportado()){ showToast(kzt('off.precisaHttps')); return; }
  const st = await swMensagem('status');
  if(!st){ showToast(kzt('off.naoAtivo')); return; }
  customConfirm(kzt('off.ativo', { casca: st.casca, midia: st.midia }), async () => {
    await swMensagem('limpar');
    showToast(kzt('off.cacheLimpo'));
  });
}
registrarOffline();
{ const ob = document.getElementById('offlineBtn'); if(ob) ob.addEventListener('click', abrirModoOffline); }

// Versão no rodapé (uma só fonte: SITE_VERSAO)
{ const vs = typeof document !== 'undefined' && document.querySelectorAll ? document.querySelectorAll('[data-versao]') : []; vs.forEach && vs.forEach(el => { el.textContent = SITE_VERSAO; }); }
