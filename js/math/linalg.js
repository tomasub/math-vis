/* Small dense linear-algebra helpers for the visualisations.
   Vectors are plain arrays; matrices are given as arrays of columns unless stated.
   Works as a browser script (SV.linalg) and as a Node module (require). */
(function (root) {
  'use strict';
  const TOL_FACTOR = 1e-10;

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function norm(a) {
    return Math.sqrt(dot(a, a));
  }

  /** Eigenvalues of a small symmetric matrix (array of rows), cyclic Jacobi. */
  function jacobiEig(M) {
    const n = M.length;
    const A = M.map((r) => r.slice());
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0, dg = 0;
      for (let p = 0; p < n; p++) {
        dg += A[p][p] * A[p][p];
        for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      }
      if (off === 0 || off <= 1e-30 * dg) break;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          if (A[p][q] === 0) continue;
          const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
          const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
          const c = 1 / Math.sqrt(t * t + 1), s = t * c;
          for (let r = 0; r < n; r++) {
            const arp = A[r][p], arq = A[r][q];
            A[r][p] = c * arp - s * arq;
            A[r][q] = s * arp + c * arq;
          }
          for (let r = 0; r < n; r++) {
            const apr = A[p][r], aqr = A[q][r];
            A[p][r] = c * apr - s * aqr;
            A[q][r] = s * apr + c * aqr;
          }
        }
      }
    }
    return A.map((r, i) => r[i]);
  }

  /** ‖Q‖₂ = sqrt(λ_max(QᵀQ)) for Q given as a list of columns. */
  function norm2(cols) {
    if (!cols.length) return 0;
    const G = cols.map((a) => cols.map((b) => dot(a, b)));
    const ev = jacobiEig(G);
    return Math.sqrt(Math.max(0, ...ev));
  }

  /**
   * In-order modified Gram–Schmidt with one re-orthogonalisation pass.
   * Column j counts as independent of q₁…q_{j−1} iff its residual norm exceeds
   * tol = 1e-10·max(1, ‖Q‖₂).
   * Returns { rank, E (orthonormal basis of the span), rel, tol, nQ } where rel is the
   * first relation found: q_j = Σ x_t · q_{idx[t]} over earlier independent columns.
   */
  function analyse(cols) {
    const nQ = norm2(cols);
    const tol = TOL_FACTOR * Math.max(1, nQ);
    const E = [], R = [], idx = [];
    let rel = null;
    for (let j = 0; j < cols.length; j++) {
      const r = cols[j].slice();
      const co = E.map(() => 0);
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < E.length; i++) {
          const c = dot(E[i], r);
          co[i] += c;
          for (let l = 0; l < r.length; l++) r[l] -= c * E[i][l];
        }
      }
      const rn = norm(r);
      if (rn > tol) {
        E.push(r.map((x) => x / rn));
        R.push({ co, d: rn });
        idx.push(j);
      } else if (!rel) {
        // q_j = Σ co_i e_i and Q_I = E·R with R upper triangular ⇒ solve R x = co.
        const m = co.length, x = new Array(m);
        for (let i = m - 1; i >= 0; i--) {
          let s = co[i];
          for (let l = i + 1; l < m; l++) s -= R[l].co[i] * x[l];
          x[i] = s / R[i].d;
        }
        rel = { j, idx: idx.slice(), x, res: rn };
      }
    }
    return { rank: E.length, E, rel, tol, nQ };
  }

  /** Number for display: up to 3 decimals, proper minus sign, no "−0". */
  function fmt(x) {
    if (!Number.isFinite(x)) return '—';
    let r = Math.round(x * 1000) / 1000;
    if (Math.abs(r) < 5e-4) r = 0;
    return String(r).replace('-', '−');
  }

  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

  /** Scientific notation such as 3.2·10⁻¹⁰. */
  function fmtE(x) {
    if (x === 0) return '0';
    if (!Number.isFinite(x)) return '—';
    let e = Math.floor(Math.log10(Math.abs(x)));
    let m = Math.round((x / Math.pow(10, e)) * 100) / 100;
    if (Math.abs(m) >= 10) { m /= 10; e += 1; }
    return String(m).replace('-', '−') + '·10' + String(e).split('').map((c) => SUP[c]).join('');
  }

  const SUB = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
  const sub = (i) => SUB[i] ?? String(i + 1);

  /** "q₃ = 2q₁ − q₂" from a relation returned by analyse(). */
  function relationText(rel, name = 'q') {
    const big = Math.max(1, ...rel.x.map(Math.abs));
    let out = '';
    rel.x.forEach((v, t) => {
      if (Math.abs(v) <= 1e-9 * big) return;
      const a = Math.abs(v);
      const coef = Math.abs(a - 1) < 1e-9 ? '' : fmt(a);
      const term = coef + name + sub(rel.idx[t]);
      if (out === '') out = (v < 0 ? '−' : '') + term;
      else out += (v < 0 ? ' − ' : ' + ') + term;
    });
    return name + sub(rel.j) + ' = ' + (out === '' ? '0' : out);
  }

  /** TeX version of relationText: "\\mathbf q_3 = 2\\mathbf q_1 - \\mathbf q_2". */
  function relationTex(rel) {
    const big = Math.max(1, ...rel.x.map(Math.abs));
    let out = '';
    rel.x.forEach((v, t) => {
      if (Math.abs(v) <= 1e-9 * big) return;
      const a = Math.abs(v);
      const coef = Math.abs(a - 1) < 1e-9 ? '' : fmtTex(a);
      const term = coef + '\\mathbf{q}_{' + (rel.idx[t] + 1) + '}';
      if (out === '') out = (v < 0 ? '-' : '') + term;
      else out += (v < 0 ? ' - ' : ' + ') + term;
    });
    return '\\mathbf{q}_{' + (rel.j + 1) + '} = ' + (out === '' ? '\\mathbf{0}' : out);
  }

  /** Number for TeX: up to 3 decimals, ASCII minus. */
  function fmtTex(x) {
    if (!Number.isFinite(x)) return '\\text{—}';
    let r = Math.round(x * 1000) / 1000;
    if (Math.abs(r) < 5e-4) r = 0;
    return String(r);
  }

  /** Scientific notation in TeX: 3.2 \\cdot 10^{-10}. */
  function fmtETex(x) {
    if (x === 0) return '0';
    let e = Math.floor(Math.log10(Math.abs(x)));
    let m = Math.round((x / Math.pow(10, e)) * 100) / 100;
    if (Math.abs(m) >= 10) { m /= 10; e += 1; }
    return m + ' \\cdot 10^{' + e + '}';
  }

  const api = { TOL_FACTOR, dot, norm, jacobiEig, norm2, analyse, fmt, fmtE, sub, relationText, relationTex, fmtTex, fmtETex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SV = root.SV || {};
  root.SV.linalg = api;
})(typeof window !== 'undefined' ? window : globalThis);
