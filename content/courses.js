/* Course manifest: courses → lectures → visualisations.
   The navigation, front page, course pages and placeholder pages are generated from this.
   It is a script (not .json) so the site also works when opened straight from disk.
   Edit the object literal below; keep it valid JSON-style data. */
(function (root) {
  var manifest = {
    "site": {
      "title": "Study visualisations",
      "subtitle": "math for ChemE",
      "greeting": "Welcome back",
      "intro": "Choose the course you are focusing on. The side navigation and topic pages follow the course you pick."
    },
    "groups": [
      "Mathematics",
      "Statistics and data",
      "Chemistry and physics"
    ],
    "courses": [
      {
        "id": "ma",
        "title": "Matrix algebra",
        "group": "Mathematics",
        "status": "placeholder",
        "note": "Preliminary course to Linear algebra",
        "lectures": []
      },
      {
        "id": "la",
        "title": "Linear algebra",
        "group": "Mathematics",
        "status": "prototype",
        "note": "Matrix computations · 12 lectures, 3 chapters",
        "source": "Hannukainen, Hyvönen, Malinen — Linear Algebra, Aalto lecture notes",
        "constants": [
          [
            "arithmetic",
            "IEEE double (JS number, same as MATLAB)"
          ],
          [
            "tol",
            "1e-10·max(1, ‖A‖), shown in the UI"
          ],
          [
            "axes",
            "[−3, 3] unless stated"
          ],
          [
            "notation",
            "R(A), N(A), κ(A), σ(A), bold vectors"
          ]
        ],
        "extras": [
          "3.1 · p < 1 “spheres” (not a norm)",
          "7.2 · Courant–Fischer min–max illustration",
          "9.2 · adjustable Lotka–Volterra coefficients; free-form F(x) as a stretch goal",
          "12.2 · Eckart–Young optimality, ‖A − A_k‖₂ = σ_{k+1}"
        ],
        "flags": [
          "5.3 · correction: machine epsilon is the gap after 1, not the smallest positive double",
          "9.2 · model coefficients reconstructed from the notes; verify against the PDF",
          "11.3 · breakdown threshold shown next to the notes’ MATLAB value"
        ],
        "lectures": [
          {
            "n": 1,
            "title": "Span, independence, range and nullspace",
            "sections": "Def 1.0.1 · §1.1",
            "visualisations": [
              {
                "id": "1.1",
                "title": "Span and linear independence explorer",
                "refs": "Def 1.0.1 · (1.3)–(1.4)",
                "interaction": "drag vectors · ℝ²/ℝ³",
                "status": "ready",
                "module": "js/viz/span-explorer.js",
                "source": "Lecture 1 · Def 1.0.1 · (1.3)–(1.4)",
                "purpose_html": "The span of <b>q</b><sub>1</sub>, …, <b>q</b><sub>k</sub> is the set of all combinations Q<b>α</b> (1.3). The vectors are linearly independent when Q<b>α</b> = 0 only for <b>α</b> = 0 (1.4). Adding a dependent vector does not enlarge the span.",
                "needs": [
                  "katex"
                ]
              },
              {
                "id": "1.2",
                "title": "Range, nullspace and solvability of Ax = b",
                "refs": "Def 1.1.1 · Lem 1.1.1–1.1.2",
                "interaction": "matrix editor · linked dual panels",
                "status": "ready",
                "module": "js/viz/solvability.js",
                "source": "Lecture 1 · Def 1.1.1 · Lem 1.1.1–1.1.2 · (1.7)",
                "purpose_html": "Existence of a solution to A<b>x</b> = <b>b</b> is equivalent to <b>b</b> &isin; R(A), and uniqueness is equivalent to N(A) = {<b>0</b>} (Lem 1.1.1). Every solution is one particular solution x<sub>p</sub> plus anything in N(A) (Lem 1.1.2), so the solution set is a shifted copy of N(A). Combining the two gives the unique / infinitely many / no solution trichotomy of (1.7).",
                "needs": [
                  "katex"
                ]
              },
              {
                "id": "1.3",
                "title": "One subspace, two bases",
                "refs": "Ex 1.1.1 · Defs 1.1.3–1.1.4",
                "interaction": "3D · drag on plane",
                "status": "ready",
                "module": "js/viz/two-bases.js",
                "source": "Lecture 1 · Ex 1.1.1 · Defs 1.1.3–1.1.4",
                "purpose_html": "A subspace has infinitely many bases, but the coordinates of a vector in a given basis are unique, and every basis of R(A) has the same number of vectors (Defs 1.1.3–1.1.4). The coordinate vector <b>z</b> (column basis of A) and <b>x</b> (basis w<sub>1</sub>, w<sub>2</sub>) describe the same <b>y</b> &isin; R(A).",
                "needs": [
                  "katex",
                  "three"
                ]
              }
            ]
          },
          {
            "n": 2,
            "title": "Dimension theorem and invertibility",
            "sections": "Thm 1.1.1 · Cor 1.1.1",
            "visualisations": [
              {
                "id": "2.1",
                "title": "Dimension theorem as a split of the input space",
                "refs": "Thm 1.1.1",
                "interaction": "animation · rank slider",
                "status": "ready",
                "module": "js/viz/dimension-split.js",
                "source": "Lecture 2 · Thm 1.1.1",
                "purpose_html": "Splitting R<sup>n</sup> into N(A) and a complement, A collapses N(A) to <b>0</b> and maps the complement one-to-one onto R(A), so dim R(A) + dim N(A) = n (Thm 1.1.1): what is lost to N(A) is exactly what is missing from R(A).",
                "needs": [
                  "katex",
                  "three"
                ]
              },
              {
                "id": "2.2",
                "title": "Shape vs solvability",
                "refs": "Thm 1.1.1",
                "interaction": "sampler",
                "status": "placeholder",
                "module": "js/viz/shape-solvability.js",
                "source": "Lecture 2 · Thm 1.1.1",
                "purpose_html": "Unique solvability of A<b>x</b> = <b>b</b> for every <b>b</b> forces a square matrix: tall A leaves <b>b</b> outside R(A) (no solution), wide A has N(A) ≠ {<b>0</b>} (many solutions), the consequences of Thm 1.1.1.",
                "needs": [
                  "katex",
                  "three"
                ]
              },
              {
                "id": "2.3",
                "title": "Invertibility dashboard",
                "refs": "Cor 1.1.1",
                "interaction": "indicator lights · morph slider",
                "status": "placeholder",
                "module": "js/viz/invertibility-dashboard.js",
                "source": "Lecture 2 · Cor 1.1.1",
                "purpose_html": "The six equivalent conditions of Cor 1.1.1 for a square A (R(A) = R<sup>n</sup>, independent columns, independent rows, N(A) = {<b>0</b>}, det A ≠ 0, 0 ∉ σ(A)) switch together, because they are one fact; near the singular point det, the smallest |λ| and A<sup>−1</sup> degenerate together.",
                "needs": [
                  "katex"
                ]
              }
            ]
          },
          {
            "n": 3,
            "title": "Vector norms and inner products",
            "sections": "§1.2.1–1.2.2",
            "visualisations": [
              {
                "id": "3.1",
                "title": "p-norm unit spheres",
                "refs": "Def 1.2.1",
                "interaction": "log slider · drag",
                "status": "placeholder"
              },
              {
                "id": "3.2",
                "title": "Inner product, angle and Cauchy–Schwarz",
                "refs": "Lem 1.2.1 · (1.17)–(1.18)",
                "interaction": "drag · two modes",
                "status": "placeholder"
              },
              {
                "id": "3.3",
                "title": "Inner products from SPD matrices",
                "refs": "Lem 1.2.3 · Ex 1.2.1",
                "interaction": "matrix editor · side plot",
                "status": "placeholder"
              }
            ]
          },
          {
            "n": 4,
            "title": "Matrix norms",
            "sections": "§1.2.3",
            "visualisations": [
              {
                "id": "4.1",
                "title": "Operator norm = maximal stretching",
                "refs": "Def 1.2.5 · Lem 1.2.4–1.2.5",
                "interaction": "probe · polar plot",
                "status": "placeholder"
              },
              {
                "id": "4.2",
                "title": "Operator norms vs other matrix norms",
                "refs": "Def 1.2.6 · Lem 1.2.6",
                "interaction": "table · bar chart",
                "status": "placeholder"
              }
            ]
          },
          {
            "n": 5,
            "title": "Stability and conditioning",
            "sections": "§1.3–1.4",
            "visualisations": [
              {
                "id": "5.1",
                "title": "Perturbing Ax = b: the condition number in action",
                "refs": "Thm 1.3.2",
                "interaction": "sampling cloud · log sliders",
                "status": "placeholder"
              },
              {
                "id": "5.2",
                "title": "Nearby matrices stay invertible",
                "refs": "Thm 1.3.1",
                "interaction": "matrix slice · convergence plot",
                "status": "placeholder"
              },
              {
                "id": "5.3",
                "title": "Floating point and the Hilbert matrix",
                "refs": "§1.4",
                "interaction": "log plot",
                "status": "placeholder"
              }
            ]
          },
          {
            "n": 6,
            "title": "Eigenvalues and eigenvectors",
            "sections": "§2.1",
            "visualisations": [
              {
                "id": "6.1",
                "title": "Eigenvector hunt (2×2)",
                "refs": "Lem 2.1.1 · Ex 2.1.3",
                "interaction": "sweep · side plot",
                "status": "placeholder"
              },
              {
                "id": "6.2",
                "title": "Algebraic vs geometric multiplicity",
                "refs": "Thm 2.1.1",
                "interaction": "parameter slider",
                "status": "placeholder"
              },
              {
                "id": "6.3",
                "title": "Diagonalisation as change of basis",
                "refs": "A = VΛV⁻¹",
                "interaction": "staged animation",
                "status": "placeholder"
              }
            ]
          },
          {
            "n": 7,
            "title": "Hermitian matrices and the Rayleigh quotient",
            "sections": "§2.2",
            "visualisations": [
              {
                "id": "7.1",
                "title": "Spectral theorem: symmetric vs non-symmetric",
                "refs": "Lem 2.2.1–2.2.2 · Thm 2.2.1",
                "interaction": "linked dual panels",
                "status": "placeholder"
              },
              {
                "id": "7.2",
                "title": "Rayleigh quotient landscape",
                "refs": "Thm 2.2.2",
                "interaction": "plot · 3D heat map",
                "status": "placeholder"
              }
            ]
          },
          {
            "n": 8,
            "title": "Similarity, Schur, Jordan, matrix exponential",
            "sections": "§2.3–2.4",
            "visualisations": [
              {
                "id": "8.1",
                "title": "Similar matrices: same map, different basis",
                "refs": "Def 2.3.1 · Lem 2.3.1",
                "interaction": "linked dual panels",
                "status": "placeholder"
              },
              {
                "id": "8.2",
                "title": "Schur and Jordan form explorer",
                "refs": "Thm 2.3.1–2.3.2",
                "interaction": "tabs · builder",
                "status": "placeholder"
              },
              {
                "id": "8.3",
                "title": "Matrix exponential: series and trajectories",
                "refs": "(2.19)",
                "interaction": "convergence plot · trajectory",
                "status": "placeholder"
              }
            ]
          },
          {
            "n": 9,
            "title": "Qualitative ODE analysis and normal equations",
            "sections": "§2.4.1 · §3.1",
            "visualisations": [
              {
                "id": "9.1",
                "title": "Phase portrait of y′ = Ay with classification",
                "refs": "§2.4.1",
                "interaction": "vector field · trace–det plane",
                "status": "placeholder"
              },
              {
                "id": "9.2",
                "title": "Linearisation at equilibria: Lotka–Volterra",
                "refs": "Ex 2.4.2",
                "interaction": "click · zoom panel",
                "status": "placeholder"
              },
              {
                "id": "9.3",
                "title": "Least squares fit of a spring constant",
                "refs": "Ex 3.1.1",
                "interaction": "drag points · side plot",
                "status": "placeholder"
              },
              {
                "id": "9.4",
                "title": "Fitting an ellipse to a point cloud",
                "refs": "Ex 3.1.2",
                "interaction": "click to add points",
                "status": "placeholder"
              }
            ]
          },
          {
            "n": 10,
            "title": "Projections",
            "sections": "§3.2",
            "visualisations": [
              {
                "id": "10.1",
                "title": "Orthogonal vs oblique projection in ℝ²",
                "refs": "Ex 3.2.1–3.2.2 · Def 3.2.1",
                "interaction": "drag · toggle",
                "status": "placeholder"
              },
              {
                "id": "10.2",
                "title": "Orthogonal projection onto a subspace of ℝ³",
                "refs": "(3.16) · Def 3.2.3",
                "interaction": "3D · drag",
                "status": "placeholder"
              }
            ]
          },
          {
            "n": 11,
            "title": "Least squares geometry and QR",
            "sections": "§3.3–3.4",
            "visualisations": [
              {
                "id": "11.1",
                "title": "Least squares as projection: the two views",
                "refs": "(3.21)",
                "interaction": "linked 2D ↔ 3D panels",
                "status": "placeholder"
              },
              {
                "id": "11.2",
                "title": "Gram–Schmidt step by step → A = QR",
                "refs": "Lem 3.4.1 · (3.25)",
                "interaction": "stepper · 3D",
                "status": "placeholder"
              },
              {
                "id": "11.3",
                "title": "Why not the normal equations?",
                "refs": "Ex 3.4.1",
                "interaction": "log-log plot",
                "status": "placeholder"
              }
            ]
          },
          {
            "n": 12,
            "title": "Singular value decomposition",
            "sections": "§3.5",
            "visualisations": [
              {
                "id": "12.1",
                "title": "SVD geometry: rotate–stretch–rotate",
                "refs": "Lem 3.5.1",
                "interaction": "staged animation",
                "status": "placeholder"
              },
              {
                "id": "12.2",
                "title": "SVD as a sum of rank-1 matrices",
                "refs": "§3.5",
                "interaction": "layers · image",
                "status": "placeholder"
              },
              {
                "id": "12.3",
                "title": "Pseudoinverse and the minimum-norm LSQ solution",
                "refs": "Thm 3.5.2–3.5.3 · Cor 3.5.1",
                "interaction": "threshold slider · drag",
                "status": "placeholder"
              }
            ]
          }
        ]
      },
      {
        "id": "dic1",
        "title": "Differential and integral calculus 1",
        "group": "Mathematics",
        "status": "placeholder",
        "note": "Not built yet",
        "lectures": []
      },
      {
        "id": "dic2",
        "title": "Differential and integral calculus 2",
        "group": "Mathematics",
        "status": "placeholder",
        "note": "Not built yet",
        "lectures": []
      },
      {
        "id": "dic3",
        "title": "Differential and integral calculus 3",
        "group": "Mathematics",
        "status": "placeholder",
        "note": "Not built yet",
        "lectures": []
      },
      {
        "id": "ps",
        "title": "Probability and statistics",
        "group": "Statistics and data",
        "status": "placeholder",
        "note": "Not built yet",
        "lectures": []
      },
      {
        "id": "si",
        "title": "Statistical inference",
        "group": "Statistics and data",
        "status": "placeholder",
        "note": "Not built yet",
        "lectures": []
      },
      {
        "id": "ml",
        "title": "Machine learning",
        "group": "Statistics and data",
        "status": "placeholder",
        "note": "Not built yet",
        "lectures": []
      },
      {
        "id": "ass",
        "title": "Atom structure and spectroscopy",
        "group": "Chemistry and physics",
        "status": "placeholder",
        "note": "Not built yet",
        "lectures": []
      },
      {
        "id": "td",
        "title": "Thermodynamics",
        "group": "Chemistry and physics",
        "status": "placeholder",
        "note": "Not built yet",
        "lectures": []
      }
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = manifest;
  root.SV = root.SV || {};
  root.SV.manifest = manifest;
})(typeof window !== 'undefined' ? window : globalThis);
