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

  /** A·x for A given as an array of rows (each length n); x has length n. Returns a vector of length rows.length. */
  function applyRows(rows, x) {
    return rows.map((r) => dot(r, x));
  }

  /**
   * Orthogonal projection of v onto span(E) for an orthonormal set E (e.g. the `.E` from
   * analyse()). Returns the coefficients ⟨v, eᵢ⟩, the projected vector, and the residual
   * norm ‖v − proj‖₂ (0 when E is empty and v is the zero vector; ‖v‖₂ when E is empty).
   */
  function projectOntoBasis(E, v) {
    const proj = v.map(() => 0);
    const coeffs = E.map((e) => {
      const c = dot(e, v);
      for (let l = 0; l < v.length; l++) proj[l] += c * e[l];
      return c;
    });
    const residual = norm(v.map((x, l) => x - proj[l]));
    return { coeffs, proj, residual };
  }

  /**
   * Extends an orthonormal set `basis` (vectors of length `dim`) to a full orthonormal
   * basis of ℝ^dim by Gram–Schmidt against the standard basis e₁…e_dim, and returns only
   * the newly added vectors (so N(A) = these vectors when `basis` spans N(A)^⊥ = the row
   * space of A). `tol` should come from the same analyse() call that produced `basis`
   * (e.g. tol = 1e-10·max(1, ‖A‖₂)) so one tolerance decides both the rank and the
   * completion — this function does not compute its own.
   */
  function completeOrthonormalBasis(basis, dim, tol) {
    const E = basis.map((v) => v.slice());
    const added = [];
    for (let i = 0; i < dim && E.length < dim; i++) {
      const e = new Array(dim).fill(0);
      e[i] = 1;
      const r = e.slice();
      for (let pass = 0; pass < 2; pass++) {
        for (const u of E) {
          const c = dot(u, r);
          for (let l = 0; l < dim; l++) r[l] -= c * u[l];
        }
      }
      const rn = norm(r);
      if (rn > tol) {
        const u = r.map((x) => x / rn);
        E.push(u);
        added.push(u);
      }
    }
    return added;
  }

  /**
   * Solves the square system M x = b (M an array of rows, b a matching array) by Gaussian
   * elimination with partial pivoting. Returns null if M is singular at the scale of its
   * own entries (no second global tolerance: the pivot is compared with the matrix's own
   * magnitude). Used for small (n ≤ 3) systems; a stable general method, as the project
   * conventions ask for when a 2×2 closed form would just special-case this anyway.
   */
  function gaussianSolve(M, b) {
    const n = M.length;
    const A = M.map((r) => r.slice());
    const y = b.slice();
    let scale = 0;
    for (const r of A) for (const x of r) scale = Math.max(scale, Math.abs(x));
    const pivTol = 1e-12 * Math.max(1, scale);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let row = col + 1; row < n; row++) if (Math.abs(A[row][col]) > Math.abs(A[piv][col])) piv = row;
      if (Math.abs(A[piv][col]) < pivTol) return null;
      if (piv !== col) { [A[piv], A[col]] = [A[col], A[piv]]; [y[piv], y[col]] = [y[col], y[piv]]; }
      for (let row = col + 1; row < n; row++) {
        const f = A[row][col] / A[col][col];
        if (f === 0) continue;
        for (let c = col; c < n; c++) A[row][c] -= f * A[col][c];
        y[row] -= f * y[col];
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  /**
   * Minimum-norm solution x of A x = b (A given by its rows, m × n), assuming the system
   * is consistent (b ∈ R(A) — callers decide that separately, e.g. with analyse() on the
   * columns of A and projectOntoBasis). The minimum-norm solution always lies in
   * N(A)^⊥ = row(A): writing x = Σ cᵢrᵢ over the orthonormal row-space basis rᵢ from
   * analyse(rows), A x = (A R) c where R's columns are the rᵢ; A R has full column rank
   * (A restricted to N(A)^⊥ is injective, Lemma 1.1.1), so c solves the small normal
   * equations (A R)ᵗ(A R) c = (A R)ᵗ b. Valid for rank-deficient A (then rows may not be
   * independent; analyse() still returns an orthonormal basis of their span).
   */
  function minNormSolve(rows, b) {
    const n = rows.length ? rows[0].length : 0;
    const rowBasis = analyse(rows).E;
    if (!rowBasis.length) return new Array(n).fill(0);
    const cols = rowBasis.map((v) => applyRows(rows, v));
    const k = cols.length;
    const G = cols.map((ci) => cols.map((cj) => dot(ci, cj)));
    const rhs = cols.map((ci) => dot(ci, b));
    const c = gaussianSolve(G, rhs) || new Array(k).fill(0);
    const x = new Array(n).fill(0);
    for (let i = 0; i < k; i++) for (let l = 0; l < n; l++) x[l] += c[i] * rowBasis[i][l];
    return x;
  }

  /** Integer gcd (always ≥ 1; gcd(0, 0) = 1 so callers never divide by 0). */
  function gcdInt(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) { const t = b; b = a % b; a = t; }
    return a || 1;
  }

  /** Integer lcm, via gcd. */
  function lcmInt(a, b) {
    return Math.abs(a * b) / gcdInt(a, b);
  }

  /**
   * Rescales a direction vector to the smallest integer vector that points along the same
   * line, for display next to the notes (e.g. a nullspace basis vector that `analyse()`
   * returns as a unit vector such as [0.577, 0.577, −0.577] is really span[1, 1, −1], the
   * same line as the notes' [−1, −1, 1]). A basis vector and any non-zero multiple of it
   * span the same subspace, so this is a display convention, not a different mathematical
   * object — the sign is normalised so the first non-zero entry of the result is positive.
   *
   * Tries, for every component relative to the largest-magnitude one, a rational
   * approximation p/q with q ≤ maxDenom; if every component matches within `tol` (relative
   * to q), the vector is rescaled to the resulting small integer vector (reduced by its
   * gcd) and `exact: true` is returned. Otherwise (no small-denominator match, e.g. an
   * irrational direction) the input vector is returned unchanged with `exact: false`, so
   * callers can fall back to showing the plain unit vector.
   *
   * This has no single "correct" numeric answer to check against NumPy (any non-zero
   * multiple is equally valid), so it is covered by hand-written tests instead of a
   * NumPy-fixture comparison.
   *
   * @param {number[]} v
   * @param {number} [maxDenom=12]
   * @param {number} [tol=1e-4]
   * @returns {{ v: number[], exact: boolean }}
   */
  function niceBasis(v, maxDenom, tol) {
    maxDenom = maxDenom || 12;
    tol = tol == null ? 1e-4 : tol;
    const n = v.length;
    if (v.every((x) => Math.abs(x) < 1e-12)) return { v: v.slice(), exact: true };
    let p = 0;
    for (let i = 1; i < n; i++) if (Math.abs(v[i]) > Math.abs(v[p])) p = i;
    let denom = 1;
    for (let i = 0; i < n; i++) {
      if (i === p) continue;
      const r = v[i] / v[p];
      let best = null;
      for (let q = 1; q <= maxDenom; q++) {
        const num = r * q;
        if (Math.abs(num - Math.round(num)) < tol * q) { best = q; break; }
      }
      if (best == null) return { v: v.slice(), exact: false };
      denom = lcmInt(denom, best);
      if (denom > 10000) return { v: v.slice(), exact: false }; // guard against a degenerate blow-up
    }
    const ints = v.map((x) => Math.round((x / v[p]) * denom));
    let g = Math.abs(ints[0]) || 1;
    for (let i = 1; i < n; i++) g = gcdInt(g, ints[i]);
    let out = ints.map((x) => x / g);
    // direction check: the rescaled integer vector must still point along v (or exactly against it)
    const nOut = norm(out), nV = norm(v);
    if (nOut === 0 || nV === 0) return { v: v.slice(), exact: false };
    const cosLike = dot(out, v) / (nOut * nV);
    if (Math.abs(cosLike - 1) > 1e-6 && Math.abs(cosLike + 1) > 1e-6) return { v: v.slice(), exact: false };
    const firstNz = out.find((x) => x !== 0) || 0;
    if (firstNz < 0) out = out.map((x) => -x);
    return { v: out, exact: true };
  }

  /**
   * Coordinates of y in the basis given by `cols` (array of columns, independent): solves
   * the m×k system [cols] z = y exactly when y lies in the span. Uses the orthonormal basis
   * from analyse() only to test membership and the small normal equations (GᵗG z = Gᵗy,
   * G has full column rank so GᵗG is invertible) to get z. Returns
   * { z, residual, inSpan, independent }: z = null if the columns are dependent;
   * `residual` = ‖y − Gz‖₂ and inSpan = residual ≤ tol (tol from analyse(cols)).
   */
  function coordsInBasis(cols, y) {
    const an = analyse(cols);
    if (an.rank < cols.length) return { z: null, residual: null, inSpan: false, independent: false };
    const G = cols.map((ci) => cols.map((cj) => dot(ci, cj)));
    const z = gaussianSolve(G, cols.map((ci) => dot(ci, y)));
    if (!z) return { z: null, residual: null, inSpan: false, independent: false };
    const res = norm(y.map((v, l) => v - cols.reduce((s, c, j) => s + z[j] * c[l], 0)));
    return { z, residual: res, inSpan: res <= an.tol * Math.max(1, norm(y)), independent: true };
  }

  /**
   * Splits the input space ℝⁿ for A (array of rows, m×n) as in the proof of Thm 1.1.1:
   * { rank, nullity, tol, N: orthonormal basis of N(A), C: orthonormal basis of N(A)^⊥ = row
   * space (a valid complement) }. rank + nullity = n always.
   */
  function splitInputSpace(rows) {
    const n = rows.length ? rows[0].length : 0;
    const cols = []; for (let j = 0; j < n; j++) cols.push(rows.map((r) => r[j]));
    const colAn = analyse(cols), rowAn = analyse(rows);
    const C = rowAn.E.slice(0, colAn.rank);
    const N = completeOrthonormalBasis(C, n, colAn.tol);
    return { rank: colAn.rank, nullity: N.length, tol: colAn.tol, N, C };
  }

  /**
   * Random m×n matrix (array of rows) of exact rank r (0 ≤ r ≤ min(m,n)): B C with B m×r and
   * C r×n having entries from `rand()` (default: uniform in [−2, 2] rounded to 0.5 steps, kept
   * away from rank loss by retrying until analyse() confirms rank r, at most 50 tries).
   */
  function randomRankMatrix(m, n, r, rand) {
    const rnd = rand || (() => Math.round((Math.random() * 4 - 2) * 2) / 2);
    for (let t = 0; t < 50; t++) {
      const B = Array.from({ length: m }, () => Array.from({ length: r }, rnd));
      const C = Array.from({ length: r }, () => Array.from({ length: n }, rnd));
      const A = B.map((br) => Array.from({ length: n }, (_, j) => br.reduce((s, v, k) => s + v * C[k][j], 0)));
      const cols = []; for (let j = 0; j < n; j++) cols.push(A.map((row) => row[j]));
      if (analyse(cols).rank === r) return A;
    }
    return null;
  }

  const api = {
    TOL_FACTOR, dot, norm, jacobiEig, norm2, analyse, fmt, fmtE, sub, relationText, relationTex, fmtTex, fmtETex,
    applyRows, coordsInBasis, splitInputSpace, randomRankMatrix, projectOntoBasis, completeOrthonormalBasis, gaussianSolve, minNormSolve, niceBasis,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SV = root.SV || {};
  root.SV.linalg = api;
})(typeof window !== 'undefined' ? window : globalThis);
