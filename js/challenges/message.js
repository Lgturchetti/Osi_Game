/* ═══════════════════════════════════════
   MESSAGE CHALLENGE (CAMADA 7 — APLICAÇÃO / "A MENSAGEM")
   O jogador manda uma mensagem no WhatsApp e acompanha a viagem dela:
   📱 Você → ☁️ Servidor → 📱 Bia. Em pontos-chave ele decide (perguntar
   pro DNS, o que o servidor faz quando o destino está offline, comprimir
   a foto…). O balão de mensagem vai mudando de estado:
     🕐 enviando · ✓ chegou no servidor · ✓✓ chegou no destino · ✓✓ azul = lida.
   3 rodadas: Bia online · Bia offline (store-and-forward) · foto no grupo.
═══════════════════════════════════════ */

const MessageChallenge = (() => {

  const ROUNDS = [
    { id:'online',  icon:'💬', title:'Conversa com a Bia',
      desc:'A Bia está <b>online</b> agora. Manda a mensagem e segue a viagem dela.',
      ctx:'E aí, novidades? 👀', text:'Bora no cinema hoje? 🍿',
      recipients:['Bia'] },
    { id:'offline', icon:'📵', title:'Conversa com a Bia',
      desc:'A Bia está <b>sem internet</b>. Vamos ver o que acontece com a mensagem.',
      ctx:'Tô quase chegando!', text:'Cheguei! Tô te esperando na porta 😅',
      recipients:['Bia'] },
    { id:'group',   icon:'👥', title:'Grupo “Cinerama”',
      desc:'Você vai mandar uma <b>foto de 8 MB</b> no grupo com a Bia, o Léo e a Ana.',
      ctx:'Bora marcar esse cine 🎬', text:'📷 Foto',
      recipients:['Bia','Léo','Ana'] },
  ];

  let _c=null, roundIdx=0, busy=false, timers=[];
  let checks='none';          // none | sending | one | two | read
  let pendingChoice=null;     // chave da decisão em aberto (pra dica)
  let awaitingNext=false;

  const after = (ms,fn)=>{ const t=setTimeout(fn,ms); timers.push(t); return t; };
  const emit  = (n,d)=>_c && _c.dispatchEvent(new CustomEvent(n,{detail:d}));
  const cur   = ()=>ROUNDS[roundIdx];
  const bubble= t=>emit('message-msg',t);

  function reset(){ _c=null; roundIdx=0; clearAll(); }
  function clearAll(){
    timers.forEach(clearTimeout); timers=[];
    checks='none'; busy=false; awaitingNext=false; pendingChoice=null;
  }

  // ── Render ───────────────────────────────────────────────
  function render(container){
    _c=container;
    clearAll();
    container.innerHTML=`
      <div class="msg-wrap" id="msg-wrap">
        <div class="msg-top">
          <div class="msg-round-badge">📱 Mensagem <strong id="msg-num">1</strong> de <strong>${ROUNDS.length}</strong></div>
          <div class="msg-scenario">
            <span class="msg-sc-icon" id="msg-sc-icon">💬</span>
            <span class="msg-sc-text"><strong class="msg-sc-title" id="msg-sc-title">—</strong><span id="msg-sc-desc"></span></span>
          </div>
        </div>

        <div class="msg-phone">
          <div class="msg-phone-head">
            <span id="msg-chat-name">Bia</span>
            <span class="msg-e2e-badge">🔒 ponta a ponta</span>
          </div>
          <div class="msg-chat" id="msg-chat"></div>
        </div>
        <div class="msg-e2e-note" id="msg-e2e-note"></div>

        <div class="msg-path">
          <div class="msg-path-track" id="msg-path-track">
            <div class="msg-node" id="msg-node-you"><span class="msg-node-ic">📱</span><span class="msg-node-lb">Você</span></div>
            <div class="msg-seg"><i class="msg-line" id="msg-line-1"></i></div>
            <div class="msg-node" id="msg-node-server"><span class="msg-node-ic">☁️</span><span class="msg-node-lb">Servidor</span></div>
            <div class="msg-seg"><i class="msg-line" id="msg-line-2"></i></div>
            <div class="msg-recipients" id="msg-recipients"></div>
            <div class="msg-envelope" id="msg-envelope">✉️</div>
          </div>
        </div>

        <div class="msg-callout" id="msg-callout" hidden></div>

        <div class="msg-stage" id="msg-stage"></div>
      </div>`;

    container.querySelector('#msg-stage').addEventListener('click', onStageClick);
    renderRound();
  }

  function onStageClick(e){
    const b=e.target.closest('button');
    if(!_c || !b || busy) return;
    const act=b.dataset.act;
    if(act==='send')      onSend();
    else if(act==='next') { roundIdx++; renderRound(); }
    else if(act==='choice') onChoice(b.dataset.key, b.dataset.opt, b.dataset.ok==='1');
  }

  function renderRound(){
    if(!_c) return;
    clearAll();
    const r=cur();
    _c.querySelector('#msg-num').textContent      = roundIdx+1;
    _c.querySelector('#msg-sc-icon').textContent  = r.icon;
    _c.querySelector('#msg-sc-title').textContent = r.title;
    _c.querySelector('#msg-sc-desc').innerHTML    = ' — ' + r.desc;

    const group=r.recipients.length>1;
    _c.querySelector('#msg-chat-name').textContent = group ? 'Grupo Cinerama' : r.recipients[0];
    _c.querySelector('#msg-e2e-note').innerHTML = group
      ? '🔒 Conversa criptografada de ponta a ponta — nem o servidor do WhatsApp consegue ler o conteúdo.'
      : `🔒 Conversa criptografada — nem o servidor lê. Só você e a ${r.recipients[0]} têm a chave.`;

    _c.querySelector('#msg-recipients').innerHTML = r.recipients.map((name,i)=>
      `<div class="msg-node msg-rcpt" id="msg-rcpt-${i}"><span class="msg-node-ic">📱</span><span class="msg-node-lb">${name}</span><i class="msg-rcpt-tick" id="msg-rcpt-tick-${i}"></i></div>`).join('');
    _c.querySelector('#msg-recipients').classList.toggle('group', group);

    renderChat();
    resetPath();
    _c.querySelector('#msg-callout').hidden=true;
    stageSend();
  }

  // ── Chat ─────────────────────────────────────────────────
  function renderChat(){
    const c=_c.querySelector('#msg-chat'); if(!c) return;
    const r=cur();
    let tick='';
    if(checks==='sending') tick='<span class="msg-tick pending">🕐</span>';
    else if(checks==='one') tick='<span class="msg-tick">✓</span>';
    else if(checks==='two') tick='<span class="msg-tick">✓✓</span>';
    else if(checks==='read')tick='<span class="msg-tick read">✓✓</span>';
    c.innerHTML=`
      <div class="msg-bubble in"><span class="msg-b-from">${r.recipients[0]}</span>${r.ctx}</div>
      <div class="msg-bubble out ${checks==='none'?'draft':''}">${r.text}<span class="msg-tick-wrap">${tick}</span></div>`;
  }

  // ── Trajeto ──────────────────────────────────────────────
  function resetPath(){
    if(!_c) return;
    ['msg-line-1','msg-line-2'].forEach(id=>{const e=_c.querySelector('#'+id); if(e) e.classList.remove('lit');});
    _c.querySelectorAll('.msg-rcpt').forEach(n=>n.classList.remove('has','read'));
    _c.querySelectorAll('.msg-node').forEach(n=>n.classList.remove('active'));
    const env=_c.querySelector('#msg-envelope');
    if(env){ env.style.transition='none'; env.style.left='4%'; env.style.opacity='0'; }
  }
  function litLine(id){ if(!_c)return; const e=_c.querySelector('#'+id); if(e) e.classList.add('lit'); }
  function activeNode(id,on){ if(!_c)return; const e=_c.querySelector('#msg-node-'+id); if(e) e.classList.toggle('active',on!==false); }

  function moveEnvelope(fromPct,toPct,dur,cb){
    const env=_c && _c.querySelector('#msg-envelope');
    if(!env){ after(dur,()=>cb&&cb()); return; }
    env.style.transition='none';
    env.style.left=fromPct+'%';
    env.style.opacity='1';
    void env.offsetWidth;
    env.style.transition=`left ${dur}ms cubic-bezier(.4,0,.2,1), opacity .3s ease`;
    after(20,()=>{ env.style.left=toPct+'%'; });
    after(dur+60,()=>cb&&cb());
  }

  function setChecks(v){ checks=v; renderChat(); }

  function calloutShow(html){
    const el=_c && _c.querySelector('#msg-callout');
    if(!el) return;
    el.hidden=false; el.innerHTML=html;
    if(el.animate) el.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:260});
  }

  // ── Stage (área de ação) ─────────────────────────────────
  function stageEl(){ return _c && _c.querySelector('#msg-stage'); }
  function stageSend(){
    const s=stageEl(); if(!s) return;
    s.innerHTML=`<button class="msg-send-btn" data-act="send" type="button">Enviar mensagem ➤</button>`;
  }
  function stageNext(){
    const s=stageEl(); if(!s) return;
    awaitingNext=true;
    s.innerHTML=`<button class="msg-send-btn go" data-act="next" type="button">Próxima mensagem →</button>`;
  }
  function stageWait(txt){
    const s=stageEl(); if(!s) return;
    s.innerHTML=`<div class="msg-waiting">${txt}</div>`;
  }
  function stageChoices(key,q,opts){
    const s=stageEl(); if(!s) return;
    pendingChoice=key;
    s.innerHTML=`
      <div class="msg-choice-q">${q}</div>
      <div class="msg-choices">
        ${opts.map(o=>`<button class="msg-choice" data-act="choice" data-key="${key}" data-opt="${o.opt}" data-ok="${o.ok?1:0}" type="button">${o.text}</button>`).join('')}
      </div>`;
  }

  // ── Fluxo ────────────────────────────────────────────────
  function onSend(){
    if(busy) return;
    busy=true;
    setChecks('sending');
    const r=cur();
    if(r.id==='online'){
      bubble('A mensagem precisa achar o servidor do WhatsApp primeiro.');
      after(500,()=>{
        busy=false;
        stageChoices('dns',
          'O app tem o nome “servidor do WhatsApp”, mas precisa do endereço na internet. O que fazer?',
          [{opt:'dns',   text:'🔍 Perguntar o endereço (IP) pro DNS',       ok:true},
           {opt:'direct',text:'Mandar a mensagem direto pro celular da Bia', ok:false},
           {opt:'guess', text:'Chutar um endereço pro servidor',            ok:false}]);
      });
    } else if(r.id==='offline'){
      bubble('O app já sabe onde fica o servidor. Enviando…');
      activeNode('you');
      moveEnvelope(6,50,1000,()=>{
        litLine('msg-line-1'); activeNode('you',false); activeNode('server');
        setChecks('one');
        bubble('✓ Um tiquinho: a mensagem chegou no SERVIDOR do WhatsApp — ainda não na Bia.');
        after(1400,()=>{
          busy=false;
          bubble('O servidor tentou entregar pra Bia… mas ela está sem internet. O que ele deve fazer?');
          stageChoices('offline',
            'A Bia está offline. O servidor deve:',
            [{opt:'hold',  text:'📥 Guardar a mensagem e entregar quando ela voltar', ok:true},
             {opt:'delete',text:'🗑️ Descartar a mensagem',                            ok:false},
             {opt:'retry', text:'🔁 Reenviar sem parar até ela aparecer',             ok:false}]);
        });
      });
    } else { // group
      bubble('Você vai mandar uma foto de 8 MB pro grupo. Antes de enviar…');
      after(400,()=>{
        busy=false;
        stageChoices('compress',
          'A foto tem 8 MB. O melhor é:',
          [{opt:'compress',text:'🗜️ Comprimir a foto antes de enviar',   ok:true},
           {opt:'raw',     text:'Mandar do jeito que está, 8 MB inteiros', ok:false}]);
      });
    }
  }

  function onChoice(key,opt,ok){
    if(busy) return;
    if(!ok){ wrongChoice(key,opt); return; }
    pendingChoice=null;
    busy=true;
    _c.querySelectorAll('.msg-choice').forEach(b=>{ b.disabled=true; if(b.dataset.opt===opt) b.classList.add('picked'); });

    if(key==='dns'){
      bubble('DNS respondeu: o servidor fica em 157.240.22.51. Bora!');
      after(600,()=>{
        activeNode('you');
        moveEnvelope(6,50,1000,()=>{
          litLine('msg-line-1'); activeNode('you',false); activeNode('server');
          setChecks('one');
          calloutShow('✓ <b>Um tiquinho:</b> a mensagem chegou no <b>servidor</b>. Ainda não na Bia.');
          bubble('Chegou no servidor. Agora ele entrega pra Bia, que está online.');
          after(1200,()=>{
            moveEnvelope(50,88,1000,()=>{
              litLine('msg-line-2'); activeNode('server',false);
              markRecipient(0,'has');
              setChecks('two');
              calloutShow('✓✓ <b>Dois tiquinhos:</b> chegou no celular da Bia.');
              bubble('Entregue! Faltam os tiquinhos ficarem azuis.');
              after(1300,()=>{
                markRecipient(0,'read');
                setChecks('read');
                calloutShow('✓✓ <b style="color:#53bdeb">azul:</b> a Bia abriu a conversa e <b>leu</b>. (Só fica azul aí, não antes.)');
                roundDone();
              });
            });
          });
        });
      });
    }

    else if(key==='offline'){
      calloutShow('⚠️ <b>Mito:</b> “um tiquinho só = fui bloqueado”. <b>Mentira!</b> A Bia só está sem internet. A mensagem fica <b>guardada no servidor</b>, esperando ela voltar — não some.');
      bubble('O servidor guardou a mensagem. Agora é esperar a Bia dar sinal de vida…');
      stageWait('⏳ Esperando a Bia voltar pra internet…');
      after(2400,()=>{
        bubble('A Bia voltou pra internet! O servidor entrega a mensagem que estava guardada.');
        moveEnvelope(50,88,1000,()=>{
          litLine('msg-line-2'); activeNode('server',false);
          markRecipient(0,'has');
          setChecks('two');
          calloutShow('✓✓ <b>Dois tiquinhos:</b> a Bia voltou e recebeu.');
          after(1300,()=>{
            markRecipient(0,'read');
            setChecks('read');
            calloutShow('✓✓ <b style="color:#53bdeb">azul:</b> lida.');
            roundDone();
          });
        });
      });
    }

    else if(key==='compress'){
      bubble('Foto comprimida pra ~800 KB — bem mais rápido e gasta menos dados de todo mundo. Enviando…');
      after(700,()=>{
        activeNode('you');
        moveEnvelope(6,50,1000,()=>{
          litLine('msg-line-1'); activeNode('you',false); activeNode('server');
          setChecks('one');
          calloutShow('✓ Chegou no servidor. Agora ele faz uma cópia pra <b>cada pessoa</b> do grupo.');
          bubble('Num grupo, o servidor entrega uma cópia pra cada um.');
          after(1100,()=>{
            litLine('msg-line-2');
            markRecipient(0,'has');
            after(500,()=>markRecipient(2,'has'));   // Ana
            after(1500,()=>{                          // Léo demora
              markRecipient(1,'has');
              activeNode('server',false);
              setChecks('two');
              calloutShow('✓✓ no grupo = <b>todo mundo</b> recebeu. O Léo demorou um pouco — o ✓✓ só aparece quando a <b>última</b> pessoa recebe.');
              bubble('Todo mundo recebeu. Faltam lerem.');
              after(1400,()=>{
                [0,1,2].forEach((i,k)=>after(k*260,()=>markRecipient(i,'read')));
                after(900,()=>{
                  setChecks('read');
                  calloutShow('✓✓ <b style="color:#53bdeb">azul</b> no grupo = todo mundo leu. (Dá pra tocar na mensagem e ver quem já viu.)');
                  roundDone();
                });
              });
            });
          });
        });
      });
    }
  }

  function markRecipient(i,cls){
    const n=_c && _c.querySelector('#msg-rcpt-'+i);
    if(!n) return;
    if(cls==='has') n.classList.add('has');
    if(cls==='read'){ n.classList.add('has','read'); }
  }

  function wrongChoice(key,opt){
    const MSG={
      'dns:direct':'Seu celular não sabe onde a Bia está agora — ela pode estar em qualquer rede do mundo. A mensagem SEMPRE vai primeiro pro servidor do WhatsApp, que sabe localizar cada usuário.',
      'dns:guess' :'Chutar endereço não funciona e mandaria a mensagem pro lugar errado. É pra isso que existe o DNS: você dá o nome, ele te devolve o número certo.',
      'offline:delete':'Aí você perderia a mensagem! O trabalho do servidor é justamente NÃO deixar isso acontecer — ele guarda até conseguir entregar.',
      'offline:retry' :'Reenviar sem parar só gastaria rede à toa. O servidor guarda a mensagem uma vez e espera a Bia aparecer — aí entrega.',
      'compress:raw'  :'8 MB inteiros iam demorar pra subir e ainda gastar os dados móveis de todo mundo do grupo pra baixar. O app comprime a foto antes justamente por isso.',
    };
    const HINT={
      dns:'A mensagem sempre passa pelo servidor. E pra achar o servidor pela internet, você precisa do endereço (IP) — quem dá isso é o DNS.',
      offline:'O servidor não desiste nem fica insistindo — ele guarda e espera.',
      compress:'Foto grande = demora e gasta dados. Dá pra deixar bem menor sem perder quase nada.',
    };
    emit('message-wrong',{ reason:key, message:MSG[key+':'+opt]||'Essa não é a melhor escolha. Tente outra.', hint:HINT[key] });
  }

  function roundDone(){
    busy=false;
    const final = roundIdx===ROUNDS.length-1;
    emit('message-correct',{ final, round:roundIdx+1 });
    if(final){ after(800,()=>emit('message-success')); }
    else stageNext();
  }

  // ── Dica ─────────────────────────────────────────────────
  function hintGlow(){
    if(!_c) return;
    let el;
    if(pendingChoice) el=_c.querySelector(`.msg-choice[data-key="${pendingChoice}"][data-ok="1"]`);
    else if(awaitingNext) el=_c.querySelector('#msg-stage [data-act="next"]');
    else el=_c.querySelector('#msg-stage [data-act="send"]');
    if(el){ el.classList.add('hint-glow'); setTimeout(()=>el.classList.remove('hint-glow'),2800); }
  }

  return { render, reset, hintGlow };
})();
