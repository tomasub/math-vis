/* 1.2 Range, nullspace and solvability of Ax = b · Lecture 1 · Def 1.1.1 · Lem 1.1.1–1.1.2 · (1.7)
   model: pure functions (state → derived values → scene), tested in Node
   view:  a Preact component that composes toolkit pieces */
(function (root) {
  'use strict';
  var L = (root.SV && root.SV.linalg) || (typeof require !== 'undefined' ? require('../math/linalg.js') : null);

  var PRESETS = {
    ex111: { m: 3, n: 2, A: [[1, 1, 0], [0, -1, 0], [2, 2, 0]], name: 'Example 1.1.1' },
    ex112: { m: 3, n: 3, A: [[1, 0, 1], [0, 2, 2], [-1, 1, 0]], name: 'Example 1.1.2' },
  };

  /* ================= model ================= */
  var model = {
    initial: function () {
      // Example 1.1.1's shape (3×2): input ℝ², output ℝ³, so the harder mixed 2D/3D
      // layout is what the default screenshot shows. b = A·[0.5, 0.5] = [1, -0.5, 2] so
      // the default state already has a (unique) solution to look at, and every
      // component of b sits strictly inside the [-3, 3] axis range (unlike, say,
      // A·[1,1] = [2,-1,4], whose 3rd component is already outside the box and would
      // get clamped to 3 the first time anyone dragged or nudged b).
      return {
        m: 3, n: 2,
        A: [[1, 1, 0], [0, -1, 0], [2, 2, 0]],
        x: [-1.5, 0.5, 0],
        b: [1, -0.5, 2],
        check: false,
      };
    },

    PRESETS: PRESETS,

    /** Round to 2 decimals and clamp to [−3, 3]; components beyond the active dim are kept as-is. */
    clampVec: function (v, dim) {
      return [0, 1, 2].map(function (i) {
        var x = v[i] != null ? v[i] : 0;
        if (i >= dim) return x;
        var y = Math.max(-3, Math.min(3, Math.round(x * 100) / 100));
        return y === 0 ? 0 : y;
      });
    },
    moveX: function (s, v) { return { x: model.clampVec(v, s.n) }; },
    moveB: function (s, v) { return { b: model.clampVec(v, s.m) }; },
    setShape: function (s, m, n) { return { m: m, n: n }; },
    setEntry: function (s, i, j, val) {
      var A = s.A.map(function (r) { return r.slice(); });
      A[i][j] = val;
      return { A: A };
    },
    // b chosen in R(A) for each preset, so the preset actually shows the case it's named
    // for: ex111 (full column rank) reuses the default's b = A·[0.5, 0.5] = [1,-0.5,2]
    // (a unique solution); ex112's b = A·[1,1,0] = [1,2,0] lands off the trivial N(A), so
    // the infinitely-many-solutions case (and the N(A) = span[-1,-1,1] line) is what shows.
    PRESET_B: { ex111: [1, -0.5, 2], ex112: [1, 2, 0] },
    applyPreset: function (s, name) {
      var p = PRESETS[name];
      if (!p) return {};
      return {
        m: p.m, n: p.n,
        A: p.A.map(function (r) { return r.slice(); }),
        b: model.PRESET_B[name].slice(),
        x: model.clampVec(s.x, p.n), // reset/clamp x if it would sit outside the new n
      };
    },
    setCheck: function (s, on) { return { check: on }; },

    /** A fresh b, for the "check yourself" practice loop. About half the time it lands in
        R(A) (so unique/infinite cases come up too, not just "no solution"), the rest is a
        uniformly random point — a genuine draw, not scripted to a particular answer.
        The in-R(A) branch builds b = A·xr and, if that falls outside [-3, 3], *scales the
        whole vector* (not each component) by 3/max|bᵢ| so it stays exactly on the same
        ray through the origin — i.e. exactly in R(A), since R(A) is a subspace and any
        scalar multiple of a point in it is still in it. Clamping componentwise instead
        (as an earlier version did) generally knocks a point in R(A) off it. */
    randomizeB: function (s, rand) {
      rand = rand || Math.random;
      var g = function () { return Math.round((rand() * 6 - 3) * 2) / 2; };
      if (rand() < 0.5) {
        var xr = []; for (var k = 0; k < s.n; k++) xr.push(g());
        var b = [0, 0, 0];
        for (var i2 = 0; i2 < s.m; i2++) for (var j2 = 0; j2 < s.n; j2++) b[i2] += s.A[i2][j2] * xr[j2];
        var mx = 0; for (var i3 = 0; i3 < 3; i3++) mx = Math.max(mx, Math.abs(b[i3]));
        if (mx > 3) { var k2 = 3 / mx; for (var i4 = 0; i4 < 3; i4++) b[i4] *= k2; }
        return { b: b };
      }
      return { b: model.clampVec([g(), g(), g()], s.m) };
    },

    /** Everything the panels and the scenes need, computed once per state. */
    derive: function (s) {
      var m = s.m, n = s.n;
      var rows = s.A.slice(0, m).map(function (r) { return r.slice(0, n); });
      var cols = [];
      for (var j = 0; j < n; j++) { var c = []; for (var i = 0; i < m; i++) c.push(rows[i][j]); cols.push(c); }
      var colAn = L.analyse(cols);          // rank r, R(A) basis (E, in R^m), tol = 1e-10·max(1, ‖A‖₂)
      var rowAn = L.analyse(rows);          // same rank (rank A = rank Aᵀ), N(A)^⊥ basis (in R^n)
      var rank = colAn.rank, tol = colAn.tol;
      var nullBasis = L.completeOrthonormalBasis(rowAn.E, n, tol); // N(A) basis: completes N(A)^⊥ to R^n
      var nullDim = nullBasis.length;
      var x = s.x.slice(0, n), b = s.b.slice(0, m);
      var Ax = L.applyRows(rows, x);
      var projB = L.projectOntoBasis(colAn.E, b);
      var bInR = projB.residual <= tol;
      var xp = bInR ? L.minNormSolve(rows, b) : null;
      var nullTrivial = nullDim === 0;
      var verdict = !bInR ? 'none' : (nullTrivial ? 'unique' : 'infinite');
      return {
        m: m, n: n, rows: rows, cols: cols, rank: rank, tol: tol, nQ: colAn.nQ,
        R_basis: colAn.E, N_basis: nullBasis, nullDim: nullDim, nullTrivial: nullTrivial,
        rowBasis: rowAn.E, x: x, b: b, Ax: Ax, dist: projB.residual, proj: projB.proj,
        bInR: bInR, xp: xp, verdict: verdict,
      };
    },

    /** { input, output } scenes for the two stages (see toolkit/stage2d.js for the format). */
    scene: function (s, d, onMoveX, onMoveB) {
      var n = d.n, m = d.m;
      var inp = { dim: n, extent: 3.5, step: 0.5, lines: [], planes: [], arrows: [], segments: [], dots: [], points: [] };
      // N(A), through the origin (always shown, even with no solution)
      if (d.nullDim === 1) inp.lines.push({ dir: d.N_basis[0], color: 'muted' });
      else if (d.nullDim === 2 && n === 3) inp.planes.push({ basis: d.N_basis, color: 'muted' });
      else if (d.nullDim === n) { if (n === 2) inp.fillAll = 'muted'; else inp.box = 'muted'; }
      // solution set x_p + N(A) (Lemma 1.1.2) — only drawn when b ∈ R(A); no fake set otherwise
      if (d.bInR) {
        if (d.nullDim === 0) {
          inp.dots.push({ at: d.xp, color: 'accent', r: 7, label: 'xₚ', labelColor: 'accent' });
        } else if (d.nullDim === 1) {
          inp.lines.push({ dir: d.N_basis[0], at: d.xp, color: 'accent' });
          inp.dots.push({ at: d.xp, color: 'accent', r: 5, label: 'xₚ', labelColor: 'accent' });
        } else if (d.nullDim === 2 && n === 3) {
          inp.planes.push({ basis: d.N_basis, at: d.xp, color: 'accent' });
          inp.dots.push({ at: d.xp, color: 'accent', r: 5, label: 'xₚ', labelColor: 'accent' });
        } else if (d.nullDim === n) {
          if (n === 2) inp.fillAll = 'accent'; else inp.box = 'accent';
        }
      }
      inp.arrows.push({ from: [0, 0, 0], to: d.x, color: 'q2' });
      inp.points.push({
        id: 'x', at: d.x, color: 'q2', label: 'x',
        aria: 'x at (' + d.x.map(L.fmt).join(', ') + '). Arrow keys move it' + (n === 3 ? '; Page Up and Page Down move x₃' : '') + '.',
        onMove: onMoveX,
      });
      inp.aria = 'Input space ℝ' + n + '. N(A) is ' + (d.nullTrivial ? '{0}.' : 'dimension ' + d.nullDim + '.') +
        (d.bInR ? ' The solution set is shown.' : ' There is no solution, so no solution set is drawn.');

      var out = { dim: m, extent: 3.5, step: 0.5, lines: [], planes: [], arrows: [], segments: [], dots: [], points: [] };
      if (d.rank === 0) out.dots.push({ at: [0, 0, 0], color: 'accent', r: 10, opacity: 0.28 });
      else if (d.rank === 1) out.lines.push({ dir: d.R_basis[0], color: 'accent' });
      else if (d.rank === 2 && m === 3) out.planes.push({ basis: d.R_basis, color: 'accent' });
      else if (d.rank === m) { if (m === 2) out.fillAll = 'accent'; else out.box = 'accent'; }
      out.arrows.push({ from: [0, 0, 0], to: d.Ax, color: 'q3', label: 'Ax', labelColor: 'q3' });
      out.arrows.push({ from: [0, 0, 0], to: d.b, color: 'q2' });
      out.points.push({
        id: 'b', at: d.b, color: 'q2', label: 'b',
        aria: 'b at (' + d.b.map(L.fmt).join(', ') + '). Arrow keys move it' + (m === 3 ? '; Page Up and Page Down move x₃' : '') + '.',
        onMove: onMoveB,
      });
      if (!d.bInR) {
        out.segments.push({ from: d.b, to: d.proj, color: 'warn', dash: true });
        // The label sits on the far side of proj(b) from the origin (not a fixed screen
        // offset from the dot), so it never lands on the Ax/b arrowheads that also radiate
        // from the origin: pushed 0.6 world units further out along the same ray.
        var pn = L.norm(d.proj);
        var labelAt = pn > 1e-9
          ? d.proj.map(function (x) { return x * (1 + 0.6 / pn); })
          : [d.proj[0] + 0.6, d.proj[1], d.proj[2]]; // proj(b) = 0 (R(A) = {0}): offset sideways
        out.dots.push({ at: d.proj, color: 'warn', r: 5, label: 'proj(b)', labelColor: 'warn', labelAt: labelAt });
      }
      out.aria = 'Output space ℝ' + m + '. R(A) has dimension ' + d.rank + '. b is ' +
        (d.bInR ? 'in R(A).' : 'not in R(A); distance ' + L.fmt(d.dist) + ' shown as a dashed segment to its projection.');
      return { input: inp, output: out };
    },

    /** TeX for the live-values and verdict panels. */
    tex: function (s, d) {
      var f = L.fmtTex;
      var rowsTex = function (rows) { return rows.map(function (r) { return r.map(f).join(' & '); }).join(' \\\\ '); };
      var colvec = function (v) { return '\\begin{bmatrix}' + v.map(f).join('\\\\') + '\\end{bmatrix}'; };
      var A = 'A = \\begin{bmatrix}' + rowsTex(d.rows) + '\\end{bmatrix}';
      var Ax = 'A\\mathbf{x} = ' + colvec(d.Ax);
      var b = '\\mathbf{b} = ' + colvec(d.b);
      var tol = '\\mathrm{tol} = 10^{-10}\\max(1, \\|A\\|_2) = ' + L.fmtETex(d.tol);
      // Display the nullspace/range bases as the smallest integer vectors along the same
      // line/plane (e.g. span[1,1,-1] rather than the computed unit vector
      // [0.577, 0.577, -0.577]) so they read the same as the notes' span[-1,-1,1]; a basis
      // vector and any non-zero multiple of it span the same subspace, so this only
      // changes the printed numbers, never the geometry drawn in scene(). Falls back to
      // the plain unit vector (niceBasis's exact: false) when no small integer match exists.
      var niceN = d.N_basis.map(function (v) { return L.niceBasis(v).v; });
      var niceR = d.R_basis.map(function (v) { return L.niceBasis(v).v; });
      var basisRescaled = d.N_basis.concat(d.R_basis).length > 0;
      var nullTex = d.nullTrivial ? 'N(A) = \\{\\mathbf{0}\\}'
        : 'N(A) = \\mathrm{span}\\{' + niceN.map(colvec).join(',\\;') + '\\}';
      var rangeTex = d.rank === 0 ? 'R(A) = \\{\\mathbf{0}\\}'
        : 'R(A) = \\mathrm{span}\\{' + niceR.map(colvec).join(',\\;') + '\\}';
      var xpTex = d.bInR ? '\\mathbf{x}_p = ' + colvec(d.xp) : null;
      var solutionTex = null;
      if (d.bInR) {
        solutionTex = d.nullTrivial ? '\\mathbf{x} = \\mathbf{x}_p'
          : '\\mathbf{x} = \\mathbf{x}_p + ' + niceN.map(function (v, i) {
            return (niceN.length > 1 ? 't_{' + (i + 1) + '}' : 't') + colvec(v);
          }).join(' + ');
      }
      var distTex = !d.bInR ? '\\|\\mathbf{b} - P_{R(A)}\\mathbf{b}\\|_2 = ' + f(d.dist) : null;
      return {
        A: A, Ax: Ax, b: b, tol: tol, nullTex: nullTex, rangeTex: rangeTex, xpTex: xpTex, solutionTex: solutionTex,
        distTex: distTex, basisRescaled: basisRescaled,
      };
    },
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = model; return; }

  /* ================= view ================= */
  var SV = root.SV, ui = SV.ui, html = ui.html;
  var SUPN = { 1: '¹', 2: '²', 3: '³' };
  var VERDICT_OPTIONS = [{ value: 'none', label: '0' }, { value: 'unique', label: '1' }, { value: 'infinite', label: '∞' }];
  var VERDICT_LABEL = { none: 'no solution', unique: 'a unique solution', infinite: 'infinitely many solutions' };

  function VerdictBody(d, tex) {
    return html`<div class="verdict-body">
      <p class=${'verdict ' + (d.bInR ? 'ok' : 'warn')}>
        b ${d.bInR ? '∈' : '∉'} R(A)${!d.bInR && html` · distance ${L.fmt(d.dist)}`}
      </p>
      <p class=${'verdict ' + (d.nullTrivial ? 'ok' : 'warn')}>N(A) ${d.nullTrivial ? '= {0}' : '≠ {0}, dim ' + d.nullDim}</p>
      <p class="rel"><strong>${VERDICT_LABEL[d.verdict]}</strong> (by (1.7))</p>
      ${!d.bInR && html`<p class="small muted"><${ui.Tex} tex=${tex.distTex} /></p>`}
    </div>`;
  }

  function Solvability() {
    var st = ui.useMerge(model.initial()), s = st[0], set = st[1];
    var d = model.derive(s);
    var scenes = model.scene(s, d,
      function (v) { set(function (o) { return model.moveX(o, v); }); },
      function (v) { set(function (o) { return model.moveB(o, v); }); });
    var tex = model.tex(s, d);
    var activeA = s.A.slice(0, s.m).map(function (r) { return r.slice(0, s.n); });
    var resetKey = s.m + 'x' + s.n + '|' + s.A.join(',') + '|' + s.b.join(',');

    return html`<div class="viz">
      <div class="viz-toolbar">
        <${ui.Seg} label="shape" mono value=${s.m + 'x' + s.n} onChange=${function (v) {
          var parts = v.split('x'); set(function (o) { return model.setShape(o, +parts[0], +parts[1]); });
        }} options=${[[2, 2], [3, 2], [2, 3], [3, 3]].map(function (p) {
          return { value: p[0] + 'x' + p[1], label: p[0] + '×' + p[1], aria: p[0] + ' by ' + p[1] + ' matrix' };
        })} />
        <div class="row">
          <${ui.Btn} onClick=${function () { set(function (o) { return model.applyPreset(o, 'ex111'); }); }}>Example 1.1.1<//>
          <${ui.Btn} onClick=${function () { set(function (o) { return model.applyPreset(o, 'ex112'); }); }}>Example 1.1.2<//>
        </div>
        <${ui.Check} label="Check yourself" checked=${s.check} onChange=${function (v) { set({ check: v }); }} />
        <div class="row push">
          <${ui.Btn} onClick=${function () { set(function (o) { return model.randomizeB(o); }); }}>Random b<//>
          <${ui.Btn} onClick=${function () { set(model.initial()); }}>Reset<//>
        </div>
      </div>
      <div class="viz-body">
        <div class="viz-figures">
          <figure class="viz-figure">
            <div class="figure-box">
              <${SV.stage.Stage} scene=${scenes.input} />
              <span class="span-caption">input space ℝ${SUPN[d.n]}</span>
            </div>
            <figcaption class="muted small">Drag <b>x</b>, or Tab to it and use the arrow keys. The pale line/plane is N(A); the darker one, when b has a solution, is x<sub>p</sub> + N(A) (Lemma 1.1.2).</figcaption>
          </figure>
          <figure class="viz-figure">
            <div class="figure-box">
              <${SV.stage.Stage} scene=${scenes.output} />
              <span class="span-caption">output space ℝ${SUPN[d.m]}</span>
            </div>
            <figcaption class="muted small">Drag <b>b</b>. R(A) is shaded; <b>Ax</b> follows <b>x</b> live. When b ∉ R(A) a dashed segment shows its distance to R(A).</figcaption>
          </figure>
        </div>
        <aside class="viz-side">
          <${ui.Panel} title="Verdict" live>
            ${s.check
              ? html`<${ui.PredictReveal} prompt="Predict the number of solutions of Ax = b for the current A and b."
                  options=${VERDICT_OPTIONS} correct=${d.verdict} resetKey=${resetKey}
                  render=${function () { return VerdictBody(d, tex); }} />`
              : VerdictBody(d, tex)}
          <//>
          <${ui.Panel} title="Matrix A">
            <${ui.MatrixEditor} value=${activeA} legend="A"
              onChange=${function (i, j, x) { set(function (o) { return model.setEntry(o, i, j, x); }); }} />
          <//>
          <${ui.Panel} title="Live values">
            <div class="formula"><${ui.Tex} display tex=${tex.A} /></div>
            <div class="formula"><${ui.Tex} display tex=${tex.Ax} /></div>
            <div class="formula"><${ui.Tex} display tex=${tex.b} /></div>
            <div class="formula"><${ui.Tex} display tex=${tex.rangeTex} /></div>
            <div class="formula"><${ui.Tex} display tex=${tex.nullTex} /></div>
            ${tex.xpTex && html`<div class="formula"><${ui.Tex} display tex=${tex.xpTex} /></div>`}
            ${tex.solutionTex && html`<div class="formula"><${ui.Tex} display tex=${tex.solutionTex} /></div>`}
            ${tex.basisRescaled && html`<p class="small muted">N(A)/R(A) bases are shown as the smallest integer vector along the same line/plane — any non-zero multiple spans the same subspace.</p>`}
          <//>
          <${ui.Panel} title="Fixed by system" muted>
            <${ui.KV} items=${[
              ['dimensions', 'capped at 3 (m, n ≤ 3)'],
              ['rank(A), dim R(A)', String(d.rank)],
              ['tol', html`<${ui.Tex} tex=${tex.tol} />`],
              ['rank method', 'Gram–Schmidt (re-orthogonalised), on the columns and rows of A'],
              ['xₚ', 'the minimum-norm solution: xₚ ⊥ N(A)'],
              ['axes', '[−3, 3] · IEEE double'],
            ]} />
          <//>
        </aside>
      </div>
    </div>`;
  }

  SV.viz.register('1.2', { component: Solvability, needs: ['katex'], model: model });
})(typeof window !== 'undefined' ? window : globalThis);
