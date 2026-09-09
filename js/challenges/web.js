/* ═══════════════════════════════════════
   WEB CHALLENGE (CAMADA 7 — FASE 2: "ABRINDO UM SITE")
   Um navegador de mentira. O jogador digita um endereço e acompanha o
   carregamento: DNS → pedido HTTP (GET/POST) → código de resposta
   (200 / 404 / 401) → a página se montando (que na verdade são vários
   pedidos). Ensina: GET vs POST, HTTP vs HTTPS, ler os códigos, e que
   "uma página" = muitos pedidos.
   2 rodadas: abrir o site da escola · fazer login no portal.
═══════════════════════════════════════ */

const WebChallenge = (() => {

  const ROUNDS = [
    { id:'open', icon:'🏫', title:'Abrir o site da escola',
      desc:'Você digitou <b>www.husm.ufsm.br</b> e apertou Ir. Vamos ver o navegador trabalhar.',
      url:'www.husm.ufsm.br', https:true, ip:'200.18.42.10' },
    { id:'login', icon:'🔑', title:'Fazer login no portal',
      desc:'Você vai entrar no <b>portal do aluno</b> e digitar sua senha. Cuidado com cada passo.',
      url:'portal.ufsm.br/login', https:null, ip:'200.18.42.55' },
  ];

  let _c=null, roundIdx=0, busy=false, timers=[];
  let pendingChoice=null, awaitingNext=false;

  const after = (ms,fn)=>{ const t=setTimeout(fn,ms); timers.push(t); return t; };
  const emit  = (n,d)=>_c && _c.dispatchEvent(new CustomEvent(n,{detail:d}));
  const cur   = ()=>ROUNDS[roundIdx];
  const bubble= t=>emit('web-msg',t);
  const q     = s=>_c && _c.querySelector(s);

  function reset(){ _c=null; roundIdx=0; clearAll(); }
  function clearAll(){ timers.forEach(clearTimeout); timers=[]; busy=false; pendingChoice=null; awaitingNext=false; }

  // ── Render ───────────────────────────────────────────────
  function render(container){
    _c=container;
    clearAll();
    container.innerHTML=`
      <div class="web-wrap" id="web-wrap">
        <div class="web-top">
          <div class="web-round-badge">🌐 Site <strong id="web-num">1</strong> de <strong>${ROUNDS.length}</strong></div>
          <div class="web-scenario">
            <span class="web-sc-icon" id="web-sc-icon">🏫</span>
            <span class="web-sc-text"><strong class="web-sc-title" id="web-sc-title">—</strong><span id="web-sc-desc"></span></span>
          </div>
        </div>

        <div class="web-browser">
          <div class="web-bar">
            <span class="web-bar-lock" id="web-lock"></span>
            <span class="web-bar-url" id="web-url">—</span>
            <span class="web-bar-go">Ir</span>
          </div>
          <div class="web-steps" id="web-steps"></div>
          <div class="web-page" id="web-page"><span class="web-page-empty">a página vai aparecer aqui</span></div>
          <div class="web-status" id="web-status" hidden></div>
        </div>

        <div class="web-callout" id="web-callout" hidden></div>
        <div class="web-stage" id="web-stage"></div>
      </div>`;
    container.querySelector('#web-stage').addEventListener('click', onStageClick);
    renderRound();
  }

  function onStageClick(e){
    const b=e.target.closest('button');
    if(!_c || !b || busy) return;
    const a=b.dataset.act;
    if(a==='go')     onGo();
    else if(a==='next'){ roundIdx++; renderRound(); }
    else if(a==='choice') onChoice(b.dataset.key, b.dataset.opt, b.dataset.ok==='1');
  }

  function renderRound(){
    if(!_c) return;
    clearAll();
    const r=cur();
    q('#web-num').textContent      = roundIdx+1;
    q('#web-sc-icon').textContent  = r.icon;
    q('#web-sc-title').textContent = r.title;
    q('#web-sc-desc').innerHTML    = ' — ' + r.desc;
    q('#web-url').textContent      = r.url;
    setLock(r.id==='login' ? 'none' : 'ok');
    q('#web-steps').innerHTML='';
    q('#web-page').innerHTML='<span class="web-page-empty">a página vai aparecer aqui</span>';
    q('#web-status').hidden=true;
    q('#web-callout').hidden=true;
    stageGo();
  }

  // ── Peças da UI ──────────────────────────────────────────
  function setLock(mode){
    const el=q('#web-lock'); if(!el) return;
    el.className='web-bar-lock '+mode;
    el.textContent = mode==='ok' ? '🔒' : mode==='bad' ? '⚠️' : '';
  }
  function addStep(txt,kind){
    const s=q('#web-steps'); if(!s) return;
    const d=document.createElement('div');
    d.className='web-step '+(kind||'');
    d.innerHTML=txt;
    s.appendChild(d);
    if(d.animate) d.animate([{opacity:0,transform:'translateX(-6px)'},{opacity:1,transform:'none'}],{duration:220});
  }
  function showStatus(code,label,kind){
    const el=q('#web-status'); if(!el) return;
    el.hidden=false;
    el.className='web-status '+kind;
    el.innerHTML=`<span class="web-status-code">${code}</span><span class="web-status-lbl">${label}</span>`;
    if(el.animate) el.animate([{transform:'scale(.8)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:260,easing:'cubic-bezier(.34,1.56,.64,1)'});
  }
  function calloutShow(html){
    const el=q('#web-callout'); if(!el) return;
    el.hidden=false; el.innerHTML=html;
    if(el.animate) el.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:240});
  }
  function setPage(html){ const p=q('#web-page'); if(p) p.innerHTML=html; }

  const PAGE_SITE = `
    <div class="wp-header">🏫 Hospital Universitário de Santa Maria</div>
    <div class="wp-line"></div><div class="wp-line short"></div><div class="wp-line"></div>
    <div class="wp-img" id="wp-img"><span>carregando imagem…</span></div>
    <div class="wp-line short"></div>`;
  const PAGE_LOGIN = `
    <div class="wp-header">🔑 Portal do Aluno</div>
    <div class="wp-field">Usuário: <span class="wp-input">joao.silva</span></div>
    <div class="wp-field">Senha: <span class="wp-input">••••••••</span></div>
    <div class="wp-btn">Entrar</div>`;

  // ── Stage ────────────────────────────────────────────────
  function stageEl(){ return q('#web-stage'); }
  function stageGo(){
    const s=stageEl(); if(!s) return;
    s.innerHTML=`<button class="web-go-btn" data-act="go" type="button">▶ Ir para o site</button>`;
  }
  function stageNext(){
    const s=stageEl(); if(!s) return;
    awaitingNext=true;
    s.innerHTML=`<button class="web-go-btn go" data-act="next" type="button">Próximo site →</button>`;
  }
  function stageChoices(key,ttl,opts){
    const s=stageEl(); if(!s) return;
    pendingChoice=key;
    s.innerHTML=`
      <div class="web-choice-q">${ttl}</div>
      <div class="web-choices">
        ${opts.map(o=>`<button class="web-choice" data-act="choice" data-key="${key}" data-opt="${o.opt}" data-ok="${o.ok?1:0}" type="button">${o.text}</button>`).join('')}
      </div>`;
  }
  function stageWait(txt){ const s=stageEl(); if(s) s.innerHTML=`<div class="web-waiting">${txt}</div>`; }

  // ── Fluxo ────────────────────────────────────────────────
  function onGo(){
    if(busy) return;
    busy=true;
    const r=cur();
    stageWait('…');
    if(r.id==='open'){
      addStep(`🔍 DNS: <b>${r.url}</b> → ${r.ip}`,'ok');
      bubble('O navegador já perguntou pro DNS e achou o servidor. Agora precisa pedir a página.');
      after(800,()=>{
        busy=false;
        stageChoices('method',
          'O que o navegador manda pro servidor pra <b>ver</b> a página inicial?',
          [{opt:'get',   text:'GET /  —  "me manda a página"',           ok:true},
           {opt:'post',  text:'POST /  —  "estou te enviando dados"',     ok:false},
           {opt:'delete',text:'DELETE /  —  "apaga essa página"',         ok:false}]);
      });
    } else { // login
      bubble('Você vai digitar sua senha aqui. A primeira decisão é sobre o endereço.');
      after(400,()=>{
        busy=false;
        stageChoices('scheme',
          'Você vai digitar uma senha nessa página. Começar o endereço com:',
          [{opt:'https',text:'https://  🔒  (conexão criptografada)',        ok:true},
           {opt:'http', text:'http://  (conexão normal, sem cadeado)',       ok:false}]);
      });
    }
  }

  function onChoice(key,opt,ok){
    if(busy) return;
    if(!ok){ wrong(key,opt); return; }
    pendingChoice=null;
    busy=true;
    _c.querySelectorAll('.web-choice').forEach(b=>{ b.disabled=true; if(b.dataset.opt===opt) b.classList.add('picked'); });

    if(key==='method'){
      addStep('📨 <b>GET</b> / HTTP/1.1','send');
      bubble('Pedido enviado. Esperando o servidor responder…');
      after(900,()=>{
        addStep('📥 <b>200 OK</b> — aqui está a página','recv');
        showStatus('200','OK','ok');
        calloutShow('<b>200 OK</b> = deu tudo certo, o servidor está te mandando a página.');
        setPage(PAGE_SITE);
        after(1100,()=>{
          bubble('O HTML chegou — mas ele pede mais coisas: o CSS, o logo e uma foto. Cada um é um novo pedido.');
          addStep('📨 GET /estilo.css → <b>200</b>','send');
          after(500,()=>addStep('📨 GET /logo.png → <b>200</b>','send'));
          after(1100,()=>{
            addStep('📨 GET /banner.jpg → <b>404</b>','err');
            const img=q('#wp-img'); if(img){ img.classList.add('broken'); img.innerHTML='<span>🖼️❌ imagem não encontrada</span>'; }
            calloutShow('Uma imagem deu <b>404</b> (não existe nesse endereço). A página <b>abre mesmo assim</b> — só fica com a imagem quebrada. Uma página é feita de vários pedidos, e um pode falhar sem derrubar o resto.');
            after(1400,roundDone);
          });
        });
      });
    }

    else if(key==='scheme'){
      setLock('ok');
      addStep(`🔍 DNS: <b>${cur().url}</b> → ${cur().ip}`,'ok');
      addStep('🔒 Conexão segura (HTTPS) estabelecida','ok');
      calloutShow('Com <b>https://</b> a conversa vai criptografada — se alguém estiver espionando o wi-fi, só vê embaralhado. Sempre confira o cadeado antes de digitar senha.');
      bubble('Conexão segura. Agora o navegador carrega a tela de login.');
      after(1100,()=>{
        addStep('📨 GET /login → 📥 <b>200 OK</b>','recv');
        setPage(PAGE_LOGIN);
        after(900,()=>{
          busy=false;
          stageChoices('creds',
            'Você preencheu usuário e senha e clicou em Entrar. Como o navegador manda isso pro servidor?',
            [{opt:'post',text:'POST — os dados vão no corpo do pedido, não aparecem',       ok:true},
             {opt:'get', text:'GET — os dados vão na URL',                                   ok:false}]);
        });
      });
    }

    else if(key==='creds'){
      addStep('📨 <b>POST</b> /login  (usuário e senha no corpo, não na URL)','send');
      bubble('Enviando o login com segurança…');
      after(1000,()=>{
        addStep('📥 <b>200 OK</b> — bem-vindo!','recv');
        showStatus('200','OK · logado','ok');
        setPage('<div class="wp-header">🔑 Portal do Aluno</div><div class="wp-ok">✓ Bem-vindo, João!</div><div class="wp-line"></div><div class="wp-line short"></div>');
        calloutShow('<b>POST</b> manda os dados escondidos no corpo do pedido. Se fosse <b>GET</b>, a senha apareceria na URL <code>portal.ufsm.br/login?senha=1234</code> — e ficaria salva no histórico e nos registros do servidor.');
        bubble('Logado! Pronto — você acompanhou o navegador carregar uma página do zero.');
        after(2200,roundDone);
      });
    }
  }

  function wrong(key,opt){
    const MSG={
      'method:post'  :'POST é pra ENVIAR dados pro servidor (um formulário, um comentário). Você só quer VER a página — isso é GET.',
      'method:delete':'DELETE pediria pro servidor APAGAR a página! Pra só visualizar, o pedido certo é GET.',
      'scheme:http'  :'Com http:// (sem cadeado) sua senha viajaria aberta — qualquer um na mesma rede wi-fi poderia ler. Pra digitar senha, tem que ser https://.',
      'creds:get'    :'Com GET, usuário e senha iriam na URL: portal.ufsm.br/login?user=joao&senha=1234 — isso fica salvo no histórico do navegador e nos registros do servidor. Senha nunca vai por GET.',
    };
    if(key==='scheme' && opt==='http') setLock('bad');
    emit('web-wrong',{ reason:key, message:MSG[key+':'+opt]||'Essa não é a melhor escolha.', });
  }

  function roundDone(){
    busy=false;
    const final = roundIdx===ROUNDS.length-1;
    emit('web-correct',{ final, round:roundIdx+1 });
    if(final){ after(800,()=>emit('web-success')); }
    else stageNext();
  }

  // ── Dica ─────────────────────────────────────────────────
  function hintGlow(){
    if(!_c) return;
    let el;
    if(pendingChoice) el=_c.querySelector(`.web-choice[data-key="${pendingChoice}"][data-ok="1"]`);
    else if(awaitingNext) el=_c.querySelector('#web-stage [data-act="next"]');
    else el=_c.querySelector('#web-stage [data-act="go"]');
    if(el){ el.classList.add('hint-glow'); setTimeout(()=>el.classList.remove('hint-glow'),2800); }
  }

  return { render, reset, hintGlow };
})();
