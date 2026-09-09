const RouteChallenge = (() => {

  // ── Fase 1: campos de IP (com as duas correções já validadas) ──
  // 1. Máscara começa num placeholder — não vem pré-marcada na resposta certa.
  // 2. IP não pode ser igual ao Gateway (conflito de endereço).
  const IP_FIELDS = [
    { id:'ip', label:'Endereço IP', type:'text', placeholder:'ex: 192.168.1.X',
      validate: v => /^192\.168\.1\.([1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(v.trim()),
      hint:'.0 é a rede e .255 é broadcast — nenhum host pode usar esses' },
    { id:'mask', label:'Máscara de Sub-rede', type:'select',
      options:['— escolha —','255.0.0.0','255.255.0.0','255.255.255.0','255.255.255.255'],
      correct:'255.255.255.0', hint:'/24 significa 24 bits de rede' },
    { id:'gateway', label:'Gateway Padrão', type:'text', placeholder:'ex: 192.168.1.1',
      validate: v => /^192\.168\.1\.(1|254)$/.test(v.trim()),
      hint:'Geralmente .1 ou .254 — a "porta de saída" da rede' },
  ];

  // ── Fase 2: topologia PC → CTISM → CT → INPE → HUSM ──
  const NODES = [
    { id:'pc',    icon:'💻', label:'Seu PC',         net:'192.168.1.0/24' },
    { id:'ctism', icon:'📡', label:'Roteador|CTISM', net:'10.10.0.0/16'   },
    { id:'ct',    icon:'🖧', label:'Roteador|CT',     net:'10.20.0.0/16'   },
    { id:'inpe',  icon:'🛰️', label:'Roteador|INPE',  net:'10.30.0.0/16'   },
    { id:'husm',  icon:'🏥', label:'Servidor|HUSM',  net:'10.40.0.0/16'   },
  ];
  const labelBR = s => s.replace('|','<br>');
  const labelSP = s => s.replace('|',' ');
  const DEST_IP = '10.40.0.10';

  // cada roteador do meio tem 3 rotas; só uma leva ao próximo salto certo
  const ROUTES = {
    ctism:{ correct:'ct', table:[
        { net:'10.20.0.0/16',  hop:'Roteador CT',          node:'ct' },
        { net:'10.99.0.0/16',  hop:'Roteador Reitoria',    node:'x1' },
        { net:'172.16.0.0/12', hop:'Roteador Lab. Física', node:'x2' },
      ], wrong:{
        x1:'Essa rota vai parar na Reitoria — seu pacote precisa seguir em direção ao HUSM (rede 10.40).',
        x2:'Essa rota leva ao Laboratório de Física, uma rede totalmente diferente. O pacote se perderia por lá!',
      }},
    ct:{ correct:'inpe', table:[
        { net:'10.55.0.0/16',   hop:'Roteador Biblioteca', node:'x1' },
        { net:'10.30.0.0/16',   hop:'Roteador INPE',       node:'inpe' },
        { net:'192.168.0.0/16', hop:'Rede Wi-Fi Aluno',    node:'x2' },
      ], wrong:{
        x1:'A Biblioteca é uma rede vizinha, mas não está no caminho do HUSM. Procure a rota mais perto da rede 10.40.',
        x2:'Essa é a rede do Wi-Fi dos alunos — ótima pra navegar, mas não leva ao servidor do HUSM.',
      }},
    inpe:{ correct:'husm', table:[
        { net:'10.40.0.0/16', hop:'Servidor HUSM',         node:'husm' },
        { net:'10.10.0.0/16', hop:'Roteador CTISM (volta)',node:'x1' },
        { net:'8.8.8.0/24',   hop:'Internet externa',      node:'x2' },
      ], wrong:{
        x1:'Essa rota faz o pacote VOLTAR pro CTISM! Ele andaria em círculos sem nunca chegar. 🔁',
        x2:'Isso mandaria o pacote pra internet lá fora — mas o HUSM está aqui dentro da rede da UFSM.',
      }},
  };

  let _container = null;
  let phase = 'ip';      // 'ip' | 'journey'
  let playerIP = null;
  let J = {};             // estado da jornada: { step, order }

  function reset() {
    _container = null;
    phase = 'ip';
    playerIP = null;
    J = {};
  }

  function getPhase() { return phase; }

  function render(container) {
    _container = container;
    phase = 'ip';
    renderPhase1();
  }

  // ── Fase 1 ──────────────────────────────────────────
  function renderPhase1() {
    _container.innerHTML = `
      <div class="ip-fields">${IP_FIELDS.map(f => `
        <div class="iprow">
          <label>${f.label}</label>
          ${f.type === 'select'
            ? `<select id="rt-ipf-${f.id}">${f.options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`
            : `<input type="text" id="rt-ipf-${f.id}" placeholder="${f.placeholder || ''}" autocomplete="off">`}
          <span class="ip-hint">${f.hint}</span>
        </div>`).join('')}</div>
      <div class="ch-actions">
        <button class="gbtn gbtn-blue" id="rt-btn-ip" type="button">Confirmar IP →</button>
      </div>`;
    _container.querySelector('#rt-btn-ip')?.addEventListener('click', submitIP);
  }

  function submitIP() {
    let ok = true;
    const vals = {};
    IP_FIELDS.forEach(f => {
      const el = _container.querySelector('#rt-ipf-' + f.id);
      if (!el) return;
      vals[f.id] = el.value.trim();
      const valid = f.type === 'select' ? el.value === f.correct : f.validate(el.value);
      el.classList.toggle('ok', valid);
      el.classList.toggle('err', !valid);
      if (!valid) ok = false;
    });

    let conflictMsg = '';
    if (ok && vals.ip && vals.ip === vals.gateway) {
      ok = false;
      conflictMsg = 'O IP e o Gateway não podem ser o mesmo endereço — seriam dois "moradores" com o mesmo número na rua. Escolha um IP diferente do gateway.';
      const ipEl = _container.querySelector('#rt-ipf-ip');
      ipEl?.classList.remove('ok'); ipEl?.classList.add('err');
    }

    if (ok) {
      playerIP = vals.ip;
      const btn = _container.querySelector('#rt-btn-ip');
      if (btn) {
        btn.textContent = 'Enviar o pacote 🚀';
        btn.className = 'gbtn gbtn-green';
        btn.removeEventListener('click', submitIP);
        btn.addEventListener('click', startJourney, { once: true });
      }
      _container.dispatchEvent(new CustomEvent('route-ip-ok'));
    } else {
      _container.dispatchEvent(new CustomEvent('route-wrong', {
        detail: { phase: 'ip', message: conflictMsg || 'Um ou mais campos estão incorretos. Veja as dicas de cada campo.' }
      }));
    }
  }

  // ── Fase 2 ──────────────────────────────────────────
  function startJourney() {
    phase = 'journey';

    const titleEl = document.querySelector('.phase-title');
    if (titleEl) titleEl.textContent = 'A Jornada do Pacote';
    const instrEl = document.querySelector('.ch-instruction');
    if (instrEl) instrEl.innerHTML = `Seu pacote precisa chegar ao <strong>Servidor HUSM</strong>. Nenhum roteador conhece o caminho inteiro — cada um só sabe qual é o <strong>próximo salto</strong>. Em cada roteador, escolha a rota que leva seu pacote para mais perto do destino.`;

    // step = índice do nó onde o pacote está agora. Começa em 1 (CTISM):
    // o pacote saiu do PC[0] e chegou ao primeiro roteador, onde acontece
    // a primeira decisão de roteamento.
    J = { step: 1, order: ['pc', 'ctism', 'ct', 'inpe', 'husm'] };

    _container.innerHTML = `
      <div class="journey">
        <div class="packet-dest">
          <div class="pd-chip">📦</div>
          <span>Pacote de <b>${playerIP || '192.168.1.50'}</b> → destino:</span>
          <span><b>${DEST_IP}</b> (rede do HUSM)</span>
        </div>
        <div class="netmap">
          <div class="netmap-grid"></div>
          <div class="netmap-title">// topologia da rede — UFSM</div>
          <div class="hoprow" id="rt-hoprow"></div>
          <div class="packet" id="rt-packet">📦</div>
        </div>
        <div id="rt-router-panel-slot"></div>
      </div>`;

    renderMap();
    renderRouter();
    setTimeout(() => placePacket('pc'), 400);
    setTimeout(() => placePacket('ctism'), 700);
  }

  function renderMap() {
    const row = _container.querySelector('#rt-hoprow');
    if (!row) return;
    let html = '';
    NODES.forEach((n, i) => {
      let cls = '';
      if (i < J.step) cls = 'done';
      else if (i === J.step) cls = 'current';
      html += `<div class="hopnode ${cls}" id="rt-node-${n.id}">
        <div class="hopicon">${n.icon}</div>
        <div class="hoplabel">${labelBR(n.label)}</div>
        <div class="hopnet">${n.net}</div>
      </div>`;
      if (i < NODES.length - 1) {
        const lit = i < J.step ? 'lit' : '';
        html += `<div class="hoplink ${lit}"></div>`;
      }
    });
    row.innerHTML = html;
  }

  function placePacket(nodeId) {
    const packet = _container.querySelector('#rt-packet');
    const node = _container.querySelector('#rt-node-' + nodeId);
    const map = _container.querySelector('.netmap');
    if (!packet || !node || !map) return;
    const mr = map.getBoundingClientRect();
    const icon = node.querySelector('.hopicon');
    const ir = icon.getBoundingClientRect();
    packet.style.left = (ir.left - mr.left + ir.width / 2 - 13) + 'px';
    packet.style.top = (ir.top - mr.top + ir.height / 2 - 13) + 'px';
  }

  function renderRouter() {
    const slot = _container.querySelector('#rt-router-panel-slot');
    if (!slot) return;
    const currentId = J.order[J.step];

    if (currentId === 'husm') {
      slot.innerHTML = `<div class="router-panel journey-done">
        <div class="jd-icon">🎉</div>
        <div class="jd-title">Pacote entregue no HUSM!</div>
        <div class="jd-msg">Seu pacote passou por 3 roteadores e chegou ao servidor de destino.
          Foi exatamente isso que a Camada de Rede fez: em cada parada, um roteador olhou o endereço de destino
          e decidiu apenas o <b>próximo salto</b> — sem nunca precisar conhecer o caminho inteiro.
          É assim que a internet inteira funciona!</div>
      </div>`;
      const p = _container.querySelector('#rt-packet');
      p?.classList.add('arrived');
      if (p) p.textContent = '✓';
      _container.dispatchEvent(new CustomEvent('route-success'));
      return;
    }

    const routeData = ROUTES[currentId];
    const node = NODES.find(n => n.id === currentId);
    slot.innerHTML = `<div class="router-panel">
      <div class="router-panel-head">
        <span class="rp-icon">${node.icon}</span>
        <span class="rp-name">${labelSP(node.label)}</span>
        <span class="rp-tag">roteador ${J.step} de 3</span>
      </div>
      <div class="router-panel-sub">
        Estou no roteador <b>${labelSP(node.label)}</b>. Meu pacote quer chegar em <b>${DEST_IP}</b>.
        Qual dessas rotas leva pra mais perto?
      </div>
      <div class="route-table-label">
        <span class="col-dest">Rede de destino</span>
        <span class="col-hop">Próximo salto</span>
      </div>
      <div class="routes">
        ${routeData.table.map((r, idx) => `
          <button class="rbtn" id="rt-rbtn-${idx}" type="button" data-router="${currentId}" data-target="${r.node}" data-idx="${idx}">
            <span class="r-net">${r.net}</span>
            <span class="r-arrow">→</span>
            <span class="r-hop">${r.hop}</span>
          </button>`).join('')}
      </div>
    </div>`;
    slot.querySelectorAll('.rbtn').forEach(b => {
      b.addEventListener('click', () => chooseRoute(b.dataset.router, b.dataset.target, +b.dataset.idx));
    });
  }

  function chooseRoute(routerId, targetNode, idx) {
    const routeData = ROUTES[routerId];
    const btn = _container.querySelector('#rt-rbtn-' + idx);
    if (!routeData || !btn) return;

    if (targetNode === routeData.correct) {
      _container.querySelectorAll('.rbtn').forEach(b => b.disabled = true);
      btn.classList.add('correct');
      _container.dispatchEvent(new CustomEvent('route-correct'));

      J.step++;
      setTimeout(() => { renderMap(); placePacket(J.order[J.step]); }, 150);
      setTimeout(() => { renderRouter(); }, 1050);
    } else {
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      const msg = routeData.wrong[targetNode] || 'Essa rota não leva ao HUSM. Tente outra!';
      _container.dispatchEvent(new CustomEvent('route-wrong', { detail: { phase: 'journey', message: msg } }));
    }
  }

  function hintGlow() {
    if (!_container) return;
    if (phase === 'ip') {
      const target = IP_FIELDS.find(f => {
        const el = _container.querySelector('#rt-ipf-' + f.id);
        if (!el) return false;
        return !el.value || (f.type === 'select' ? el.value !== f.correct : !f.validate(el.value));
      }) || IP_FIELDS[0];
      const row = _container.querySelector('#rt-ipf-' + target.id)?.closest('.iprow');
      row?.classList.add('hint-glow');
      setTimeout(() => row?.classList.remove('hint-glow'), 2800);
    } else {
      const currentId = J.order[J.step];
      const routeData = ROUTES[currentId];
      if (!routeData) return;
      const idx = routeData.table.findIndex(r => r.node === routeData.correct);
      const btn = _container.querySelector('#rt-rbtn-' + idx);
      btn?.classList.add('hint-glow');
      setTimeout(() => btn?.classList.remove('hint-glow'), 2800);
    }
  }

  return { render, reset, hintGlow, getPhase };
})();
