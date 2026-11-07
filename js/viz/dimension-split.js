/* 2.1 Dimension theorem as a split of the input space · Lecture 2 · Thm 1.1.1
   model: pure functions (state → derived values → scenes), tested in Node
   view:  a Preact component that composes toolkit pieces */
(function (root) {
  'use strict';
  var L = (root.SV && root.SV.linalg) || (typeof require !== 'undefined' ? require('../math/linalg.js') : null);
  var SCALE = 2; // drawn length of the unit basis vectors

  function pad3(v) { return [v[0] || 0, v[1] || 0, v[2] || 0]; }
  function scale(v, c) { return v.map(function (x) { return x * c; }); }
  function resize(A, m, n) {
    var out = [];
    for (var i = 0; i < m; i++) { out.push([]); for (var j = 0; j < n; j++) out[i].push(A[i] && A[i][j] != null ? A[i][j] : 0); }
    return out;
  }
  function spaceName(d) { return 'ℝ' + L.sub(d); }

  /* ================= model ================= */
  var model = {
    /** Default: 3×3 matrix of rank 2 (row 3 = row 1 + row 2), so N(A) is the line through (−1, −1, 1). */
    initial: function () {
      return { m: 3, n: 3, A: [[1, 2, 3], [0, 1, 1], [1, 3, 4]], t: 0 };
    },

    /** Change the shape; entries are kept where they exist, new ones are 0. */
    setShape: function (s, m, n) { return { m: m, n: n, A: resize(s.A, m, n), t: s.t }; },
    setEntry: function (s, i, j, x) {
      var A = s.A.map(function (r) { return r.slice(); });
      A[i][j] = x; return { A: A };
    },
    /** Replace A by a random matrix of exactly this rank (clamped to 0…min(m,n)). */
    setRank: function (s, r, rand) {
      r = Math.max(0, Math.min(Math.min(s.m, s.n), Math.round(r)));
      var A = r === 0 ? resize([], s.m, s.n) : L.randomRankMatrix(s.m, s.n, r, rand);
      return A ? { A: A } : {};
    },

    derive: function (s) {
      var m = s.m, n = s.n, A = s.A;
      var sp = L.splitInputSpace(A);
      var cols = []; for (var j = 0; j < n; j++) cols.push(A.map(function (r) { return r[j]; }));
      var colAn = L.analyse(cols);
      var rank = sp.rank, nullity = sp.nullity;
      var nullImg = sp.N.map(function (v) { return L.applyRows(A, v); });
      var compImg = sp.C.map(function (w) { return L.applyRows(A, w); });
      var nullMax = nullImg.reduce(function (a, y) { return Math.max(a, L.norm(y)); }, 0);
      var injective = L.analyse(compImg).rank === rank; // images of the complement basis independent
      var maxImg = compImg.reduce(function (a, y) { return Math.max(a, L.norm(y) * SCALE); }, 0);
      return {
        m: m, n: n, rank: rank, nullity: nullity, tol: sp.tol, N: sp.N, C: sp.C,
        nullImg: nullImg, compImg: compImg, nullMax: nullMax, injective: injective,
        R: colAn.E, theorem: rank + nullity === n && colAn.rank === rank,
        inExtent: Math.max(3.5, 1.15 * SCALE), outExtent: Math.max(3.5, 1.15 * maxImg),
        maxRank: Math.min(m, n),
      };
    },

    /** Scene of one space. which = 'in' (ℝⁿ) or 'out' (ℝᵐ). */
    scene: function (s, d, which) {
      var inp = which === 'in', dim = inp ? s.n : s.m, t = s.t, O = [0, 0, 0];
      var sc = {
        dim: dim === 3 ? 3 : 2, extent: inp ? d.inExtent : d.outExtent, step: 0.5,
        axisLabels: dim === 1 ? ['x₁', '', ''] : undefined,
        lines: [], planes: [], arrows: [], segments: [], dots: [], points: [],
      };
      var sub = function (E, color) { // draw span(E) as a subspace of this space
        if (E.length === 0) sc.dots.push({ at: O, color: color, r: 10, opacity: 0.25 });
        else if (E.length === 1) sc.lines.push({ dir: pad3(E[0]), color: color });
        else if (E.length === 2 && dim === 3) sc.planes.push({ basis: [pad3(E[0]), pad3(E[1])], color: color });
        else if (E.length === dim) { if (dim === 3) sc.box = color; else sc.fillAll = color; }
      };
      if (inp) {
        sub(d.N, 'q1');
        d.N.forEach(function (v, i) {
          var f = 1 - t;
          if (f > 1e-9) sc.arrows.push({ from: O, to: scale(pad3(v), SCALE * f), color: 'q1', label: 'v' + L.sub(i) });
        });
        if (t > 1 - 1e-9 && d.N.length) sc.dots.push({ at: O, color: 'q1', r: 6, label: 'N(A) → 0' });
        d.C.forEach(function (w, i) {
          sc.arrows.push({ from: O, to: scale(pad3(w), SCALE), color: 'q2', label: 'w' + L.sub(i) });
        });
        sc.aria = 'Input space ' + spaceName(s.n) + ' split into N(A) of dimension ' + d.nullity +
          ' and a complement of dimension ' + d.rank + '.';
      } else {
        sub(d.R, 'accent');
        d.compImg.forEach(function (y, i) {
          if (t > 1e-9) sc.arrows.push({ from: O, to: scale(pad3(y), SCALE * t), color: 'q2', label: 'Aw' + L.sub(i) });
        });
        if (d.N.length) sc.dots.push({ at: O, color: 'q1', r: 6, label: t > 1e-9 ? 'A·N(A) = 0' : undefined });
        sc.aria = 'Output space ' + spaceName(s.m) + ' with the range R(A) of dimension ' + d.rank + '.';
      }
      return sc;
    },

    tex: function (s, d) {
      var f = L.fmtTex;
      var mat = '\\begin{bmatrix}' + s.A.map(function (r) { return r.map(f).join(' & '); }).join('\\\\') + '\\end{bmatrix}';
      return {
        A: 'A = ' + mat + ' \\in \\mathbb{R}^{' + s.m + '\\times ' + s.n + '}',
        dims: '\\dim R(A) + \\dim N(A) = \\htmlClass{q2}{' + d.rank + '} + \\htmlClass{q1}{' + d.nullity + '} = ' + s.n + ' = n',
        tol: '\\mathrm{tol} = 10^{-10}\\max(1, \\|A\\|_2) = ' + L.fmtETex(d.tol),
      };
    },

    /** Plain-text reading of the split, for the status panel and tests. */
    summary: function (s, d) {
      return 'N(A) has dimension ' + d.nullity + ' and is sent to 0; the complement N(A)⊥ has dimension ' + d.rank +
        ' and is sent one-to-one onto R(A), also of dimension ' + d.rank + '. ' + d.rank + ' + ' + d.nullity + ' = ' + s.n + '.';
    },
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = model; return; }

  /* ================= view ================= */
  var SV = root.SV, ui = SV.ui, html = ui.html;

  function DimensionSplit() {
    var st = ui.useMerge(model.initial()), s = st[0], set = st[1];
    var d = model.derive(s);
    var sIn = model.scene(s, d, 'in'), sOut = model.scene(s, d, 'out');
    var tex = model.tex(s, d);
    var shapeOpts = function (key) {
      return [1, 2, 3].map(function (x) { return { value: x, label: String(x), aria: key + ' = ' + x }; });
    };
    return html`<div class="viz">
      <div class="viz-toolbar">
        <${ui.Seg} label="m (rows)" mono value=${s.m} options=${shapeOpts('m')}
          onChange=${function (v) { set(function (o) { return model.setShape(o, v, o.n); }); }} />
        <${ui.Seg} label="n (columns)" mono value=${s.n} options=${shapeOpts('n')}
          onChange=${function (v) { set(function (o) { return model.setShape(o, o.m, v); }); }} />
        <div class="row push">
          <${ui.Btn} onClick=${function () { set(function (o) { return model.setRank(o, d.rank); }); }}>New random, same rank<//>
          <${ui.Btn} onClick=${function () { set(model.initial()); }}>Reset<//>
        </div>
      </div>
      <div class="viz-body">
        <figure class="viz-figure">
          <div class="figure-box">
            <${SV.stage.Stage} scene=${sIn} />
            <span class="span-caption">input ${spaceName(s.n)}: N(A) (blue) ⊕ N(A)⊥ (orange)</span>
          </div>
          <div class="figure-box">
            <${SV.stage.Stage} scene=${sOut} />
            <span class="span-caption">output ${spaceName(s.m)}: R(A) shaded</span>
          </div>
          <${ui.Player} label="apply A" value=${s.t} duration=${3} onChange=${function (t) { set({ t: t }); }} />
          <figcaption class="muted small">At t = 0 the split of ℝⁿ; moving to t = 1 applies A: the vectors <b>v</b>ᵢ of N(A) shrink to <b>0</b>, while the complement vectors <b>w</b>ⱼ arrive as A<b>w</b>ⱼ, which fill R(A) one-to-one. Drag empty space in a 3D view to orbit.</figcaption>
        </figure>
        <aside class="viz-side">
          <${ui.Panel} title="Dimension count" live>
            <${ui.SplitBar} total=${s.n} parts=${[
              { label: 'dim R(A)', value: d.rank, color: 'q2' },
              { label: 'dim N(A)', value: d.nullity, color: 'q1' },
            ]} />
            <div class="formula"><${ui.Tex} display tex=${tex.dims} /></div>
            <p class="small">${model.summary(s, d)}</p>
            <p class="small muted">A·N(A): largest ‖A<b>v</b>‖ = ${d.nullity ? L.fmtE(d.nullMax) : 'n/a (N(A) = {0})'} · complement images independent: ${d.injective ? 'yes' : 'no'}</p>
          <//>
          <${ui.Panel} title="Matrix A">
            <${ui.MatrixEditor} legend="Entries of A" value=${s.A}
              onChange=${function (i, j, x) { set(function (o) { return model.setEntry(o, i, j, x); }); }} />
            <${ui.Slider} label="rank" min="0" max=${d.maxRank} step="1" value=${d.rank}
              display=${String(d.rank)} onInput=${function (r) { set(function (o) { return model.setRank(o, r); }); }} />
            <p class="muted small">Moving the rank slider replaces A by a random matrix of that rank.</p>
          <//>
          <${ui.Panel} title="Live values"><div class="formula"><${ui.Tex} display tex=${tex.A} /></div><//>
          <${ui.Panel} title="Fixed by system" muted>
            <${ui.KV} items=${[
              ['complement', 'N(A)⊥ (= row space). Any complement of N(A) works in the proof of Thm 1.1.1; this one is just a convenient choice.'],
              ['tol', html`<${ui.Tex} tex=${tex.tol} />`],
              ['bases', 'orthonormal, computed by Gram–Schmidt; drawn with length 2'],
              ['axes', 'ℝ³ and ℝ² within [−3, 3]; output axes widen if A·w is longer'],
            ]} />
          <//>
        </aside>
      </div>
    </div>`;
  }

  SV.viz.register('2.1', { component: DimensionSplit, needs: ['katex', 'three'], model: model });
})(typeof window !== 'undefined' ? window : globalThis);
