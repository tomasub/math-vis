---
date created: 2026-10-28T15:10
date modified: 2026-10-28T17:10
---
# Linear algebra visualisation catalogue

Source: `la_2020_HUGE.pdf`, the Aalto *Linear Algebra* lecture notes by Hannukainen, Hyvönen and Malinen
(12 lectures, 3 chapters). The lecture boundaries and the definition/theorem/example numbers are taken from the notes.

Each entry lists:
- **Shows**: what is on screen
- **User controls**: what you can change
- **Fixed by system**: values the site sets and you can't change
- **Purpose**: what the visualisation should teach

★ marks the suggested working-sample set.

General system constants for all visualisations (not repeated below):
- double-precision arithmetic, i.e. JS `number`, the same as MATLAB
- a rank/zero tolerance `tol = 1e-10·max(1, ‖A‖)`, shown in the UI
- axis range [−3, 3] unless stated otherwise
- notation exactly as in the notes: R(A), N(A), bold vectors, κ(A), σ(A) = spectrum

---

## Lecture 1: Span, independence, range and nullspace (Def 1.0.1, §1.1 up to Example 1.1.2)

### 1.1 Span and linear independence explorer

- **Shows:** vectors q₁…q_k drawn from the origin. The current combination Qα = Σ αⱼqⱼ is drawn tip-to-tail, and span(q₁,…,q_k) is shaded. Depending on the vectors that is a point, line, plane or all of ℝⁿ. A status line reads "linearly independent", or "dependent: q₃ = 2q₁ − q₂" with the actual relation found.
- **User controls:** the space (ℝ² or ℝ³), k = 1…4, dragging vector tips (with snap-to-grid), and α sliders. The "Make dependent" button drops the last vector into the span of the others.
- **Fixed by system:** the zero vector is drawn but excluded from the drag targets. In ℝ³ the 3D view (orbit camera) has the span plane rendered semi-transparent. Independence is decided by rank(Q) = k with tol.
- **Purpose:** link Def 1.0.1 and (1.3)–(1.4) to geometry. The span is the set of all Qα, and independence means Qα = 0 only for α = 0. It also shows that adding a dependent vector does not enlarge the span.

### ★ 1.2 Range, nullspace and solvability of Ax = b

- **Shows:** two side-by-side panels:
  - *input space ℝⁿ*: N(A) as a line or plane, the solution set x_p + N(A) (Lemma 1.1.2) drawn as a shifted copy of N(A), and a draggable x
  - *output space ℝᵐ*: R(A) = span of the columns, and a draggable **b**

  A verdict panel shows three results: b ∈ R(A)? (yes/no), N(A) = {0}? (yes/no), and from these "unique / infinitely many / no solution" according to (1.7).
- **User controls:** the entries of A (2×2, 3×2, 2×3 or 3×3), dragging **b**, and dragging x (Ax moves live in the right panel). Presets: Example 1.1.1 (A = [1 1; 0 −1; 2 2]) and Example 1.1.2 (A = [1 0 1; 0 2 2; −1 1 0], N(A) = span[−1, −1, 1]ᵀ).
- **Fixed by system:** dimensions are capped at 3, and rank decisions use tol. When b ∉ R(A) the distance from b to R(A) is shown, so "no solution" is not just a binary verdict. The same distance comes back in Lecture 11.
- **Purpose:** existence ⇔ b ∈ R(A), and uniqueness ⇔ N(A) = {0} (Lemma 1.1.1). All solutions are one particular solution plus anything in the nullspace. These three statements are the backbone of Chapter 1.
- **Check yourself:** before the verdict is revealed, predict whether the dragged **b** has 0, 1 or ∞ solutions.

### 1.3 One subspace, two bases (Example 1.1.1)

- **Shows:** the plane R(A) ⊂ ℝ³ with two coordinate grids on it: one spanned by the columns of A and one by w₁ = [1,0,2]ᵀ, w₂ = [0,1,0]ᵀ. A point y on the plane displays both coordinate vectors z (A = column basis) and x (W basis), and the conversion x₁ = z₁ + z₂, x₂ = −z₂ from the notes.
- **User controls:** dragging y within the plane, editing w₁ and w₂ (the site warns if they leave the plane or become dependent), and toggling each grid on or off.
- **Fixed by system:** the subspace is fixed to R(A) from Example 1.1.1, which keeps the comparison honest. Coordinates are computed by solving the 3×2 system exactly (the point is constrained to the plane).
- **Purpose:** a subspace has infinitely many bases, but coordinates in a given basis are unique, and every basis has the same size (Defs 1.1.3–1.1.4). This stops the student from treating "the coordinates of a vector" as a property of the vector alone.

---

## Lecture 2: Dimension theorem and invertibility (Thm 1.1.1, Cor 1.1.1, inverse)

### 2.1 Dimension theorem as a split of the input space

- **Shows:** ℝⁿ (n ≤ 3) split into N(A), spanned by v₁…v_k, and a complement spanned by w₁…w_{n−k}, as in the proof of Thm 1.1.1. An animation applies A: the nullspace collapses to 0 and the complement maps one-to-one onto R(A). A bar shows dim R(A) + dim N(A) = n, with the two parts filling a fixed-length bar.
- **User controls:** the matrix entries, or a "rank" slider (0…min(m,n)) that generates a random matrix of that rank, the shape m×n, and play/scrub of the animation.
- **Fixed by system:** the complement is chosen as N(A)^⊥, a valid choice in the proof. The UI notes that any complement works.
- **Purpose:** the theorem says that what is lost to N(A) is exactly what is missing from R(A). Seeing it as a conservation law makes the Chapter-1 corollaries feel obvious.

### 2.2 Shape vs solvability

- **Shows:** for a wide (m < n) or tall (m > n) A, which of the two failures from the notes must occur: "no solution for some b" (tall) or "many solutions for some b" (wide). A sampler shows sample right-hand sides b and marks each as solvable (unique), solvable (many) or not solvable.
- **User controls:** m and n (1…3), the matrix entries, and "sample b".
- **Fixed by system:** the sample b vectors are drawn uniformly from a ball. For tall A, almost every sample is unsolvable, and the UI points this out explicitly, since R(A) has measure zero.
- **Purpose:** the result that "unique solvability for all b requires a square matrix" (the consequence of Thm 1.1.1). It also exercises the syllogisms the notes ask students to make sure they understand.

### ★ 2.3 Invertibility dashboard (Cor 1.1.1)

- **Shows:** a 2×2 or 3×3 matrix with the six equivalent conditions of Cor 1.1.1 as indicator lights:
  1. R(A) = ℝⁿ
  2. independent columns
  3. independent rows
  4. N(A) = {0}
  5. det A ≠ 0
  6. 0 ∉ σ(A)

  The panel also shows the numerical values behind each light (det A, smallest |λ|, smallest singular value) and the entries of A⁻¹ when it exists.
- **User controls:** the matrix entries, and a morph slider t ∈ [0,1] that moves A(t) = (1−t)A + tA_singular toward a chosen singular matrix.
- **Fixed by system:** each condition is evaluated with tol, and tol is displayed.
- **Purpose:** the six conditions switch together, because they are one fact. Near the singular point, det, the smallest eigenvalue and the entries of A⁻¹ all degenerate together. This sets up Lecture 5 (conditioning).
- **Note:** det A and the eigenvalues are only exactly zero at the singular end. In floating point it is ‖A⁻¹‖ that tells you how close you are. Say so in the UI.

---

## Lecture 3: Vector norms and inner products (§1.2.1–1.2.2)

### ★ 3.1 P-norm unit spheres (extends `unitc.m`)

- **Shows:** the unit sphere {x : ‖x‖_p = 1} in ℝ² for the current p. The p = 1, 2, ∞ curves stay as faint references, matching `unitspheres_together.png`. A draggable x shows ‖x‖₁, ‖x‖₂, ‖x‖_p and ‖x‖_∞ as numbers and as the scale factor ρ that places x on each sphere (the ρ = 1/‖x‖_p construction from `unit_2.m`). A triangle-inequality mode shows x, y and x + y with ‖x + y‖_p ≤ ‖x‖_p + ‖y‖_p as two bars.
- **User controls:** p from 1 to 50 on a log slider, plus an ∞ button; dragging x (and y); and an optional "show p < 1" toggle.
- **Fixed by system:** ℝ² only (ℝ³ optional), and 1000 sample directions, as in the MATLAB scripts. The p < 1 toggle is clearly labelled "not a norm; triangle inequality fails". The notes only define 1 ≤ p < ∞, so this is an extra.
- **Purpose:** Def 1.2.1 in pictures, and the homework lim_{p→∞} ‖x‖_p = ‖x‖_∞: as p grows the sphere becomes the square, because the largest component dominates. With p < 1 the sphere loses convexity, which shows why the triangle inequality is the axiom that fails.

### 3.2 Inner product, angle and Cauchy–Schwarz

- **Shows:** x and y with the angle θ, cos θ = x·y / (‖x‖₂‖y‖₂), and the decomposition from the Cauchy–Schwarz proof: x = (⟨x,y⟩/‖y‖²) y + remainder, with the remainder ⊥ y. A bar compares |⟨x,y⟩| with ‖x‖‖y‖, and the two are equal only when x ∥ y. An orthonormal-basis mode uses two orthonormal q₁, q₂ and shows the coefficients αⱼ = ⟨x, qⱼ⟩ of (1.18) as projections.
- **User controls:** dragging x, y, q₁ (q₂ follows as the perpendicular), and switching between mode A (C–S) and mode B (orthonormal basis).
- **Fixed by system:** the Euclidean inner product in ℝ². The general inner product is the next visualisation.
- **Purpose:** connect the algebraic dot product to geometry (law of cosines), see where C–S comes from, and see why orthonormal bases make coefficients trivial to compute (Lemma 1.2.1, (1.17)–(1.18)).

### 3.3 Inner products from SPD matrices (Lemma 1.2.3, Example 1.2.1)

- **Shows:** for a symmetric 2×2 A, the "unit sphere" {x : xᵀAx = 1}. It is an ellipse when A is positive definite. Drag x to see the line of vectors A-orthogonal to x (yᵀAx = 0), next to the ordinary orthogonal line. A preset reproduces Example 1.2.1: ∫₀¹ (α₀ + α₁x)² dx = α₀² + α₀α₁ + α₁²/3, i.e. A = [1 ½; ½ ⅓]. A side plot shows the polynomial p(x) = α₀ + α₁x on [0,1].
- **User controls:** a₁₁, a₁₂ (= a₂₁) and a₂₂, dragging x, and the Example 1.2.1 preset.
- **Fixed by system:** symmetry is enforced. Positive definiteness is checked via eigenvalues. If A is only semidefinite or indefinite, the curve becomes degenerate or hyperbolic and the panel says "not an inner product": axiom (i) fails.
- **Purpose:** orthogonality and length depend on the chosen inner product. Every inner product on ℝⁿ is xᵀAy for an SPD A. Problem-specific norms (the notes' term) are a real thing, not a curiosity.

---

## Lecture 4: Matrix norms (§1.2.3)

### ★ 4.1 Operator norm = maximal stretching

- **Shows:** the unit sphere S of the chosen vector norm and its image AS. This is the notes' red-circle / blue-ellipse figure, generalised to the 1- and ∞-norms. A probe x on S rotates, and a polar plot of ‖Ax‖/‖x‖ against direction marks the maximiser x*. Three numbers are compared:
  - ‖A‖ found by brute-force maximisation
  - the closed form: maximum column sum (1-norm), maximum row sum (∞-norm), or √λ_max(AᵀA) (2-norm, Lemma 1.2.5)
  - the inequality ‖Ax‖ ≤ ‖A‖‖x‖ (Lemma 1.2.4) for the current probe
- **User controls:** the 2×2 entries, the norm (1, 2 or ∞), dragging the probe, and a preset with the notes' figure matrix.
- **Fixed by system:** 2000 sample directions for the brute-force maximum, which is shown alongside the closed form so you can see the two agree to about 3 digits.
- **Purpose:** Def 1.2.5 as a picture ("maximum amplification of length"). Different vector norms give different matrix norms, and the 1/∞/2 formulas are shortcuts for the same maximisation.

### 4.2 Operator norms vs other matrix norms

- **Shows:** a table and bar chart of ‖A‖₁, ‖A‖₂, ‖A‖_∞, ‖A‖_F and ‖A‖_max for the current A, plus a test row for the identity I: operator norms give ‖I‖ = 1, while ‖I‖_F = √n. A submultiplicativity checker for ‖AB‖ ≤ ‖A‖‖B‖ uses a second matrix B.
- **User controls:** the A and B entries, and the size n (2 or 3).
- **Fixed by system:** the list of norms. There are no hidden "random" checks; every inequality shown is evaluated on the actual matrices.
- **Purpose:** Def 1.2.6 and Lemma 1.2.6: every operator norm is a matrix norm, but not every matrix norm is an operator norm. The identity test is the quickest way to see it. Also the homework "what inner product gives ‖·‖_F?" (answer: Σ aᵢⱼbᵢⱼ = trace(BᵀA), behind a reveal).

---

## Lecture 5: Stability and conditioning (§1.3–1.4)

### ★ 5.1 Perturbing Ax = b: the condition number in action

- **Shows:** a 2×2 system as two lines intersecting at x. A cloud of perturbed right-hand sides b + δb with ‖δb‖ ≤ ε‖b‖ maps to a cloud of solutions x̃, which is an ellipse stretched along the worst direction. A live comparison shows the measured relative error ‖x̃ − x‖/‖x‖ against the bound κ(A)·‖δb‖/‖b‖. With δA on, the full bound of Thm 1.3.2 is used, including the 1/(1 − κ‖δA‖/‖A‖) factor, and it is marked "invalid" when ‖δA‖ ≥ 1/‖A⁻¹‖.
- **User controls:**
  - an angle slider between the two lines, which controls κ directly
  - or free matrix entries
  - ε for δb and for δA (log sliders)
  - the norm (1, 2 or ∞)
  - "show worst-case δb", which aligns δb with the singular vector that achieves the bound
- **Fixed by system:** 300 samples in the cloud. κ(A) = ‖A‖‖A⁻¹‖ is computed in the selected norm.
- **Purpose:** near-parallel lines are ill-conditioned. The condition number is the worst-case amplification of relative error, the bound is attained in specific directions, and most random perturbations stay below it. Students often read κ as a typical error factor; this shows it is a worst case.

### 5.2 Nearby matrices stay invertible (Thm 1.3.1, Neumann series)

- **Shows:**
  - *left*: a 2D slice of matrix space, A + s·E₁ + t·E₂, with the singular set det = 0 drawn as a curve and the guaranteed-safe ball ‖δA‖ < 1/‖A⁻¹‖ as a disc. The disc never crosses the curve, and in the 2-norm it touches it, because 1/‖A⁻¹‖₂ = σ_min is exactly the distance to singularity.
  - *right*: the partial sums s_k = Σ Bⁱ, B = −A⁻¹δA, converging to (I − B)⁻¹, with an error-vs-k plot and the geometric-series bound ‖B‖^{k+1}/(1 − ‖B‖).
- **User controls:** A, the slice directions E₁ and E₂ (presets: single-entry matrices), and a draggable δA point in the slice.
- **Fixed by system:** the 2-norm is the default, so the disc touches the singular curve. In other norms it may not. Cap k_max = 60.
- **Purpose:** "if a matrix is invertible, so are all nearby matrices". The condition ‖δA‖‖A⁻¹‖ < 1 is sufficient but not necessary: pick δA outside the disc that is still invertible, and the Neumann series can still converge when the spectral radius of B is < 1 even though ‖B‖ ≥ 1. The UI shows this case and says why.

### 5.3 Floating point and the Hilbert matrix (§1.4)

- **Shows:**
  - *panel 1*: the spacing of double-precision numbers near 1, i.e. the machine epsilon u ≈ 2.2·10⁻¹⁶, and near 10ᵏ
  - *panel 2*: solving H_n x = H_n·[1,…,1]ᵀ for the Hilbert matrix H_n (n = 2…14), plotting the measured error ‖x̃ − 1‖/‖1‖ against u·κ(H_n) on a log scale
- **User controls:** n, and the solver (Gaussian elimination with or without pivoting, or `A\b`-like LU with partial pivoting).
- **Fixed by system:** IEEE double precision (real, not simulated: JS uses the same format as MATLAB). Exact κ(H_n) values are taken from a table, since computing them in double precision is itself inaccurate for large n. The UI says this.
- **Purpose:** why the notes call solving Ax = b on a computer "not a trivial matter". Roughly log₁₀ κ digits are lost, and by n ≈ 12 the answer has no correct digits.
- **Correction to flag in the UI:** the notes describe the machine epsilon as "the smallest positive number that can be represented at all". That is not right. The smallest positive double is about 5·10⁻³²⁴. The machine epsilon is the gap between 1 and the next float (equivalently, the relative rounding error bound). The visualisation should show the correct definition and note the discrepancy.

---

## Lecture 6: Eigenvalues and eigenvectors (Ch 2 intro, §2.1)

### ★ 6.1 Eigenvector hunt (2×2)

- **Shows:** a unit vector x sweeping around the circle with Ax drawn from the same origin. Eigenvectors are the directions where Ax ∥ x. Each is highlighted, with λ = signed length ratio. A side plot shows the characteristic polynomial p_A(λ) = λ² − (tr A)λ + det A (Lemma 2.1.1 base case) with its real roots marked. When the roots are complex, the plot shows their real/imaginary parts and the main view says "no real eigen-directions".
- **User controls:** the 2×2 entries, and manual drag or auto-sweep of x. Presets:
  - rotation [0 −1; 1 0], λ = ±i, from the notes' "why complex numbers"
  - Example 2.1.3 [3 −1; 1 1], double eigenvalue 2, only one eigen-direction
  - a diagonal matrix
  - a shear
- **Fixed by system:** the eigen-direction detection threshold is |sin∠(x, Ax)| < tol. The roots are computed in closed form from the quadratic.
- **Purpose:** Av = λv means "A only stretches v". Real 2×2 matrices can have zero, one or two eigen-directions, and the complex case is not an exotic extra: a simple rotation already needs it.
- **Check yourself:** guess the number of real eigen-directions before the sweep runs.

### 6.2 Algebraic vs geometric multiplicity: watching a matrix become defective

- **Shows:** a family A(t) = [2 1; t² 2], with eigenvalues 2 ± t. As t → 0 the two eigenvalues merge and the two eigenvectors rotate toward each other until they coincide. A readout shows μ_A, μ_G, the angle between the eigenvectors, and cond(V) of the eigenvector matrix, which blows up as t → 0.
- **User controls:** t, and a choice of family (merging into a defective matrix versus merging into 2I, which stays diagonalisable).
- **Fixed by system:** both families are chosen to have analytic eigenpairs, so the display has no numerical noise.
- **Purpose:** non-defective means μ_A = μ_G and diagonalisable. Thm 2.1.1: distinct eigenvalues give independent eigenvectors, and the visualisation shows how that independence degenerates continuously, while merging into 2I shows that coinciding eigenvalues do not always cause trouble.

### 6.3 Diagonalisation as change of basis (A = VΛV⁻¹)

- **Shows:** a grid and a test shape (e.g. an "F" glyph, so orientation is visible). A plays in three animated stages: V⁻¹ (go to eigen-coordinates), Λ (scale along the axes), V (come back). The composed result is compared with applying A directly.
- **User controls:** a diagonalisable 2×2 (the site refuses defective matrices with a message linking to 6.2), the stage scrubber, and the speed.
- **Fixed by system:** eigenvectors are normalised to unit length and ordered by eigenvalue. The UI notes that diagonalisation is not unique (order and scaling).
- **Purpose:** in its own eigenbasis a diagonalisable map is pure axis scaling, which is why Aᵏ and e^{A} become easy later.

---

## Lecture 7: Hermitian (symmetric) matrices and the Rayleigh quotient (§2.2)

### 7.1 Spectral theorem: symmetric vs non-symmetric

- **Shows:** two panels with the same diagonal-ish starting matrix. *Left* is forced symmetric: the eigenvectors are always orthogonal and line up with the axes of the ellipse xᵀAx = ±1. *Right* is unconstrained: the eigenvectors drift apart and the eigenvalues can go complex.
- **User controls:** the left panel's a₁₁, a₁₂ and a₂₂, the right panel's four entries, and "make right = left + skew part".
- **Fixed by system:** ℝ² (the ℝ³ ellipsoid is optional). Real arithmetic, so "Hermitian" appears as "symmetric", with a note that the complex case reads A* = A.
- **Purpose:** Lemmas 2.2.1–2.2.2 and Thm 2.2.1: symmetric means real eigenvalues, orthogonal eigenvectors and A = QΛQᵀ. Seeing the failure on the right is what makes the theorem's content visible.

### 7.2 Rayleigh quotient landscape (Thm 2.2.2)

- **Shows:**
  - for 2×2: R(A,x) = xᵀAx/xᵀx plotted against the angle of x on the unit circle, a sinusoid between λ₁ and λ₂ with its extremes at the eigenvectors
  - for 3×3: a heat map on the unit sphere
  - in both: bars for the weights βᵢ = |αᵢ|²/Σ|αⱼ|², showing R as a convex combination of eigenvalues, the key step in the proof
- **User controls:** a symmetric 2×2 or 3×3, and dragging x on the circle or sphere.
- **Fixed by system:** symmetry is enforced. The eigen-decomposition uses a Jacobi method, which is exact enough at these sizes.
- **Purpose:** the extreme eigenvalues are the extremes of a simple ratio, which is the idea behind the power method and the Courant–Fischer theorem (2.12). The notes mention Courant–Fischer without proving it; a 3×3 "min over planes of max" extra could illustrate it, marked as beyond the notes.

---

## Lecture 8: Similarity, Schur, Jordan and the matrix exponential (§2.3–2.4)

### 8.1 Similar matrices: same map, different basis (Def 2.3.1, Lemma 2.3.1)

- **Shows:** the same linear map drawn twice, once in the standard basis (matrix A) and once in a user-chosen basis S (matrix B = S⁻¹AS). An invariants panel lists p_A = p_B, trace, det, σ(A) with multiplicities and rank, and all stay identical while the entries of B change.
- **User controls:** A, the basis S by dragging its two column vectors, and "choose S = eigenvectors", which makes B diagonal.
- **Fixed by system:** a warning appears if S becomes singular (rank tol).
- **Purpose:** similarity is change of basis, which is why it preserves exactly the basis-free quantities. It sets up diagonalisation, Schur and Jordan as "pick the best basis".

### 8.2 Schur and Jordan form explorer (Thm 2.3.1, Thm 2.3.2)

- **Shows:**
  - *Schur tab:* for a 2×2/3×3 A, the unitary Q and upper-triangular T with the eigenvalues on the diagonal, and a check that ‖A − QTQᵀ‖ ≈ 0
  - *Jordan builder:* choose block sizes for one eigenvalue and see the assembled J, μ_A, μ_G (the number of blocks) and the ranks of (J − λI)ᵏ for k = 1, 2, 3
- **User controls:**
  - *Schur:* the matrix entries
  - *Jordan:* the size n ≤ 4, λ, and the block partition (e.g. 4 = 3+1 or 2+2)
- **Fixed by system:** in the Schur tab, matrices with complex eigenvalues show the real Schur form with a note. Jordan forms are built, not computed from arbitrary A, since computing them numerically is ill-posed, as the notes themselves say.
- **Purpose:** "triangularise always, diagonalise only sometimes". The block sizes decide similarity. The rank sequence also answers the notes' homework (4×4, σ = {0}, μ_G(0) = 2: 3+1 and 2+2 are not similar), behind a reveal button.

### 8.3 Matrix exponential: series and trajectories (2.19)

- **Shows:**
  - *left:* the partial sums S_N(t) = Σ_{j≤N} (tA)ʲ/j! converging to e^{tA}, as an error-vs-N plot against the bound from the notes (driven by |t|·‖A‖)
  - *right:* the trajectory x(t) = e^{tA}x₀ in the plane. For diagonalisable A the computation route Se^{tΛ}S⁻¹ is shown step by step. For a defective A (Jordan block) the t·e^{λt} term appears explicitly.
- **User controls:** the 2×2 A, t, N, and x₀ (drag).
- **Fixed by system:** the reference e^{tA} is computed by scaling-and-squaring, with a note that this is what MATLAB's `expm` does, in contrast to `exp`, which acts elementwise (the notes' question). Cap N = 40.
- **Purpose:** e^{tA} is defined by the power series, it solves x′ = Ax with x(0) = x₀, it needs many more terms when |t|‖A‖ is large, and similarity reduces it to scalar exponentials.

---

## Lecture 9: Qualitative ODE analysis (§2.4.1) and normal equations (§3.1)

### ★ 9.1 Phase portrait of y′ = Ay with classification

- **Shows:** the vector field, trajectories started by clicking, the eigen-directions (when real), and a classification label: stable or unstable node, saddle, stable or unstable spiral, centre, or degenerate. A trace–determinant diagram shows the current A as a point, with region boundaries (det = 0, tr = 0, tr² = 4 det).
- **User controls:** the 2×2 entries, dragging the point in the trace–det plane (which generates a matching A), clicking to seed trajectories, and the time direction.
- **Fixed by system:** an RK4 integrator with small dt, cross-checked against e^{tA}y₀ from 8.3. The plotting window is [−3, 3]².
- **Purpose:** the signs of the eigenvalues' real parts decide stability, the imaginary parts mean rotation, and eigenvectors are the straight-line solutions. This is the linear core of (2.23).

### 9.2 Linearisation at equilibria: Lotka–Volterra (Example 2.4.2)

- **Shows:** the nonlinear field F on [−0.2, 1.6]² (the window from the notes) with the equilibria (0, 0) and (1, 0.5). Clicking an equilibrium opens a zoom panel comparing the nonlinear field with the linearised field DF(x̃)(x − x̃), with eigenvalues σ(A₂) = {−1, 2/3} (saddle) and σ(A₁) = {±i√(2/3)} (centre).
- **User controls:** the initial point (click), the zoom radius, and the model coefficients a, b, c, d (extra; the notes' values are the default). An optional free-form F(x) for an expression parser is a stretch goal.
- **Fixed by system:** the default model F = [⅔x₁ − (4/3)x₁x₂, x₁x₂ − x₂]ᵀ. The PDF text extraction garbled this formula, so I reconstructed the coefficients from the equilibria and spectra stated in the notes; check them against the PDF. The Jacobian is computed analytically.
- **Purpose:** linearisation predicts local behaviour near hyperbolic equilibria (the saddle). The notes stress that it cannot settle the centre case: purely imaginary eigenvalues are inconclusive, and the full nonlinear orbit is needed (here it is closed).

### 9.3 Least squares fit of a spring constant (Example 3.1.1)

- **Shows:** measured points (gmᵢ, xᵢ) and the fitted line through the origin. Residual bars show the gaps. A side plot shows ‖Ak − b‖₂² against k, a parabola whose minimum sits at k̂ = (AᵀA)⁻¹Aᵀb (the 1-parameter normal equation). Drag k by hand to feel the minimum.
- **User controls:** dragging the data points, "add noise" (σ slider), the number of measurements n, and a manual k slider.
- **Fixed by system:** g = 9.81 m/s², the ideal linear spring law of the notes' model, and a "true" k for generating synthetic data, which can be hidden.
- **Purpose:** an overdetermined system has no exact solution, and least squares minimises the square sum of residuals. The normal equation is just "derivative = 0". This is the motivating example before the general theory.

### 9.4 Fitting an ellipse to a point cloud (Example 3.1.2)

- **Shows:** points (clicked or generated from a noisy ellipse) and the best-fit conic x₁² + Ax₂² + Bx₁x₂ + Cx₁ + Dx₂ + E = 0 from the 5-parameter least-squares problem (the notes' form), the residuals, the matrix A and vector b built row by row, and the ellipse condition B² − 4A < 0. When that condition fails it shows a "fit is a hyperbola/parabola" warning.
- **User controls:** clicking to add, drag or remove points, the noise level, and the true ellipse parameters for synthetic data.
- **Fixed by system:** the fixed normalisation (coefficient of x₁² = 1), as in the notes. The UI notes that this normalisation fails for conics with no x₁² term.
- **Purpose:** least squares applies to any model that is linear in the parameters, even when the curve itself is nonlinear in x. It also shows the notes' assumption "surely the data is good enough to give an ellipse" failing in practice.

---

## Lecture 10: Projections (§3.2)

### 10.1 Orthogonal vs oblique projection in ℝ² (Examples 3.2.1, 3.2.2)

- **Shows:** x split as x = αa + βc along two directions a and c. In orthogonal mode, c ⊥ a and P = aaᵀ/‖a‖² (3.19). In oblique mode, c is free and P comes from solving [a, c][α, β]ᵀ = x. A matrix panel shows P and I − P with checks of P² = P, Pᵀ = P? (true only for orthogonal), and the eigenvalues {0, 1}.
- **User controls:** dragging x, a and c, and the orthogonal/oblique toggle.
- **Fixed by system:** a singular [a, c] (parallel a and c) is detected with tol and the panel reports "no decomposition: ℝ² ≠ V ⊕ W".
- **Purpose:** Def 3.2.1: every P² = P is a projection, but only symmetric ones are orthogonal. Each projection belongs to a direct-sum split (Lemma 3.2.1), and I − P is the complementary projection.

### 10.2 Orthogonal projection onto a subspace of ℝ³ (3.16)

- **Shows:** V = R(V) for one or two draggable spanning vectors (a line or plane), x, P_V x and the residual x − P_V x lying in V^⊥ (Def 3.2.3). Live P_V = V(VᵀV)⁻¹Vᵀ, with an orthonormal-basis toggle where it simplifies to VVᵀ.
- **User controls:** the spanning vectors, x, the subspace dimension (1 or 2), and "orthonormalise basis" (previewing Gram–Schmidt from 11.2).
- **Fixed by system:** a 3D view with orbit camera. VᵀV invertibility is checked against tol.
- **Purpose:** the projection depends only on the subspace, not on the basis (change the basis and P_V stays the same). There is no need to construct a basis of V^⊥, a point the notes make explicitly.

---

## Lecture 11: Least squares geometry and QR (§3.3–3.4)

### ★ 11.1 Least squares as projection: the two views

- **Shows:** two linked panels for fitting a line y = c₀ + c₁t through 3 data points:
  - *data view (ℝ²)*: the points and the line, with residuals
  - *column-space view (ℝ³)*: b = [y₁, y₂, y₃]ᵀ, the plane R(A) spanned by [1,1,1]ᵀ and [t₁,t₂,t₃]ᵀ, the projection Pb = Ax̂, and the residual b − Ax̂ ⊥ R(A)

  Moving the line in the data view moves Ax in the plane. A bar shows the Pythagorean split ‖Ax − b‖² = ‖Ax − Pb‖² + ‖(I − P)b‖² from (3.21).
- **User controls:** dragging the data points, dragging the line (c₀, c₁) manually, and "snap to LSQ".
- **Fixed by system:** exactly 3 data points, so that b lives in a drawable ℝ³ (the UI explains why). The LSQ solution comes from QR, not the normal equations.
- **Purpose:** this is the central picture of Chapter 3. The least-squares solution makes Ax the closest point of R(A) to b. The residual is perpendicular to the column space, which is exactly what AᵀA x = Aᵀb says. The part (I − P)b of the error cannot be removed by any x.

### 11.2 Gram–Schmidt Step by step → A = QR (Lemma 3.4.1, (3.25))

- **Shows:** the columns a₁, a₂, a₃ of a 3×3 (or 3×2) A in ℝ³. A stepper:
  - normalise a₁ → q₁
  - subtract the projection of a₂ on q₁ and normalise → q₂
  - and so on

  Each subtracted projection appears as an arrow, and its coefficient fills the corresponding entry of R as it is computed. The final check is ‖A − QR‖ and ‖I − QᵀQ‖.
- **User controls:** the columns (drag), step forward/back, and the variant (classical vs modified, as in the notes' two MATLAB listings).
- **Fixed by system:** in exact-looking geometry the two variants are identical; their difference appears only in 11.3.
- **Purpose:** R is upper triangular because qⱼ only uses a₁…aⱼ (span preservation (3.24)), and the entries of R are just projection coefficients. If a column is dependent, its q̃ becomes 0 and the process stops; this is shown explicitly, linked to the N(A) = {0} assumption.

### 11.3 Why not the normal equations? (Example 3.4.1)

- **Shows:** for the notes' matrix A = [1 1; ε 0; 0 ε], a log-log plot over ε of:
  - the LSQ error via the normal equations (AᵀA has entries 1 + ε², which round to 1)
  - the LSQ error via classical GS QR
  - the LSQ error via modified GS QR
  - the orthogonality loss ‖I − QᵀQ‖ for both GS variants
  - κ(A) and κ(AᵀA) = κ(A)², overlaid
- **User controls:** the ε range, a cursor for a single ε, and the right-hand side b.
- **Fixed by system:** real IEEE double-precision computation. Because JS arithmetic is the same as MATLAB's, the breakdown is genuine, not scripted. It happens near ε ≈ 10⁻⁸, where ε² drops below the machine epsilon; the notes quote a MATLAB threshold, so show both.
- **Purpose:** forming AᵀA squares the condition number and can destroy information completely (AᵀA becomes singular in floating point). QR avoids this, and modified GS keeps Q more orthogonal than classical GS. This ties back to Lecture 5.

---

## Lecture 12: Singular value decomposition (§3.5)

### ★ 12.1 SVD geometry: rotate–stretch–rotate

- **Shows:** the unit circle mapped by A in three animated stages: Vᵀ (rotate or reflect), Σ (stretch by σ₁ ≥ σ₂ ≥ 0), and U (rotate or reflect). The result is an ellipse with semi-axes σᵢuᵢ, with vᵢ marked on the circle and Avᵢ = σᵢuᵢ on the ellipse. A comparison strip shows that σ₁ = ‖A‖₂ (link to 4.1) and that σᵢ² are the eigenvalues of AᵀA (Lemma 3.5.1).
- **User controls:** the 2×2 entries (or 2×3 / 3×2 with a 3D view), the stage scrubber, and "show eigenvectors too", which contrasts eigenvectors with singular vectors for non-symmetric A.
- **Fixed by system:** a closed-form 2×2 SVD. Singular values are sorted descending and signs are fixed so U and V are proper rotations where possible (the UI notes U and V aren't unique).
- **Purpose:** every matrix, not just symmetric ones, is diagonal in a suitable pair of orthonormal bases. Singular vectors, not eigenvectors, describe stretching.

### 12.2 SVD as a sum of rank-1 matrices

- **Shows:** A = Σᵢ σᵢuᵢvᵢᵀ built up one term at a time, shown as:
  - (a) a small matrix heat map, with each rank-1 layer uᵢvᵢᵀ shown separately
  - (b) a grayscale image (e.g. 64×64) reconstructed from k terms, with the singular-value spectrum as a bar chart and the relative error
- **User controls:** k, the choice of image or matrix (built-in, drawn on a canvas, or uploaded), and a log scale for the spectrum.
- **Fixed by system:** the image resolution is capped for speed. The SVD is computed by one-sided Jacobi (no library needed).
- **Purpose:** rank(A) = the number of non-zero σᵢ, and each term is rank 1 (the notes' "partial isometry" remark). The fact that ‖A − A_k‖₂ = σ_{k+1} is optimal (Eckart–Young) is not in the notes; mark it "extra (not in course notes)".

### ★ 12.3 Pseudoinverse and the minimum-norm least-squares solution (Thm 3.5.2, Thm 3.5.3, Cor 3.5.1)

- **Shows:** for a rank-deficient A (2×2 rank 1, or 3×2):
  - the four subspaces read off the SVD (Thm 3.5.2): R(A) = span(u₁…u_p), R(A)^⊥, N(A) = span(v_{p+1}…), N(A)^⊥ = span(v₁…v_p)
  - in input space, the whole least-squares solution set x† + N(A) as a line, with x† marked as its point closest to the origin, lying in N(A)^⊥
- **User controls:** the matrix entries, dragging b, a "nearly rank-deficient" slider (σ₂ = δ), and the truncation threshold for treating σ as zero.
- **Fixed by system:** the default threshold equals tol. With δ above the threshold, x† uses 1/δ and jumps far away; below it, the term is dropped. The UI shows both answers side by side.
- **Purpose:** least squares is non-unique exactly when N(A) ≠ {0}, and the pseudoinverse picks the minimum-norm solution in N(A)^⊥. The truncation slider shows why rank is a numerical decision: a tiny σ either produces a huge, unstable x† or gets cut off. This connects Chapter 3 back to the conditioning of Lecture 5.

---

## Suggested working sample (4 visualisations, covering different interaction types)

| # | Visualisation | Interaction type |
|---|---|---|
| 3.1 | p-norm unit spheres | slider + drag, 2D, continuation of existing MATLAB work |
| 1.2 | Range / nullspace / solvability | editable matrix + linked dual panels, 2D/3D |
| 5.1 | Conditioning | sampling cloud + live inequality |
| 11.1 | Least squares as projection | linked data view ↔ 3D column-space view |

Strong alternates: 6.1 (eigenvector hunt), 9.1 (phase portrait), 12.1 (SVD geometry).
