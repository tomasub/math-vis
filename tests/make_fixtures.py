"""Generate reference results with NumPy for the JavaScript math tests.

    python3 tests/make_fixtures.py      # writes tests/fixtures.json

Re-run after adding cases. The JS tests (node tests/run.js) compare against this file,
so the JS numerics are checked against an independent implementation (LAPACK via NumPy).
"""
import json
from pathlib import Path

import numpy as np

rng = np.random.default_rng(20261104)
TOL_FACTOR = 1e-10


def tol_for(Q):
    return TOL_FACTOR * max(1.0, np.linalg.norm(Q, 2)) if Q.size else TOL_FACTOR


def cols(Q):
    """Matrix (n×k) → list of columns, as the JS code expects."""
    return [Q[:, j].tolist() for j in range(Q.shape[1])]


def first_relation(Q):
    """First column that lies in the span of the earlier ones (rank decided with tol),
    with its coefficients on the earlier *independent* columns (greedy, in order)."""
    tol = tol_for(Q)
    idx = []
    for j in range(Q.shape[1]):
        B = Q[:, idx]
        if idx:
            x, *_ = np.linalg.lstsq(B, Q[:, j], rcond=None)
            res = np.linalg.norm(Q[:, j] - B @ x)
        else:
            x, res = np.zeros(0), np.linalg.norm(Q[:, j])
        if res > tol:
            idx.append(j)
        else:
            return {"j": j, "idx": idx, "x": x.tolist()}
    return None


cases = {"symEig": [], "norm2": [], "rank": [], "gaussianSolve": [], "projectOntoBasis": [], "solvability": []}

# symmetric eigenvalues, n = 2…4
for _ in range(40):
    n = int(rng.integers(2, 5))
    A = rng.normal(size=(n, n)) * rng.choice([0.01, 1, 100])
    A = (A + A.T) / 2
    cases["symEig"].append({"A": A.tolist(), "eig": np.sort(np.linalg.eigvalsh(A)).tolist()})

# spectral norm of n×k matrices
for _ in range(40):
    n, k = int(rng.integers(1, 4)), int(rng.integers(1, 5))
    Q = rng.normal(size=(n, k)) * rng.choice([1e-3, 1, 1e3])
    cases["norm2"].append({"cols": cols(Q), "norm2": float(np.linalg.norm(Q, 2))})


def add_rank_case(Q, label):
    tol = tol_for(Q)
    cases["rank"].append({
        "label": label,
        "cols": cols(Q),
        "rank": int(np.linalg.matrix_rank(Q, tol=tol)),
        "tol": tol,
        "relation": first_relation(Q),
    })


# full rank, exact rank deficiency, near deficiency well below / above tol
for _ in range(30):
    n = int(rng.integers(2, 4)); k = int(rng.integers(1, 5))
    add_rank_case(rng.integers(-6, 7, size=(n, k)) / 2.0, "random grid")
for _ in range(30):
    n = int(rng.integers(2, 4)); k = int(rng.integers(2, 5))
    Q = rng.integers(-6, 7, size=(n, k)) / 2.0
    j = int(rng.integers(1, k))
    c = rng.choice([-1.5, -1, -0.5, 0.5, 1, 1.5], size=j)
    Q[:, j] = Q[:, :j] @ c                       # exact dependence
    add_rank_case(Q, "exact dependence")
for scale, label in [(1e-13, "perturbed 1e-13 (dependent)"), (1e-7, "perturbed 1e-7 (independent)")]:
    for _ in range(15):
        n = 3; k = 3
        Q = rng.normal(size=(n, k))
        Q[:, 2] = 0.7 * Q[:, 0] - 1.3 * Q[:, 1]
        e = rng.normal(size=n); e -= Q[:, :2] @ np.linalg.lstsq(Q[:, :2], e, rcond=None)[0]
        Q[:, 2] += scale * e / np.linalg.norm(e)  # move off the plane by exactly `scale`
        add_rank_case(Q, label)
add_rank_case(np.zeros((2, 1)), "zero vector")
add_rank_case(np.array([[1.0, 0, 0], [0, 0, 1], [0, 0, 0]]), "zero column in the middle")

# gaussianSolve: random invertible k×k systems vs numpy.linalg.solve (1.2's math/linalg.js)
for _ in range(30):
    k = int(rng.integers(1, 5))
    M = rng.normal(size=(k, k))
    if abs(np.linalg.det(M)) < 1e-6:
        continue
    b = rng.normal(size=k)
    x = np.linalg.solve(M, b)
    cases["gaussianSolve"].append({"M": M.tolist(), "b": b.tolist(), "x": x.tolist()})

# projectOntoBasis: v projected onto a random orthonormal partial basis (possibly empty/full)
for _ in range(30):
    n = int(rng.integers(2, 4))
    k = int(rng.integers(0, n + 1))
    if k == 0:
        E = np.zeros((n, 0))
    else:
        Q, _ = np.linalg.qr(rng.normal(size=(n, k)))
        E = Q[:, :k]
    v = rng.normal(size=n)
    coeffs = (E.T @ v) if k else np.zeros(0)
    proj = (E @ coeffs) if k else np.zeros(n)
    residual = float(np.linalg.norm(v - proj))
    cases["projectOntoBasis"].append({
        "E": [E[:, j].tolist() for j in range(k)], "v": v.tolist(),
        "coeffs": coeffs.tolist(), "proj": proj.tolist(), "residual": residual,
    })

# Solvability of Ax = b (1.2): rank, nullity and the minimum-norm solution (via SVD,
# truncated at the same tol as analyse()'s rank decision) for a consistent system.
# Ranks are mostly full here (random matrices), with some rows made exactly dependent so
# N(A) is non-trivial, matching the "infinitely many solutions" case the UI must show.
def add_solvability_case(A, label):
    m, n = A.shape
    tol = tol_for(A)
    rank = int(np.linalg.matrix_rank(A, tol=tol))
    x_true = rng.integers(-4, 5, size=n) / 2.0
    b = A @ x_true
    U, S, Vt = np.linalg.svd(A, full_matrices=False)
    keep = S > tol
    S_inv = np.zeros_like(S)
    S_inv[keep] = 1.0 / S[keep]
    x_min = (Vt.T * S_inv) @ (U.T @ b)
    cases["solvability"].append({
        "label": label, "rows": A.tolist(), "b": b.tolist(), "tol": tol,
        "rank": rank, "nullity": n - rank, "minNormX": x_min.tolist(),
    })


for _ in range(25):
    m, n = int(rng.integers(1, 4)), int(rng.integers(1, 4))
    add_solvability_case(rng.integers(-4, 5, size=(m, n)) / 2.0, "random (usually full rank)")
for _ in range(20):
    m, n = int(rng.integers(2, 4)), int(rng.integers(2, 4))
    A = rng.integers(-4, 5, size=(m, n)) / 2.0
    j = int(rng.integers(1, n))
    c = rng.choice([-1.5, -1, -0.5, 0.5, 1, 1.5], size=j)
    A[:, j] = A[:, :j] @ c  # exact column dependence -> non-trivial N(A)
    add_solvability_case(A, "rank-deficient (non-trivial N(A))")
add_solvability_case(np.zeros((3, 2)), "zero matrix")
add_solvability_case(np.eye(3), "identity")

# 1.3 / 2.1: coordinates in a basis (numpy lstsq) and the split of R^n into N(A) + N(A)^perp
cases["coordsInBasis"] = []
for _ in range(25):
    m = int(rng.integers(2, 4)); k = int(rng.integers(1, m + 1))
    G = rng.integers(-4, 5, size=(m, k)) / 2.0
    if np.linalg.matrix_rank(G) < k:
        continue
    z = rng.integers(-4, 5, size=k) / 2.0
    cases["coordsInBasis"].append({"cols": cols(G), "y": (G @ z).tolist(), "z": np.linalg.lstsq(G, G @ z, rcond=None)[0].tolist()})
cases["splitInput"] = []
for _ in range(25):
    m, n = int(rng.integers(1, 4)), int(rng.integers(1, 4))
    A = rng.integers(-4, 5, size=(m, n)) / 2.0
    if rng.random() < 0.5 and n > 1:
        A[:, n - 1] = A[:, 0]
    r = int(np.linalg.matrix_rank(A, tol=tol_for(A)))
    cases["splitInput"].append({"rows": A.tolist(), "rank": r, "nullity": n - r})

# 2.2 / 2.3: det, inverse, singular values, eigenvalues, solution-set kind
cases["detInv"] = []
for _ in range(30):
    n = int(rng.integers(1, 4))
    A = rng.integers(-4, 5, size=(n, n)) / 2.0
    if rng.random() < 0.3 and n > 1:
        A[:, n - 1] = A[:, 0]
    ev = np.linalg.eigvals(A)
    singular = bool(np.linalg.matrix_rank(A, tol=tol_for(A)) < n)
    cases["detInv"].append({"rows": A.tolist(), "det": float(np.linalg.det(A)), "singular": singular,
        "inv": None if singular else np.linalg.inv(A).tolist(),
        "sv": np.linalg.svd(A, compute_uv=False).tolist(),
        "eig": sorted([[float(z.real), float(abs(z.imag))] for z in ev])})
cases["singularValues"] = []
for _ in range(20):
    m, n = int(rng.integers(1, 4)), int(rng.integers(1, 4))
    A = rng.integers(-4, 5, size=(m, n)) / 2.0
    cases["singularValues"].append({"rows": A.tolist(), "sv": np.linalg.svd(A, compute_uv=False).tolist()})
cases["classify"] = []
for _ in range(40):
    m, n = int(rng.integers(1, 4)), int(rng.integers(1, 4))
    A = rng.integers(-4, 5, size=(m, n)) / 2.0
    if rng.random() < 0.5:
        b = A @ (rng.integers(-4, 5, size=n) / 2.0)
    else:
        b = rng.integers(-4, 5, size=m) / 2.0
    r = int(np.linalg.matrix_rank(A, tol=tol_for(A)))
    rb = int(np.linalg.matrix_rank(np.column_stack([A, b]), tol=tol_for(np.column_stack([A, b]))))
    kind = "none" if rb > r else ("unique" if r == n else "many")
    cases["classify"].append({"rows": A.tolist(), "b": b.tolist(), "kind": kind})

out = Path(__file__).with_name("fixtures.json")
out.write_text(json.dumps({"generator": "numpy " + np.__version__, "seed": 20261104, **cases}, indent=1))
print(f"wrote {out} · {sum(len(v) for v in cases.values())} cases")
