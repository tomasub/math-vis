/* 1.1 Span and linear independence explorer · Lecture 1 · Def 1.0.1 · (1.3)–(1.4)
   model: pure functions (state → derived values → scene), tested in Node
   view:  a Preact component that composes toolkit pieces */
(function (root) {
  'use strict';
  var L = (root.SV && root.SV.linalg) || (typeof require !== 'undefined' ? require('../math/linalg.js') : null);
  var COLORS = ['q1', 'q2', 'q3', 'q4'];
  var DEFAULT_VECS = [[2, 1, 0.5], [-1, 1.5, 1], [1, -2, -1], [0.5, 2.5, 2]];

  /* ================= model ================= */
  var model = {
    initial: function () {
      return { dim: 2, k: 2, snap: true, vecs: DEFAULT_VECS.map(function (v) { return v.slice(); }), alpha: [1, 1, 0, 0] };
    },

    /** Snap to the 0.5 grid (optional) and clamp to [−3, 3]; coordinates beyond dim are kept. */
    snapVec: function (s, v) {
      return [0, 1, 2].map(function (i) {
        var x = v[i] != null ? v[i] : 0;
        if (i >= s.dim) return x;
        var y = s.snap ? Math.round(x * 2) / 2 : Math.round(x * 100) / 100;
        y = Math.max(-3, Math.min(3, y));
        return y === 0 ? 0 : y;
      });
    },
    moveVec: function (s, i, v) {
      var vecs = s.vecs.map(function (w) { return w.slice(); });
      vecs[i] = model.snapVec(s, v);
      return { vecs: vecs };
    },

    /** Replace q_k by a random combination of q₁…q_{k−1} that stays inside the axes (q₁ := 0 when k = 1). */
    makeDependent: function (s, rand) {
      rand = rand || Math.random;
      var k = s.k, n = s.dim, target = null, choices = [-1.5, -1, -0.5, 0.5, 1, 1.5];
      if (k === 1) target = [0, 0, 0];
      for (var tries = 0; tries < 60 && !target; tries++) {
        var t = [0, 0, 0];
        for (var i = 0; i < k - 1; i++) {
          var c = choices[Math.floor(rand() * choices.length)];
          if (tries > 40) c /= 2;
          for (var l = 0; l < 3; l++) t[l] += c * s.vecs[i][l];
        }
        var inside = t.slice(0, n).every(function (x) { return Math.abs(x) <= 3; });
        if (inside && Math.hypot.apply(null, t.slice(0, n)) > 0.4) target = t;
      }
      if (!target) target = s.vecs[0].map(function (x) { return x / 2; });
      for (var m = n; m < 3; m++) target[m] = s.vecs[k - 1][m];
      var vecs = s.vecs.map(function (w) { return w.slice(); });
      vecs[k - 1] = target;
      return { vecs: vecs };
    },

    /** Everything the panels and the scene need, computed once per state. */
    derive: function (s) {
      var n = s.dim, k = s.k;
      var cols = s.vecs.slice(0, k).map(function (v) { return v.slice(0, n); });
      var an = L.analyse(cols), r = an.rank, indep = r === k;
      var R = n === 2 ? 'ℝ²' : 'ℝ³';
      var spanDesc = r === 0 ? '{0}: a single point' : r === 1 ? 'a line through 0'
        : (r === 2 && n === 3) ? 'a plane through 0' : 'all of ' + R;
      var res = [0, 0, 0];
      for (var i = 0; i < k; i++) for (var l = 0; l < n; l++) res[l] += s.alpha[i] * s.vecs[i][l];
      return {
        an: an, rank: r, indep: indep, spanDesc: spanDesc, R: R, res: res,
        relText: an.rel ? L.relationText(an.rel) : '',
        relTex: an.rel ? L.relationTex(an.rel) : '',
        anyAlpha: s.alpha.slice(0, k).some(function (a) { return Math.abs(a) > 1e-12; }),
      };
    },

    /** Scene for the stage (see toolkit/stage2d.js for the format). */
    scene: function (s, d, onMove) {
      var n = s.dim, k = s.k, O = [0, 0, 0], sc = {
        dim: n, extent: 3.5, step: s.snap ? 0.5 : 0.1, drops: true,
        lines: [], planes: [], arrows: [], segments: [], dots: [], points: [],
      };
      if (d.rank === 0) sc.dots.push({ at: O, color: 'accent', r: 12, opacity: 0.25 });
      if (d.rank === 1) sc.lines.push({ dir: d.an.E[0], color: 'accent' });
      if (d.rank === 2 && n === 3) sc.planes.push({ basis: [d.an.E[0], d.an.E[1]], color: 'accent' });
      if (d.rank === n) { if (n === 2) sc.fillAll = 'accent'; else sc.box = 'accent'; }

      var cur = O.slice();
      for (var i = 0; i < k; i++) {
        var v = n === 3 ? s.vecs[i].slice() : [s.vecs[i][0], s.vecs[i][1], 0];
        sc.arrows.push({ from: O, to: v, color: COLORS[i] });
        var a = s.alpha[i];
        if (Math.abs(a) > 1e-12) {
          var nxt = cur.map(function (x, l) { return x + a * v[l]; });
          sc.segments.push({ from: cur, to: nxt, color: COLORS[i], dash: true });
          cur = nxt;
        }
        sc.points.push({
          id: 'q' + (i + 1), at: v, color: COLORS[i], label: 'q' + L.sub(i),
          aria: 'q' + L.sub(i) + ' tip at (' + s.vecs[i].slice(0, n).map(L.fmt).join(', ') + ')' +
            (n === 3 ? '. Arrow keys move x₁ and x₂, Page Up and Page Down move x₃' : '. Arrow keys move the tip'),
          onMove: (function (j) { return function (w) { onMove(j, w); }; })(i),
        });
      }
      if (d.anyAlpha && Math.hypot(d.res[0], d.res[1], d.res[2]) > 1e-12) {
        sc.arrows.push({ from: O, to: d.res, color: 'text', width: 3, label: 'Qα' });
      }
      sc.aria = 'Vectors q₁ to q' + L.sub(k - 1) + ' in ' + d.R + '. Their span is ' + d.spanDesc + '. ' +
        (d.indep ? 'They are linearly independent.' : 'They are linearly dependent: ' + d.relText + '.');
      return sc;
    },

    /** TeX for the live-values panel. Columns take their series colour. */
    tex: function (s, d) {
      var n = s.dim, k = s.k, f = L.fmtTex;
      var colTex = function (v) { return '\\begin{bmatrix}' + v.slice(0, n).map(f).join('\\\\') + '\\end{bmatrix}'; };
      var cls = function (i, t) { return '\\htmlClass{' + COLORS[i] + '}{' + t + '}'; };
      var rows = [];
      for (var r = 0; r < n; r++) {
        var cells = [];
        for (var i = 0; i < k; i++) cells.push(cls(i, f(s.vecs[i][r])));
        rows.push(cells.join(' & '));
      }
      var names = [];
      for (i = 0; i < k; i++) names.push(cls(i, '\\mathbf{q}_{' + (i + 1) + '}'));
      var Q = 'Q = [\\,' + names.join('\\;') + '\\,] = \\begin{bmatrix}' + rows.join('\\\\') + '\\end{bmatrix}';
      var terms = [];
      for (i = 0; i < k; i++) terms.push(f(s.alpha[i]) + cls(i, colTex(s.vecs[i])));
      var Qa = 'Q\\boldsymbol{\\alpha} = ' + terms.join(' + ').replace(/\+ -/g, '- ') + ' = ' + colTex(d.res);
      var tol = '\\mathrm{tol} = 10^{-10}\\max(1, \\|Q\\|_2) = ' + L.fmtETex(d.an.tol);
      return { Q: Q, Qa: Qa, tol: tol, rel: d.relTex };
    },
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = model; return; }

  /* ================= view ================= */
  var SV = root.SV, ui = SV.ui, html = ui.html;

  function SpanExplorer() {
    var st = ui.useMerge(model.initial()), s = st[0], set = st[1];
    var d = model.derive(s);
    var scene = model.scene(s, d, function (i, w) { set(function (o) { return model.moveVec(o, i, w); }); });
    var tex = model.tex(s, d);
    var k = s.k, n = s.dim;
    var names = []; for (var i = 0; i < k; i++) names.push('q' + SV.linalg.sub(i));

    return html`<div class="viz">
      <div class="viz-toolbar">
        <${ui.Seg} aria="Space" value=${n} onChange=${function (v) { set({ dim: v }); }}
          options=${[{ value: 2, label: 'ℝ²', aria: 'Space R2' }, { value: 3, label: 'ℝ³', aria: 'Space R3' }]} />
        <${ui.Seg} label="vectors k" mono value=${k} onChange=${function (v) { set({ k: v }); }}
          options=${[1, 2, 3, 4].map(function (x) { return { value: x, label: String(x), aria: 'k = ' + x }; })} />
        <${ui.Check} label="Snap to grid (0.5)" checked=${s.snap} onChange=${function (v) { set({ snap: v }); }} />
        <div class="row push">
          <${ui.Btn} primary onClick=${function () { set(function (o) { return model.makeDependent(o); }); }}>Make dependent<//>
          <${ui.Btn} onClick=${function () { set(model.initial()); }}>Reset<//>
        </div>
      </div>
      <div class="viz-body">
        <figure class="viz-figure">
          <div class="figure-box">
            <${SV.stage.Stage} scene=${scene} />
            <span class="span-caption">span = ${d.spanDesc}</span>
          </div>
          <figcaption class="muted small">Drag a vector tip, or focus it with Tab and use the arrow keys${n === 3 ? ' (Page Up / Page Down move x₃). Drag empty space to orbit the view' : ''}. Dashed segments draw Q<b>α</b> tip to tail. The shaded region is the span.</figcaption>
        </figure>
        <aside class="viz-side">
          <${ui.Panel} title="Status" live>
            <p class=${'verdict ' + (d.indep ? 'ok' : 'warn')}>${d.indep ? 'Linearly independent' : 'Linearly dependent'}</p>
            ${!d.indep && html`<p class="rel"><${ui.Tex} tex=${tex.rel} fallback=${d.relText} /></p>`}
            <p class="mono small">rank(Q) = ${d.rank}${d.indep ? ' = k' : ' < k = ' + k}</p>
            <p class="small">span(${names.join(', ')}) = ${d.spanDesc} · dim span = ${d.rank} with ${k} vector${k > 1 ? 's' : ''}</p>
            ${!d.indep && html`<p class="muted small">Dropping ${d.relText.split(' =')[0]} leaves the span unchanged.</p>`}
            ${k > n && html`<p class="muted small">k = ${k} > n = ${n}: more vectors than dimensions, so they must be dependent.</p>`}
          <//>
          <${ui.Panel} title=${html`Coefficients <span class="no-caps">α</span>`}>
            ${s.alpha.slice(0, k).map(function (a, j) {
              return html`<${ui.Slider} label=${'α' + SV.linalg.sub(j)} cls=${COLORS[j]} min="-2" max="2" step="0.1" value=${a}
                display=${SV.linalg.fmt(a)} onInput=${function (x) { set(function (o) { var al = o.alpha.slice(); al[j] = x; return { alpha: al }; }); }} />`;
            })}
          <//>
          <${ui.Panel} title="Live values">
            <div class="formula"><${ui.Tex} display tex=${tex.Q} /></div>
            <div class="formula"><${ui.Tex} display tex=${tex.Qa} /></div>
          <//>
          <${ui.Panel} title="Fixed by system" muted>
            <${ui.KV} items=${[
              ['independent iff', 'rank(Q) = k, decided with tol'],
              ['tol', html`<${ui.Tex} tex=${tex.tol} />`],
              ['rank method', 'Gram–Schmidt (re-orthogonalised), in order q₁, q₂, …'],
              ['origin', 'drawn, not draggable'],
              ['axes', '[−3, 3] · IEEE double'],
            ]} />
          <//>
        </aside>
      </div>
    </div>`;
  }

  SV.viz.register('1.1', { component: SpanExplorer, needs: ['katex'], model: model });
})(typeof window !== 'undefined' ? window : globalThis);
