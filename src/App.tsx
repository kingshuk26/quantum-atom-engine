import { useState, useCallback, useRef, useEffect, Suspense, lazy } from 'react';
import { runSCF, buildElectronConfig, SCFResult } from './physics/scfSolver';
import { ELEMENT_DATA, ATOMIC_UNITS, ORBITAL_NAMES } from './physics/constants';
import PeriodicTable from './components/PeriodicTable';
import RadialWaveChart from './components/RadialWaveChart';
import EnergyLevelChart from './components/EnergyLevelChart';
import ConvergenceChart from './components/ConvergenceChart';

const AtomCanvas3D = lazy(() => import('./components/AtomCanvas3D'));
const DensitySlice2D = lazy(() => import('./components/DensitySlice2D'));

type ColorScheme = 'plasma' | 'viridis' | 'inferno' | 'quantum';
type ViewMode = '3d' | '2d' | 'energy' | 'wavefunction';
type WaveMode = 'wavefunction' | 'density' | 'radial_prob';

interface SCFProgress {
  iteration: number;
  energy: number;
  delta: number;
}

const KNOWN_ENERGIES: Record<number, number> = {
  1: -13.606,   // H exact
  2: -79.005,   // He 
  3: -203.48,   // Li
  4: -399.39,   // Be
  6: -1030.1,   // C
  8: -2042.1,   // O
  10: -3497.0,  // Ne
};

export default function App() {
  const [selectedZ, setSelectedZ] = useState(1);
  const [charge, setCharge] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SCFResult | null>(null);
  const [progress, setProgress] = useState<SCFProgress[]>([]);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('plasma');
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [waveMode, setWaveMode] = useState<WaveMode>('radial_prob');
  const [showAnalytical, setShowAnalytical] = useState(false);
  const [isoLevel, setIsoLevel] = useState(0.15);
  const [displayRadius, setDisplayRadius] = useState(3.0);
  const [showPeriodicTable, setShowPeriodicTable] = useState(true);
  const [maxIterations, setMaxIterations] = useState(50);
  const [mixingParam, setMixingParam] = useState(0.4);
  const [activeTab, setActiveTab] = useState<'controls' | 'results' | 'math'>('controls');
  const workerRef = useRef<{ abort: boolean }>({ abort: false });

  const elementInfo = ELEMENT_DATA[selectedZ] ?? { symbol: `Z=${selectedZ}`, name: 'Element', config: '?', mass: 0 };
  const nElectrons = Math.max(0, selectedZ - charge);
  const electronConfig = buildElectronConfig(selectedZ, charge);

  const handleRun = useCallback(async () => {
    if (isRunning) { workerRef.current.abort = true; return; }
    
    setIsRunning(true);
    setProgress([]);
    setResult(null);
    workerRef.current.abort = false;

    try {
      const progressList: SCFProgress[] = [];
      
      const scfResult = await runSCF(
        {
          Z: selectedZ,
          charge,
          numGridPoints: 600,
          maxIterations,
          convergenceTol: 1e-6,
          mixingParameter: mixingParam,
        },
        (iter, energy, delta) => {
          if (workerRef.current.abort) return;
          const p = { iteration: iter, energy, delta };
          progressList.push(p);
          setProgress([...progressList]);
        }
      );

      if (!workerRef.current.abort) {
        setResult(scfResult);
        // Auto-set display radius based on atom size
        const rMax_ang = Math.max(2.0, scfResult.radialGrid[scfResult.radialGrid.length - 1] * 0.529177 * 0.35);
        setDisplayRadius(Math.min(8, rMax_ang));
      }
    } catch (err) {
      console.error('SCF error:', err);
    } finally {
      setIsRunning(false);
    }
  }, [selectedZ, charge, maxIterations, mixingParam, isRunning]);

  // Auto-run on element selection
  useEffect(() => {
    if (!isRunning) {
      handleRun();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZ, charge]);

  const totalEnergyEV = result ? result.totalEnergy * ATOMIC_UNITS.hartree_to_eV : null;
  const knownEnergy = KNOWN_ENERGIES[selectedZ];
  const energyError = totalEnergyEV && knownEnergy 
    ? Math.abs((totalEnergyEV - knownEnergy) / knownEnergy * 100) 
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-gray-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Animated atom icon */}
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
              <div className="absolute inset-1 rounded-full bg-blue-600/60" />
              <div className="absolute inset-2.5 rounded-full bg-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wider">
                ⚛ QUANTUM ATOM ENGINE
              </h1>
              <p className="text-[9px] text-gray-500 tracking-widest">
                SCF-DFT · LDA · KOHN-SHAM · FINITE DIFFERENCE
              </p>
            </div>
          </div>

          {/* Current element badge */}
          {result && (
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-gray-400">{elementInfo.name}</div>
                <div className="text-lg font-bold text-blue-400">{elementInfo.symbol}</div>
              </div>
              <div className={`
                w-12 h-12 rounded-lg flex flex-col items-center justify-center border
                ${result.converged ? 'border-emerald-500/60 bg-emerald-900/30' : 'border-amber-500/60 bg-amber-900/30'}
              `}>
                <span className="text-xs text-gray-400">{selectedZ}</span>
                <span className="text-lg font-bold">{elementInfo.symbol}</span>
              </div>
              <div className="text-xs text-gray-400 space-y-0.5">
                <div>E = <span className="text-blue-300">{totalEnergyEV?.toFixed(3)} eV</span></div>
                <div className={result.converged ? 'text-emerald-400' : 'text-amber-400'}>
                  {result.converged ? '✓ Converged' : '⟳ Not converged'} ({result.iterations} iter)
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-screen-2xl mx-auto w-full">
        {/* LEFT SIDEBAR */}
        <aside className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-gray-800/60 flex flex-col bg-gray-950">
          {/* Tab selector */}
          <div className="flex border-b border-gray-800">
            {(['controls', 'results', 'math'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-[10px] uppercase tracking-widest transition-colors ${
                  activeTab === tab
                    ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === 'controls' ? '⚙ Input' : tab === 'results' ? '📊 Results' : '∇ Math'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {activeTab === 'controls' && (
              <>
                {/* Periodic Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] uppercase tracking-widest text-gray-500">Element</h3>
                    <button
                      onClick={() => setShowPeriodicTable(v => !v)}
                      className="text-[9px] text-blue-400 hover:text-blue-300"
                    >
                      {showPeriodicTable ? '▲ Hide' : '▼ Show'} Table
                    </button>
                  </div>
                  {showPeriodicTable && (
                    <PeriodicTable selectedZ={selectedZ} onSelect={setSelectedZ} />
                  )}
                  
                  {/* Manual input */}
                  <div className="flex gap-2 items-center">
                    <label className="text-[10px] text-gray-500 shrink-0">Z (1–36):</label>
                    <input
                      type="number"
                      min={1} max={36}
                      value={selectedZ}
                      onChange={e => setSelectedZ(Math.max(1, Math.min(36, parseInt(e.target.value) || 1)))}
                      className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-500"
                    />
                    <div className="text-xs text-blue-400 font-bold">{elementInfo.symbol}</div>
                    <div className="text-xs text-gray-500">{elementInfo.name}</div>
                  </div>
                </div>

                {/* Charge */}
                <div className="space-y-1">
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-500">Ionic Charge</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={-(selectedZ - 1)}
                      max={selectedZ - 1}
                      value={charge}
                      onChange={e => setCharge(parseInt(e.target.value))}
                      className="flex-1 accent-blue-500"
                    />
                    <span className={`w-12 text-center text-xs font-bold ${
                      charge > 0 ? 'text-orange-400' : charge < 0 ? 'text-blue-400' : 'text-gray-300'
                    }`}>
                      {charge > 0 ? `+${charge}` : charge === 0 ? '0' : charge}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Electrons: <span className="text-gray-300">{nElectrons}</span>
                    {charge !== 0 && <span className="ml-2 text-amber-400">({charge > 0 ? 'cation' : 'anion'})</span>}
                  </div>
                </div>

                {/* Config preview */}
                <div className="bg-gray-900/60 rounded p-2 space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest">Electron Config</div>
                  <div className="flex flex-wrap gap-1">
                    {electronConfig.map(({ n, l, occ }) => (
                      <span
                        key={`${n}${l}`}
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          l === 0 ? 'border-blue-700 text-blue-300 bg-blue-900/40' :
                          l === 1 ? 'border-emerald-700 text-emerald-300 bg-emerald-900/40' :
                          l === 2 ? 'border-amber-700 text-amber-300 bg-amber-900/40' :
                          'border-pink-700 text-pink-300 bg-pink-900/40'
                        }`}
                      >
                        {n}{ORBITAL_NAMES[l]}<sup>{occ}</sup>
                      </span>
                    ))}
                  </div>
                  {elementInfo.config && (
                    <div className="text-[10px] text-gray-500 mt-1">{elementInfo.config}</div>
                  )}
                </div>

                {/* SCF Parameters */}
                <div className="space-y-3 border-t border-gray-800 pt-3">
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-500">SCF Parameters</h3>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Max Iterations</span>
                      <span className="text-gray-300">{maxIterations}</span>
                    </div>
                    <input
                      type="range" min={10} max={200} step={5}
                      value={maxIterations}
                      onChange={e => setMaxIterations(parseInt(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Mixing Parameter α</span>
                      <span className="text-gray-300">{mixingParam.toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min={0.05} max={0.8} step={0.05}
                      value={mixingParam}
                      onChange={e => setMixingParam(parseFloat(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="text-[9px] text-gray-600">
                      Lower = more stable but slower convergence
                    </div>
                  </div>
                </div>

                {/* Run button */}
                <button
                  onClick={handleRun}
                  className={`w-full py-3 rounded-lg font-bold text-sm tracking-wider transition-all ${
                    isRunning
                      ? 'bg-red-900/60 border border-red-700 text-red-300 hover:bg-red-800/60 animate-pulse'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                  }`}
                >
                  {isRunning ? '⏹ ABORT' : '▶ RUN SCF'}
                </button>

                {/* Progress */}
                {isRunning && progress.length > 0 && (
                  <div className="bg-gray-900/80 rounded p-2 space-y-1">
                    <div className="text-[10px] text-gray-500 flex justify-between">
                      <span>SCF Iteration {progress[progress.length - 1].iteration}</span>
                      <span className="text-blue-400">Running...</span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      E = {(progress[progress.length - 1].energy * ATOMIC_UNITS.hartree_to_eV).toFixed(4)} eV
                    </div>
                    <div className="text-[10px] text-gray-500">
                      ΔE = {(progress[progress.length - 1].delta * ATOMIC_UNITS.hartree_to_eV).toExponential(2)} eV
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1 mt-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full transition-all"
                        style={{ width: `${(progress.length / maxIterations) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'results' && result && (
              <>
                {/* Energy breakdown */}
                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-500">Energy Breakdown</h3>
                  <div className="space-y-1 text-xs">
                    {[
                      { label: 'Total Energy', value: result.totalEnergy * ATOMIC_UNITS.hartree_to_eV, color: 'text-blue-400', bold: true },
                      { label: 'Nuclear Attraction', value: result.nuclearEnergy * ATOMIC_UNITS.hartree_to_eV, color: 'text-red-400', bold: false },
                      { label: 'Hartree (e-e)', value: result.hartreeEnergy * ATOMIC_UNITS.hartree_to_eV, color: 'text-amber-400', bold: false },
                      { label: 'XC (LDA)', value: result.xcEnergy * ATOMIC_UNITS.hartree_to_eV, color: 'text-emerald-400', bold: false },
                    ].map(({ label, value, color, bold }) => (
                      <div key={label} className={`flex justify-between ${bold ? 'border-t border-gray-700 pt-1 mt-1' : ''}`}>
                        <span className="text-gray-400">{label}</span>
                        <span className={`${color} ${bold ? 'font-bold' : ''}`}>
                          {value.toFixed(4)} eV
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-gray-600 text-[10px] pt-1">
                      <span>In Hartree</span>
                      <span>{result.totalEnergy.toFixed(6)} Ha</span>
                    </div>
                  </div>
                </div>

                {/* Validation */}
                {knownEnergy && energyError !== null && (
                  <div className={`rounded p-2 border text-xs ${
                    energyError < 2 ? 'border-emerald-700 bg-emerald-900/20' :
                    energyError < 10 ? 'border-amber-700 bg-amber-900/20' :
                    'border-red-700 bg-red-900/20'
                  }`}>
                    <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Validation vs Reference</div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Reference</span>
                      <span className="text-gray-300">{knownEnergy.toFixed(3)} eV</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Computed</span>
                      <span className="text-blue-300">{totalEnergyEV?.toFixed(3)} eV</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Error</span>
                      <span className={energyError < 5 ? 'text-emerald-400' : 'text-amber-400'}>
                        {energyError.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Orbital table */}
                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-500">Orbital Energies</h3>
                  <div className="space-y-1">
                    {result.orbitals.map(orb => (
                      <div key={orb.label} className="flex items-center gap-2 text-xs">
                        <span className={`w-6 font-bold ${
                          orb.l === 0 ? 'text-blue-400' :
                          orb.l === 1 ? 'text-emerald-400' :
                          orb.l === 2 ? 'text-amber-400' :
                          'text-pink-400'
                        }`}>{orb.label}</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              orb.l === 0 ? 'bg-blue-500' :
                              orb.l === 1 ? 'bg-emerald-500' :
                              orb.l === 2 ? 'bg-amber-500' :
                              'bg-pink-500'
                            }`}
                            style={{ width: `${(orb.occupation / (2 * (2 * orb.l + 1))) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-center text-gray-400">{orb.occupation}e</span>
                        <span className="w-20 text-right text-gray-300">
                          {(orb.energy * ATOMIC_UNITS.hartree_to_eV).toFixed(2)} eV
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Atom properties */}
                <div className="space-y-2 border-t border-gray-800 pt-3">
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-500">Properties</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: 'Z', value: selectedZ },
                      { label: 'Electrons', value: nElectrons },
                      { label: 'SCF Iters', value: result.iterations },
                      { label: 'Mass (amu)', value: elementInfo.mass || '—' },
                      { label: 'Converged', value: result.converged ? 'Yes ✓' : 'No ✗' },
                      { label: 'Grid Pts', value: result.radialGrid.length },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-900/50 rounded p-1.5">
                        <div className="text-gray-500 text-[9px]">{label}</div>
                        <div className="text-gray-200 font-bold">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'results' && !result && (
              <div className="text-center text-gray-600 text-xs py-8">
                Run SCF computation to see results
              </div>
            )}

            {activeTab === 'math' && (
              <div className="space-y-4 text-xs text-gray-400">
                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-500">Theory</h3>
                  <div className="bg-gray-900/60 rounded p-3 space-y-3 font-mono">
                    <div>
                      <div className="text-blue-400 text-[10px] uppercase mb-1">Kohn-Sham Equation</div>
                      <div className="text-gray-300 text-[11px] leading-relaxed">
                        [-½∇² + V_eff(r)]ψ = εψ
                      </div>
                      <div className="text-gray-600 text-[9px]">Atomic units: ℏ = mₑ = e = 1</div>
                    </div>
                    <div>
                      <div className="text-emerald-400 text-[10px] uppercase mb-1">Effective Potential</div>
                      <div className="text-gray-300 text-[11px] leading-relaxed">
                        V_eff = V_nuc + V_H[ρ] + V_xc[ρ]
                      </div>
                      <div className="text-gray-600 text-[9px] space-y-0.5">
                        <div>V_nuc = -Z/r</div>
                        <div>V_H = ∫ρ(r')/|r-r'|dr' (Hartree)</div>
                        <div>V_xc = LDA (Perdew-Zunger)</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-amber-400 text-[10px] uppercase mb-1">Electron Density</div>
                      <div className="text-gray-300 text-[11px]">ρ(r) = Σᵢ fᵢ|ψᵢ(r)|²</div>
                    </div>
                    <div>
                      <div className="text-pink-400 text-[10px] uppercase mb-1">Radial Equation</div>
                      <div className="text-gray-300 text-[11px] leading-relaxed">
                        [-½d²/dr² + l(l+1)/2r²<br/>+ V_eff(r)]u(r) = εu(r)
                      </div>
                      <div className="text-gray-600 text-[9px]">u(r) = r·R(r)</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-500">Numerical Method</h3>
                  <div className="bg-gray-900/60 rounded p-3 space-y-2 text-[10px]">
                    <div className="flex gap-2">
                      <span className="text-blue-400 shrink-0">1.</span>
                      <span>Initialize ρ₀ (Thomas-Fermi guess)</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-blue-400 shrink-0">2.</span>
                      <span>Build tridiagonal Hamiltonian H(ρ)</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-blue-400 shrink-0">3.</span>
                      <span>Diagonalize via QL algorithm → εᵢ, ψᵢ</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-blue-400 shrink-0">4.</span>
                      <span>Update ρ_new = Σ fᵢ|ψᵢ|²</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-blue-400 shrink-0">5.</span>
                      <span>Mix: ρ = (1-α)ρ + αρ_new</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-blue-400 shrink-0">6.</span>
                      <span>Repeat until |ΔE| &lt; 10⁻⁶ Ha</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-500">LDA XC Functional</h3>
                  <div className="bg-gray-900/60 rounded p-3 text-[10px] space-y-1 font-mono">
                    <div className="text-violet-400">Exchange (Slater):</div>
                    <div className="text-gray-300 pl-2">εₓ = -(3/π)^(1/3)·ρ^(1/3)</div>
                    <div className="text-violet-400 mt-2">Correlation (Perdew-Zunger):</div>
                    <div className="text-gray-300 pl-2 text-[9px] leading-relaxed">
                      rₛ = (3/4πρ)^(1/3)<br/>
                      εc = γ/(1+β₁√rₛ+β₂rₛ)  [rₛ≥1]<br/>
                      εc = A·ln(rₛ)+B+C·rₛ·ln(rₛ)  [rₛ&lt;1]
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* MAIN PANEL */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* View controls */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/60 bg-gray-900/50 flex-wrap">
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
              {([
                { key: '3d', label: '🌐 3D View' },
                { key: '2d', label: '🔬 Density' },
                { key: 'energy', label: '⚡ Levels' },
                { key: 'wavefunction', label: '〜 Wave' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`px-2 py-1 rounded text-[10px] transition-all ${
                    viewMode === key
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-1 ml-auto">
              {/* Color scheme */}
              <select
                value={colorScheme}
                onChange={e => setColorScheme(e.target.value as ColorScheme)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="plasma">🌈 Plasma</option>
                <option value="viridis">🌿 Viridis</option>
                <option value="inferno">🔥 Inferno</option>
                <option value="quantum">⚛ Quantum</option>
              </select>

              {viewMode === '3d' && (
                <>
                  <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
                    <span className="text-[9px] text-gray-500">Iso:</span>
                    <input
                      type="range" min={0.01} max={0.9} step={0.01}
                      value={isoLevel}
                      onChange={e => setIsoLevel(parseFloat(e.target.value))}
                      className="w-16 accent-blue-500"
                    />
                    <span className="text-[9px] text-gray-400 w-6">{isoLevel.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
                    <span className="text-[9px] text-gray-500">R:</span>
                    <input
                      type="range" min={0.5} max={8} step={0.25}
                      value={displayRadius}
                      onChange={e => setDisplayRadius(parseFloat(e.target.value))}
                      className="w-16 accent-blue-500"
                    />
                    <span className="text-[9px] text-gray-400 w-8">{displayRadius.toFixed(1)}Å</span>
                  </div>
                </>
              )}

              {viewMode === 'wavefunction' && (
                <>
                  <select
                    value={waveMode}
                    onChange={e => setWaveMode(e.target.value as WaveMode)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-300 focus:outline-none"
                  >
                    <option value="wavefunction">u(r) Wavefunction</option>
                    <option value="density">ρ(r) Density</option>
                    <option value="radial_prob">|u(r)|² Prob</option>
                  </select>
                  {selectedZ === 1 && (
                    <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showAnalytical}
                        onChange={e => setShowAnalytical(e.target.checked)}
                        className="accent-blue-500"
                      />
                      Analytical
                    </label>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Main visualization area */}
          <div className="flex-1 min-h-0 relative">
            {!result && !isRunning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gray-600">
                <div className="text-6xl">⚛</div>
                <div className="text-lg font-bold text-gray-500">Select an element and run SCF</div>
                <div className="text-sm text-gray-600 max-w-md text-center">
                  The quantum engine will compute electron density from first principles using 
                  Kohn-Sham DFT with LDA exchange-correlation
                </div>
              </div>
            )}

            {isRunning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-950/80 z-10">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-blue-400/50 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
                  <div className="absolute inset-4 rounded-full border-2 border-blue-300/70 animate-spin" style={{ animationDuration: '3s' }} />
                  <div className="absolute inset-8 rounded-full bg-blue-500 animate-pulse" />
                </div>
                <div className="text-blue-400 font-bold">Computing {elementInfo.symbol} ({elementInfo.name})</div>
                <div className="text-gray-500 text-sm">
                  {progress.length > 0 
                    ? `SCF Iter ${progress[progress.length-1].iteration} | E = ${(progress[progress.length-1].energy * ATOMIC_UNITS.hartree_to_eV).toFixed(4)} eV`
                    : 'Initializing...'}
                </div>
                <div className="text-gray-600 text-xs">Solving Kohn-Sham equations numerically...</div>
              </div>
            )}

            {result && (
              <>
                {viewMode === '3d' && (
                  <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading 3D...</div>}>
                    <AtomCanvas3D
                      result={result}
                      displayRadius={displayRadius}
                      isoLevel={isoLevel}
                      colorScheme={colorScheme}
                    />
                  </Suspense>
                )}

                {viewMode === '2d' && (
                  <div className="h-full flex items-center justify-center p-4">
                    <div className="relative" style={{ width: 'min(100%, 500px)', aspectRatio: '1' }}>
                      <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
                        <DensitySlice2D
                          result={result}
                          colorScheme={colorScheme}
                          size={500}
                        />
                      </Suspense>
                      <div className="absolute top-2 left-2 text-[10px] text-gray-400 bg-gray-950/80 px-2 py-1 rounded">
                        ρ(x,z) cross-section · y=0 plane
                      </div>
                    </div>
                  </div>
                )}

                {viewMode === 'energy' && (
                  <div className="h-full flex flex-col gap-4 p-4">
                    <div className="flex-1 min-h-0">
                      <EnergyLevelChart result={result} width={800} height={320} />
                    </div>
                    <div className="h-48 shrink-0">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">SCF Convergence</div>
                      <ConvergenceChart
                        energyHistory={result.energyHistory}
                        converged={result.converged}
                      />
                    </div>
                  </div>
                )}

                {viewMode === 'wavefunction' && (
                  <div className="h-full flex flex-col gap-3 p-4">
                    <div className="flex-1 min-h-0">
                      <RadialWaveChart
                        result={result}
                        showAnalytical={showAnalytical}
                        mode={waveMode}
                      />
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 border-t border-gray-800 pt-2">
                      <span>Radial grid: 0 → {(result.radialGrid[result.radialGrid.length-1] * ATOMIC_UNITS.bohr_to_angstrom).toFixed(2)} Å</span>
                      <span>Grid points: {result.radialGrid.length}</span>
                      <span>dr ≈ {((result.radialGrid[1] - result.radialGrid[0]) * ATOMIC_UNITS.bohr_to_angstrom * 1000).toFixed(2)} mÅ</span>
                      {showAnalytical && selectedZ === 1 && (
                        <span className="text-blue-400">── Computed &nbsp;&nbsp; - - Analytical</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom status bar */}
          {result && (
            <div className="border-t border-gray-800/60 bg-gray-900/50 px-3 py-1.5 flex flex-wrap gap-4 text-[10px] text-gray-500">
              <span className="text-blue-400 font-bold">{elementInfo.symbol} (Z={selectedZ})</span>
              <span>E = <span className="text-gray-300">{totalEnergyEV?.toFixed(4)} eV</span></span>
              <span>= <span className="text-gray-300">{result.totalEnergy.toFixed(6)} Ha</span></span>
              <span className={result.converged ? 'text-emerald-400' : 'text-amber-400'}>
                {result.converged ? '✓ SCF Converged' : '⚠ Not Converged'}
              </span>
              <span>Iters: <span className="text-gray-300">{result.iterations}</span></span>
              <span>Orbitals: <span className="text-gray-300">{result.orbitals.length}</span></span>
              <span className="ml-auto text-gray-700">KS-DFT / LDA / Finite Difference</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
