/**
 * Numerical Methods for Quantum Mechanics
 * Implements finite-difference eigenvalue solver for the radial Schrödinger equation
 * using atomic units (hbar = me = e = 1)
 */

/**
 * Thomas algorithm for tridiagonal matrix system Ax = d
 * O(n) solution
 */
export function thomasAlgorithm(
  lower: Float64Array,
  main: Float64Array,
  upper: Float64Array,
  rhs: Float64Array
): Float64Array {
  const n = main.length;
  const c = new Float64Array(n);
  const d = new Float64Array(n);
  const x = new Float64Array(n);

  c[0] = upper[0] / main[0];
  d[0] = rhs[0] / main[0];

  for (let i = 1; i < n; i++) {
    const m = main[i] - lower[i] * c[i - 1];
    c[i] = upper[i] / m;
    d[i] = (rhs[i] - lower[i] * d[i - 1]) / m;
  }

  x[n - 1] = d[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    x[i] = d[i] - c[i] * x[i + 1];
  }

  return x;
}

/**
 * Power iteration method to find the dominant eigenvalue/vector
 */
export function powerIteration(
  matvec: (v: Float64Array) => Float64Array,
  n: number,
  maxIter = 1000,
  tol = 1e-10
): { eigenvalue: number; eigenvector: Float64Array } {
  let v = new Float64Array(n);
  // Random init
  for (let i = 0; i < n; i++) v[i] = Math.random() - 0.5;
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  const vNorm = new Float64Array(n);
  for (let i = 0; i < n; i++) vNorm[i] = v[i] / norm;
  v = vNorm;

  let eigenvalue = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    const w = matvec(v);
    const newEigenvalue = v.reduce((s, vi, i) => s + vi * w[i], 0);
    norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
    const newV = new Float64Array(w.length);
    for (let i = 0; i < w.length; i++) newV[i] = w[i] / norm;

    if (Math.abs(newEigenvalue - eigenvalue) < tol) {
      return { eigenvalue: newEigenvalue, eigenvector: newV };
    }
    eigenvalue = newEigenvalue;
    v = newV;
  }
  return { eigenvalue, eigenvector: v };
}

/**
 * Tridiagonal matrix eigenvalue decomposition using QR algorithm (implicit shift)
 * Returns eigenvalues sorted in ascending order with corresponding eigenvectors
 */
export function tridiagonalEigenSolver(
  diag: Float64Array,
  offDiag: Float64Array,
  numEigenvalues: number
): { eigenvalues: number[]; eigenvectors: Float64Array[] } {
  const n = diag.length;
  
  // Copy arrays to avoid mutation
  const d = Float64Array.from(diag);
  const e = new Float64Array(n); 
  for (let i = 0; i < n - 1; i++) e[i + 1] = offDiag[i];

  // Initialize eigenvector matrix as identity
  const Z: Float64Array[] = [];
  for (let i = 0; i < n; i++) {
    const row = new Float64Array(n);
    row[i] = 1.0;
    Z.push(row);
  }

  // QL algorithm with implicit shift for symmetric tridiagonal matrix
  const maxIter = 30;
  
  for (let l = 0; l < n; l++) {
    let iter = 0;
    let m: number;
    
    do {
      m = l;
      while (m < n - 1) {
        const dd = Math.abs(d[m]) + Math.abs(d[m + 1]);
        if (Math.abs(e[m + 1]) <= 1e-14 * dd) break;
        m++;
      }
      
      if (m !== l) {
        if (iter++ >= maxIter) break;
        
        // Compute implicit shift
        let g = (d[l + 1] - d[l]) / (2.0 * e[l + 1]);
        let r = Math.sqrt(g * g + 1.0);
        g = d[m] - d[l] + e[l + 1] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
        
        let s = 1.0, c = 1.0, p = 0.0;
        
        for (let i = m - 1; i >= l; i--) {
          let f = s * e[i + 1];
          const b = c * e[i + 1];
          
          if (Math.abs(f) >= Math.abs(g)) {
            c = g / f;
            r = Math.sqrt(c * c + 1.0);
            e[i + 2] = f * r;
            s = 1.0 / r;
            c *= s;
          } else {
            s = f / g;
            r = Math.sqrt(s * s + 1.0);
            e[i + 2] = g * r;
            c = 1.0 / r;
            s *= c;
          }
          
          g = d[i + 1] - p;
          r = (d[i] - g) * s + 2.0 * c * b;
          p = s * r;
          d[i + 1] = g + p;
          g = c * r - b;
          
          // Update eigenvectors
          for (let k = 0; k < n; k++) {
            f = Z[k][i + 1];
            Z[k][i + 1] = s * Z[k][i] + c * f;
            Z[k][i] = c * Z[k][i] - s * f;
          }
        }
        
        d[l] -= p;
        e[l + 1] = g;
        e[m] = 0.0;
      }
    } while (m !== l);
  }

  // Sort by eigenvalue
  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => d[a] - d[b]);

  const eigenvalues: number[] = [];
  const eigenvectors: Float64Array[] = [];

  const count = Math.min(numEigenvalues, n);
  for (let k = 0; k < count; k++) {
    const idx = indices[k];
    eigenvalues.push(d[idx]);
    const ev = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      ev[i] = Z[i][idx];
    }
    eigenvectors.push(ev);
  }

  return { eigenvalues, eigenvectors };
}

/**
 * Simpson's rule numerical integration
 */
export function simpsonsIntegral(f: Float64Array, dx: number): number {
  const n = f.length;
  if (n < 3) return 0;
  
  let sum = f[0] + f[n - 1];
  for (let i = 1; i < n - 1; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * f[i];
  }
  return (dx / 3) * sum;
}

/**
 * Normalize a wavefunction: returns normalized version
 */
export function normalizeWavefunction(psi: Float64Array, dr: number): Float64Array {
  // Compute |psi|^2 * r^2 for 3D normalization (radial part u(r) where psi = u/r)
  // For u(r): integral |u|^2 dr = 1
  const psi2 = new Float64Array(psi.length);
  for (let i = 0; i < psi.length; i++) psi2[i] = psi[i] * psi[i];
  const norm = simpsonsIntegral(psi2, dr);
  const factor = norm > 0 ? 1.0 / Math.sqrt(norm) : 1.0;
  return psi.map(x => x * factor) as Float64Array;
}

/**
 * Compute radial probability density P(r) = |u(r)|^2 = r^2 |R(r)|^2
 * where u(r) = r * R(r) is the reduced radial wavefunction
 */
export function radialProbabilityDensity(u: Float64Array): Float64Array {
  return u.map(ui => ui * ui) as Float64Array;
}

/**
 * Numerov method for solving u'' = f(r) * u
 * More accurate than simple finite difference (O(h^6) local error)
 */
export function numerovSolve(
  f: Float64Array,  // f(r) array
  u0: number,       // u(r0) boundary condition
  u1: number,       // u(r0+dr) boundary condition  
  dr: number
): Float64Array {
  const n = f.length;
  const u = new Float64Array(n);
  u[0] = u0;
  u[1] = u1;

  const h2 = dr * dr;
  const h2_12 = h2 / 12.0;

  for (let i = 2; i < n; i++) {
    const num = (2.0 * u[i-1] * (1.0 - (5.0/12.0) * h2 * f[i-1]) 
                 - u[i-2] * (1.0 + h2_12 * f[i-2]));
    const denom = 1.0 + h2_12 * f[i];
    u[i] = num / denom;
  }

  return u;
}
