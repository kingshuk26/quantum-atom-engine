import React, { useEffect, useRef } from 'react';
import { SCFResult, analyticalHydrogenWavefunction } from '../physics/scfSolver';
import { ATOMIC_UNITS, ORBITAL_COLORS, ORBITAL_NAMES } from '../physics/constants';

interface RadialWaveChartProps {
  result: SCFResult;
  showAnalytical?: boolean;
  mode: 'wavefunction' | 'density' | 'radial_prob';
}

const RadialWaveChart: React.FC<RadialWaveChartProps> = ({ result, showAnalytical = false, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !result.orbitals.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.offsetWidth || 600;
    const h = canvas.offsetHeight || 250;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 15, right: 15, bottom: 38, left: 55 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    const { radialGrid } = result;
    const rMax_au = Math.min(radialGrid[radialGrid.length - 1], 20.0 / Math.max(1, Math.pow(result.Z, 0.33)));
    const rMax_ang = rMax_au * ATOMIC_UNITS.bohr_to_angstrom;

    // Find y range
    let yMin = 0, yMax = 0;
    for (const orb of result.orbitals) {
      const data = getData(orb, mode);
      for (let i = 0; i < radialGrid.length; i++) {
        if (radialGrid[i] > rMax_au) break;
        if (mode === 'wavefunction') {
          yMin = Math.min(yMin, data[i]);
          yMax = Math.max(yMax, data[i]);
        } else {
          yMax = Math.max(yMax, data[i]);
        }
      }
    }
    
    if (yMax === 0) yMax = 1;
    const yRange = yMax - yMin;
    const yPadded = yRange * 0.1;

    const xToPixel = (r_au: number) => pad.left + (r_au / rMax_au) * plotW;
    const yToPixel = (y: number) => pad.top + plotH - plotH * ((y - (yMin - yPadded)) / (yRange + 2 * yPadded));

    // Grid
    const numGridX = 5, numGridY = 4;
    ctx.strokeStyle = 'rgba(30,41,59,0.6)';
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= numGridX; i++) {
      const x = pad.left + (i / numGridX) * plotW;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotH); ctx.stroke();
      const rVal = (i / numGridX) * rMax_ang;
      ctx.fillStyle = 'rgba(100,116,139,0.8)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(rVal.toFixed(1), x, pad.top + plotH + 14);
    }

    for (let i = 0; i <= numGridY; i++) {
      const y = pad.top + (i / numGridY) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
      const val = yMin - yPadded + ((1 - i / numGridY) * (yRange + 2 * yPadded));
      ctx.fillStyle = 'rgba(100,116,139,0.8)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(3), pad.left - 4, y + 3);
    }

    // Zero line
    const y0 = yToPixel(0);
    if (y0 >= pad.top && y0 <= pad.top + plotH) {
      ctx.strokeStyle = 'rgba(100,116,139,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(pad.left, y0); ctx.lineTo(pad.left + plotW, y0); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Axis labels
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('r (Å)', pad.left + plotW / 2, h - 6);

    ctx.save();
    ctx.translate(12, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    const yLabel = mode === 'wavefunction' ? 'u(r)' : mode === 'density' ? 'ρ(r)' : '|u(r)|²';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Plot each orbital
    result.orbitals.forEach((orb, i) => {
      const data = getData(orb, mode);
      const color = ORBITAL_COLORS[ORBITAL_NAMES[orb.l] as keyof typeof ORBITAL_COLORS] ?? '#fff';
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();

      let started = false;
      for (let j = 0; j < radialGrid.length; j++) {
        const r = radialGrid[j];
        if (r > rMax_au) break;
        const x = xToPixel(r * ATOMIC_UNITS.bohr_to_angstrom);
        const y = yToPixel(data[j]);
        if (y < 0 || y > h + 50) { started = false; continue; }
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Analytical comparison (H-like only for validation)
      if (showAnalytical && result.Z === 1 && (orb.n <= 3)) {
        const analytical = analyticalHydrogenWavefunction(orb.n, orb.l, radialGrid, 1);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        let aStarted = false;
        const analyticalData = mode === 'density' ? 
          analytical.map(v => v * v) : analytical;
        for (let j = 0; j < radialGrid.length; j++) {
          if (radialGrid[j] > rMax_au) break;
          const x = xToPixel(radialGrid[j] * ATOMIC_UNITS.bohr_to_angstrom);
          const y = yToPixel(analyticalData[j]);
          if (!aStarted) { ctx.moveTo(x, y); aStarted = true; }
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;

      // Legend entry
      const legendX = pad.left + 8 + (i % 4) * 60;
      const legendY = pad.top + 10;
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY - 5, 14, 3);
      ctx.fillStyle = 'rgba(226,232,240,0.9)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(orb.label, legendX + 16, legendY);
    });

    // Title
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    const modeLabel = mode === 'wavefunction' ? 'Radial Wavefunction u(r)' : 
                      mode === 'density' ? 'Electron Density ρ(r)' : 
                      'Radial Probability |u(r)|²';
    ctx.fillText(modeLabel, w - pad.right, pad.top + 10);

  }, [result, showAnalytical, mode]);

  function getData(orb: SCFResult['orbitals'][0], mode: string): Float64Array {
    if (mode === 'wavefunction') return orb.u;
    if (mode === 'density') {
      const rho = new Float64Array(orb.u.length);
      for (let i = 0; i < orb.u.length; i++) {
        const ri = result.radialGrid[i];
        rho[i] = orb.u[i] * orb.u[i] / (4 * Math.PI * ri * ri);
      }
      return rho;
    }
    return orb.pDensity; // radial probability
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-lg"
    />
  );
};

export default RadialWaveChart;
