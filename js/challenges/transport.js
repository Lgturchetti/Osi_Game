/* ═══════════════════════════════════════
   TRANSPORT CHALLENGE (CAMADA 4 — CANAL COM PERDA)
   O jogador envia dados por um canal que derruba pacotes. A cada rodada,
   uma situação diferente exige TCP (entrega garantida) ou UDP (entrega
   rápida). O jogador escolhe o modo, clica em Transmitir e VÊ o que chega
   do outro lado:
     • TCP  → o buffer do destinatário só libera em ordem; o que se perde é
       reenviado (banner "⟳ reenviando"), o medidor de atraso sobe, mas a
       integridade fecha em 100%.
     • UDP  → o destinatário mostra o que chegou na hora, com buracos onde
       os pacotes caíram; rápido, porém a integridade cai.
   Acertar = escolher o modo que atende a necessidade da rodada (tempo real
   × integridade). Errar custa uma vida e repete a rodada.
═══════════════════════════════════════ */

const TransportChallenge = (() => {

  const ROUNDS = [
    { id:'videocall', icon:'📹', title:'Videochamada ao vivo',
      ctx:'A professora está explicando <b>ao vivo</b>. Um congelamento de 3 segundos e a turma perde o fio da meada.',
      answer:'udp', drop:[3,6],
      udp:{ ok:true,  msg:'Um quadro saiu tremido, mas a chamada seguiu fluida e em tempo real. Ninguém reclamou.' },
      tcp:{ ok:false, msg:'A imagem CONGELOU esperando reenviar os quadros perdidos. Ao vivo, esse atraso é fatal.' } },

    { id:'email', icon:'📧', title:'Enviar um e-mail',
      ctx:'Tem um anexo importante junto. Ou o e-mail chega <b>inteiro</b>, ou não serve pra nada.',
      answer:'tcp', drop:[2,5],
      udp:{ ok:false, msg:'O e-mail chegou com trechos faltando — texto cortado e anexo corrompido. Inútil.' },
      tcp:{ ok:true,  msg:'Demorou um pouco reenviando o que se perdeu, mas chegou 100% completo e em ordem.' } },

    { id:'game', icon:'🎮', title:'Posição dos jogadores num game online',
      ctx:'A posição de cada jogador muda dezenas de vezes por segundo. Um dado de 1 segundo atrás <b>já não vale nada</b>.',
      answer:'udp', drop:[4,7],
      udp:{ ok:true,  msg:'Faltaram 2 atualizações, mas as seguintes já corrigiram a posição. O jogo continuou responsivo.' },
      tcp:{ ok:false, msg:'O jogo travou reenviando posições VELHAS que nem importam mais. Lag horrível.' } },

    { id:'download', icon:'📄', title:'Baixar um boleto em PDF',
      ctx:'É um arquivo. Se faltar <b>1 pedaço</b>, o PDF simplesmente não abre.',
      answer:'tcp', drop:[1,6],
      udp:{ ok:false, msg:'O PDF baixou com pedaços faltando e não abre: "arquivo corrompido".' },
      tcp:{ ok:true,  msg:'Cada pedaço perdido foi reenviado e conferido. O PDF abriu perfeitamente.' } },

    { id:'stream', icon:'📺', title:'Assistir a um jogo de futebol ao vivo',
      ctx:'Transmissão <b>ao vivo</b>. Você quer ver o gol na hora que ele acontece — não 10 segundos depois.',
      answer:'udp', drop:[2,3,7],
      udp:{ ok:true,  msg:'Meio segundo de pixels quadrados e a transmissão seguiu ao vivo.' },
      tcp:{ ok:false, msg:'O vídeo ficou travando pra reenviar tudo e acumulou atraso. Você ouviu o vizinho gritar o gol antes de ver.' } },
  ];

  const N = 8;                    // pacotes por transmissão
  const STAGGER = 135;            // ms entre a saída de cada pacote
  const FLY = 1950;               // ms de voo do pacote (bate com o CSS)
  const DROP_AT = 980;            // ms — quando o pacote perdido chega na zona de interferência

  let _c            = null;
  let roundIdx      = 0;
  let chosen        = null;       // 'tcp' | 'udp'
  let busy          = false;      // trava durante a animação
  let awaitingNext  = false;      // botão em modo "próxima rodada"
  let timers        = [];

  function reset() {
    _c = null; roundIdx = 0; chosen = null;
    busy = false; awaitingNext = false;
    timers.forEach(clearTimeout); timers = [];
  }

  const after = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const cur   = () => ROUNDS[roundIdx];

  // ── Render ───────────────────────────────────────────────
  function render(container) {
    _c = container;
    container.innerHTML = `
      <div class="tp-wrap" id="tp-wrap">
        <div class="tp-top">
          <div class="tp-round-badge">📡 Transmissão <strong id="tp-num">1</strong> de <strong>${ROUNDS.length}</strong></div>
          <div class="tp-scenario">
            <span class="tp-scenario-icon" id="tp-sc-icon">📹</span>
            <span class="tp-scenario-text">
              <strong class="tp-sc-title" id="tp-sc-title">—</strong>
              <span id="tp-sc-ctx"></span>
            </span>
          </div>
        </div>

        <div class="tp-modes" id="tp-modes">
          <button class="tp-mode" id="tp-mode-tcp" data-mode="tcp" type="button">
            <span class="tp-mode-name">TCP</span>
            <span class="tp-mode-tag">Entrega garantida</span>
            <span class="tp-mode-desc">confirma cada pacote · reenvia o que se perde · entrega em ordem</span>
          </button>
          <button class="tp-mode" id="tp-mode-udp" data-mode="udp" type="button">
            <span class="tp-mode-name">UDP</span>
            <span class="tp-mode-tag">Entrega rápida</span>
            <span class="tp-mode-desc">dispara os pacotes · não confirma · o que cair, caiu</span>
          </button>
        </div>

        <div class="tp-channel">
          <div class="tp-endpoint">🐧</div>
          <div class="tp-wire">
            <div class="tp-interference"><span>⚡ interferência</span></div>
            <div class="tp-packets" id="tp-packets"></div>
          </div>
          <div class="tp-endpoint">📥</div>
        </div>

        <div class="tp-receiver">
          <div class="tp-receiver-label">Chegou do outro lado:</div>
          <div class="tp-slots" id="tp-slots"></div>
        </div>

        <div class="tp-meters">
          <div class="tp-meter">
            <div class="tp-meter-top"><span>📦 Integridade</span><span id="tp-int-val">—</span></div>
            <div class="tp-meter-bar"><div class="tp-meter-fill tp-int" id="tp-int-fill"></div></div>
          </div>
          <div class="tp-meter">
            <div class="tp-meter-top"><span>⏱ Atraso</span><span id="tp-lag-val">—</span></div>
            <div class="tp-meter-bar"><div class="tp-meter-fill tp-lag" id="tp-lag-fill"></div></div>
          </div>
        </div>

        <div class="tp-banner" id="tp-banner"></div>

        <div class="tp-actions">
          <button class="tp-transmit-btn" id="tp-transmit" type="button" disabled>Transmitir ▶</button>
        </div>
      </div>`;

    container.querySelectorAll('.tp-mode').forEach(b => {
      b.addEventListener('click', () => { if (!busy && !awaitingNext) pickMode(b.dataset.mode); });
    });
    container.querySelector('#tp-transmit').addEventListener('click', onTransmitBtn);

    startRound();
  }

  function onTransmitBtn() {
    if (busy) return;
    if (awaitingNext) { awaitingNext = false; roundIdx++; startRound(); return; }
    if (!chosen) return;
    transmit();
  }

  // ── Rodada ───────────────────────────────────────────────
  function startRound() {
    if (!_c) return;
    timers.forEach(clearTimeout); timers = [];
    busy = false; chosen = null; awaitingNext = false;
    const r = cur();

    _c.querySelector('#tp-num').textContent      = roundIdx + 1;
    _c.querySelector('#tp-sc-icon').textContent  = r.icon;
    _c.querySelector('#tp-sc-title').textContent = r.title;
    _c.querySelector('#tp-sc-ctx').innerHTML     = ' — ' + r.ctx;

    _c.querySelectorAll('.tp-mode').forEach(m =>
      m.classList.remove('sel', 'correct', 'wrong', 'hint-glow', 'locked'));

    const t = _c.querySelector('#tp-transmit');
    t.disabled = true; t.textContent = 'Transmitir ▶'; t.classList.remove('go');

    renderPackets();
    renderSlots();
    setMeter('int', null);
    setMeter('lag', null);
    hideBanner();
  }

  function pickMode(mode) {
    chosen = mode;
    _c.querySelectorAll('.tp-mode').forEach(m => m.classList.toggle('sel', m.dataset.mode === mode));
    const t = _c.querySelector('#tp-transmit');
    t.disabled = false; t.classList.add('go');
  }

  function renderPackets() {
    const wrap = _c.querySelector('#tp-packets');
    if (!wrap) return;
    wrap.innerHTML = Array.from({ length: N }, (_, i) =>
      `<div class="tp-packet" id="tp-pk-${i + 1}" style="left:${i * 5}px">${i + 1}</div>`).join('');
  }

  function renderSlots() {
    const el = _c.querySelector('#tp-slots');
    if (!el) return;
    el.innerHTML = Array.from({ length: N }, (_, i) =>
      `<div class="tp-slot" id="tp-slot-${i + 1}">${i + 1}</div>`).join('');
  }

  function setSlot(n, cls) {
    const s = _c.querySelector('#tp-slot-' + n);
    if (!s) return;
    s.classList.remove('filled', 'buffered', 'lost');
    if (cls) s.classList.add(cls);
  }

  function popSlot(n) {
    const s = _c.querySelector('#tp-slot-' + n);
    if (s && s.animate) s.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
      { duration: 240, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }

  function setMeter(which, val) {
    const fill = _c.querySelector('#tp-' + which + '-fill');
    const lab  = _c.querySelector('#tp-' + which + '-val');
    if (!fill || !lab) return;
    if (val == null) { fill.style.width = '0%'; lab.textContent = '—'; return; }
    fill.style.width = Math.max(0, Math.min(100, val)) + '%';
    lab.textContent = which === 'int'
      ? Math.round(val) + '%'
      : (val < 25 ? 'baixo' : val < 60 ? 'médio' : 'ALTO');
  }

  function showBanner(txt, kind) {
    const b = _c.querySelector('#tp-banner');
    if (!b) return;
    b.innerHTML = txt;
    b.className = 'tp-banner show ' + (kind || '');
  }
  function hideBanner() {
    const b = _c.querySelector('#tp-banner');
    if (b) b.className = 'tp-banner';
  }

  // ── Transmissão ──────────────────────────────────────────
  function transmit() {
    if (busy || !chosen) return;
    busy = true;
    const r = cur();
    const dropped = new Set(r.drop);
    const arrived = [];

    _c.querySelectorAll('.tp-mode').forEach(m => m.classList.add('locked'));
    const t = _c.querySelector('#tp-transmit');
    t.disabled = true; t.textContent = 'Transmitindo…'; t.classList.remove('go');

    renderPackets();
    renderSlots();
    setMeter('int', null);
    setMeter('lag', null);

    showBanner(chosen === 'tcp'
      ? '📦 TCP: cada pacote vai ser confirmado — segura aí…'
      : '⚡ UDP: disparando tudo de uma vez…', 'work');

    for (let n = 1; n <= N; n++) {
      const pk = _c.querySelector('#tp-pk-' + n);
      const base = (n - 1) * STAGGER;
      after(30 + base, () => { if (pk) pk.style.left = 'calc(100% - 22px)'; });
      if (dropped.has(n)) {
        // ao chegar na zona de interferência: trava o avanço e deixa o
        // pacote cair devagar, pra dar pra ver ele se perdendo ali.
        after(base + DROP_AT, () => {
          if (!pk) return;
          pk.style.left = getComputedStyle(pk).left;
          pk.style.transition = 'left .12s linear, transform .7s ease-in, opacity .7s ease-in';
          pk.classList.add('dropped');
        });
      } else {
        after(base + FLY, () => { arrived.push(n); land(n, arrived); });
      }
    }

    after(N * STAGGER + FLY + 500, () => {
      if (chosen === 'udp') finishUDP(r, arrived, dropped);
      else                  retransmitTCP(r, arrived, dropped);
    });
  }

  function land(n, arrived) {
    if (chosen === 'udp') {
      setSlot(n, 'filled');
      popSlot(n);
    } else {
      refreshTCPSlots(new Set(arrived));
    }
  }

  // TCP: só é "entregue" (verde) o prefixo contíguo a partir de 1;
  // o resto que já chegou fica "no buffer" (âmbar) esperando os atrasados.
  function refreshTCPSlots(set) {
    let contiguous = true;
    for (let k = 1; k <= N; k++) {
      if (set.has(k)) setSlot(k, contiguous ? 'filled' : 'buffered');
      else contiguous = false;
    }
  }

  function finishUDP(r, arrived, dropped) {
    dropped.forEach(n => setSlot(n, 'lost'));
    const pct = Math.round((arrived.length / N) * 100);
    setMeter('int', pct);
    setMeter('lag', 6);
    showBanner(`${dropped.size} pacote(s) perdido(s) — e ninguém volta pra buscar. Integridade ${pct}%.`,
      r.answer === 'udp' ? 'ok' : 'bad');
    after(950, () => verdict(r));
  }

  function retransmitTCP(r, arrived, dropped) {
    const set = new Set(arrived);
    refreshTCPSlots(set);
    const queue = [...dropped].sort((a, b) => a - b);
    let lag = 14;
    setMeter('lag', lag);

    const step = (i) => {
      if (i >= queue.length) {
        setMeter('int', 100);
        setMeter('lag', Math.min(100, lag));
        showBanner('✓ Todos os pacotes confirmados e entregues em ordem — integridade 100%.', 'ok');
        after(900, () => verdict(r));
        return;
      }
      const n = queue[i];
      showBanner(`⟳ Faltou o pacote ${n} — o destinatário pediu pra reenviar…`, 'work');
      lag += 24;
      setMeter('lag', Math.min(100, lag));

      const pk = _c.querySelector('#tp-pk-' + n);
      if (pk) {
        pk.classList.remove('dropped');
        pk.classList.add('resend');
        pk.style.transition = 'none';
        pk.style.left = '0px';
        void pk.offsetWidth;                       // reflow
        pk.style.transition = 'left .9s linear, opacity .3s ease, transform .3s ease';
        after(20, () => { pk.style.left = 'calc(100% - 22px)'; });
      }
      after(980, () => {
        set.add(n);
        refreshTCPSlots(set);
        popSlot(n);
        after(320, () => step(i + 1));
      });
    };
    step(0);
  }

  // ── Veredito ─────────────────────────────────────────────
  function verdict(r) {
    const res = r[chosen];
    const t   = _c.querySelector('#tp-transmit');

    if (res.ok) {
      _c.querySelectorAll('.tp-mode').forEach(m =>
        m.classList.toggle('correct', m.dataset.mode === chosen));
      const final = roundIdx === ROUNDS.length - 1;
      _c.dispatchEvent(new CustomEvent('transport-correct',
        { detail: { final, chosen, message: res.msg } }));

      if (final) {
        after(700, () => _c.dispatchEvent(new CustomEvent('transport-success')));
        busy = true;                               // trava até a próxima camada
      } else {
        chosen = null;
        awaitingNext = true;
        busy = false;
        t.textContent = 'Próxima transmissão →';
        t.disabled = false; t.classList.add('go');
      }
    } else {
      _c.querySelectorAll('.tp-mode').forEach(m => {
        if (m.dataset.mode === chosen) m.classList.add('wrong');
      });
      _c.dispatchEvent(new CustomEvent('transport-wrong', {
        detail: {
          chosen, answer: r.answer, message: res.msg,
          hint: r.answer === 'udp'
            ? 'Esses dados envelhecem rápido — parar tudo pra reenviar não compensa. Pense em UDP.'
            : 'Aqui não pode faltar nada: você precisa de confirmação e ordem. Pense em TCP.'
        }
      }));
      after(2200, () => {
        if (!_c) return;
        busy = false; chosen = null; awaitingNext = false;
        _c.querySelectorAll('.tp-mode').forEach(m =>
          m.classList.remove('sel', 'wrong', 'locked'));
        renderPackets();
        renderSlots();
        setMeter('int', null);
        setMeter('lag', null);
        hideBanner();
        t.textContent = 'Transmitir ▶';
        t.disabled = true; t.classList.remove('go');
      });
    }
  }

  // ── Dica ─────────────────────────────────────────────────
  function hintGlow() {
    if (!_c) return;
    const card = _c.querySelector('#tp-mode-' + cur().answer);
    card?.classList.add('hint-glow');
    setTimeout(() => card?.classList.remove('hint-glow'), 2800);
  }

  return { render, reset, hintGlow };
})();
