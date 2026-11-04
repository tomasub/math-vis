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


cases = {"symEig": [], "norm2": [], "rank": []}

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

out = Path(__file__).with_name("fixtures.json")
out.write_text(json.dumps({"generator": "numpy " + np.__version__, "seed": 20261104, **cases}, indent=1))
print(f"wrote {out} · {sum(len(v) for v in cases.values())} cases")
