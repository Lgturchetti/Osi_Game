const Tux = (() => {
  const BODY=`<ellipse cx="60" cy="95" rx="38" ry="44" fill="#111"/><ellipse cx="60" cy="105" rx="22" ry="29" fill="#f5f0e8"/><ellipse cx="25" cy="88" rx="11" ry="27" fill="#111" transform="rotate(-15 25 88)"/><ellipse cx="95" cy="88" rx="11" ry="27" fill="#111" transform="rotate(15 95 88)"/><ellipse cx="44" cy="136" rx="14" ry="7" fill="#f5a623" transform="rotate(-10 44 136)"/><ellipse cx="76" cy="136" rx="14" ry="7" fill="#f5a623" transform="rotate(10 76 136)"/>`;
  const HEAD=`<ellipse cx="60" cy="48" rx="32" ry="30" fill="#111"/><ellipse cx="60" cy="52" rx="20" ry="20" fill="#f5f0e8"/><ellipse cx="60" cy="63" rx="9" ry="5" fill="#f5a623"/>`;
  const EYES={
    normal:`<circle cx="51" cy="46" r="6" fill="white"/><circle cx="69" cy="46" r="6" fill="white"/><circle cx="52" cy="47" r="3.5" fill="#111"/><circle cx="70" cy="47" r="3.5" fill="#111"/><circle cx="53" cy="46" r="1.2" fill="white"/><circle cx="71" cy="46" r="1.2" fill="white"/>`,
    happy:`<path d="M44 48 Q51 40 58 48" stroke="#111" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M62 48 Q69 40 76 48" stroke="#111" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    superHappy:`<path d="M42 50 Q51 38 60 50" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M60 50 Q69 38 78 50" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    sad:`<circle cx="51" cy="48" r="6" fill="white"/><circle cx="69" cy="48" r="6" fill="white"/><circle cx="51" cy="50" r="3.5" fill="#111"/><circle cx="69" cy="50" r="3.5" fill="#111"/><path d="M44 42 Q51 46 57 43" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M63 43 Q69 46 76 42" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    think:`<circle cx="51" cy="46" r="6" fill="white"/><circle cx="69" cy="46" r="6" fill="white"/><circle cx="53" cy="46" r="3.5" fill="#111"/><circle cx="71" cy="46" r="3.5" fill="#111"/><path d="M44 40 Q51 37 57 40" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    wow:`<circle cx="51" cy="46" r="8" fill="white"/><circle cx="69" cy="46" r="8" fill="white"/><circle cx="51" cy="46" r="4.5" fill="#111"/><circle cx="69" cy="46" r="4.5" fill="#111"/><circle cx="52" cy="44" r="1.8" fill="white"/><circle cx="70" cy="44" r="1.8" fill="white"/>`,
    wink:`<path d="M44 48 Q51 41 58 48" stroke="#111" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="69" cy="46" r="6" fill="white"/><circle cx="70" cy="47" r="3.5" fill="#111"/><circle cx="71" cy="46" r="1.2" fill="white"/>`,
  };
  const MOUTHS={
    normal:`<path d="M53 66 Q60 70 67 66" stroke="#d4891a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    big:`<path d="M50 64 Q60 75 70 64" stroke="#d4891a" stroke-width="2.5" fill="#f5a623" stroke-linecap="round"/>`,
    huge:`<path d="M47 63 Q60 78 73 63" stroke="#d4891a" stroke-width="2.5" fill="#f5a623" stroke-linecap="round"/><path d="M52 66 Q60 73 68 66" fill="#c0392b" stroke="none"/>`,
    sad:`<path d="M53 70 Q60 64 67 70" stroke="#d4891a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    open:`<ellipse cx="60" cy="67" rx="8" ry="6" fill="#d4891a"/>`,
    smirk:`<path d="M54 66 Q62 70 68 65" stroke="#d4891a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  };
  const CHEEKS=`<circle cx="41" cy="57" r="7" fill="#ff6b8a" opacity="0.4"/><circle cx="79" cy="57" r="7" fill="#ff6b8a" opacity="0.4"/>`;
  const SWEAT=`<ellipse cx="88" cy="32" rx="5" ry="8" fill="#74b9ff" opacity="0.85"/>`;
  const STARS=`<text x="18" y="28" font-size="14" opacity=".9">⭐</text><text x="88" y="28" font-size="14" opacity=".9">⭐</text>`;
  const BANG=`<text x="83" y="22" font-size="18" fill="#ffd32a">!</text>`;
  const PRESETS={
    idle:{eyes:'normal',mouth:'normal'},happy:{eyes:'happy',mouth:'big',cheeks:true},
    superHappy:{eyes:'superHappy',mouth:'huge',cheeks:true,acc:STARS},
    sad:{eyes:'sad',mouth:'sad',acc:SWEAT},think:{eyes:'think',mouth:'smirk'},
    wow:{eyes:'wow',mouth:'open',acc:BANG},wink:{eyes:'wink',mouth:'big',cheeks:true},
    celebrate:{eyes:'superHappy',mouth:'huge',cheeks:true,acc:STARS},
    worried:{eyes:'sad',mouth:'open',acc:SWEAT},
  };
  function make(preset='idle',size=110){const p=PRESETS[preset]||PRESETS.idle;return `<svg viewBox="0 0 120 150" width="${size}" height="${Math.round(size*150/120)}" xmlns="http://www.w3.org/2000/svg">${BODY}${HEAD}${EYES[p.eyes]}${MOUTHS[p.mouth]}${p.cheeks?CHEEKS:''}${p.acc||''}</svg>`;}
  function render(id,preset,size){const el=document.getElementById(id);if(el)el.innerHTML=make(preset,size);}
  function pop(id){const el=document.getElementById(id);if(!el)return;el.animate([{transform:'scale(1)'},{transform:'scale(1.2)'},{transform:'scale(1)'}],{duration:320,easing:'cubic-bezier(.34,1.56,.64,1)'});}
  function bounce(id){const el=document.getElementById(id);if(!el)return;el.animate([{transform:'translateY(0)'},{transform:'translateY(-14px)'},{transform:'translateY(0)'},{transform:'translateY(-7px)'},{transform:'translateY(0)'}],{duration:650,easing:'ease-in-out'});}
  function shake(id){const el=document.getElementById(id);if(!el)return;el.animate([{transform:'translateX(0)'},{transform:'translateX(-10px)'},{transform:'translateX(10px)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:400,easing:'ease-in-out'});}
  return{render,pop,bounce,shake};
})();
