import React, { useEffect, useRef } from 'react';
import { SCFResult, getDensitySlice } from '../physics/scfSolver';

interface DensitySlice2DProps {
  result: SCFResult | null;
  colorScheme: 'plasma' | 'viridis' | 'inferno' | 'quantum';
  size?: number;
}

function colorFromScheme(t: number, scheme: string): [number, number, number] {
  const tc = Math.max(0, Math.min(1, t));
  
  if (scheme === 'viridis') {
    const rv = Math.round(255 * (0.267 + tc * (-0.003 + tc * 1.4)));
    const gv = Math.round(255 * Math.max(0, 0.005 + tc * (1.2 - tc * 0.4)));
    const bv = Math.round(255 * Math.max(0, 0.329 + tc * (0.4 - tc * 1.0)));
    return [Math.min(255, Math.max(0, rv)), Math.min(255, Math.max(0, gv)), Math.min(255, Math.max(0, bv))];
  }
  
  if (scheme === 'inferno') {
    const ri = Math.round(255 * Math.min(1, Math.max(0, tc * tc * 2.5)));
    const gi = Math.round(255 * Math.min(1, Math.max(0, tc * tc * tc * 2.0)));
    const bi = Math.round(255 * Math.min(1, Math.max(0, 0.5 * (1 - tc) * (1 - tc) + tc * tc * 0.2)));
    return [ri, gi, bi];
  }
  
  if (scheme === 'quantum') {
    if (tc < 0.25) {
      const s = tc / 0.25;
      return [0, Math.round(s * 50), Math.round(100 + s * 155)];
    } else if (tc < 0.5) {
      const s = (tc - 0.25) / 0.25;
      return [Math.round(s * 100), 0, Math.round(255 - s * 100)];
    } else if (tc < 0.75) {
      const s = (tc - 0.5) / 0.25;
      return [Math.round(100 + s * 155), Math.round(s * 100), 155];
    } else {
      const s = (tc - 0.75) / 0.25;
      return [255, Math.round(100 + s * 155), Math.round(155 + s * 100)];
    }
  }

  // Plasma (default)
  const rp = Math.round(255 * Math.min(1, Math.max(0, 0.05 + tc * (1.8 - tc * 0.6))));
  const gp = Math.round(255 * Math.min(1, Math.max(0, tc * tc * 0.8)));
  const bp = Math.round(255 * Math.min(1, Math.max(0, 0.53 + tc * (0.3 - tc * 0.8))));
  return [rp, gp, bp];
}

const DensitySlice2D: React.FC<DensitySlice2DProps> = ({ result, colorScheme, size = 300 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { electronDensity, radialGrid, Z } = result;
    const rMax = Math.min(radialGrid[radialGrid.length - 1], 12.0 / Math.max(1, Math.pow(Z, 0.3)));
    const sliceData = getDensitySlice(electronDensity, radialGrid, size, rMax);
    
    const imageData = ctx.createImageData(size, size);
    
    // Log-scale for better visualization of shell structure
    const logMax = Math.log(sliceData.maxVal + 1);
    
    for (let ix = 0; ix < size; ix++) {
      for (let iz = 0; iz < size; iz++) {
        const val = sliceData.slice[ix * size + iz];
        // Use log scale
        const logVal = Math.log(val + 1) / logMax;
        const t = Math.pow(logVal, 0.6); // gamma correction
        
        const [r, g, b] = colorFromScheme(t, colorScheme);
        const alpha = val > 0 ? Math.round(30 + t * 225) : 10;
        
        // Flip z axis for display
        const pixelIdx = ((size - 1 - iz) * size + ix) * 4;
        imageData.data[pixelIdx] = r;
        imageData.data[pixelIdx + 1] = g;
        imageData.data[pixelIdx + 2] = b;
        imageData.data[pixelIdx + 3] = alpha;
      }
    }

    // Black background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, size, size);
    ctx.putImageData(imageData, 0, 0);

    // Draw nucleus indicator
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Draw axis labels
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '11px monospace';
    ctx.fillText('X', size - 15, size / 2 - 4);
    ctx.fillText('Z', size / 2 + 4, 12);

    // Draw scale bar
    const barWidth = size * 0.25;
    const bohrPerPixel = 2 * rMax / size;
    const barBohr = barWidth * bohrPerPixel;
    const barAngstrom = (barBohr * 0.529177).toFixed(1);
    
    ctx.strokeStyle = 'rgba(148,163,184,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, size - 15);
    ctx.lineTo(10 + barWidth, size - 15);
    ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '10px monospace';
    ctx.fillText(`${barAngstrom} Å`, 10, size - 4);

    // Draw concentric circles for expected shell radii
    for (const orb of result.orbitals) {
      let maxP = 0, peakR = 0;
      for (let i = 0; i < orb.pDensity.length; i++) {
        if (orb.pDensity[i] > maxP) {
          maxP = orb.pDensity[i];
          peakR = result.radialGrid[i];
        }
      }
      if (peakR > rMax || peakR < 0.01) continue;
      const pixelR = (peakR / rMax) * (size / 2);

      const lColors = ['rgba(96,165,250,0.3)', 'rgba(52,211,153,0.3)', 'rgba(245,158,11,0.3)', 'rgba(244,114,182,0.3)'];
      ctx.strokeStyle = lColors[orb.l % 4];
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, pixelR, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Label
      ctx.fillStyle = lColors[orb.l % 4].replace('0.3', '0.8');
      ctx.font = '9px monospace';
      ctx.fillText(orb.label, size / 2 + pixelR * 0.7, size / 2 - pixelR * 0.7);
    }

  }, [result, colorScheme, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="w-full h-full object-contain rounded-lg"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export default DensitySlice2D;
