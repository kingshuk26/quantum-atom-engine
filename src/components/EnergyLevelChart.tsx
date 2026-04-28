import React, { useEffect, useRef } from 'react';
import { SCFResult } from '../physics/scfSolver';
import { ATOMIC_UNITS, ORBITAL_COLORS, ORBITAL_NAMES } from '../physics/constants';

interface EnergyLevelChartProps {
  result: SCFResult;
  width?: number;
  height?: number;
}

const EnergyLevelChart: React.FC<EnergyLevelChartProps> = ({ result, width = 400, height = 300 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 20, right: 20, bottom: 40, left: 65 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    // Background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, width, height);

    if (!result.orbitals.length) return;

    const energiesEV = result.orbitals.map(o => o.energy * ATOMIC_UNITS.hartree_to_eV);
    const minE = Math.min(...energiesEV) * 1.15;
    const maxE = Math.min(5, Math.max(...energiesEV) * 1.1);

    const eToY = (e: number) => pad.top + plotH * (1 - (e - minE) / (maxE - minE));

    // Grid lines
    ctx.strokeStyle = 'rgba(30,41,59,0.8)';
    ctx.lineWidth = 0.5;
    const numGridLines = 6;
    for (let i = 0; i <= numGridLines; i++) {
      const e = minE + (i / numGridLines) * (maxE - minE);
      const y = eToY(e);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      // Energy labels
      ctx.fillStyle = 'rgba(100,116,139,0.9)';
      ctx.font = `${10 * Math.min(1, width/400)}px monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(e.toFixed(1) + ' eV', pad.left - 5, y + 4);
    }

    // Zero line
    if (maxE > 0 && minE < 0) {
      const y0 = eToY(0);
      ctx.strokeStyle = 'rgba(100,116,139,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y0);
      ctx.lineTo(pad.left + plotW, y0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(100,116,139,0.6)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('0', pad.left + 2, y0 - 3);
    }

    // Y-axis label
    ctx.save();
    ctx.translate(12, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Energy (eV)', 0, 0);
    ctx.restore();

    // Group orbitals by l
    const lGroups = new Map<number, { orb: typeof result.orbitals[0]; eV: number }[]>();
    result.orbitals.forEach((orb, idx) => {
      if (!lGroups.has(orb.l)) lGroups.set(orb.l, []);
      lGroups.get(orb.l)!.push({ orb, eV: energiesEV[idx] });
    });

    const numL = lGroups.size;
    const colWidth = plotW / (numL + 1);

    let colIdx = 0;
    for (const [l, orbList] of lGroups) {
      const x = pad.left + (colIdx + 0.5) * colWidth + colWidth * 0.5;
      colIdx++;

      // Column label
      ctx.fillStyle = ORBITAL_COLORS[ORBITAL_NAMES[l] as keyof typeof ORBITAL_COLORS] ?? '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ORBITAL_NAMES[l].toUpperCase(), x, height - 8);

      for (const { orb, eV } of orbList) {
        if (eV < minE || eV > maxE) continue;
        const y = eToY(eV);
        const lineHalf = 28;

        const orbColor = ORBITAL_COLORS[ORBITAL_NAMES[l] as keyof typeof ORBITAL_COLORS] ?? '#aaa';

        // Glow effect
        const grad = ctx.createLinearGradient(x - lineHalf, y, x + lineHalf, y);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.3, orbColor + '88');
        grad.addColorStop(0.5, orbColor);
        grad.addColorStop(0.7, orbColor + '88');
        grad.addColorStop(1, 'transparent');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - lineHalf, y);
        ctx.lineTo(x + lineHalf, y);
        ctx.stroke();

        // Electron occupancy dots
        const maxElec = 2 * (2 * l + 1);
        const dotSpacing = 5;
        const dotStartX = x - (orb.occupation / 2) * dotSpacing;
        for (let e = 0; e < orb.occupation; e++) {
          const dotX = dotStartX + e * dotSpacing;
          ctx.beginPath();
          ctx.arc(dotX, y - 6, 2, 0, 2 * Math.PI);
          ctx.fillStyle = orbColor;
          ctx.fill();
        }
        for (let e = orb.occupation; e < maxElec; e++) {
          const dotX = dotStartX + e * dotSpacing - (orb.occupation / 2) * dotSpacing + (maxElec / 2) * dotSpacing;
          ctx.beginPath();
          ctx.arc(dotX + (e - orb.occupation) * dotSpacing * 0.5, y - 6, 2, 0, 2 * Math.PI);
          ctx.strokeStyle = orbColor + '44';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = 'rgba(226,232,240,0.9)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${orb.label}`, x, y + 14);

        // Energy value
        ctx.fillStyle = 'rgba(148,163,184,0.6)';
        ctx.font = '8px monospace';
        ctx.fillText(`${eV.toFixed(2)} eV`, x, y + 24);
      }
    }

    // Title
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Orbital Energy Levels', width / 2, 14);

  }, [result, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%' }}
      className="rounded-lg"
    />
  );
};

export default EnergyLevelChart;
