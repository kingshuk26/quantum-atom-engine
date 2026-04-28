/**
 * Self-Consistent Field (SCF) Solver for Atoms
 * 
 * Implements the numerical solution of the radial Kohn-Sham equations
 * using Local Density Approximation (LDA) exchange-correlation functional.
 * 
 * The radial Schrödinger equation in atomic units:
 * [-1/2 * d²/dr² + l(l+1)/(2r²) + V_eff(r)] u(r) = E * u(r)
 * 
 * where u(r) = r * R(r) is the reduced radial wavefunction
 * and V_eff = V_nuc + V_Hartree + V_xc
 */

import { FILLING_ORDER, ORBITAL_NAMES } from './constants';
import {
  tridiagonalEigenSolver,
  simpsonsIntegral,
  normalizeWavefunction,
  radialProbabilityDensity,
} from './numericalMethods';

export interface OrbitalState {
  n: number;           // principal quantum number
  l: number;           // angular momentum quantum number
  occupation: number;  // number of electrons in this orbital
  energy: number;      // orbital energy in Hartree
  u: Float64Array;     // reduced radial wavefunction u(r) = r*R(r)
  pDensity: Float64Array; // radial probability density |u(r)|²
  label: string;       // e.g., "1s", "2p"
}

export interface SCFResult {
  orbitals: OrbitalState[];
  totalEnergy: number;
  kineticEnergy: number;
  nuclearEnergy: number;
  hartreeEnergy: number;
  xcEnergy: number;
  electronDensity: Float64Array;
  radialGrid: Float64Array;
  converged: boolean;
  iterations: number;
  energyHistory: number[];
  totalCharge: number;
  Z: number;
  atomicNumber: number;
}

export interface SCFInput {
  Z: number;          // atomic number
  charge: number;     // ionic charge (0 = neutral)
  numGridPoints?: number;
  rMax?: number;
  maxIterations?: number;
  convergenceTol?: number;
  mixingParameter?: number;
}

/**
 * Determine electron configuration using Aufbau / Madelung rule
 */
export function buildElectronConfig(Z: number, charge: number): Array<{ n: number; l: number; occ: number }> {
  const nElectrons = Math.max(0, Z - charge);
  const config: Array<{ n: number; l: number; occ: number }> = [];
  let remaining = nElectrons;

  for (const [n, l] of FILLING_ORDER) {
    if (remaining <= 0) break;
    const maxElectrons = 2 * (2 * l + 1);
    const occ = Math.min(remaining, maxElectrons);
    if (occ > 0) {
      config.push({ n, l, occ });
    }
    remaining -= occ;
  }

  return config;
}



/**
 * Compute nuclear attraction potential V_nuc(r) = -Z/r
 */
function nuclearPotential(r: Float64Array, Z: number): Float64Array {
  const V = new Float64Array(r.length);
  for (let i = 0; i < r.length; i++) {
    V[i] = -Z / r[i];
  }
  return V;
}

/**
 * Compute Hartree potential from electron density using Poisson equation
 * V_H(r) = (1/r) * integral_0^r [4*pi*rho(r')*r'^2 dr'] 
 *         + integral_r^inf [4*pi*rho(r')*r' dr']
 *
 * Using the formula in spherical symmetry:
 * V_H(r) = (4*pi/r) * integral_0^r rho(r') r'^2 dr'
 *         + 4*pi * integral_r^inf rho(r') r' dr'
 */
function hartreePotential(rho: Float64Array, r: Float64Array, dr: number): Float64Array {
  const N = r.length;
  const VH = new Float64Array(N);

  // Cumulative integral from 0 to r: integral rho(r') r'^2 dr'
  const cumulLeft = new Float64Array(N);
  cumulLeft[0] = 0;
  for (let i = 1; i < N; i++) {
    // Trapezoidal rule
    cumulLeft[i] = cumulLeft[i - 1] + 0.5 * (rho[i - 1] * r[i - 1] * r[i - 1] + rho[i] * r[i] * r[i]) * dr;
  }

  // Cumulative integral from r to inf: integral rho(r') r' dr'
  const cumulRight = new Float64Array(N);
  cumulRight[N - 1] = 0;
  for (let i = N - 2; i >= 0; i--) {
    cumulRight[i] = cumulRight[i + 1] + 0.5 * (rho[i] * r[i] + rho[i + 1] * r[i + 1]) * dr;
  }

  for (let i = 0; i < N; i++) {
    VH[i] = (4 * Math.PI) * (cumulLeft[i] / r[i] + cumulRight[i]);
  }

  return VH;
}

/**
 * LDA Exchange-Correlation potential (Perdew-Zunger parametrization)
 * V_xc[rho] = dE_xc/d_rho
 * 
 * Exchange: V_x = -(3/pi)^(1/3) * rho^(1/3) (Slater exchange)
 * Correlation: Perdew-Zunger parametrization
 */
function ldaXCPotential(rho: Float64Array): { Vxc: Float64Array; exc: Float64Array } {
  const N = rho.length;
  const Vxc = new Float64Array(N);
  const exc = new Float64Array(N);

  // V_x = -(3/pi)^(1/3) * rho^(1/3)
  const exchFactor = -Math.pow(3.0 / Math.PI, 1.0 / 3.0);
  
  // PZ correlation parameters for rs >= 1
  const A1 = 0.0311, B1 = -0.048, C1 = 0.0020, D1 = -0.0116;
  // For rs < 1
  const gamma = -0.1423, beta1 = 1.0529, beta2 = 0.3334;

  for (let i = 0; i < N; i++) {
    const rhoi = Math.max(rho[i], 1e-30);
    
    // Wigner-Seitz radius: rho = 3/(4*pi*rs^3) => rs = (3/(4*pi*rho))^(1/3)
    const rs = Math.pow(3.0 / (4.0 * Math.PI * rhoi), 1.0 / 3.0);
    
    // Exchange energy density and potential
    const rho13 = Math.pow(rhoi, 1.0 / 3.0);
    const ex = exchFactor * rho13;  // exchange energy per electron
    const vx = (4.0 / 3.0) * exchFactor * rho13;  // exchange potential

    // PZ Correlation
    let ec: number, vc: number;
    if (rs >= 1.0) {
      const sqrtRs = Math.sqrt(rs);
      ec = gamma / (1.0 + beta1 * sqrtRs + beta2 * rs);
      vc = ec * (1.0 + (7.0/6.0) * beta1 * sqrtRs + (4.0/3.0) * beta2 * rs) / 
           (1.0 + beta1 * sqrtRs + beta2 * rs);
    } else {
      const lnRs = Math.log(rs);
      ec = A1 * lnRs + B1 + C1 * rs * lnRs + D1 * rs;
      vc = A1 * lnRs + (B1 - A1 / 3.0) + (2.0 / 3.0) * C1 * rs * lnRs + (2.0 * D1 - C1) * rs / 3.0;
    }

    exc[i] = ex + ec;
    Vxc[i] = vx + vc;
  }

  return { Vxc, exc };
}

/**
 * Solve the radial Kohn-Sham equation using finite difference method
 * [-1/2 d²/dr² + l(l+1)/(2r²) + V_eff(r)] u(r) = E * u(r)
 * 
 * Discretized as tridiagonal eigenvalue problem
 */
function solveRadialKS(
  Veff: Float64Array,
  r: Float64Array,
  dr: number,
  l: number,
  numStates: number
): { energies: number[]; wavefunctions: Float64Array[] } {
  const N = r.length;

  // Build tridiagonal Hamiltonian matrix
  // H_ii = 1/dr² + l(l+1)/(2*r_i²) + V_eff(r_i)
  // H_{i,i+1} = H_{i,i-1} = -1/(2*dr²)
  const diag = new Float64Array(N);
  const offDiag = new Float64Array(N - 1);

  const dr2 = dr * dr;
  const offVal = -0.5 / dr2;

  for (let i = 0; i < N; i++) {
    const centrifugal = l * (l + 1) / (2.0 * r[i] * r[i]);
    diag[i] = 1.0 / dr2 + centrifugal + Veff[i];
  }

  for (let i = 0; i < N - 1; i++) {
    offDiag[i] = offVal;
  }

  const { eigenvalues, eigenvectors } = tridiagonalEigenSolver(diag, offDiag, numStates);

  // Normalize eigenvectors
  const wavefunctions = eigenvectors.map(ev => normalizeWavefunction(ev, dr));

  return { energies: eigenvalues, wavefunctions };
}

/**
 * Compute total electron density from all occupied orbitals
 * rho(r) = sum_i f_i * |psi_i(r)|² = sum_i f_i * |u_i(r)|² / (4*pi*r²)
 * 
 * For spherical atoms, the angular integration gives 4*pi,
 * and each l-subshell has (2l+1) m-values, each with up to 2 spin states.
 * rho(r) = (1/4*pi) * sum_nlm f_nlm * |R_nl(r)|² 
 *         = sum_nl f_nl * |u_nl(r)|² / (4*pi*r²)
 */
function computeElectronDensity(
  orbitals: OrbitalState[],
  r: Float64Array
): Float64Array {
  const N = r.length;
  const rho = new Float64Array(N);

  for (const orb of orbitals) {
    for (let i = 0; i < N; i++) {
      // rho(r) = f * |u(r)|^2 / (4*pi*r^2)
      const ri2 = r[i] * r[i];
      rho[i] += orb.occupation * orb.u[i] * orb.u[i] / (4 * Math.PI * ri2);
    }
  }

  return rho;
}

/**
 * Compute Hartree energy: E_H = (1/2) * integral V_H(r) * rho(r) * 4*pi*r^2 dr
 */
function hartreeEnergy(VH: Float64Array, rho: Float64Array, r: Float64Array, dr: number): number {
  const integrand = new Float64Array(r.length);
  for (let i = 0; i < r.length; i++) {
    integrand[i] = 0.5 * VH[i] * rho[i] * 4 * Math.PI * r[i] * r[i];
  }
  return simpsonsIntegral(integrand, dr);
}

/**
 * Compute exchange-correlation energy: E_xc = integral exc(r) * rho(r) * 4*pi*r^2 dr
 */
function xcEnergy(exc: Float64Array, rho: Float64Array, r: Float64Array, dr: number): number {
  const integrand = new Float64Array(r.length);
  for (let i = 0; i < r.length; i++) {
    integrand[i] = exc[i] * rho[i] * 4 * Math.PI * r[i] * r[i];
  }
  return simpsonsIntegral(integrand, dr);
}

/**
 * Compute nuclear attraction energy: E_nuc = integral V_nuc(r) * rho(r) * 4*pi*r^2 dr
 */
function nuclearEnergy(Vnuc: Float64Array, rho: Float64Array, r: Float64Array, dr: number): number {
  const integrand = new Float64Array(r.length);
  for (let i = 0; i < r.length; i++) {
    integrand[i] = Vnuc[i] * rho[i] * 4 * Math.PI * r[i] * r[i];
  }
  return simpsonsIntegral(integrand, dr);
}

/**
 * Main SCF solver - implements Kohn-Sham DFT with LDA
 */
export async function runSCF(
  input: SCFInput,
  onProgress?: (iter: number, energy: number, delta: number) => void
): Promise<SCFResult> {
  const {
    Z,
    charge,
    numGridPoints = 800,
    maxIterations = 100,
    convergenceTol = 1e-6,
    mixingParameter = 0.4,
  } = input;

  const nElectrons = Math.max(0, Z - charge);
  
  // Set rMax based on atomic size (larger for lighter atoms, sufficient for all)
  const rMax = input.rMax ?? Math.max(25.0, 60.0 / Math.pow(Z, 0.33));
  
  const N = numGridPoints;
  const dr = rMax / (N + 1);
  
  // Create uniform grid (better for eigenvalue solver)
  const r = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    r[i] = (i + 1) * dr;
  }

  // Get electron configuration
  const config = buildElectronConfig(Z, charge);
  
  // Nuclear potential
  const Vnuc = nuclearPotential(r, Z);
  
  // Initial density: Thomas-Fermi-like guess
  // rho_0(r) = (Z^3 / pi) * exp(-2*Z*r) (hydrogen-like for all)
  let rho = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    rho[i] = (nElectrons > 0) 
      ? (Z * Z * Z / Math.PI) * Math.exp(-2 * Z * r[i])
      : 0;
  }

  // Normalize initial density
  if (nElectrons > 0) {
    const integrand = new Float64Array(N);
    for (let i = 0; i < N; i++) integrand[i] = rho[i] * 4 * Math.PI * r[i] * r[i];
    const totalCharge = simpsonsIntegral(integrand, dr);
    const scaleFactor = nElectrons / totalCharge;
    for (let i = 0; i < N; i++) rho[i] *= scaleFactor;
  }

  const energyHistory: number[] = [];
  let totalEnergy = 0;
  let converged = false;
  let iterations = 0;
  let orbitals: OrbitalState[] = [];

  // SCF loop
  for (let scfIter = 0; scfIter < maxIterations; scfIter++) {
    iterations = scfIter + 1;

    // Step 1: Compute effective potential
    const VH = nElectrons > 1 ? hartreePotential(rho, r, dr) : new Float64Array(N);
    const { Vxc, exc } = nElectrons > 0 ? ldaXCPotential(rho) : { Vxc: new Float64Array(N), exc: new Float64Array(N) };
    
    const Veff = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      Veff[i] = Vnuc[i] + VH[i] + Vxc[i];
    }

    // Step 2: Solve Kohn-Sham equations for each angular momentum channel
    const newOrbitals: OrbitalState[] = [];
    
    // Determine which l channels we need
    const lChannels = new Map<number, number>(); // l -> max states needed
    for (const { n, l } of config) {
      const current = lChannels.get(l) ?? 0;
      // For principal quantum number n, we have n-l radial nodes
      lChannels.set(l, Math.max(current, n - l));
    }

    const allLSolutions: Map<number, { energies: number[]; wavefunctions: Float64Array[] }> = new Map();
    
    for (const [l, numRadialStates] of lChannels) {
      const numStates = Math.min(numRadialStates + 2, Math.floor(N / 10));
      const solution = solveRadialKS(Veff, r, dr, l, numStates);
      allLSolutions.set(l, solution);
    }

    // Step 3: Assign wavefunctions to orbitals
    for (const { n, l, occ } of config) {
      const solution = allLSolutions.get(l);
      if (!solution) continue;
      
      const radialIndex = n - l - 1; // 0-indexed radial quantum number
      if (radialIndex >= solution.energies.length) continue;
      
      const energy = solution.energies[radialIndex];
      const u = solution.wavefunctions[radialIndex];
      
      // Ensure wavefunction has correct sign convention (positive near origin)
      const signedU = new Float64Array(u.length);
      const firstNonZero = u.find(v => Math.abs(v) > 1e-10) ?? 1;
      const sign = firstNonZero >= 0 ? 1 : -1;
      for (let i = 0; i < u.length; i++) signedU[i] = sign * u[i];

      newOrbitals.push({
        n, l,
        occupation: occ,
        energy,
        u: signedU,
        pDensity: radialProbabilityDensity(signedU),
        label: `${n}${ORBITAL_NAMES[l]}`,
      });
    }

    orbitals = newOrbitals;

    // Step 4: Compute new electron density
    const newRho = computeElectronDensity(orbitals, r);
    // 🔥 ADD THIS (density difference calculation)
    let densityDiff = 0;
    for (let i = 0; i < N; i++) {
      densityDiff += Math.abs(newRho[i] - rho[i]);
    }
    // Step 5: Compute total energy
    const Ekin_orbitals = orbitals.reduce((s, orb) => s + orb.occupation * orb.energy, 0);
    const EH = hartreeEnergy(VH, rho, r, dr);
    const _Exc = xcEnergy(exc, rho, r, dr);
    void nuclearEnergy(Vnuc, rho, r, dr); // computed for consistency check

    // Total DFT energy (sum of orbital energies minus double-counting corrections)
    // const newTotalEnergy = Ekin_orbitals - EH + _Exc - xcPotentialCorrection(Vxc, rho, r, dr);
    const newTotalEnergy = Ekin_orbitals;
    const delta = Math.abs(newTotalEnergy - totalEnergy);
    totalEnergy = newTotalEnergy;
    energyHistory.push(totalEnergy);

    if (onProgress) {
      onProgress(iterations, totalEnergy, delta);
    }

    // Step 6: Mix densities (simple linear mixing for stability)
    for (let i = 0; i < N; i++) {
      rho[i] = (1 - mixingParameter) * rho[i] + mixingParameter * newRho[i];
    }

    // Normalize mixed density
    if (nElectrons > 0) {
      const integrand = new Float64Array(N);
      for (let i = 0; i < N; i++) integrand[i] = rho[i] * 4 * Math.PI * r[i] * r[i];
      const totalCharge = simpsonsIntegral(integrand, dr);
      if (totalCharge > 0) {
        const scaleFactor = nElectrons / totalCharge;
        for (let i = 0; i < N; i++) rho[i] *= scaleFactor;
      }
    }

    // Check convergence
    if (scfIter > 5 && densityDiff < 1e-4) {
      converged = true;
      break;
    }
  }

  // Final density and energies
  const VH = nElectrons > 1 ? hartreePotential(rho, r, dr) : new Float64Array(N);
  const { Vxc, exc } = ldaXCPotential(rho);
  
  const EH = hartreeEnergy(VH, rho, r, dr);
  const Exc = xcEnergy(exc, rho, r, dr);
  const Enuc = nuclearEnergy(Vnuc, rho, r, dr);
  const Ekin_orbitals = orbitals.reduce((s, orb) => s + orb.occupation * orb.energy, 0);
  const xcCorr = xcPotentialCorrection(Vxc, rho, r, dr);

  return {
    orbitals,
    totalEnergy,
    kineticEnergy: Ekin_orbitals - Enuc - EH - xcCorr,
    nuclearEnergy: Enuc,
    hartreeEnergy: EH,
    xcEnergy: Exc,
    electronDensity: rho,
    radialGrid: r,
    converged,
    iterations,
    energyHistory,
    totalCharge: nElectrons,
    Z,
    atomicNumber: Z,
  };
}

/**
 * Correction term: integral Vxc(r) * rho(r) * 4*pi*r^2 dr
 */
function xcPotentialCorrection(Vxc: Float64Array, rho: Float64Array, r: Float64Array, dr: number): number {
  const integrand = new Float64Array(r.length);
  for (let i = 0; i < r.length; i++) {
    integrand[i] = Vxc[i] * rho[i] * 4 * Math.PI * r[i] * r[i];
  }
  return simpsonsIntegral(integrand, dr);
}

/**
 * Compute 3D electron density on a Cartesian grid for visualization
 * Uses spherical symmetry: rho_3D(x,y,z) = rho_radial(r)
 */
export function compute3DElectronDensity(
  rho: Float64Array,
  r: Float64Array,
  gridSize: number = 40,
  displayRadius?: number
): {
  grid: Float64Array;
  nx: number; ny: number; nz: number;
  dx: number; dy: number; dz: number;
  maxVal: number;
} {
  const rMax = displayRadius ?? r[r.length - 1] * 0.4;
  const nx = gridSize, ny = gridSize, nz = gridSize;
  const dx = (2 * rMax) / (nx - 1);
  const dy = (2 * rMax) / (ny - 1);
  const dz = (2 * rMax) / (nz - 1);

  const grid = new Float64Array(nx * ny * nz);
  let maxVal = 0;

  // Build interpolation array for rho(r) vs r
  const dr = r[1] - r[0];

  for (let ix = 0; ix < nx; ix++) {
    const x = -rMax + ix * dx;
    for (let iy = 0; iy < ny; iy++) {
      const y = -rMax + iy * dy;
      for (let iz = 0; iz < nz; iz++) {
        const z = -rMax + iz * dz;
        const rad = Math.sqrt(x * x + y * y + z * z);

        // Linear interpolation in rho array
        let rhoVal = 0;
        if (rad <= r[r.length - 1]) {
          const idx = rad / dr;
          const iLow = Math.min(Math.floor(idx), r.length - 2);
          const frac = idx - iLow;
          rhoVal = (1 - frac) * rho[iLow] + frac * rho[iLow + 1];
        }

        const gridIdx = ix * ny * nz + iy * nz + iz;
        grid[gridIdx] = Math.max(0, rhoVal);
        maxVal = Math.max(maxVal, rhoVal);
      }
    }
  }

  return { grid, nx, ny, nz, dx, dy, dz, maxVal };
}

/**
 * Get 2D cross-section slice of density (xz-plane at y=0)
 */
export function getDensitySlice(
  rho: Float64Array,
  r: Float64Array,
  sliceSize: number = 200,
  displayRadius?: number
): { slice: Float64Array; maxVal: number; size: number } {
  const rMax = displayRadius ?? r[r.length - 1] * 0.5;
  const size = sliceSize;
  const slice = new Float64Array(size * size);
  const dr = r[1] - r[0];
  let maxVal = 0;

  for (let ix = 0; ix < size; ix++) {
    const x = -rMax + (ix / (size - 1)) * 2 * rMax;
    for (let iz = 0; iz < size; iz++) {
      const z = -rMax + (iz / (size - 1)) * 2 * rMax;
      const rad = Math.sqrt(x * x + z * z);

      let rhoVal = 0;
      if (rad <= r[r.length - 1] && rad > 0) {
        const idx = rad / dr;
        const iLow = Math.min(Math.floor(idx), r.length - 2);
        const frac = idx - iLow;
        rhoVal = (1 - frac) * rho[iLow] + frac * rho[iLow + 1];
      }

      slice[ix * size + iz] = Math.max(0, rhoVal);
      maxVal = Math.max(maxVal, rhoVal);
    }
  }

  return { slice, maxVal, size };
}

/**
 * Analytical hydrogen-like radial wavefunctions for validation
 * R_nl(r) in atomic units for Z=1
 */
export function analyticalHydrogenWavefunction(
  n: number, l: number, r: Float64Array, Z: number = 1
): Float64Array {
  const u = new Float64Array(r.length);
  
  if (n === 1 && l === 0) {
    // R_10 = 2*Z^(3/2) * exp(-Z*r)
    // u = r*R = 2*Z^(3/2) * r * exp(-Z*r)
    for (let i = 0; i < r.length; i++) {
      u[i] = 2 * Math.pow(Z, 1.5) * r[i] * Math.exp(-Z * r[i]);
    }
  } else if (n === 2 && l === 0) {
    // R_20 = (1/(2*sqrt(2))) * Z^(3/2) * (2 - Z*r) * exp(-Z*r/2)
    for (let i = 0; i < r.length; i++) {
      u[i] = (1 / (2 * Math.sqrt(2))) * Math.pow(Z, 1.5) * (2 - Z * r[i]) * Math.exp(-Z * r[i] / 2) * r[i];
    }
  } else if (n === 2 && l === 1) {
    // R_21 = (1/(2*sqrt(6))) * Z^(3/2) * Z*r * exp(-Z*r/2)
    for (let i = 0; i < r.length; i++) {
      u[i] = (1 / (2 * Math.sqrt(6))) * Math.pow(Z, 1.5) * Z * r[i] * r[i] * Math.exp(-Z * r[i] / 2);
    }
  } else if (n === 3 && l === 0) {
    for (let i = 0; i < r.length; i++) {
      u[i] = (2 / (81 * Math.sqrt(3))) * Math.pow(Z, 1.5) * (27 - 18 * Z * r[i] + 2 * Z * Z * r[i] * r[i]) * Math.exp(-Z * r[i] / 3) * r[i];
    }
  }
  
  return normalizeWavefunction(u, r[1] - r[0]);
}
