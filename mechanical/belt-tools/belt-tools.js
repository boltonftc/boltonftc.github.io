/* /mechanical/belt-tools/ — three solvers sharing one diagram. Mode lives in the URL hash
   (#wizard, #find-belt, #center-distance) so old links and bookmarks land on the right tool. */
(function(){
  "use strict";
  const BC = window.BeltCore, fmt = BC.fmt, PITCH = BC.PITCH;
  const $ = id => document.getElementById(id);
  const draw = BC.makeDrawer($('bc-svg'), { animate: true });
  const out = $('bt-out'), how = $('bt-how');
  const MODES = ['wizard', 'find-belt', 'center-distance'];
  let mode = 'wizard';

  const stat = (label, value, hi) => `<div class="bc-stat${hi ? ' hi' : ''}"><small>${label}</small><b>${value}</b></div>`;
  const signed = (x, d) => (x >= 0 ? '+' : '') + fmt(x, d);

  /* ---------- 01 · design it ---------- */
  const oRatio=$('o-ratio'), oC=$('o-c'), oCtol=$('o-ctol'), oRtol=$('o-rtol'), oTmin=$('o-tmin'), oTmax=$('o-tmax');
  function runWizard(){
    const targR=+oRatio.value, targC=+oC.value, cTol=+oCtol.value, rTol=+oRtol.value/100,
          tmin=Math.max(8,+oTmin.value|0), tmax=Math.max(+oTmin.value|0,+oTmax.value|0);
    how.innerHTML = '<b>How it works.</b> For every pulley pair in your tooth range whose ratio is within tolerance, it works out the belt length needed at your target spacing and checks it against every real goBILDA belt. Each real belt fixes the geometry, so it calculates the exact center distance that belt needs and keeps the ones inside your tolerance. Results are ranked by how close they land to your target spacing, then by ratio. Click a row to see it in the diagram.';
    if (!(targR>0&&targC>0&&tmax>=tmin)){ out.innerHTML='<div class="bc-err">Check your inputs: ratio and center distance must be above 0, and max teeth must be at least min teeth.</div>'; return; }
    const tR = targR>=1?targR:1/targR;
    const results=[];
    for (let n1=tmin;n1<=tmax;n1++){
      for (let n2=n1;n2<=tmax;n2++){
        const ratio = n2/n1;
        if (Math.abs(ratio-tR) > tR*rTol) continue;
        for (const b of BC.BELTS){
          const C = BC.centerFor(n1,n2,b.t);
          if (C==null || C < BC.minCenter(n1,n2)) continue;
          const dC = C - targC;
          if (Math.abs(dC) > cTol) continue;
          results.push({ n1, n2, ratio, b, C, dC, wrap: BC.smallWrap(n1,n2,C) });
        }
      }
    }
    results.sort((a,b)=> Math.abs(a.dC)-Math.abs(b.dC) || Math.abs(a.ratio-tR)-Math.abs(b.ratio-tR));
    if (!results.length){
      out.innerHTML='<div class="bc-warn">Nothing fits. Open <b>Tolerances &amp; pulley range</b> and widen the tolerances or the tooth range.</div>';
      draw(tmin, Math.round(tmin*tR), targC, '');
      return;
    }
    const top = results.slice(0,30), best = top[0];
    let html = stats([
      ['Best pulleys', `${best.n1}T : ${best.n2}T`, true],
      ['Belt', `${best.b.t}T`],
      ['Center distance', `${fmt(best.C,1)} mm`],
      ['Off target by', `${signed(best.dC,1)} mm`]
    ]);
    html += `<h3>Matches <small>${results.length} found · closest ${top.length} shown · click a row to preview</small></h3>`;
    html += `<div class="dtable-wrap"><table class="dtable bc-tbl"><thead><tr>`
      + `<th>Pulleys</th><th class="num">Ratio</th><th class="num">Ratio off</th><th>Belt</th><th>SKU</th><th class="num">Center C</th><th class="num">Off target</th><th class="num">Wrap</th></tr></thead><tbody>`;
    top.forEach((r,i)=>{
      const rPct = (r.ratio-tR)/tR*100;
      html += `<tr class="${i===0?'sel':''}" data-n1="${r.n1}" data-n2="${r.n2}" data-c="${r.C}">`
        + `<td>${r.n1}T : ${r.n2}T</td><td class="num">${fmt(r.ratio,3)}</td><td class="num">${signed(rPct,1)}%</td>`
        + `<td>${r.b.t}T · ${r.b.mm} mm</td><td>${BC.skuCell(r.b)}</td>`
        + `<td class="num">${fmt(r.C,2)} mm</td><td class="num">${signed(r.dC,2)} mm</td><td class="num">${fmt(r.wrap,0)}&deg;</td></tr>`;
    });
    out.innerHTML = html + `</tbody></table></div>`;
    draw(best.n1,best.n2,best.C,`${best.n1}T : ${best.n2}T with a ${best.b.t}T belt`);
  }

  /* ---------- 02 · find a belt ---------- */
  const fN1=$('f-n1'), fN2=$('f-n2'), fC=$('f-c');
  function runFind(){
    const N1=+fN1.value, N2=+fN2.value, C=+fC.value;
    how.innerHTML = '<b>How it works.</b> From your pulleys and spacing it works out the <i>ideal</i> belt length, then checks every goBILDA belt and calculates the exact spacing each one needs. The difference is how far you\'d move a shaft. Rule of thumb: <b>round up</b> to the next belt (slightly loose, take up slack with a tensioner). Never round down, or the belt will be too tight.';
    if (!(N1>=8&&N2>=8&&C>0)){ out.innerHTML='<div class="bc-err">Enter pulley teeth of at least 8 and a center distance.</div>'; return; }
    const Zi = BC.idealTeeth(N1,N2,C);
    const ratio = Math.max(N1,N2)/Math.min(N1,N2);
    const rows = BC.BELTS.map(b => { const Cb = BC.centerFor(N1,N2,b.t); return { b, Cb, dC:(Cb==null?null:Cb-C) }; })
      .filter(r => r.Cb!=null).sort((a,b)=> Math.abs(a.dC)-Math.abs(b.dC));
    const near = rows.slice(0,4).sort((a,b)=> a.b.t-b.b.t);
    const rec = BC.BELTS.find(b => b.t >= Math.ceil(Zi));
    let html = stats([
      ['Ideal belt', `${fmt(Zi,1)}T`, true],
      ['Ideal length', `${fmt(Zi*PITCH,1)} mm`],
      ['Ratio', `${fmt(ratio,3)} : 1`],
      ['Round up to', rec ? `${rec.t}T` : '—']
    ]);
    html += BC.wrapNote(N1,N2,C);
    html += `<h3>Nearest stock belts <small>and the shaft move to fit each · click a row to preview</small></h3>`;
    html += `<div class="dtable-wrap"><table class="dtable bc-tbl"><thead><tr><th>Belt</th><th class="num">Pitch length</th><th>SKU</th><th class="num">Exact C</th><th class="num">Move shaft</th></tr></thead><tbody>`;
    near.forEach(r=>{
      const isRec = rec && r.b.t===rec.t;
      html += `<tr class="${isRec?'rec':''}" data-n1="${N1}" data-n2="${N2}" data-c="${r.Cb}">`
        + `<td>${r.b.t}T${isRec?'<span class="bc-pill">Round up</span>':''}</td><td class="num">${r.b.mm} mm</td><td>${BC.skuCell(r.b)}</td>`
        + `<td class="num">${fmt(r.Cb,2)} mm</td><td class="num">${signed(r.dC,2)} mm ${r.dC>=0?'farther':'closer'}</td></tr>`;
    });
    out.innerHTML = html + `</tbody></table></div>`;
    draw(N1,N2,C,`Ideal ${fmt(Zi,1)}T at C = ${fmt(C,1)} mm`);
  }

  /* ---------- 03 · place the shafts ---------- */
  const pN1=$('p-n1'), pN2=$('p-n2'), pBelt=$('p-belt');
  BC.BELTS.forEach(b => { const o=document.createElement('option'); o.value=b.t; o.textContent=`${b.t}T · ${b.mm} mm · ${b.sku}`; pBelt.appendChild(o); });
  pBelt.value = 132;
  function runCenter(){
    const N1=+pN1.value, N2=+pN2.value, Z=+pBelt.value;
    how.innerHTML = '<b>How it works.</b> A belt of fixed length around two known pulleys can only sit at one center-to-center distance. This solves that geometry exactly, and reports each pulley\'s pitch diameter and the wrap angle on the smaller pulley. Keep the wrap above about 120&deg; so teeth don\'t skip under load.';
    if (!(N1>=8&&N2>=8)){ out.innerHTML='<div class="bc-err">Enter pulley teeth of at least 8.</div>'; return; }
    const b = BC.BELTS.find(x=>x.t===Z);
    const C = BC.centerFor(N1,N2,Z);
    if (C==null){
      out.innerHTML=`<div class="bc-err">A ${Z}T belt is too short to wrap a ${N1}T and a ${N2}T pulley. Pick a longer belt.</div>`;
      draw(N1,N2,BC.minCenter(N1,N2)*1.5,'');
      return;
    }
    const mC = BC.minCenter(N1,N2);
    let html = stats([
      ['Center distance', `${fmt(C,2)} mm`, true],
      ['Ratio', `${fmt(Math.max(N1,N2)/Math.min(N1,N2),3)} : 1`],
      ['P1 pitch ⌀', `${fmt(BC.pitchDia(N1),2)} mm`],
      ['P2 pitch ⌀', `${fmt(BC.pitchDia(N2),2)} mm`],
      ['Small-pulley wrap', `${fmt(BC.smallWrap(N1,N2,C),0)}&deg;`]
    ]);
    html += `<p>Belt: ${BC.skuCell(b)} &nbsp;<span class="muted">${b.t}T · ${b.mm} mm pitch length</span></p>`;
    if (C < mC) html += `<div class="bc-err">That spacing (${fmt(C,1)} mm) is less than ${fmt(mC,1)} mm, where the pulleys would touch. You can't build it. Use a longer belt.</div>`;
    html += BC.wrapNote(N1,N2,C);
    out.innerHTML = html;
    draw(N1,N2,C,`${b.t}T belt → C = ${fmt(C,2)} mm`);
  }

  function stats(list){
    return `<div class="bc-stats">${list.map(s => stat(s[0], s[1], s[2])).join('')}</div>`;
  }

  /* ---------- modes ---------- */
  const RUN = { 'wizard': runWizard, 'find-belt': runFind, 'center-distance': runCenter };
  function setMode(m, push){
    if (MODES.indexOf(m) < 0) m = 'wizard';
    mode = m;
    MODES.forEach(x => {
      $('panel-' + x).hidden = x !== m;
      $('tab-' + x).setAttribute('aria-selected', x === m ? 'true' : 'false');
    });
    if (push && location.hash !== '#' + m) history.replaceState(null, '', '#' + m);
    RUN[m]();
  }
  document.querySelectorAll('.bt-mode').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode, true)));
  window.addEventListener('hashchange', () => setMode(location.hash.slice(1), false));

  [oRatio,oC,oCtol,oRtol,oTmin,oTmax].forEach(el=>el.addEventListener('input', runWizard));
  [fN1,fN2,fC].forEach(el=>el.addEventListener('input', runFind));
  [pN1,pN2,pBelt].forEach(el=>el.addEventListener('input', runCenter));
  BC.initInteractions(draw);

  const rtb = document.querySelector('#ref-tbl tbody');
  BC.BELTS.forEach(b => rtb.insertAdjacentHTML('beforeend',
    `<tr><td class="num">${b.t}T</td><td class="num">${b.mm} mm</td><td>${BC.skuCell(b)}</td></tr>`));

  setMode(location.hash.slice(1), false);
})();
