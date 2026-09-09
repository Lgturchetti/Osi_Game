let G={};
const DEV_PASS='#PROTEC2026';
let DEV=false;
function resetState(){G={layer:0,phase:'intro',lives:3,score:0,attempts:0,passed:false,mistakeLayers:[],results:[],choiceSelected:null,wireSelected:null,wireSelectedSide:null,wireMatched:{},sortOrder:[],rj45HintUsedThisLife:false,rj45CrimpTried:false};}
const $=id=>document.getElementById(id);
function showScreen(n){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$('screen-'+n).classList.add('active');}
function delay(ms){return new Promise(r=>setTimeout(r,ms));}

// Registra um erro do jogador. No modo desenvolvedor não custa vida nem
// marca a camada como errada — pode errar à vontade.
function mistake(){
  G.attempts++;
  if(DEV)return;
  G.lives=Math.max(0,G.lives-1);
  if(!G.mistakeLayers.includes(G.layer))G.mistakeLayers.push(G.layer);
}

function buildSidebar(){
  $('osi-stack').innerHTML=LAYERS.map(l=>`<div class="sport${DEV?' devclick':''}" id="sport-${l.id}"><span class="sport-led" id="sled-${l.id}"></span><span class="sport-num">L${l.id}</span><span class="sport-name">${l.emoji} ${l.short}</span><span class="sport-check" id="lcheck-${l.id}"></span></div>`).join('');
  if(DEV)LAYERS.forEach(l=>{const el=$('sport-'+l.id);if(el)el.onclick=()=>devGoToLayer(l.id-1);});
}
function updateSidebar(){
  LAYERS.forEach((l,i)=>{
    const row=$('sport-'+l.id),led=$('sled-'+l.id),chk=$('lcheck-'+l.id);
    row.classList.remove('active','done','pending');led.classList.remove('active','ok','err');
    if(i<G.layer){
      row.classList.add('done');
      const passed=G.results.find(r=>r.idx===i)?.passed;
      led.classList.add(passed?'ok':'err');chk.textContent=passed?'✓':'✗';
    }else if(i===G.layer){
      row.classList.add('active');led.classList.add('active');chk.textContent='';
    }else{
      row.classList.add('pending');chk.textContent='';
    }
  });
  $('lives-row').innerHTML=DEV
    ?'<span class="dev-lives">DEV · ∞</span>'
    :Array.from({length:3},(_,i)=>`<span>${i<G.lives?'🐧':'💀'}</span>`).join('');
  const bb=$('btn-back');if(bb)bb.hidden=G.layer<=0;
  const l=LAYERS[G.layer];$('topbar-layer').innerHTML=`Camada <span>${l.emoji} ${l.name}</span>`;
  $('prog-fill').style.width=(G.layer/LAYERS.length*100)+'%';
}
function setTux(p,id='tux-sidebar'){Tux.render(id,p,90);}
function setBubble(t,id='tux-bubble'){const el=$(id);if(el)el.textContent=t;}

function startGame(){resetState();buildSidebar();showScreen('game');updateSidebar();setTux('idle');setBubble('Vamos começar!');showIntro();renderDevBar();}

// ─── Navegação: voltar de camada (jogador) ───────────────
function goBack(){
  if(G.layer<=0)return;
  if(DEV){devGoToLayer(G.layer-1);return;}
  confirmDialog(
    `Voltar para a <b>Camada ${G.layer}</b>?<br><br>Você vai ter que passar por ela de novo — o progresso desta camada e das próximas se perde.`,
    ()=>{
      G.layer--;
      G.results=G.results.filter(r=>r.idx<G.layer);
      G.mistakeLayers=G.mistakeLayers.filter(i=>i<G.layer);
      G.lives=3;G.passed=false;G.attempts=0;
      showIntro();
    },'Voltar');
}

// ─── Modo desenvolvedor ─────────────────────────────────
function promptDev(){
  if(DEV){confirmDialog('Modo desenvolvedor está <b>ativo</b>. Desativar?',disableDev,'Desativar');return;}
  const ov=document.createElement('div');
  ov.className='modal-ov';
  ov.innerHTML=`<div class="modal-box">
    <div class="modal-msg">Senha de desenvolvedor</div>
    <input type="password" id="dev-pass" class="dev-pass-input" autocomplete="off" placeholder="senha">
    <div class="modal-err" id="dev-err" hidden>Senha incorreta.</div>
    <div class="modal-actions">
      <button class="gbtn gbtn-gray gbtn-sm" id="modal-no" type="button">Cancelar</button>
      <button class="gbtn gbtn-yellow gbtn-sm" id="modal-yes" type="button">Entrar</button>
    </div></div>`;
  document.body.appendChild(ov);
  const inp=ov.querySelector('#dev-pass');inp.focus();
  const go=()=>{
    if(inp.value===DEV_PASS){ov.remove();enableDev();}
    else{ov.querySelector('#dev-err').hidden=false;inp.select();}
  };
  ov.querySelector('#modal-no').onclick=()=>ov.remove();
  ov.querySelector('#modal-yes').onclick=go;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
}

function enableDev(){
  DEV=true;
  try{localStorage.setItem('osi_dev','1');}catch(e){}
  renderDevBar();
  if($('screen-game').classList.contains('active')){buildSidebar();updateSidebar();}
}
function disableDev(){
  DEV=false;
  try{localStorage.removeItem('osi_dev');}catch(e){}
  renderDevBar();
  if($('screen-game').classList.contains('active')){buildSidebar();updateSidebar();}
}

function renderDevBar(){
  const bar=$('dev-bar');if(!bar)return;
  document.body.classList.toggle('dev-on',DEV);
  if(!DEV){bar.hidden=true;bar.innerHTML='';return;}
  bar.hidden=false;
  const curL=(G&&typeof G.layer==='number')?G.layer:-1;
  bar.innerHTML=`
    <span class="devbar-tag">DEV</span>
    <button data-act="prev" type="button" title="camada anterior">◀</button>
    ${LAYERS.map(l=>`<button data-act="go" data-k="${l.id-1}" type="button" class="${l.id-1===curL?'cur':''}">L${l.id}</button>`).join('')}
    <button data-act="next" type="button" title="próxima camada">▶</button>
    <span class="devbar-sep"></span>
    <button data-act="sim" type="button">▶ Simular</button>
    <button data-act="result" type="button">🏁 Resultado</button>
    <button data-act="restart" type="button">⟳ Reiniciar</button>
    <button data-act="off" type="button">✕ dev</button>`;
  bar.querySelectorAll('button').forEach(b=>b.onclick=()=>devAct(b.dataset.act,b.dataset.k));
}
function devAct(act,k){
  if(act==='prev')return devGoToLayer((G.layer||0)-1);
  if(act==='next')return devGoToLayer((G.layer||0)+1);
  if(act==='go')return devGoToLayer(+k);
  if(act==='sim'){showScreen('game');return runSimulation();}
  if(act==='result')return showResult();
  if(act==='restart')return startGame();
  if(act==='off')return disableDev();
}
function devGoToLayer(k){
  if(!G||typeof G.layer!=='number')resetState();
  k=Math.max(0,Math.min(LAYERS.length-1,k));
  G.layer=k;G.lives=3;G.passed=false;G.attempts=0;
  G.results=G.results.filter(r=>r.idx<k);
  G.mistakeLayers=G.mistakeLayers.filter(i=>i<k);
  showScreen('game');
  buildSidebar();updateSidebar();
  showChallenge();
  renderDevBar();
}

// ─── Diálogo de confirmação ─────────────────────────────
function confirmDialog(msg,onYes,yesLabel){
  const ov=document.createElement('div');
  ov.className='modal-ov';
  ov.innerHTML=`<div class="modal-box">
    <div class="modal-msg">${msg}</div>
    <div class="modal-actions">
      <button class="gbtn gbtn-gray gbtn-sm" id="modal-no" type="button">Cancelar</button>
      <button class="gbtn gbtn-yellow gbtn-sm" id="modal-yes" type="button">${yesLabel||'Continuar'}</button>
    </div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('#modal-no').onclick=()=>ov.remove();
  ov.querySelector('#modal-yes').onclick=()=>{ov.remove();onYes&&onYes();};
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
}

function showIntro(){
  G.phase='intro';G.attempts=0;G.passed=false;
  const l=LAYERS[G.layer];updateSidebar();setTux('think');setBubble(l.challenge.hint);
  $('gmain').innerHTML=`<div class="phase-wrap">
    <div class="phase-header">
      <div class="lbadge">${l.emoji} Camada ${l.id}</div>
      <div><div class="phase-title">${l.intro.title||l.intro.text.split('\n')[0].slice(0,42)+'…'}</div><div class="phase-sub">${l.name} — Leia antes do desafio</div></div>
    </div>
    <div class="intro-card">${l.intro.text.split('\n\n').map(p=>`<p>${p.trim()}</p>`).join('')}</div>
    <div class="analogy-box"><div class="analogy-icon">${l.intro.analogy.icon}</div><div class="analogy-body"><strong>Analogia:</strong> ${l.intro.analogy.text}</div></div>
    <div class="row mt-auto" style="padding-top:.5rem">
      <div style="font-size:.72rem;color:var(--v2-text-dimmer);font-weight:600;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase">Leia com atenção!</div>
      <div class="ml-auto"><button class="gbtn gbtn-green" onclick="showChallenge()">Pronto! →</button></div>
    </div>
  </div>`;
}

function showChallenge(){
  G.phase='challenge';const l=LAYERS[G.layer],ch=l.challenge;
  setTux('idle');setBubble('Você consegue!');
  const isRj45=ch.type==='rj45';
  const noSubmitBtn=isRj45||ch.type==='switch'||ch.type==='route'||ch.type==='transport'||ch.type==='app';
  $('gmain').innerHTML=`<div class="phase-wrap">
    <div class="phase-header">
      <div class="lbadge">${l.emoji} Desafio L${l.id}</div>
      <div><div class="phase-title">${ch.title}</div><div class="phase-sub">${l.name}</div></div>
    </div>
    <div class="challenge-wrap">
      <div class="ch-instruction">${ch.instruction}</div>
      <div id="ch-widget"></div>
      <div id="rj45-hint-area"></div>
      <div class="feedback" id="feedback"><span id="fb-icon"></span><span id="fb-txt"></span></div>
      <div class="ch-actions">
        <button class="gbtn gbtn-gray gbtn-sm" id="btn-hint" onclick="showHint()" ${isRj45?'disabled':''}>💡 Dica</button>
        ${!noSubmitBtn?`<button class="gbtn gbtn-blue" id="btn-submit" onclick="submitChallenge()">Confirmar →</button>`:''}
      </div>
    </div>
  </div>`;
  buildWidget(ch);
}

function buildWidget(ch){
  const w=$('ch-widget');if(!w)return;
  if(ch.type==='rj45')       buildRJ45(w);
  else if(ch.type==='switch')  buildSwitch(w);
  else if(ch.type==='route')   buildRoute(w);
  else if(ch.type==='transport')buildTransport(w);
  else if(ch.type==='app')     buildApp(w);
  else if(ch.type==='choice')  buildChoice(ch,w);
  else if(ch.type==='ip')      buildIP(ch,w);
  else if(ch.type==='sequence')buildSeq(ch,w);
  else if(ch.type==='toggle')  buildToggle(ch,w);
  else if(ch.type==='wire')    buildWire(ch,w);
}

// ─── RJ45 integration ───────────────────────────────────
function buildRJ45(container){
  // Show standard selector first
  container.innerHTML = buildStdSelector();
}

function buildStdSelector() {
  const stds = {
    'T568B': {
      use: 'Mais comum no Brasil e EUA. Usado em redes domésticas e corporativas.',
    },
    'T568A': {
      use: 'Padrão alternativo. Exigido em instalações governamentais americanas (TIA-568-A).',
    },
  };

  // Generic icon — same for both, sem revelar a ordem
  const cardIconHTML = () => `
    <div style="font-size:2rem;line-height:1">🔌</div>`;

  return `<div class="std-selector">
    <div class="std-selector-title">🔌 Escolha o padrão de cabeamento</div>
    <div class="std-selector-sub">
      Os dois padrões usam os mesmos 8 fios, mas em ordens diferentes.<br>
      Escolha um e monte o cabo corretamente!
    </div>
    <div class="std-cards">
      ${Object.entries(stds).map(([key, val]) => `
        <div class="std-card" id="stdcard-${key}" onclick="selectStandard('${key}')">
          <div class="std-card-name">${key}</div>
          ${cardIconHTML()}
          <div class="std-card-use">${val.use}</div>
        </div>
      `).join('')}
    </div>
    <button class="gbtn gbtn-purple" id="btn-std-confirm" onclick="confirmStandard()" disabled>
      Confirmar padrão →
    </button>
  </div>`;
}

let _pendingStandard = null;
function selectStandard(std) {
  _pendingStandard = std;
  document.querySelectorAll('.std-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('stdcard-' + std)?.classList.add('selected');
  const btn = document.getElementById('btn-std-confirm');
  if (btn) btn.disabled = false;
}

function confirmStandard() {
  if (!_pendingStandard) return;
  RJ45Challenge.setStandard(_pendingStandard);

  // Update instruction text dynamically
  const instrEl = document.querySelector('.ch-instruction');
  if (instrEl) {
    const hints = {
      'T568B': 'Branco-Laranja · Laranja · Branco-Verde · Azul · Branco-Azul · Verde · Branco-Marrom · Marrom',
      'T568A': 'Branco-Verde · Verde · Branco-Laranja · Azul · Branco-Azul · Laranja · Branco-Marrom · Marrom',
    };
    instrEl.innerHTML = `Arraste os fios para os slots do conector RJ45 na ordem correta da norma <strong>${_pendingStandard}</strong>. Depois, use o <strong>Crimper</strong> para fixar. A dica só está disponível após a primeira tentativa.`;
    // Update the tux hint too
    setBubble(hints[_pendingStandard]);
  }

  const widget = document.getElementById('ch-widget');
  if (!widget) return;

  RJ45Challenge.reset();
  RJ45Challenge.render(widget);

  widget.addEventListener('rj45-success',()=>{
    G.passed=true;
    showFeedback(true,'Cabo crimpado com sucesso! Conexão estabelecida! 🎉');
    setTux('superHappy');Tux.bounce('tux-sidebar');Tux.pop('tux-sidebar');
    setBubble('INCRÍVEL! Cabo montado perfeitamente! 🎉');
    const actions=document.querySelector('.ch-actions');
    if(actions && !actions.querySelector('.btn-advance')){
      const btn=document.createElement('button');
      btn.className='gbtn gbtn-green btn-advance';
      btn.textContent='Próxima camada →';
      btn.onclick=advanceLayer;
      actions.appendChild(btn);
    }
  });

  widget.addEventListener('rj45-fail',()=>{
    mistake();
    showFeedback(false,'Alguns fios estão na posição errada. Os slots mostram onde errou — tente novamente!');
    setTux('sad');Tux.shake('tux-sidebar');
    setBubble('Quase! Veja os slots e tente de novo.');
    updateSidebar();
    G.rj45CrimpTried=true;
    G.rj45HintUsedThisLife=false;
    const hintBtn=$('btn-hint');if(hintBtn){hintBtn.disabled=false;}
    if(G.lives<=0)setTimeout(advanceLayer,1600);
  });

  widget.addEventListener('rj45-msg',e=>{
    showFeedback(false,e.detail);
  });
}

// ─── Switch (Camada 2 — portaria) integration ────────────
function buildSwitch(container){
  SwitchChallenge.reset();

  // listeners are attached BEFORE render() so the very first
  // broadcast message (fired synchronously on round 1) isn't missed
  container.addEventListener('switch-msg', e=>{
    setBubble(e.detail);
  });

  container.addEventListener('switch-correct', e=>{
    if(!e.detail.final){
      const msg=e.detail.viaBroadcast
        ? 'Broadcast certo! O porteiro aprendeu esse endereço e já anotou no caderno 📓✅'
        : 'Entrega direta correta! O porteiro já conhecia esse endereço 📬✅';
      showFeedback(true,msg);
      setTux('happy');Tux.pop('tux-sidebar');
    }
  });

  container.addEventListener('switch-wrong', e=>{
    mistake();
    let msg='Tente novamente!';
    if(e.detail.reason==='needs-broadcast')
      msg=`O porteiro ainda não conhece ${e.detail.target}! Ele não pode chutar uma porta — primeiro precisa fazer o Broadcast.`;
    else if(e.detail.reason==='wrong-door')
      msg=`Essa porta é de outro apartamento! A encomenda era para ${e.detail.target}.`;
    else if(e.detail.reason==='unnecessary-broadcast')
      msg=`Isso até funcionaria, mas seria desperdício de banda da rede! ${e.detail.target} já está no caderno — entregue direto na porta certa.`;
    showFeedback(false,msg);
    setTux('sad');Tux.shake('tux-sidebar');
    setBubble('Pense: o porteiro já conhece esse endereço ou não?');
    updateSidebar();
    if(G.lives<=0)setTimeout(advanceLayer,1600);
  });

  container.addEventListener('switch-success', ()=>{
    G.passed=true;
    showFeedback(true,'Todas as encomendas entregues! O porteiro aprendeu a rede toda — caderno completo! 🎉');
    setTux('superHappy');Tux.bounce('tux-sidebar');Tux.pop('tux-sidebar');
    setBubble('PERFEITO! Caderno completo! 🎉');
    const actions=document.querySelector('.ch-actions');
    if(actions && !actions.querySelector('.btn-advance')){
      const btn=document.createElement('button');
      btn.className='gbtn gbtn-green btn-advance';
      btn.textContent='Próxima camada →';
      btn.onclick=advanceLayer;
      actions.appendChild(btn);
    }
  });

  SwitchChallenge.render(container);
}

// ─── Route (Camada 3 — jornada do pacote) integration ────
function buildRoute(container){
  RouteChallenge.reset();

  container.addEventListener('route-ip-ok', ()=>{
    showFeedback(true,'Endereço configurado! Seu computador já pode enviar pacotes pela rede.');
    setTux('happy');Tux.pop('tux-sidebar');
    setBubble('Agora clique em "Enviar o pacote" para começar a jornada!');
  });

  container.addEventListener('route-correct', ()=>{
    showFeedback(true,'Rota correta! O pacote avança para o próximo roteador.');
    setTux('happy');Tux.pop('tux-sidebar');
  });

  container.addEventListener('route-wrong', e=>{
    mistake();
    showFeedback(false,e.detail?.message||'Tente novamente!');
    setTux('sad');Tux.shake('tux-sidebar');
    setBubble(e.detail?.phase==='ip'?'Revise os campos com atenção.':'Pense: qual rede está mais perto do destino 10.40?');
    updateSidebar();
    if(G.lives<=0)setTimeout(advanceLayer,1600);
  });

  container.addEventListener('route-success', ()=>{
    G.passed=true;
    showFeedback(true,'Pacote entregue no HUSM! Endereçamento e roteamento completos! 🎉');
    setTux('superHappy');Tux.bounce('tux-sidebar');Tux.pop('tux-sidebar');
    setBubble('PERFEITO! Pacote entregue! 🎉');
    const actions=document.querySelector('.ch-actions');
    if(actions && !actions.querySelector('.btn-advance')){
      const btn=document.createElement('button');
      btn.className='gbtn gbtn-green btn-advance';
      btn.textContent='Próxima camada →';
      btn.onclick=advanceLayer;
      actions.appendChild(btn);
    }
  });

  RouteChallenge.render(container);
}

// ─── Transport (Camada 4 — canal com perda) integration ──
function buildTransport(container){
  TransportChallenge.reset();

  container.addEventListener('transport-msg', e=>{ setBubble(e.detail); });

  container.addEventListener('transport-correct', e=>{
    if(!e.detail.final){
      showFeedback(true,e.detail.message);
      setTux('happy');Tux.pop('tux-sidebar');
      setBubble(e.detail.chosen==='udp'
        ? 'Boa! Aqui velocidade vale mais que perfeição. 🏃'
        : 'Boa! Nada se perdeu no caminho. 📦✅');
    }
  });

  container.addEventListener('transport-wrong', e=>{
    mistake();
    showFeedback(false,e.detail?.message||'Tente novamente!');
    setTux('sad');Tux.shake('tux-sidebar');
    setBubble(e.detail?.hint||'Pense: esses dados precisam de integridade ou de tempo real?');
    updateSidebar();
    if(G.lives<=0)setTimeout(advanceLayer,1600);
  });

  container.addEventListener('transport-success', ()=>{
    G.passed=true;
    showFeedback(true,'Todas as transmissões entregues do jeito certo! Você entendeu o trade-off do Transporte! 🎉');
    setTux('superHappy');Tux.bounce('tux-sidebar');Tux.pop('tux-sidebar');
    setBubble('PERFEITO! TCP quando não pode faltar, UDP quando não pode esperar! 🎉');
    const actions=document.querySelector('.ch-actions');
    if(actions && !actions.querySelector('.btn-advance')){
      const btn=document.createElement('button');
      btn.className='gbtn gbtn-green btn-advance';
      btn.textContent='Próxima camada →';
      btn.onclick=advanceLayer;
      actions.appendChild(btn);
    }
  });

  TransportChallenge.render(container);
}

// ─── Aplicação (Camada 7) — 2 fases: mensagem + navegador ──
let APP_DONE={msg:false,web:false};
let APP_PHASE='picker';   // 'picker' | 'msg' | 'web'  (pra dica)

function buildApp(container){
  APP_DONE={msg:false,web:false};
  APP_PHASE='picker';
  renderAppPicker(container);
}

function renderAppPicker(container){
  APP_PHASE='picker';
  MessageChallenge.reset(); WebChallenge.reset();
  const both=APP_DONE.msg&&APP_DONE.web;
  setTux(both?'celebrate':'idle');
  setBubble(both?'As duas partes prontas! Bora testar a rede toda.':'Escolha uma parte pra começar.');
  const card=(ph,ic,name,sub,locked)=>`
    <button class="app-card${APP_DONE[ph]?' done':''}${locked?' locked':''}" data-phase="${ph}" ${locked?'disabled':''} type="button">
      <span class="app-card-ic">${ic}</span>
      <span class="app-card-name">${name}</span>
      <span class="app-card-sub">${sub}</span>
      <span class="app-card-tag">${APP_DONE[ph]?'✓ concluída':locked?'🔒 termine a 1ª primeiro':'jogar →'}</span>
    </button>`;
  container.innerHTML=`
    <div class="app-picker">
      <div class="app-picker-title">A Camada de Aplicação, na prática, são os apps que você usa. Vamos ver dois:</div>
      <div class="app-cards">
        ${card('msg','📱','Mandando uma mensagem','Como o WhatsApp entrega uma mensagem',false)}
        ${card('web','🌐','Abrindo um site','Como o navegador carrega uma página',!APP_DONE.msg)}
      </div>
    </div>`;
  container.querySelectorAll('.app-card').forEach(c=>c.onclick=()=>{
    const p=c.dataset.phase;
    if(c.disabled||APP_DONE[p]) return;
    startAppPhase(container,p);
  });
  if(both){
    G.passed=true;
    const actions=document.querySelector('.ch-actions');
    if(actions && !actions.querySelector('.btn-advance')){
      const btn=document.createElement('button');
      btn.className='gbtn gbtn-green btn-advance';
      btn.textContent='Testar a rede completa →';
      btn.onclick=advanceLayer;
      actions.appendChild(btn);
    }
  }
}

function startAppPhase(container,p){
  G.lives=3;G.attempts=0;updateSidebar();
  const done=()=>{ APP_DONE[p]=true; setTux('happy');Tux.pop('tux-sidebar'); renderAppPicker(container); };
  if(p==='msg'){ APP_PHASE='msg'; buildMessage(container,done); }
  else         { APP_PHASE='web'; buildWeb(container,done); }
}

// Fase 1 — a mensagem no WhatsApp
function buildMessage(container,onDone){
  MessageChallenge.reset();
  container.addEventListener('message-msg', e=>{ setBubble(e.detail); });
  container.addEventListener('message-correct', e=>{
    if(!e.detail.final){
      showFeedback(true,'Mensagem entregue e lida! ✓✓');
      setTux('happy');Tux.pop('tux-sidebar');
      setBubble('Boa! Próxima mensagem.');
    }
  });
  container.addEventListener('message-wrong', e=>{
    mistake();
    showFeedback(false,e.detail?.message||'Essa não é a melhor escolha.');
    setTux('sad');Tux.shake('tux-sidebar');
    setBubble(e.detail?.hint||'Pensa no caminho: seu celular → servidor → a Bia.');
    updateSidebar();
    if(G.lives<=0){ MessageChallenge.reset(); setTimeout(advanceLayer,1600); }
  });
  container.addEventListener('message-success', ()=>{
    showFeedback(true,'Parte 1 completa! Você entendeu como o WhatsApp entrega uma mensagem. ✓✓');
    setTux('superHappy');Tux.bounce('tux-sidebar');
    if(onDone) onDone();
  });
  MessageChallenge.render(container);
}

// Fase 2 — abrindo um site no navegador
function buildWeb(container,onDone){
  WebChallenge.reset();
  container.addEventListener('web-msg', e=>{ setBubble(e.detail); });
  container.addEventListener('web-correct', e=>{
    if(!e.detail.final){
      showFeedback(true,'Página carregada! ✓');
      setTux('happy');Tux.pop('tux-sidebar');
      setBubble('Boa! Próximo site.');
    }
  });
  container.addEventListener('web-wrong', e=>{
    mistake();
    showFeedback(false,e.detail?.message||'Essa não é a melhor escolha.');
    setTux('sad');Tux.shake('tux-sidebar');
    setBubble('Pensa: você quer VER a página (GET) ou ENVIAR dados (POST)? E precisa de cadeado?');
    updateSidebar();
    if(G.lives<=0){ WebChallenge.reset(); setTimeout(advanceLayer,1600); }
  });
  container.addEventListener('web-success', ()=>{
    showFeedback(true,'Parte 2 completa! Você acompanhou o navegador carregar uma página do zero. 🎉');
    setTux('superHappy');Tux.bounce('tux-sidebar');
    if(onDone) onDone();
  });
  WebChallenge.render(container);
}

function showHint(){
  const l=LAYERS[G.layer],ch=l.challenge;
  if(ch.type==='rj45'){
    if(!G.rj45CrimpTried){setBubble('Tente crimpar primeiro!');return;}
    if(G.rj45HintUsedThisLife){setBubble('Você já usou a dica desta vida!');return;}
    const hint=RJ45Challenge.getHint();
    if(!hint){setBubble('Parece que está tudo certo — tente crimpar!');return;}
    G.rj45HintUsedThisLife=true;
    // disable hint btn until next crimp
    const hintBtn=$('btn-hint');if(hintBtn)hintBtn.disabled=true;
    // show hint panel
    const area=$('rj45-hint-area');
    if(area){
      const aStripe=hint.actualStripe?`<span class="hint-swatch-stripe"></span>`:'';
      const eStripe=hint.expectedStripe?`<span class="hint-swatch-stripe"></span>`:'';
      area.innerHTML=`<div class="rj45-hint-panel">
        💡 <span class="hint-slot">Slot ${hint.slot}</span> —
        estava: <span class="hint-wire">
          <span class="hint-swatch" style="background:${hint.actualColor}">${aStripe}</span>
          ${hint.actual}
        </span>
        · deveria ser: <span class="hint-wire">
          <span class="hint-swatch" style="background:${hint.expectedColor}">${eStripe}</span>
          ${hint.expected}
        </span>
      </div>`;
    }
    setTux('wink');Tux.pop('tux-sidebar');setTimeout(()=>setTux('idle'),2500);
  } else if(ch.type==='switch'){
    SwitchChallenge.hintGlow();
    setBubble('Olhe o caderno: o endereço já está anotado? Se não, é Broadcast. Se sim, é a porta certa!');
    setTux('wink');Tux.pop('tux-sidebar');setTimeout(()=>setTux('idle'),2500);
  } else if(ch.type==='route'){
    RouteChallenge.hintGlow();
    const msg=RouteChallenge.getPhase()==='ip'
      ? 'Confira: o IP não pode ser .0, .255, nem igual ao gateway!'
      : 'Compare a rede de destino de cada rota com 10.40.0.10 — qual chega mais perto?';
    setBubble(msg);
    setTux('wink');Tux.pop('tux-sidebar');setTimeout(()=>setTux('idle'),2500);
  } else if(ch.type==='transport'){
    TransportChallenge.hintGlow();
    setBubble('Se um pedaço se perder, dá pra seguir sem ele? Sim → UDP (rápido). Não → TCP (garantido).');
    setTux('wink');Tux.pop('tux-sidebar');setTimeout(()=>setTux('idle'),2500);
  } else if(ch.type==='app'){
    if(APP_PHASE==='msg'){
      MessageChallenge.hintGlow();
      setBubble('A mensagem passa pelo servidor primeiro. Pra achar o servidor na internet, você precisa do endereço — quem dá é o DNS.');
    } else if(APP_PHASE==='web'){
      WebChallenge.hintGlow();
      setBubble('Você quer VER a página (GET) ou ENVIAR dados/senha (POST)? E pra digitar senha, o endereço tem que começar com https:// (cadeado).');
    } else {
      setBubble('Comece pela parte do WhatsApp. A do navegador libera quando você terminar essa.');
    }
    setTux('wink');Tux.pop('tux-sidebar');setTimeout(()=>setTux('idle'),2500);
  } else {
    setBubble(l.challenge.hint);
    setTux('wink');Tux.pop('tux-sidebar');setTimeout(()=>setTux('idle'),2500);
  }
}

// ─── Other widgets ───────────────────────────────────────
function buildChoice(ch,w){
  G.choiceSelected=null;
  w.innerHTML=`<div style="font-weight:800;margin-bottom:.8rem;font-size:.9rem">${ch.question}</div><div class="choices">${ch.options.map(o=>`<button class="cbtn" id="cb-${o.id}" onclick="selectChoice('${o.id}')" type="button"><strong>${o.id.toUpperCase()})</strong> ${o.text}</button>`).join('')}</div>`;
}
function selectChoice(id){document.querySelectorAll('.cbtn').forEach(b=>b.classList.remove('sel'));$('cb-'+id)?.classList.add('sel');G.choiceSelected=id;}
function validateChoice(ch){const opt=ch.options.find(o=>o.id===G.choiceSelected);return{passed:opt?.ok===true,explain:opt?.explain||''};}

function buildIP(ch,w){w.innerHTML=`<div class="ip-fields">${ch.fields.map(f=>`<div class="iprow"><label>${f.label}</label>${f.type==='select'?`<select id="ipf-${f.id}">${f.options.map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`:`<input type="text" id="ipf-${f.id}" placeholder="${f.placeholder||''}">`}<span class="ip-hint">${f.hint}</span></div>`).join('')}</div>`;}
function validateIP(ch){let ok=true;ch.fields.forEach(f=>{const el=$('ipf-'+f.id);if(!el)return;const v=f.type==='select'?el.value===f.correct:f.validate(el.value);if(f.type!=='select'){el.classList.toggle('ok',v);el.classList.toggle('err',!v);}if(!v)ok=false;});return{passed:ok};}

let _sortDrag=null;
function buildSeq(ch,w){const s=[...ch.items].sort(()=>Math.random()-.5);G.sortOrder=s.map(i=>i.id);w.innerHTML=`<div class="sort-list" id="sort-list">${s.map(it=>`<div class="sitem" id="si-${it.id}" draggable="true" ondragstart="_sDragStart(event,'${it.id}')" ondragover="_sDragOver(event,'${it.id}')" ondrop="_sDrop(event,'${it.id}')"><span class="shandle">⠿</span><span>${it.text}</span></div>`).join('')}</div>`;}
function _sDragStart(e,id){_sortDrag=id;}
function _sDragOver(e,id){e.preventDefault();$('si-'+id)?.classList.add('drag-over');}
function _sDrop(e,tid){e.preventDefault();$('si-'+tid)?.classList.remove('drag-over');if(!_sortDrag||_sortDrag===tid)return;const list=$('sort-list');list.insertBefore($('si-'+_sortDrag),$('si-'+tid));G.sortOrder=[...$('sort-list').querySelectorAll('.sitem')].map(el=>el.id.replace('si-',''));_sortDrag=null;}
function validateSeq(ch){const c=ch.items.slice().sort((a,b)=>a.order-b.order).map(i=>i.id);return{passed:G.sortOrder.join(',')===c.join(',')};}

function buildToggle(ch,w){w.innerHTML=`<div class="toggle-list">${ch.items.map(it=>`<div class="titem"><div class="titem-info"><div class="titem-label">${it.label}</div><div class="titem-note">${it.note}</div></div><label class="tswitch"><input type="checkbox" id="tog-${it.id}"><span class="tslider"></span></label></div>`).join('')}</div>`;}
function validateToggle(ch){let ok=0;ch.items.forEach(it=>{const el=$('tog-'+it.id);if(el&&el.checked===it.ok)ok++;});return{passed:ok===ch.items.length,score:ok,total:ch.items.length};}

function buildWire(ch,w){G.wireSelected=null;G.wireSelectedSide=null;G.wireMatched={};w.innerHTML=`<div class="wire-game"><div class="wire-col">${ch.left.map(n=>`<div class="wnode" id="wl-${n.id}" onclick="wireClick('left','${n.id}')">${n.label}</div>`).join('')}</div><div class="wire-mid">↔</div><div class="wire-col">${ch.right.map(n=>`<div class="wnode" id="wr-${n.id}" onclick="wireClick('right','${n.id}')">${n.label}</div>`).join('')}</div></div>`;}
function wireClick(side,id){const ch=LAYERS[G.layer].challenge,pre=side==='left'?'wl-':'wr-',el=$(pre+id);if(el?.classList.contains('matched'))return;if(!G.wireSelected){G.wireSelected=id;G.wireSelectedSide=side;el?.classList.add('sel');}else{if(G.wireSelectedSide===side){const op=side==='left'?'wl-':'wr-';$(op+G.wireSelected)?.classList.remove('sel');G.wireSelected=id;el?.classList.add('sel');return;}const lid=side==='left'?id:G.wireSelected,rid=side==='right'?id:G.wireSelected;$('wl-'+lid)?.classList.remove('sel');$('wr-'+rid)?.classList.remove('sel');const ok=ch.pairs[lid]===rid;if(ok){$('wl-'+lid)?.classList.add('matched');$('wr-'+rid)?.classList.add('matched');G.wireMatched[lid]=rid;}else{$('wl-'+lid)?.classList.add('bad');$('wr-'+rid)?.classList.add('bad');setTimeout(()=>{$('wl-'+lid)?.classList.remove('bad');$('wr-'+rid)?.classList.remove('bad');},500);}G.wireSelected=null;G.wireSelectedSide=null;}}
function validateWire(ch){const t=Object.keys(ch.pairs).length,m=Object.keys(G.wireMatched).length;return{passed:m===t,score:m,total:t};}

function submitChallenge(){
  const l=LAYERS[G.layer],ch=l.challenge;
  if(ch.type==='rj45'||ch.type==='switch'||ch.type==='route'||ch.type==='transport'||ch.type==='app')return; // handled by events
  let res={passed:false};
  if(ch.type==='choice')res=validateChoice(ch);
  else if(ch.type==='ip')res=validateIP(ch);
  else if(ch.type==='sequence')res=validateSeq(ch);
  else if(ch.type==='toggle')res=validateToggle(ch);
  else if(ch.type==='wire')res=validateWire(ch);
  G.attempts++;
  if(res.passed){
    G.passed=true;
    showFeedback(true,res.explain||'Correto! 🎉');
    setTux('superHappy');Tux.bounce('tux-sidebar');Tux.pop('tux-sidebar');setBubble('INCRÍVEL! 🎉');
    const btn=$('btn-submit');if(btn){btn.textContent='Próxima camada →';btn.onclick=advanceLayer;btn.className='gbtn gbtn-green';}
  }else{
    if(!DEV){G.lives=Math.max(0,G.lives-1);if(!G.mistakeLayers.includes(G.layer))G.mistakeLayers.push(G.layer);}
    const msg=res.explain||wrongMsg(ch.type,res);showFeedback(false,msg);
    setTux('sad');Tux.shake('tux-sidebar');setBubble('Quase! Tente de novo.');updateSidebar();
    if(G.lives<=0)setTimeout(advanceLayer,1600);
  }
}

function wrongMsg(t,r){
  if(t==='choice')return'Resposta incorreta. Leia as opções com cuidado.';
  if(t==='ip')return'Um ou mais campos com erro.';
  if(t==='sequence')return'Ordem incorreta.';
  if(t==='toggle')return`${r.score||0} de ${r.total} corretos.`;
  if(t==='wire')return`${r.score||0} de ${r.total} pares conectados.`;
  return'Tente novamente!';
}

function showFeedback(ok,msg){const fb=$('feedback');if(!fb)return;fb.className='feedback show '+(ok?'ok':'fail');$('fb-icon').textContent=ok?'✅':'❌';$('fb-txt').textContent=msg;fb.scrollIntoView({behavior:'smooth',block:'nearest'});}

function advanceLayer(){
  G.results.push({idx:G.layer,passed:G.passed,attempts:G.attempts});G.lives=3;
  if(G.layer>=LAYERS.length-1)runSimulation();else{G.layer++;showIntro();}
}

async function runSimulation(){
  showScreen('sim');Tux.render('tux-sim','think',110);setBubble('Vamos testar sua rede!','tux-sim-bubble');
  $('sim-stack').innerHTML=LAYERS.map(l=>`<div class="slayer ${l.cls}" id="sl-${l.id}"><div class="sln">L${l.id}</div><div class="slname">${l.emoji} ${l.name}</div><div class="slstatus" id="ss-${l.id}">aguardando...</div><div class="slicon" id="si-${l.id}">⏳</div></div>`).join('');
  $('sim-log').innerHTML='<span class="log-info">> Iniciando simulação...\n</span>';

  const realErrorLayerIds = [...new Set(G.mistakeLayers.map(i => LAYERS[i].id))];
  const log=$('sim-log');
  const addLog=(m,c)=>{log.innerHTML+=`<span class="${c||''}">${m}\n</span>`;log.scrollTop=9999;};
  addLog('> Enviando pacote de dados...','log-info');

  // Test every layer one by one — never stop early
  for(const l of LAYERS){
    await delay(600);
    const row=$('sl-'+l.id),ss=$('ss-'+l.id),si=$('si-'+l.id);
    row.classList.add('processing');ss.textContent='processando...';si.textContent='⚙️';
    await delay(750);
    row.classList.remove('processing');
    if(realErrorLayerIds.includes(l.id)){
      row.classList.add('err');ss.textContent=l.sim.err;si.textContent='❌';
      addLog(`> [L${l.id}] ${l.sim.err}`,'log-err');
    } else {
      row.classList.add('ok');ss.textContent=l.sim.ok;si.textContent='✅';
      addLog(`> [L${l.id}] ${l.sim.ok}`,'log-ok');
    }
  }

  const hadErrors = realErrorLayerIds.length > 0;
  if(hadErrors){
    addLog(`> ⚠️ ${realErrorLayerIds.length} camada(s) com problema.`,'log-err');
    Tux.render('tux-sim','worried',110);Tux.shake('tux-sim');
    setBubble(`${realErrorLayerIds.length} camada(s) com falha. Revise!`,'tux-sim-bubble');
  } else {
    addLog('> ✨ Todos os pacotes entregues!','log-ok');
    Tux.render('tux-sim','celebrate',110);Tux.bounce('tux-sim');setBubble('PERFEITO! 🎉','tux-sim-bubble');
  }
  setTimeout(()=>showResult(),2200);
}

function showResult(){
  showScreen('result');
  const playerErrIds = [...new Set(G.mistakeLayers.map(i => LAYERS[i].id))];
  const passedCount  = LAYERS.length - playerErrIds.length;
  const perfect      = playerErrIds.length === 0;

  // Score: each correctly completed layer = floor(100 / 7) pts, perfect bonus brings to 100
  const PTS_PER_LAYER = Math.floor(100 / LAYERS.length); // 14
  const bonus         = perfect ? (100 - PTS_PER_LAYER * LAYERS.length) : 0; // 2 pts bonus if perfect
  G.score             = passedCount * PTS_PER_LAYER + bonus;

  Tux.render('tux-result', perfect ? 'celebrate' : 'worried', 130);
  if(perfect) Tux.bounce('tux-result');

  $('result-title').textContent = perfect ? '🏆 Rede Perfeita!' : '⚠️ Rede com Problemas';
  $('result-pts').textContent   = G.score + ' pts';
  $('result-msg').textContent   = perfect
    ? 'Você configurou todas as 7 camadas OSI sem nenhum erro! Tux está muito orgulhoso!'
    : `Você acertou ${passedCount} de ${LAYERS.length} camadas. Reveja as camadas abaixo e tente novamente!`;

  const errContainer = $('result-errors');
  if(playerErrIds.length === 0){
    errContainer.style.display = 'none';
  } else {
    errContainer.style.display = 'block';
    $('result-err-list').innerHTML = playerErrIds.map(lid => {
      const l = LAYERS.find(x => x.id === lid);
      return l ? `<div class="err-item"><div class="err-dot"></div><span>${l.emoji} ${l.name}</span></div>` : '';
    }).join('');
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  $('btn-start').addEventListener('click',startGame);
  $('btn-restart').addEventListener('click',startGame);
  $('dev-trigger')?.addEventListener('click',promptDev);
  $('btn-back')?.addEventListener('click',goBack);
  try{ if(localStorage.getItem('osi_dev')==='1') DEV=true; }catch(e){}
  renderDevBar();
});
