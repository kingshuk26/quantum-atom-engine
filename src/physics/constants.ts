// Atomic units (a.u.) system
// hbar = m_e = e = 4*pi*eps0 = 1
// Energy in Hartree (1 Ha = 27.211 eV)
// Length in Bohr radii (1 a_0 = 0.529177 Å)

export const ATOMIC_UNITS = {
  hbar: 1.0,
  me: 1.0,
  e: 1.0,
  eps0: 1.0 / (4 * Math.PI),
  bohr_to_angstrom: 0.529177,
  hartree_to_eV: 27.2114,
  hartree_to_kJmol: 2625.5,
};

export const ELEMENT_DATA: Record<number, { symbol: string; name: string; config: string; mass: number }> = {
  1:  { symbol: 'H',  name: 'Hydrogen',     config: '1s¹',                     mass: 1.008 },
  2:  { symbol: 'He', name: 'Helium',        config: '1s²',                     mass: 4.003 },
  3:  { symbol: 'Li', name: 'Lithium',       config: '[He] 2s¹',                mass: 6.941 },
  4:  { symbol: 'Be', name: 'Beryllium',     config: '[He] 2s²',                mass: 9.012 },
  5:  { symbol: 'B',  name: 'Boron',         config: '[He] 2s² 2p¹',            mass: 10.811 },
  6:  { symbol: 'C',  name: 'Carbon',        config: '[He] 2s² 2p²',            mass: 12.011 },
  7:  { symbol: 'N',  name: 'Nitrogen',      config: '[He] 2s² 2p³',            mass: 14.007 },
  8:  { symbol: 'O',  name: 'Oxygen',        config: '[He] 2s² 2p⁴',            mass: 15.999 },
  9:  { symbol: 'F',  name: 'Fluorine',      config: '[He] 2s² 2p⁵',            mass: 18.998 },
  10: { symbol: 'Ne', name: 'Neon',          config: '[He] 2s² 2p⁶',            mass: 20.180 },
  11: { symbol: 'Na', name: 'Sodium',        config: '[Ne] 3s¹',                mass: 22.990 },
  12: { symbol: 'Mg', name: 'Magnesium',     config: '[Ne] 3s²',                mass: 24.305 },
  13: { symbol: 'Al', name: 'Aluminum',      config: '[Ne] 3s² 3p¹',            mass: 26.982 },
  14: { symbol: 'Si', name: 'Silicon',       config: '[Ne] 3s² 3p²',            mass: 28.086 },
  15: { symbol: 'P',  name: 'Phosphorus',    config: '[Ne] 3s² 3p³',            mass: 30.974 },
  16: { symbol: 'S',  name: 'Sulfur',        config: '[Ne] 3s² 3p⁴',            mass: 32.060 },
  17: { symbol: 'Cl', name: 'Chlorine',      config: '[Ne] 3s² 3p⁵',            mass: 35.450 },
  18: { symbol: 'Ar', name: 'Argon',         config: '[Ne] 3s² 3p⁶',            mass: 39.948 },
  19: { symbol: 'K',  name: 'Potassium',     config: '[Ar] 4s¹',                mass: 39.098 },
  20: { symbol: 'Ca', name: 'Calcium',       config: '[Ar] 4s²',                mass: 40.078 },
  26: { symbol: 'Fe', name: 'Iron',          config: '[Ar] 3d⁶ 4s²',            mass: 55.845 },
  29: { symbol: 'Cu', name: 'Copper',        config: '[Ar] 3d¹⁰ 4s¹',           mass: 63.546 },
  30: { symbol: 'Zn', name: 'Zinc',          config: '[Ar] 3d¹⁰ 4s²',           mass: 65.38 },
  36: { symbol: 'Kr', name: 'Krypton',       config: '[Ar] 3d¹⁰ 4s² 4p⁶',      mass: 83.798 },
  47: { symbol: 'Ag', name: 'Silver',        config: '[Kr] 4d¹⁰ 5s¹',           mass: 107.868 },
  79: { symbol: 'Au', name: 'Gold',          config: '[Xe] 4f¹⁴ 5d¹⁰ 6s¹',     mass: 196.967 },
  92: { symbol: 'U',  name: 'Uranium',       config: '[Rn] 5f³ 6d¹ 7s²',       mass: 238.029 },
};

// Orbital quantum numbers: subshell filling order (Madelung rule)
export const FILLING_ORDER: Array<[number, number]> = [
  [1, 0], // 1s
  [2, 0], // 2s
  [2, 1], // 2p
  [3, 0], // 3s
  [3, 1], // 3p
  [4, 0], // 4s
  [3, 2], // 3d
  [4, 1], // 4p
  [5, 0], // 5s
  [4, 2], // 4d
  [5, 1], // 5p
  [6, 0], // 6s
  [4, 3], // 4f
  [5, 2], // 5d
  [6, 1], // 6p
  [7, 0], // 7s
  [5, 3], // 5f
  [6, 2], // 6d
  [7, 1], // 7p
];

export const ORBITAL_NAMES = ['s', 'p', 'd', 'f', 'g'];
export const ORBITAL_COLORS = {
  s: '#60a5fa',  // blue
  p: '#34d399',  // green
  d: '#f59e0b',  // amber
  f: '#f472b6',  // pink
  g: '#a78bfa',  // violet
};
