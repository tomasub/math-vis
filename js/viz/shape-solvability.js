/* 2.2 Shape vs solvability · Lecture 2 · Thm 1.1.1 and its consequence
   model: pure functions (state → derived values → scene), tested in Node
   view:  a Preact component that composes toolkit pieces */
(function (root) {
  'use strict';
  var L = (root.SV && root.SV.linalg) || (typeof require !== 'undefined' ? require('../math/linalg.js') : null);
  var KIND_COLOR = { unique: 'accent', many: 'q4', none: 'warn' };
  var KIND_LABEL = { unique: 'solvable (unique)', many: 'solvable (many)', none: 'not solvable' };
  var N_SAMPLES = 14, RADIUS = 3;

  function pad3(v) { return [v[0] || 0, v[1] || 0, v[2] || 0]; }

  /** small deterministic generator for the default sample */
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var model = {
    KIND_LABEL: KIND_LABEL, N_SAMPLES: N_SAMPLES, RADIUS: RADIUS, seeded: seeded,

    initial: function () {
      var s = { m: 3, n: 2, mode: 'ball', A: [[1, 0, 0], [0, 1, 0], [1, 1, 0]], bs: [] };
      s.bs = model.sample(s, seeded(7)).bs;
      return s;
    },

    /** Draw N_SAMPLES right-hand sides. 'ball': uniform in the ball of radius 3 in ℝ^m.
        'range': b = A x with x uniform in a ball in ℝ^n (always in R(A)). */
    sample: function (s, rand) {
      var bs = [];
      for (var i = 0; i < N_SAMPLES; i++) {
        if (s.mode === 'range') {
          var rowsA = s.A.slice(0, s.m).map(function (r) { return r.slice(0, s.n); });
          var x = L.sampleInBall(s.n, RADIUS / Math.max(1, L.norm2(rowsA)), rand);   // ‖Ax‖ ≤ ‖A‖₂‖x‖ ≤ 3
          var b = rowsA.map(function (r) { var t = 0; for (var j = 0; j < s.n; j++) t += r[j] * x[j]; return t; });
          bs.push(pad3(b));
        } else bs.push(pad3(L.sampleInBall(s.m, RADIUS, rand)));
      }
      return { bs: bs };
    },

    rows: function (s) { return s.A.slice(0, s.m).map(function (r) { return r.slice(0, s.n); }); },

    setShape: function (s, m, n, rand) {
      var t = Object.assign({}, s, { m: m, n: n });
      return Object.assign({ m: m, n: n }, model.sample(t, rand));
    },
    setEntry: function (s, i, j, x, rand) {
      var A = s.A.map(function (r) { return r.slice(); });
      A[i][j] = Math.max(-3, Math.min(3, x));
      var t = Object.assign({}, s, { A: A });
      // 'range' samples depend on A; ball samples stay put so a change of A reclassifies the same b
      return Object.assign({ A: A }, s.mode === 'range' ? model.sample(t, rand) : {});
    },
    setMode: function (s, mode, rand) {
      return Object.assign({ mode: mode }, model.sample(Object.assign({}, s, { mode: mode }), rand));
    },

    derive: function (s) {
      var m = s.m, n = s.n, rows = model.rows(s);
      var cols = [];
      for (var j = 0; j < n; j++) cols.push(rows.map(function (r) { return r[j]; }));
      var an = L.analyse(cols), r = an.rank;
      var shape = m > n ? 'tall' : m < n ? 'wide' : 'square';
      var samples = s.bs.map(function (b) {
        var c = L.classifySolvability(rows, b.slice(0, m));
        return { b: b, kind: c.kind, dist: c.dist };
      });
      var counts = { unique: 0, many: 0, none: 0 };
      samples.forEach(function (x) { counts[x.kind]++; });
      var nullDim = n - r, missing = m - r;
      var allB = r === m, uniq = nullDim === 0;
      var verdict;
      if (allB && uniq) verdict = 'Unique solution for every b: rank = m = n, so A is square and invertible.';
      else if (shape === 'tall') verdict = 'Tall (m > n): rank ≤ n < m, so R(A) ≠ ℝ^' + m + ' and some b have no solution.';
      else if (shape === 'wide') verdict = 'Wide (m < n): rank ≤ m < n, so N(A) ≠ {0} and every solvable b has infinitely many solutions.';
      else verdict = 'Square but singular (rank ' + r + ' < ' + m + '): both failures occur, since R(A) ≠ ℝ^' + m + ' and N(A) ≠ {0}.';
      return {
        an: an, rank: r, shape: shape, samples: samples, counts: counts, nullDim: nullDim, missing: missing,
        allSolvable: allB, uniqueAll: allB && uniq, verdict: verdict,
        tallNote: missing > 0 && s.mode === 'ball',
        correct: allB ? 'all' : 'none',
        rangeDesc: r === 0 ? '{0}' : r === m ? 'all of ℝ^' + m : r === 1 ? 'a line through 0' : 'a plane through 0',
      };
    },

    scene: function (s, d) {
      var m = s.m, dim = m === 3 ? 3 : 2, O = [0, 0, 0];
      var sc = { dim: dim, extent: 3.5, step: 0.5, drops: dim === 3, lines: [], planes: [], arrows: [], segments: [], dots: [], points: [] };
      if (d.rank === 0) sc.dots.push({ at: O, color: 'accent', r: 10, opacity: 0.3 });
      if (d.rank === 1) sc.lines.push({ dir: pad3(d.an.E[0]), color: 'accent' });
      if (d.rank === 2 && m === 3) sc.planes.push({ basis: [pad3(d.an.E[0]), pad3(d.an.E[1])], color: 'accent' });
      if (d.rank === m && m > 1) { if (dim === 2) sc.fillAll = 'accent'; else sc.box = 'accent'; }
      var cols = ['q1', 'q2', 'q3'];
      for (var j = 0; j < s.n; j++) {
        var v = pad3(s.A.slice(0, m).map(function (r) { return r[j]; }));
        if (Math.hypot(v[0], v[1], v[2]) > 1e-12) sc.arrows.push({ from: O, to: v, color: cols[j], label: 'a' + L.sub(j) });
      }
      d.samples.forEach(function (x) {
        sc.dots.push({ at: x.b, color: KIND_COLOR[x.kind], r: 6, opacity: 0.9 });
      });
      sc.aria = 'Right-hand sides b in ℝ^' + m + ' with the range of A, ' + d.rangeDesc + '. ' +
        d.counts.unique + ' unique, ' + d.counts.many + ' many, ' + d.counts.none + ' not solvable.';
      return sc;
    },

    tex: function (s, d) {
      var f = L.fmtTex, rows = model.rows(s);
      var A = 'A = \\begin{bmatrix}' + rows.map(function (r) { return r.map(f).join(' & '); }).join('\\\\') +
        '\\end{bmatrix}\\in\\mathbb{R}^{' + s.m + '\\times ' + s.n + '}';
      var rk = '\\operatorname{rank}A = ' + d.rank + ',\\; \\dim N(A) = ' + d.nullDim;
      var dimThm = '\\dim R(A) + \\dim N(A) = ' + (d.rank + d.nullDim) + ' = n';
      var tol = '\\mathrm{tol} = 10^{-10}\\max(1, \\|A\\|_2) = ' + L.fmtETex(d.an.tol);
      return { A: A, rank: rk, dimThm: dimThm, tol: tol };
    },
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = model; return; }

  /* ================= view ================= */
  var SV = root.SV, ui = SV.ui, html = ui.html;

  function ShapeSolvability() {
    var st = ui.useMerge(model.initial()), s = st[0], set = st[1];
    var d = model.derive(s), scene = model.scene(s, d), tex = model.tex(s, d);
    var A = model.rows(s);
    var seg = function (what) {
      return [1, 2, 3].map(function (x) { return { value: x, label: String(x), aria: x + (what === 'm' ? ' rows' : ' columns') }; });
    };

    return html`<div class="viz">
      <div class="viz-toolbar">
        <${ui.Seg} label="rows m" mono value=${s.m} options=${seg('m')} onChange=${function (v) { set(function (o) { return model.setShape(o, v, o.n); }); }} />
        <${ui.Seg} label="columns n" mono value=${s.n} options=${seg('n')} onChange=${function (v) { set(function (o) { return model.setShape(o, o.m, v); }); }} />
        <${ui.Seg} label="b drawn from" value=${s.mode} onChange=${function (v) { set(function (o) { return model.setMode(o, v); }); }}
          options=${[{ value: 'ball', label: 'ball in ℝᵐ' }, { value: 'range', label: 'R(A) only' }]} />
        <div class="row push"><${ui.Btn} primary onClick=${function () { set(function (o) { return model.sample(o); }); }}>Sample b<//></div>
      </div>
      <div class="viz-body">
        <figure class="viz-figure">
          <div class="figure-box"><${SV.stage.Stage} scene=${scene} /></div>
          <figcaption class="muted small">Space ℝ${s.m}${s.m === 1 ? ' (drawn on the x₁ axis)' : ''}: the shaded set is R(A) = ${d.rangeDesc}; arrows are the columns <b>a</b>ⱼ of A. Dots are sample right-hand sides <b>b</b>, coloured by outcome as in the Verdict panel.</figcaption>
        </figure>
        <aside class="viz-side">
          <${ui.Panel} title="Matrix">
            <${ui.MatrixEditor} legend="Matrix A" name="a" value=${A} onChange=${function (i, j, x) { set(function (o) { return model.setEntry(o, i, j, x); }); }} />
          <//>
          <${ui.Panel} title="Verdict" live>
            <p class=${'verdict ' + (d.uniqueAll ? 'ok' : 'warn')}>${d.shape === 'square' ? 'Square' : d.shape === 'tall' ? 'Tall' : 'Wide'} · rank ${d.rank}</p>
            <p class="small">${d.verdict}</p>
            <ul style="list-style:none;margin:0;padding:0" class="small">
              ${['unique', 'many', 'none'].map(function (k) {
                return html`<li><span style=${'color:var(--' + KIND_COLOR[k] + ')'} aria-hidden="true">●</span> ${KIND_LABEL[k]}: <b class="mono">${d.counts[k]}</b> of ${d.samples.length}</li>`;
              })}
            </ul>
            ${d.tallNote && html`<p class="muted small">Almost every b from a ball is unsolvable here: R(A) is ${d.rangeDesc}, a set of measure zero in ℝ${s.m}. Choose "R(A) only" to see solvable ones.</p>`}
          <//>
          <${ui.Panel} title="Live values">
            <div class="formula"><${ui.Tex} display tex=${tex.A} /></div>
            <div class="formula"><${ui.Tex} display tex=${tex.rank} /></div>
            <div class="formula"><${ui.Tex} display tex=${tex.dimThm} /></div>
          <//>
          <${ui.Panel} title="Check yourself">
            <${ui.PredictReveal} resetKey=${s.m + ',' + s.n + ',' + JSON.stringify(A)}
              prompt=${'Draw b at random from the ball. What share is solvable for this A (' + s.m + '×' + s.n + ', rank ' + d.rank + ')?'}
              options=${[{ value: 'all', label: 'all of them' }, { value: 'none', label: 'almost none' }]}
              correct=${d.correct}
              render=${function (c) { return c === 'all' ? 'rank = m, so R(A) = ℝᵐ and every b is solvable.' : 'rank < m, so R(A) is a proper subspace, a null set: almost no random b lies in it.'; }} />
          <//>
          <${ui.Panel} title="Fixed by system" muted>
            <${ui.KV} items=${[
              ['samples', N_SAMPLES + ' b, uniform in a ball of radius ' + RADIUS],
              ['classification', 'b ∈ R(A) ⇔ dist(b, R(A)) ≤ tol·max(1, ‖b‖); unique ⇔ N(A) = {0}'],
              ['tol', html`<${ui.Tex} tex=${tex.tol} />`],
              ['entries', 'in [−3, 3] · IEEE double'],
            ]} />
          <//>
        </aside>
      </div>
    </div>`;
  }

  SV.viz.register('2.2', { component: ShapeSolvability, needs: ['katex'], model: model });
})(typeof window !== 'undefined' ? window : globalThis);
