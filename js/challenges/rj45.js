const RJ45Challenge = (() => {

  const STANDARDS = {
    'T568B': [
      { id: 'wo', label: 'Branco-Laranja', color: '#ff8c00', stripe: '#ffffff' },
      { id: 'o',  label: 'Laranja',        color: '#ff6600', stripe: null      },
      { id: 'wg', label: 'Branco-Verde',   color: '#22bb44', stripe: '#ffffff' },
      { id: 'b',  label: 'Azul',           color: '#1a5fff', stripe: null      },
      { id: 'wb', label: 'Branco-Azul',    color: '#1a5fff', stripe: '#ffffff' },
      { id: 'g',  label: 'Verde',          color: '#22bb44', stripe: null      },
      { id: 'wm', label: 'Branco-Marrom',  color: '#8B4513', stripe: '#ffffff' },
      { id: 'm',  label: 'Marrom',         color: '#8B4513', stripe: null      },
    ],
    'T568A': [
      { id: 'wg', label: 'Branco-Verde',   color: '#22bb44', stripe: '#ffffff' },
      { id: 'g',  label: 'Verde',          color: '#22bb44', stripe: null      },
      { id: 'wo', label: 'Branco-Laranja', color: '#ff8c00', stripe: '#ffffff' },
      { id: 'b',  label: 'Azul',           color: '#1a5fff', stripe: null      },
      { id: 'wb', label: 'Branco-Azul',    color: '#1a5fff', stripe: '#ffffff' },
      { id: 'o',  label: 'Laranja',        color: '#ff6600', stripe: null      },
      { id: 'wm', label: 'Branco-Marrom',  color: '#8B4513', stripe: '#ffffff' },
      { id: 'm',  label: 'Marrom',         color: '#8B4513', stripe: null      },
    ],
  };

  let selectedStandard = 'T568B';
  let CORRECT_ORDER = STANDARDS['T568B'];

  let slots        = Array(8).fill(null);
  let crimpTried   = false;
  let hintUsed     = false;
  let slotResults  = Array(8).fill(null);
  let draggingId   = null;
  let draggingFrom = null; // 'tray' | slot index (number)
  let _container   = null;
  let done         = false; // cabo já crimpado com sucesso — trava tudo
  let lastFailKey  = null;  // ordem da última crimpagem errada

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── SVG ─────────────────────────────────────────────────

  function wireSVG(wire, w = 36, h = 80) {
    if (!wire) return '';
    const stripe = wire.stripe
      ? `<rect x="${w*0.28}" y="0" width="${w*0.44}" height="${h}" fill="rgba(255,255,255,0.52)" rx="1"/>`
      : '';
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="wgl${wire.id}${w}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="rgba(0,0,0,0.38)"/>
        <stop offset="22%"  stop-color="rgba(255,255,255,0.2)"/>
        <stop offset="50%"  stop-color="rgba(255,255,255,0.07)"/>
        <stop offset="78%"  stop-color="rgba(255,255,255,0.16)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.32)"/>
      </linearGradient></defs>
      <rect x="2" y="0" width="${w-4}" height="${h}" fill="${wire.color}" rx="3"/>
      ${stripe}
      <rect x="2" y="0" width="${w-4}" height="${h}" fill="url(#wgl${wire.id}${w})" rx="3"/>
      <rect x="2" y="0" width="${w-4}" height="4" fill="rgba(255,255,255,0.2)" rx="2"/>
    </svg>`;
  }

  function rj45SVG(slotArr, results) {
    const W=320, H=200, slotW=22, slotH=55, slotGap=4;
    const totalW = 8*slotW + 7*slotGap;
    const startX = (W - totalW) / 2;
    const slotY  = 88;

    let slotsSVG = '';
    for (let i = 0; i < 8; i++) {
      const x    = startX + i*(slotW+slotGap);
      const wire = slotArr[i] ? CORRECT_ORDER.find(w => w.id === slotArr[i]) : null;
      const res  = results ? results[i] : null;
      let stroke = 'rgba(255,255,255,0.12)';
      if (res === 'ok')  stroke = '#22dd66';
      if (res === 'err') stroke = '#ff3a4e';

      // slot is clickable to remove wire
      const clickHandler = wire ? `onclick="RJ45Challenge._clickSlot(${i})"` : '';
      const cursorStyle  = wire ? 'cursor:pointer;' : '';

      slotsSVG += `
        <g class="rj45-slot" id="rj45slot-${i}" data-slot="${i}"
           draggable="${wire ? 'true' : 'false'}"
           style="${cursorStyle}"
           ${clickHandler}>
          <rect x="${x}" y="${slotY}" width="${slotW}" height="${slotH}"
                fill="rgba(10,10,20,0.85)" stroke="${stroke}" stroke-width="1.5" rx="2"/>
          ${wire
            ? `<g transform="translate(${x+1},${slotY+1})">${wireSVG(wire, slotW-2, slotH-2)}</g>`
            : `<text x="${x+slotW/2}" y="${slotY+slotH/2+4}" text-anchor="middle"
                     fill="rgba(255,255,255,0.14)" font-size="10" font-family="monospace">${i+1}</text>`
          }
          ${res === 'ok'  ? `<text x="${x+slotW/2}" y="${slotY-4}" text-anchor="middle" font-size="9" fill="#22dd66">✓</text>` : ''}
          ${res === 'err' ? `<text x="${x+slotW/2}" y="${slotY-4}" text-anchor="middle" font-size="9" fill="#ff3a4e">✗</text>` : ''}
        </g>`;
    }

    let pins = '';
    for (let i = 0; i < 8; i++) {
      const x = startX + i*(slotW+slotGap) + slotW/2;
      pins += `<rect x="${x-3}" y="${slotY+slotH}" width="6" height="14" fill="#d4af37" rx="1"/>
               <rect x="${x-2}" y="${slotY+slotH+12}" width="4" height="3" fill="#b8960c" rx="0.5"/>`;
    }

    return `<svg id="rj45-svg" viewBox="0 0 ${W} ${H}" width="100%"
              xmlns="http://www.w3.org/2000/svg" style="max-width:380px;display:block;margin:0 auto;overflow:visible">
      <defs>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stop-color="#3a3a4a"/>
          <stop offset="40%"  stop-color="#28283a"/>
          <stop offset="100%" stop-color="#1a1a28"/>
        </linearGradient>
        <linearGradient id="latchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stop-color="#555566"/>
          <stop offset="100%" stop-color="#333344"/>
        </linearGradient>
        <filter id="bodyShadow"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.6)"/></filter>
      </defs>
      <rect x="30" y="50" width="${W-60}" height="120" rx="10"
            fill="url(#bodyGrad)" filter="url(#bodyShadow)"/>
      <rect x="30" y="50" width="${W-60}" height="120" rx="10"
            fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
      <rect x="32" y="51" width="${W-64}" height="3" rx="2" fill="rgba(255,255,255,0.2)"/>
      <rect x="${W/2-22}" y="38" width="44" height="18" rx="5"
            fill="url(#latchGrad)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      <rect x="${W/2-18}" y="41" width="36" height="4" rx="2" fill="rgba(255,255,255,0.12)"/>
      <rect x="${startX-4}" y="52" width="${totalW+8}" height="36"
            fill="rgba(0,0,0,0.4)" rx="4" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      ${slotsSVG}
      ${pins}
      <text x="${W/2}" y="178" text-anchor="middle"
            fill="rgba(255,255,255,0.28)" font-size="9"
            font-family="'Courier New',monospace" letter-spacing="1">RJ-45 · ${selectedStandard}</text>
    </svg>`;
  }

  function crimperSVG() {
    const col = '#9988ff';
    return `<svg viewBox="0 0 80 160" width="80" height="160" xmlns="http://www.w3.org/2000/svg"
              style="transition:filter .3s" id="crimper-svg">
      <defs>
        <linearGradient id="crimperBody" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="#2a2a3a"/>
          <stop offset="50%"  stop-color="#3a3a4e"/>
          <stop offset="100%" stop-color="#222230"/>
        </linearGradient>
        <linearGradient id="handleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="${col}88"/>
          <stop offset="50%"  stop-color="${col}cc"/>
          <stop offset="100%" stop-color="${col}88"/>
        </linearGradient>
      </defs>
      <path d="M15 30 L65 30 L70 55 L10 55 Z"
            fill="url(#crimperBody)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <rect x="22" y="38" width="36" height="10" rx="2"
            fill="rgba(0,0,0,0.4)" stroke="${col}44" stroke-width="1"/>
      ${Array.from({length:8},(_,i)=>`<rect x="${24+i*4.2}" y="40" width="2.5" height="6" fill="${col}88" rx="0.5"/>`).join('')}
      <circle cx="40" cy="60" r="6" fill="#1a1a2a" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <circle cx="40" cy="60" r="2.5" fill="${col}"/>
      <path d="M20 60 L18 130 L38 130 L40 60 Z"
            fill="url(#crimperBody)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      <path d="M60 60 L62 130 L42 130 L40 60 Z"
            fill="url(#crimperBody)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      ${Array.from({length:8},(_,i)=>`
        <rect x="21" y="${70+i*7}" width="16" height="3" rx="1.5" fill="url(#handleGrad)" opacity="0.7"/>
        <rect x="43" y="${70+i*7}" width="16" height="3" rx="1.5" fill="url(#handleGrad)" opacity="0.7"/>
      `).join('')}
      <text x="40" y="145" text-anchor="middle" fill="${col}99"
            font-size="7" font-family="'Exo 2',sans-serif" font-weight="800" letter-spacing="0.5">CRIMPER</text>
    </svg>`;
  }

  // ── Render ───────────────────────────────────────────────

  function render(container) {
    _container = container;
    const shuffled = shuffle(CORRECT_ORDER);

    container.innerHTML = `
      <div class="rj45-wrap" id="rj45-wrap">
        <div class="rj45-connector-area">
          <div class="rj45-label">Toque (ou arraste) os fios para os slots · toque num fio no conector para remover</div>
          <div id="rj45-svg-wrap">${rj45SVG(slots, slotResults)}</div>
        </div>
        <div class="rj45-bottom">
          <div class="wire-tray">
            <div class="tray-label">🧰 Fios — toque para encaixar (ou arraste para um slot)</div>
            <div class="tray-wires" id="tray-wires">
              ${shuffled.map(w => `
                <div class="tray-wire" id="tray-${w.id}" data-wire="${w.id}" draggable="true" title="${w.label}">
                  ${wireSVG(w, 22, 54)}
                  <span class="tray-wire-label">${w.label}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="toolbox">
            <div class="tray-label">🔧 Ferramentas</div>
            <div class="toolbox-inner">
              <div class="tool-item" id="crimper-tool" title="Crimper — toque (ou arraste até o conector) para crimpar">
                ${crimperSVG()}
                <span class="tool-label">Toque p/ crimpar</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    attachEvents(container);
  }

  // ── Events ───────────────────────────────────────────────

  function attachEvents(container) {
    // drag from tray + click-to-place
    container.querySelectorAll('.tray-wire').forEach(el => {
      el.addEventListener('dragstart', e => {
        draggingId   = el.dataset.wire;
        draggingFrom = 'tray';
        e.dataTransfer.setData('text/plain', el.dataset.wire);
        setTimeout(() => el.classList.add('dragging'), 0);
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));

      // click → place in next free slot (left to right)
      el.addEventListener('click', () => {
        const wid = el.dataset.wire;
        const nextFree = slots.indexOf(null);
        if (nextFree === -1) return; // all slots full
        draggingFrom = 'tray';
        draggingId   = wid;
        dropWireToSlot(wid, nextFree, container);
      });
    });

    // drag from slot (SVG g element)
    container.addEventListener('dragstart', e => {
      const g = e.target.closest('[data-slot]');
      if (g && !e.target.closest('.tray-wire')) {
        const idx = parseInt(g.dataset.slot);
        if (slots[idx] !== null) {
          draggingId   = slots[idx];
          draggingFrom = idx;
          e.dataTransfer.setData('text/plain', slots[idx]);
        }
      }
    });

    // drop back to tray
    const tray = container.querySelector('#tray-wires');
    tray.addEventListener('dragover', e => { e.preventDefault(); tray.classList.add('drag-over'); });
    tray.addEventListener('dragleave', () => tray.classList.remove('drag-over'));
    tray.addEventListener('drop', e => {
      e.preventDefault(); tray.classList.remove('drag-over');
      if (typeof draggingFrom === 'number') {
        returnSlotToTray(draggingFrom, container);
      }
    });

    // crimper — drag-to-connector to crimp (no longer click)
    const crimper = container.querySelector('#crimper-tool');
    crimper.setAttribute('draggable', 'true');
    crimper.style.cursor = 'grab';

    crimper.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', '__crimper__');
      draggingId   = '__crimper__';
      draggingFrom = 'crimper';
      crimper.style.filter = 'drop-shadow(0 0 12px #e8a33d)';
    });
    crimper.addEventListener('dragend', () => {
      crimper.style.filter = '';
      draggingId   = null;
      draggingFrom = null;
    });

    // tap-to-crimp (touch / mouse click) — mesma ação do arrastar até o conector
    crimper.addEventListener('click', () => tryCrimp(container));

    // accept crimper drop on the connector area (svgWrap) or the whole rj45-connector-area
    const svgWrap = container.querySelector('#rj45-svg-wrap');
    const connectorArea = container.querySelector('.rj45-connector-area');
    [svgWrap, connectorArea].forEach(target => {
      target.addEventListener('dragover', e => {
        if (draggingId === '__crimper__') e.preventDefault();
        else {
          const g = e.target.closest('[data-slot]');
          if (g) e.preventDefault();
        }
      });
      target.addEventListener('drop', e => {
        const data = e.dataTransfer.getData('text/plain');
        if (data === '__crimper__') {
          e.preventDefault();
          tryCrimp(container);
          return;
        }
        const g = e.target.closest('[data-slot]');
        if (!g) return;
        e.preventDefault();
        const wid = data;
        const idx = parseInt(g.dataset.slot);
        dropWireToSlot(wid, idx, container);
      });
    });
  }

  // called from SVG onclick (global scope via exposed method)
  function _clickSlot(idx) {
    if (!_container) return;
    if (slots[idx] === null) return;
    returnSlotToTray(idx, _container);
  }

  function returnSlotToTray(idx, container) {
    if (done) return;
    const wid = slots[idx];
    if (!wid) return;
    slots[idx]       = null;
    slotResults[idx] = null;
    showTrayWire(wid, container);
    refreshConnector(container);
    draggingId   = null;
    draggingFrom = null;
  }

  function dropWireToSlot(wid, idx, container) {
    if (done) return;
    // if slot occupied, return old wire to tray
    if (slots[idx] !== null) {
      showTrayWire(slots[idx], container);
    }
    // if wire came from another slot, clear it
    if (typeof draggingFrom === 'number' && draggingFrom !== idx) {
      slots[draggingFrom]       = null;
      slotResults[draggingFrom] = null;
    }
    slots[idx]       = wid;
    slotResults[idx] = null;
    hideTrayWire(wid, container);
    refreshConnector(container);
    draggingId   = null;
    draggingFrom = null;
  }

  function hideTrayWire(wid, container) {
    const el = container.querySelector(`#tray-${wid}`);
    if (el) el.style.display = 'none';
  }
  function showTrayWire(wid, container) {
    const el = container.querySelector(`#tray-${wid}`);
    if (el) el.style.display = '';
  }

  function refreshConnector(container) {
    const wrap = container.querySelector('#rj45-svg-wrap');
    if (wrap) wrap.innerHTML = rj45SVG(slots, slotResults);
  }

  // ── Crimp ────────────────────────────────────────────────

  function tryCrimp(container) {
    if (done) return;
    if (slots.some(s => s === null)) {
      container.dispatchEvent(new CustomEvent('rj45-msg',
        { detail: 'Preencha todos os 8 slots antes de crimpar!' }));
      return;
    }

    // mesma montagem errada de novo (ex.: clique duplo) não custa outra vida
    const key = slots.join(',');
    if (key === lastFailKey) {
      container.dispatchEvent(new CustomEvent('rj45-msg',
        { detail: 'Essa montagem já foi testada e está errada — troque algum fio antes de crimpar de novo.' }));
      return;
    }

    crimpTried = true;
    hintUsed   = false;

    let allOk = true;
    for (let i = 0; i < 8; i++) {
      const ok   = CORRECT_ORDER[i].id === slots[i];
      slotResults[i] = ok ? 'ok' : 'err';
      if (!ok) allOk = false;
    }

    refreshConnector(container);
    flashCrimper(container, allOk);

    if (allOk) {
      done = true;
      animateCrimp(container);
      // SHORT delay so player sees the green flash, then fire success
      setTimeout(() => {
        container.dispatchEvent(new CustomEvent('rj45-success'));
      }, 900);
    } else {
      lastFailKey = key;
      container.dispatchEvent(new CustomEvent('rj45-fail'));
    }
  }

  function flashCrimper(container, ok) {
    const svg = container.querySelector('#crimper-svg');
    if (!svg) return;
    const col = ok ? '#4f9d69' : '#c4554d';
    svg.style.filter = `drop-shadow(0 0 18px ${col})`;
    setTimeout(() => { svg.style.filter = ''; }, 900);
  }

  function animateCrimp(container) {
    const svg = container.querySelector('#crimper-svg');
    if (!svg) return;
    svg.animate(
      [{ transform:'translateY(0) scaleY(1)' },
       { transform:'translateY(14px) scaleY(0.86)' },
       { transform:'translateY(0) scaleY(1)' }],
      { duration:380, easing:'cubic-bezier(.4,0,.2,1)' }
    );
  }

  // ── Hint ─────────────────────────────────────────────────

  function getHint() {
    if (!crimpTried || hintUsed) return null;
    for (let i = 0; i < 8; i++) {
      if (slotResults[i] === 'err') {
        hintUsed = true;
        return {
          slot:           i + 1,
          actual:         CORRECT_ORDER.find(w => w.id === slots[i])?.label ?? '(vazio)',
          expected:       CORRECT_ORDER[i].label,
          actualColor:    CORRECT_ORDER.find(w => w.id === slots[i])?.color ?? '#888',
          expectedColor:  CORRECT_ORDER[i].color,
          actualStripe:   CORRECT_ORDER.find(w => w.id === slots[i])?.stripe ?? null,
          expectedStripe: CORRECT_ORDER[i].stripe,
        };
      }
    }
    return null;
  }

  // ── Reset ─────────────────────────────────────────────────

  function setStandard(std) {
    if (STANDARDS[std]) {
      selectedStandard = std;
      CORRECT_ORDER = STANDARDS[std];
    }
  }

  function reset() {
    slots        = Array(8).fill(null);
    slotResults  = Array(8).fill(null);
    crimpTried   = false;
    hintUsed     = false;
    draggingId   = null;
    draggingFrom = null;
    _container   = null;
    done         = false;
    lastFailKey  = null;
  }

  return { render, reset, getHint, _clickSlot, CORRECT_ORDER, setStandard, STANDARDS };
})();
