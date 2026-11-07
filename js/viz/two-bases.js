/* 1.3 One subspace, two bases · Lecture 1 · Example 1.1.1 · Defs 1.1.3–1.1.4
   model: pure functions (state → derived values → scene), tested in Node
   view:  a Preact component that composes toolkit pieces */
(function (root) {
  'use strict';
  var L = (root.SV && root.SV.linalg) || (typeof require !== 'undefined' ? require('../math/linalg.js') : null);
  var A = [[1, 1], [0, -1], [2, 2]];                 // Example 1.1.1, fixed
  var A_COLS = [[1, 0, 2], [1, -1, 2]];
  var W0 = [[1, 0], [0, 1], [2, 0]];                 // rows of W = [w1, w2]
  var O = [0, 0, 0];

  function colsOf(rows) { return [0, 1].map(function (j) { return rows.map(function (r) { return r[j]; }); }); }
  function clean(x) { x = Math.round(x * 100) / 100; return x === 0 ? 0 : x; }

  /* ================= model ================= */
  var model = {
    A: A,
    initial: function () {
      return { z: [0.5, 0.5], W: W0.map(function (r) { return r.slice(); }), showA: true, showW: true };
    },

    /** y = Az, kept inside the axis box [−3, 3]³ by shrinking z if needed. */
    setZ: function (s, z) {
      var y = L.applyRows(A, z), m = Math.max(Math.abs(y[0]), Math.abs(y[1]), Math.abs(y[2]));
      var f = m > 3 ? 3 / m : 1;
      return { z: [clean(z[0] * f), clean(z[1] * f)] };
    },
    /** Dragging: orthogonal projection of the world point v onto R(A) (3×2 system, exact), then setZ. */
    moveY: function (s, v) {
      var r = L.coordsInBasis(A_COLS, v);
      return r.z ? model.setZ(s, r.z) : {};
    },
    setW: function (s, i, j, x) {
      var W = s.W.map(function (r) { return r.slice(); });
      W[i][j] = Math.max(-3, Math.min(3, x));
      return { W: W };
    },

    derive: function (s) {
      var y = L.applyRows(A, s.z), wc = colsOf(s.W);
      var anA = L.analyse(A_COLS), anW = L.analyse(wc);
      var indep = anW.rank === 2;
      var inPlane = wc.map(function (w) { return L.coordsInBasis(A_COLS, w).inSpan; });
      var inPlaneAll = inPlane[0] && inPlane[1];
      var valid = indep && inPlaneAll;
      var warnings = [];
      if (!indep) warnings.push('w₁ and w₂ are linearly dependent (rank W = ' + anW.rank + ' < 2), so they are not a basis of anything 2-dimensional.');
      [0, 1].forEach(function (j) {
        if (!inPlane[j]) warnings.push('w' + L.sub(j) + ' is not in R(A): it leaves the plane.');
      });
      var x = null, M = null, undef = '';
      if (valid) {
        x = L.coordsInBasis(wc, y).z;
        M = [0, 1].map(function (j) { return L.coordsInBasis(wc, A_COLS[j]).z; }); // M[j] = column j: coords of a_j in W
      } else undef = 'undefined: ' + (!indep ? 'w₁, w₂ are dependent, so the coordinates are not unique.' : 'w₁, w₂ do not both lie in R(A), so {w₁, w₂} is not a basis of R(A).');
      var isDefault = valid && s.W.every(function (r, i) { return r.every(function (v, j) { return Math.abs(v - W0[i][j]) < 1e-12; }); });
      return {
        y: y, wc: wc, tol: anA.tol, tolW: anW.tol, indep: indep, inPlane: inPlane, valid: valid, warnings: warnings,
        x: x, M: M, undef: undef, isDefault: isDefault,
        same: valid && Math.abs(x[0] - s.z[0]) < 1e-9 && Math.abs(x[1] - s.z[1]) < 1e-9,
      };
    },

    scene: function (s, d, onMove) {
      var sc = { dim: 3, extent: 3.5, step: 0.5, drops: false, planes: [], arrows: [], segments: [], dots: [], points: [], lines: [] };
      sc.planes.push({ basis: A_COLS, color: 'accent', half: 3.6, grid: s.showA ? { range: 2, step: 1, color: 'q1' } : null });
      if (d.valid) sc.planes.push({ basis: d.wc, color: 'q3', fill: false, half: 3.6, grid: s.showW ? { range: 2, step: 1, color: 'q3' } : null });
      sc.arrows.push({ from: O, to: A_COLS[0], color: 'q1', label: 'a₁' }, { from: O, to: A_COLS[1], color: 'q2', label: 'a₂' });
      sc.arrows.push({ from: O, to: d.wc[0], color: 'q3', label: 'w₁' }, { from: O, to: d.wc[1], color: 'q4', label: 'w₂' });
      var step = function (base, c1, c2, v1, v2, col1, col2) {
        var mid = base.map(function (b, l) { return b + c1 * v1[l]; });
        var end = mid.map(function (b, l) { return b + c2 * v2[l]; });
        if (Math.abs(c1) > 1e-12) sc.segments.push({ from: base, to: mid, color: col1, dash: true, width: 2 });
        if (Math.abs(c2) > 1e-12) sc.segments.push({ from: mid, to: end, color: col2, dash: true, width: 2 });
      };
      step(O, s.z[0], s.z[1], A_COLS[0], A_COLS[1], 'q1', 'q2');
      if (d.valid) step(O, d.x[0], d.x[1], d.wc[0], d.wc[1], 'q3', 'q4');
      sc.points.push({
        id: 'y', at: d.y, color: 'text', label: 'y',
        aria: 'y at (' + d.y.map(L.fmt).join(', ') + ') in the plane R(A). Arrow keys move it; it stays in the plane',
        onMove: onMove,
      });
      sc.aria = 'Plane R(A) in ℝ³ with a point y. z = (' + s.z.map(L.fmt).join(', ') + ') in the column basis' +
        (d.valid ? ', x = (' + d.x.map(L.fmt).join(', ') + ') in the basis w₁, w₂.' : '; ' + d.undef);
      return sc;
    },

    tex: function (s, d) {
      var f = L.fmtTex, col = function (v) { return '\\begin{bmatrix}' + v.map(f).join('\\\\') + '\\end{bmatrix}'; };
      var mat = function (rows) { return '\\begin{bmatrix}' + rows.map(function (r) { return r.map(f).join(' & '); }).join('\\\\') + '\\end{bmatrix}'; };
      var cls = function (c, t) { return '\\htmlClass{' + c + '}{' + t + '}'; };
      var out = {
        y: '\\mathbf{y} = A\\mathbf{z} = ' + mat(A) + col(s.z) + ' = ' + col(d.y),
        z: cls('q1', '\\mathbf{z}') + ' = ' + col(s.z),
        tol: '\\mathrm{tol} = 10^{-10}\\max(1, \\|A\\|_2) = ' + L.fmtETex(d.tol),
        W: 'W = [\\mathbf{w}_1, \\mathbf{w}_2] = ' + mat(s.W),
      };
      if (d.valid) {
        out.x = cls('q3', '\\mathbf{x}') + ' = ' + col(d.x);
        // W x = A z  ⇒  x = M z, M = [coords of a₁ in W | coords of a₂ in W]
        var Mrows = [0, 1].map(function (i) { return [d.M[0][i], d.M[1][i]]; });
        out.conv = '\\mathbf{x} = ' + mat(Mrows) + '\\mathbf{z}';
        out.convEq = 'x_1 = ' + (function () { return lin(Mrows[0]); })() + ',\\quad x_2 = ' + lin(Mrows[1]);
      } else { out.x = ''; out.conv = ''; out.convEq = ''; }
      function lin(r) {
        var t = '', names = ['z_1', 'z_2'];
        r.forEach(function (c, j) {
          if (Math.abs(c) < 1e-12) return;
          var a = Math.abs(c), body = (Math.abs(a - 1) < 1e-12 ? '' : f(a)) + names[j];
          t += (c < 0 ? ' - ' : (t ? ' + ' : '')) + body;
        });
        t = t.replace(/^ - /, '-');
        return t === '' ? '0' : t;
      }
      return out;
    },
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = model; return; }

  /* ================= view ================= */
  var SV = root.SV, ui = SV.ui, html = ui.html;

  function TwoBases() {
    var st = ui.useMerge(model.initial()), s = st[0], set = st[1];
    var d = model.derive(s);
    var scene = model.scene(s, d, function (v) { set(function (o) { return model.moveY(o, v); }); });
    var tex = model.tex(s, d);
    var fmt = SV.linalg.fmt;

    return html`<div class="viz">
      <div class="viz-toolbar">
        <${ui.Check} label="Grid of columns of A" checked=${s.showA} onChange=${function (v) { set({ showA: v }); }} />
        <${ui.Check} label="Grid of w₁, w₂" checked=${s.showW} onChange=${function (v) { set({ showW: v }); }} />
        <div class="row push"><${ui.Btn} onClick=${function () { set(model.initial()); }}>Reset<//></div>
      </div>
      <div class="viz-body">
        <figure class="viz-figure">
          <div class="figure-box"><${SV.stage.Stage} scene=${scene} /></div>
          <figcaption class="muted small">Drag <b>y</b> (or focus it with Tab and use the arrow keys); it stays in the plane R(A). Drag empty space to orbit. The two grids are the same plane with different coordinates.</figcaption>
        </figure>
        <aside class="viz-side">
          <${ui.Panel} title="Coordinates of y" live>
            <div class="formula"><${ui.Tex} display tex=${tex.y} /></div>
            <div class="formula"><${ui.Tex} display tex=${tex.z} /></div>
            ${d.valid ? html`<div class="formula"><${ui.Tex} display tex=${tex.x} /></div>
              <p class="small"><${ui.Tex} tex=${tex.conv} /> ${' '} <span class="muted">i.e.</span> <${ui.Tex} tex=${tex.convEq} /></p>
              ${d.isDefault && html`<p class="muted small">This is the conversion from Example 1.1.1: x₁ = z₁ + z₂, x₂ = −z₂.</p>`}
              <p class=${'small ' + (d.same ? 'ok' : '')}>${d.same ? 'Here x = z numerically, but they are coordinates in different bases.' : 'x ≠ z: same y, different coordinate vectors.'}</p>`
              : html`<p class="verdict warn">x ${d.undef}</p>`}
          <//>
          ${d.warnings.length > 0 && html`<${ui.Panel} title="Warning" live>
            ${d.warnings.map(function (w) { return html`<p class="small warn">${w}</p>`; })}
          <//>`}
          <${ui.Panel} title="Edit W">
            <${ui.MatrixEditor} value=${s.W} legend="W = [w₁, w₂]" name="w"
              onChange=${function (i, j, x) { set(function (o) { return model.setW(o, i, j, x); }); }} />
            <${ui.Slider} label="z₁" min="-2" max="2" step="0.05" value=${s.z[0]} display=${fmt(s.z[0])}
              onInput=${function (v) { set(function (o) { return model.setZ(o, [v, o.z[1]]); }); }} />
            <${ui.Slider} label="z₂" min="-2" max="2" step="0.05" value=${s.z[1]} display=${fmt(s.z[1])}
              onInput=${function (v) { set(function (o) { return model.setZ(o, [o.z[0], v]); }); }} />
          <//>
          <${ui.Panel} title="Check yourself">
            <${ui.PredictReveal} prompt="Predict: for this y, is the coordinate vector x in basis {w₁, w₂} the same as z?"
              resetKey=${JSON.stringify([s.z, s.W])}
              options=${[{ value: 'yes', label: 'Same' }, { value: 'no', label: 'Different' }]}
              correct=${d.valid ? (d.same ? 'yes' : 'no') : 'n/a'}
              render=${function () { return d.valid ? 'x = (' + d.x.map(fmt).join(', ') + '), z = (' + s.z.map(fmt).join(', ') + '). Coordinates belong to a basis, not to y alone.' : 'x is ' + d.undef; }} />
          <//>
          <${ui.Panel} title="Fixed by system" muted>
            <${ui.KV} items=${[
              ['subspace', 'R(A), A = [1 1; 0 −1; 2 2] (Example 1.1.1)'],
              ['dim R(A)', '2: every basis of R(A) has 2 vectors (Defs 1.1.3–1.1.4)'],
              ['coordinates', 'solved exactly from the 3×2 system; y is projected onto the plane'],
              ['tol', html`<${ui.Tex} tex=${tex.tol} />`],
              ['axes', '[−3, 3] · IEEE double'],
            ]} />
          <//>
        </aside>
      </div>
    </div>`;
  }

  SV.viz.register('1.3', { component: TwoBases, needs: ['katex', 'three'], model: model });
})(typeof window !== 'undefined' ? window : globalThis);
