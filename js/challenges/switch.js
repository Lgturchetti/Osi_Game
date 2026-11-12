/* ═══════════════════════════════════════
   SWITCH CHALLENGE (CAMADA 2 — PORTARIA DO PRÉDIO)
   O switch é simulado como o porteiro de um prédio. As 4 portas
   começam como apartamentos "??:??" (mistério) — o porteiro sabe que
   existem 4 portas, mas não sabe quem mora em cada uma. O jogador
   decide, a cada encomenda, qual ação é a correta:
     • endereço desconhecido → clicar em "Fazer Broadcast" revela qual
       porta é a certa e anota no caderno (tabela CAM) — mas a entrega
       só se completa quando o jogador clica na porta agora revelada.
     • endereço já conhecido → clicar direto na porta certa (unicast),
       sem precisar de broadcast.
   Usar a ação errada para o contexto conta como erro: clicar numa
   porta sem broadcast prévio é um chute impossível de justificar;
   fazer broadcast de um endereço já conhecido funcionaria, mas
   desperdiça banda da rede.
═══════════════════════════════════════ */

const SwitchChallenge = (() => {

  const DOORS = [
    { addr: 'AA:BB', num: 1 },
    { addr: 'CC:DD', num: 2 },
    { addr: 'EE:FF', num: 3 },
    { addr: 'GG:HH', num: 4 },
  ];

  // Sequência de encomendas. AA:BB e CC:DD repetem para demonstrar que,
  // depois de aprendido, o porteiro entrega direto (sem broadcast).
  const ROUNDS = ['CC:DD', 'AA:BB', 'EE:FF', 'CC:DD', 'GG:HH', 'AA:BB'];

  let roundIdx   = 0;
  let learned    = new Set();
  let busy       = false; // trava cliques durante animações
  let revealedThisRound = false; // true se o endereço foi revelado via broadcast nesta rodada
  let _container = null;

  function reset() {
    roundIdx   = 0;
    learned    = new Set();
    busy       = false;
    revealedThisRound = false;
    _container = null;
  }

  function currentTarget() { return ROUNDS[roundIdx]; }
  function doorLabel(addr) { return learned.has(addr) ? addr : '??:??'; }

  function render(container) {
    _container = container;

    container.innerHTML = `
      <div class="switch-wrap" id="switch-wrap">
        <div class="switch-top">
          <div class="switch-round-badge">📦 Encomenda <strong id="sw-round-num">1</strong> de <strong>${ROUNDS.length}</strong></div>
          <div class="switch-cam-panel">
            <div class="switch-cam-title">📓 Caderno do Porteiro (Tabela CAM)</div>
            <div class="switch-cam-list" id="sw-cam-list"><span class="switch-cam-empty">ainda vazio...</span></div>
          </div>
        </div>
        <div class="switch-stage">
          <div class="switch-package-area">
            <div class="switch-package" id="sw-package">
              <div class="switch-package-icon">📦</div>
              <div class="switch-package-label">Para: <strong id="sw-package-dest">--</strong></div>
            </div>
          </div>
          <button class="switch-broadcast-btn" id="sw-broadcast-btn" type="button">📢 Fazer Broadcast</button>
          <div class="switch-building" id="sw-building">
            ${DOORS.map(d => `
              <div class="switch-door" id="sw-door-${d.num}" data-addr="${d.addr}">
                <div class="switch-door-icon">🚪</div>
                <div class="switch-door-label" id="sw-doorlabel-${d.num}">??:??</div>
                <div class="switch-door-sub">Apto ${d.num}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>`;

    container.querySelectorAll('.switch-door').forEach(el => {
      el.addEventListener('click', () => { if (!busy) clickDoor(el.dataset.addr); });
    });
    container.querySelector('#sw-broadcast-btn')
      ?.addEventListener('click', () => { if (!busy) clickBroadcast(); });

    refreshDoorLabels();
    startRound();
  }

  function refreshDoorLabels() {
    if (!_container) return;
    DOORS.forEach(d => {
      const isKnown = learned.has(d.addr);
      const labelEl = _container.querySelector(`#sw-doorlabel-${d.num}`);
      const doorEl  = _container.querySelector(`#sw-door-${d.num}`);
      if (labelEl) labelEl.textContent = doorLabel(d.addr);
      if (doorEl)  doorEl.classList.toggle('revealed', isKnown);
    });
  }

  function updateCamList() {
    if (!_container) return;
    const list = _container.querySelector('#sw-cam-list');
    if (!list) return;
    list.innerHTML = learned.size === 0
      ? '<span class="switch-cam-empty">ainda vazio...</span>'
      : [...learned].map(a => `<span class="switch-cam-entry">${a}</span>`).join('');
  }

  function startRound() {
    if (!_container) return;
    busy = false;
    revealedThisRound = false;
    const target = currentTarget();

    const numEl  = _container.querySelector('#sw-round-num');
    const destEl = _container.querySelector('#sw-package-dest');
    const pkg    = _container.querySelector('#sw-package');
    const btn    = _container.querySelector('#sw-broadcast-btn');

    if (numEl)  numEl.textContent  = roundIdx + 1;
    if (destEl) destEl.textContent = target;
    pkg?.classList.remove('delivered', 'bad');
    btn?.classList.remove('wrong', 'hint-glow');
    _container.querySelectorAll('.switch-door').forEach(d =>
      d.classList.remove('correct', 'wrong', 'broadcasting', 'hint-glow'));
  }

  function advanceOrFinish() {
    if (!_container) return;
    roundIdx++;
    if (roundIdx >= ROUNDS.length) {
      _container.dispatchEvent(new CustomEvent('switch-success'));
    } else {
      startRound();
    }
  }

  // ── Clicar numa porta (ação correta apenas quando o endereço já é conhecido) ──
  function clickDoor(addr) {
    if (busy || !_container) return;
    const target = currentTarget();
    const doorEl = _container.querySelector(`.switch-door[data-addr="${addr}"]`);
    const pkg    = _container.querySelector('#sw-package');

    if (!learned.has(target)) {
      // Não dá para adivinhar uma porta que ainda é "??:??"
      busy = true;
      doorEl?.classList.add('wrong');
      pkg?.classList.add('bad');
      setTimeout(() => { doorEl?.classList.remove('wrong'); pkg?.classList.remove('bad'); busy = false; }, 550);
      _container.dispatchEvent(new CustomEvent('switch-wrong', { detail: { reason: 'needs-broadcast', target } }));
      return;
    }

    if (addr === target) {
      busy = true;
      doorEl?.classList.add('correct');
      pkg?.classList.add('delivered');
      const isFinal = roundIdx === ROUNDS.length - 1;
      _container.dispatchEvent(new CustomEvent('switch-correct', { detail: { addr, final: isFinal, viaBroadcast: revealedThisRound } }));
      setTimeout(advanceOrFinish, 900);
    } else {
      busy = true;
      doorEl?.classList.add('wrong');
      pkg?.classList.add('bad');
      setTimeout(() => { doorEl?.classList.remove('wrong'); pkg?.classList.remove('bad'); busy = false; }, 550);
      _container.dispatchEvent(new CustomEvent('switch-wrong', { detail: { reason: 'wrong-door', addr, target } }));
    }
  }

  // ── Clicar em Broadcast (ação correta apenas quando o endereço ainda é desconhecido) ──
  function clickBroadcast() {
    if (busy || !_container) return;
    const target = currentTarget();
    const btn    = _container.querySelector('#sw-broadcast-btn');
    const doors  = _container.querySelectorAll('.switch-door');

    if (learned.has(target)) {
      // já está no caderno — broadcast aqui seria desperdício de banda
      busy = true;
      btn?.classList.add('wrong');
      setTimeout(() => { btn?.classList.remove('wrong'); busy = false; }, 550);
      _container.dispatchEvent(new CustomEvent('switch-wrong', { detail: { reason: 'unnecessary-broadcast', target } }));
      return;
    }

    busy = true;
    doors.forEach(d => d.classList.add('broadcasting'));
    _container.dispatchEvent(new CustomEvent('switch-msg', { detail: '📢 Avisando o prédio inteiro...' }));

    setTimeout(() => {
      if (!_container) return;
      doors.forEach(d => d.classList.remove('broadcasting'));
      learned.add(target);
      revealedThisRound = true;
      refreshDoorLabels();
      updateCamList();
      busy = false;
      _container.dispatchEvent(new CustomEvent('switch-msg',
        { detail: `📓 Endereço ${target} descoberto! Agora clique na porta revelada para entregar.` }));
    }, 1300);
  }

  function hintGlow() {
    if (!_container) return;
    const target = currentTarget();
    if (learned.has(target)) {
      const doorEl = _container.querySelector(`.switch-door[data-addr="${target}"]`);
      doorEl?.classList.add('hint-glow');
      setTimeout(() => doorEl?.classList.remove('hint-glow'), 2800);
    } else {
      const btn = _container.querySelector('#sw-broadcast-btn');
      btn?.classList.add('hint-glow');
      setTimeout(() => btn?.classList.remove('hint-glow'), 2800);
    }
  }

  return { render, reset, hintGlow };
})();
