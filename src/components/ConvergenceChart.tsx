import React, { useEffect, useRef } from 'react';
import { ATOMIC_UNITS } from '../physics/constants';

interface ConvergenceChartProps {
  energyHistory: number[];
  converged: boolean;
}

const ConvergenceChart: React.FC<ConvergenceChartProps> = ({ energyHistory, converged }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || energyHistory.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.offsetWidth || 400;
    const h = canvas.offsetHeight || 180;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 15, right: 15, bottom: 35, left: 65 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    const energiesEV = energyHistory.map(e => e * ATOMIC_UNITS.hartree_to_eV);
    const minE = Math.min(...energiesEV);
    const maxE = Math.max(...energiesEV);
    const range = maxE - minE || 1;

    const xToPixel = (i: number) => pad.left + (i / (energyHistory.length - 1)) * plotW;
    const yToPixel = (e: number) => pad.top + plotH - plotH * ((e - minE + range * 0.05) / (range * 1.1));

    // Grid
    const nX = Math.min(energyHistory.length - 1, 6);
    ctx.strokeStyle = 'rgba(30,41,59,0.6)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= nX; i++) {
      const x = pad.left + (i / nX) * plotW;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotH); ctx.stroke();
      const iter = Math.round((i / nX) * (energyHistory.length - 1));
      ctx.fillStyle = 'rgba(100,116,139,0.7)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(iter), x, pad.top + plotH + 14);
    }

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
      const val = maxE + range * 0.05 - (i / 4) * range * 1.1;
      ctx.fillStyle = 'rgba(100,116,139,0.7)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(2), pad.left - 4, y + 3);
    }

    // Convergence line gradient
    const grad = ctx.createLinearGradient(pad.left, 0, pad.left + plotW, 0);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(0.5, '#60a5fa');
    grad.addColorStop(1, converged ? '#34d399' : '#f472b6');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = converged ? '#34d399' : '#60a5fa';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i < energiesEV.length; i++) {
      const x = xToPixel(i);
      const y = yToPixel(energiesEV[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Data points
    energiesEV.forEach((e, i) => {
      const x = xToPixel(i);
      const y = yToPixel(e);
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = i === energiesEV.length - 1 
        ? (converged ? '#34d399' : '#f472b6') 
        : 'rgba(96,165,250,0.6)';
      ctx.fill();
    });

    // Labels
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCF Iteration', pad.left + plotW / 2, h - 5);

    ctx.save();
    ctx.translate(12, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Energy (eV)', 0, 0);
    ctx.restore();

    // Convergence status
    const finalE = energiesEV[energiesEV.length - 1];
    ctx.fillStyle = converged ? '#34d399' : '#f59e0b';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      converged ? `✓ Converged: ${finalE.toFixed(4)} eV` : `⟳ Running: ${finalE.toFixed(4)} eV`,
      w - pad.right,
      pad.top + 10
    );

  }, [energyHistory, converged]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-lg"
    />
  );
};

export default ConvergenceChart;
