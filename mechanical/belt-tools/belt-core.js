/* Shared core for the GT2 2mm belt tools: catalog, math, live diagram (styled by belt.css). */
(function(){
  "use strict";
  const PITCH = 2;            // mm per tooth (GT2 2mm pitch)
  const PI = Math.PI;

  // goBILDA 2mm GT2 continuous-loop belts. teeth -> SKU (pitch length mm = teeth*2)
  const BELTS = [
    44,68,92,108,116,132,140,156,164,180,188,204,209,212,228,233,236,252,257,276,300,324
  ].map(t => ({ t, mm: t*2, sku: '3423-0006-' + String(t*2).padStart(4,'0') }));

  const beltURL = b => `https://www.gobilda.com/2mm-pitch-gt2-timing-belt-6mm-width-${b.mm}mm-pitch-length-${b.t}-tooth/`;

  // ── math ────────────────────────────────────────
  const pitchDia = N => N * PITCH / PI;                       // mm
  function beltLen(N1, N2, C){
    const D1 = pitchDia(N1), D2 = pitchDia(N2);
    return 2*C + (PI/2)*(D1+D2) + Math.pow(D1-D2,2)/(4*C);    // mm
  }
  const idealTeeth = (N1,N2,C) => beltLen(N1,N2,C)/PITCH;
  function centerFor(N1, N2, Z){                              // C for a Z-tooth belt (positive root)
    const D1 = pitchDia(N1), D2 = pitchDia(N2), L = Z*PITCH;
    const b = (PI*(D1+D2)/2) - L;
    const c = Math.pow(D1-D2,2)/4;
    const disc = b*b - 8*c;
    if (disc < 0) return null;
    const C = (-b + Math.sqrt(disc)) / 4;
    return C > 0 ? C : null;
  }
  function smallWrap(N1, N2, C){                              // wrap angle (deg) on smaller pulley
    const D1 = pitchDia(N1), D2 = pitchDia(N2);
    const arg = Math.abs(D1-D2)/(2*C);
    if (arg >= 1) return 0;
    return (PI - 2*Math.asin(arg)) * 180/PI;
  }
  const minCenter = (N1,N2) => (pitchDia(N1)+pitchDia(N2))/2; // pulleys touching (hard floor)
  const fmt = (x,d=1) => (Math.round(x*Math.pow(10,d))/Math.pow(10,d)).toFixed(d);

  function skuCell(b){
    return `<span class="bc-sku"><a href="${beltURL(b)}" target="_blank" rel="noopener">${b.sku}</a>`
      + `<button type="button" class="copy-btn" data-sku="${b.sku}">copy</button></span>`;
  }
  function wrapNote(N1,N2,C){
    const w = smallWrap(N1,N2,C);
    if (w < 90)  return `<div class="bc-warn">Wrap on the small pulley is only ${fmt(w,0)}&deg;. That's very low, so expect teeth to skip. Move the pulleys farther apart or add an idler.</div>`;
    if (w < 120) return `<div class="bc-warn">Wrap on the small pulley is ${fmt(w,0)}&deg;. Below about 120&deg; the belt can skip teeth under load. Consider an idler.</div>`;
    return '';
  }

  // ── diagram (bound to one <svg>); opts.animate runs the belt + pulleys at one surface speed ──
  const SEC_PER_TOOTH = 0.12;
  const still = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function makeDrawer(svg, opts){
    const VW = 640, VH = 340, PAD = 46;
    const animate = !!(opts && opts.animate) && !still();
    return function draw(N1, N2, C, note){
      const r1 = pitchDia(N1)/2, r2 = pitchDia(N2)/2;         // mm
      if (!(C > 0) || !isFinite(C) || C <= Math.abs(r1-r2)){
        svg.innerHTML = `<text class="bc-t-err" x="${VW/2}" y="${VH/2}" text-anchor="middle">Center distance is too small for these pulleys.</text>`;
        return;
      }
      const spanX = C + r1 + r2, spanY = 2*Math.max(r1,r2);
      const S = Math.min((VW-2*PAD)/spanX, (VH-2*PAD-40)/spanY);
      const R1 = r1*S, R2 = r2*S, d = C*S;                   // px
      const c1x = PAD + R1, c1y = (VH-40)/2 + 6, c2x = c1x + d;
      const pitchPx = PITCH*S;

      const alpha = Math.acos(Math.max(-1,Math.min(1,(R1-R2)/d)));
      const MX = mx => c1x + mx, MY = my => c1y - my;        // math(y-up,px) -> screen

      function arcPts(cxpx, r, a0, a1, steps){
        const p = [];
        for (let i=0;i<=steps;i++){
          const a = a0 + (a1-a0)*i/steps;
          p.push([MX(cxpx + r*Math.cos(a)), MY(r*Math.sin(a))]);
        }
        return p;
      }
      const N = 48;
      const arc2 = arcPts(d,  R2, alpha, -alpha,      N);     // pulley2 outer (right) side
      const arc1 = arcPts(0,  R1, -alpha, alpha-2*PI, N);     // pulley1 outer (left) side
      const T1 = [MX(R1*Math.cos(alpha)),     MY(R1*Math.sin(alpha))];
      const T2 = [MX(d + R2*Math.cos(alpha)), MY(R2*Math.sin(alpha))];

      // path runs clockwise on screen: top span left->right, around P2, bottom span back, around P1
      let dpath = `M ${T1[0].toFixed(1)} ${T1[1].toFixed(1)} L ${T2[0].toFixed(1)} ${T2[1].toFixed(1)} `;
      arc2.forEach(p => dpath += `L ${p[0].toFixed(1)} ${p[1].toFixed(1)} `);
      arc1.forEach(p => dpath += `L ${p[0].toFixed(1)} ${p[1].toFixed(1)} `);
      dpath += 'Z';

      function pulley(cx, cy, R, teeth, cls){
        let ticks = '';
        if (teeth <= 72){
          for (let i=0;i<teeth;i++){
            const a = 2*PI*i/teeth;
            const x1 = cx + (R-3)*Math.cos(a), y1 = cy + (R-3)*Math.sin(a);
            const x2 = cx + R*Math.cos(a),     y2 = cy + R*Math.sin(a);
            ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
          }
        } else {
          ticks = `<circle cx="${cx}" cy="${cy}" r="${R-2}" fill="none" stroke-dasharray="2 3"/>`;
        }
        const hub = Math.max(4, R*0.22);
        const spokes = [0, 120, 240].map(deg => {
          const a = deg*PI/180;
          return `<line x1="${(cx + hub*Math.cos(a)).toFixed(1)}" y1="${(cy + hub*Math.sin(a)).toFixed(1)}" x2="${(cx + (R-7)*Math.cos(a)).toFixed(1)}" y2="${(cy + (R-7)*Math.sin(a)).toFixed(1)}"/>`;
        }).join('');
        const spin = animate
          ? `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${(teeth*SEC_PER_TOOTH).toFixed(2)}s" repeatCount="indefinite"/>`
          : '';
        return `<g class="bc-pulley ${cls}">
          <circle class="bc-body" cx="${cx}" cy="${cy}" r="${R}"/>
          <g class="bc-turn">${spin}<g class="bc-teeth">${ticks}</g><g class="bc-spokes">${R > 22 ? spokes : ''}</g></g>
          <circle class="bc-hub" cx="${cx}" cy="${cy}" r="${hub}"/>
          <circle class="bc-axle" cx="${cx}" cy="${cy}" r="2.2"/></g>`;
      }

      const maxR = Math.max(R1,R2);
      const dy = c1y + maxR + 26;
      const dim = `
        <g class="bc-dim">
          <line x1="${c1x}" y1="${c1y}" x2="${c1x}" y2="${dy+6}"/>
          <line x1="${c2x}" y1="${c1y}" x2="${c2x}" y2="${dy+6}"/>
          <line class="bc-dim-main" x1="${c1x}" y1="${dy}" x2="${c2x}" y2="${dy}" marker-start="url(#arL)" marker-end="url(#arR)"/>
          <rect x="${(c1x+c2x)/2-50}" y="${dy-10}" width="100" height="20"/>
          <text x="${(c1x+c2x)/2}" y="${dy+4.5}" text-anchor="middle">C = ${fmt(C,1)} mm</text>
        </g>`;

      const labels = `
        <text class="bc-l1" x="${c1x}" y="${c1y - maxR - 24}" text-anchor="middle">P1 &#183; ${N1}T</text>
        <text class="bc-ls" x="${c1x}" y="${c1y - maxR - 9}"  text-anchor="middle">&#8960; ${fmt(2*r1,1)} mm</text>
        <text class="bc-l2" x="${c2x}" y="${c1y - maxR - 24}" text-anchor="middle">P2 &#183; ${N2}T</text>
        <text class="bc-ls" x="${c2x}" y="${c1y - maxR - 9}"  text-anchor="middle">&#8960; ${fmt(2*r2,1)} mm</text>`;

      const noteTxt = note ? `<text class="bc-note" x="${VW/2}" y="16" text-anchor="middle">${note}</text>` : '';
      const run = animate
        ? `<animate attributeName="stroke-dashoffset" from="0" to="${(-pitchPx).toFixed(2)}" dur="${SEC_PER_TOOTH}s" repeatCount="indefinite"/>`
        : '';

      svg.innerHTML = `
        <defs>
          <marker id="arL" markerWidth="9" markerHeight="9" refX="6" refY="4" orient="auto"><path class="bc-arrow" d="M6,1 L1,4 L6,7"/></marker>
          <marker id="arR" markerWidth="9" markerHeight="9" refX="3" refY="4" orient="auto"><path class="bc-arrow" d="M3,1 L8,4 L3,7"/></marker>
        </defs>
        ${noteTxt}
        ${dim}
        <path class="bc-belt" d="${dpath}"/>
        <path class="bc-belt-teeth" d="${dpath}" stroke-dasharray="${(pitchPx*0.45).toFixed(2)} ${(pitchPx*0.55).toFixed(2)}">${run}</path>
        ${pulley(c1x,c1y,R1,N1,'p1')}
        ${pulley(c2x,c1y,R2,N2,'p2')}
        ${labels}`;
    };
  }

  // Copy-SKU buttons + click-a-row-to-preview. Call once per page with the draw fn.
  function initInteractions(draw){
    document.addEventListener('click', e => {
      const btn = e.target.closest('.copy-btn');
      if (btn){
        e.preventDefault();
        if (navigator.clipboard) navigator.clipboard.writeText(btn.dataset.sku);
        const o = btn.textContent; btn.textContent = 'copied'; setTimeout(()=>btn.textContent=o,1000);
        return;
      }
      const tr = e.target.closest('tr[data-n1]');
      if (tr && !e.target.closest('a')){
        const tbl = tr.closest('table');
        if (tbl) tbl.querySelectorAll('tr').forEach(x=>x.classList.remove('sel'));
        tr.classList.add('sel');
        draw(+tr.dataset.n1, +tr.dataset.n2, +tr.dataset.c, '');
      }
    });
  }

  window.BeltCore = {
    PITCH, BELTS, beltURL,
    pitchDia, beltLen, idealTeeth, centerFor, smallWrap, minCenter, fmt,
    skuCell, wrapNote, makeDrawer, initInteractions
  };
})();
