import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { SCFResult } from '../physics/scfSolver';

interface AtomCanvas3DProps {
  result: SCFResult | null;
  displayRadius: number;
  isoLevel: number;
  colorScheme: 'plasma' | 'viridis' | 'inferno' | 'quantum';
}

// Color mapping functions
function plasmaColor(t: number): [number, number, number] {
  const r = Math.min(1, 0.050 + t * (2.1 - t * 0.8));
  const g = Math.min(1, Math.max(0, 0.03 + t * (0.5 - t * 0.8)));
  const b = Math.min(1, 0.53 + t * (-1.0 + t * 0.2));
  return [Math.max(0, r), Math.max(0, g), Math.max(0, b)];
}

function viridisColor(t: number): [number, number, number] {
  const r = Math.min(1, Math.max(0, 0.267 + t * (-0.003 + t * (1.785 - t * 0.6))));
  const g = Math.min(1, Math.max(0, 0.005 + t * (1.085 - t * 0.38)));
  const b = Math.min(1, Math.max(0, 0.329 + t * (1.748 - t * 3.1 + t * t * 2.1)));
  return [r, g, b];
}

function infernoColor(t: number): [number, number, number] {
  const r = Math.min(1, Math.max(0, 0.0 + t * (3.0 - t * 2.0)));
  const g = Math.min(1, Math.max(0, 0.0 + t * t * (2.5 - t)));
  const b = Math.min(1, Math.max(0, 0.014 + t * (1.6 - t * 3.2 + t * t * 2.0)));
  return [r, g, b];
}

function quantumColor(t: number): [number, number, number] {
  // Cyan -> Blue -> Purple -> White
  if (t < 0.33) {
    const s = t / 0.33;
    return [0, s * 0.5, 1 - s * 0.3];
  } else if (t < 0.66) {
    const s = (t - 0.33) / 0.33;
    return [s * 0.5, 0, 0.7 + s * 0.3];
  } else {
    const s = (t - 0.66) / 0.34;
    return [0.5 + s * 0.5, s * 0.5, 1];
  }
}

function getColor(t: number, scheme: string): [number, number, number] {
  const tc = Math.max(0, Math.min(1, t));
  switch (scheme) {
    case 'viridis': return viridisColor(tc);
    case 'inferno': return infernoColor(tc);
    case 'quantum': return quantumColor(tc);
    default: return plasmaColor(tc);
  }
}

const AtomCanvas3D: React.FC<AtomCanvas3DProps> = ({ result, displayRadius, isoLevel, colorScheme }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    animFrameId: number;
    particles?: THREE.Points;
    nucleus?: THREE.Mesh;
    isDragging: boolean;
    lastMouse: { x: number; y: number };
    spherical: { theta: number; phi: number; radius: number };
  } | null>(null);

  const initScene = useCallback(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 1000);
    camera.position.set(0, 0, displayRadius * 3.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // Ambient + directional lighting
    scene.add(new THREE.AmbientLight(0x334466, 0.8));
    const dirLight = new THREE.DirectionalLight(0x8888ff, 1.2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-5, -3, -7);
    scene.add(dirLight2);

    // Grid helper (dim)
    const gridHelper = new THREE.GridHelper(displayRadius * 4, 10, 0x1a2040, 0x0d1030);
    gridHelper.position.y = -displayRadius * 1.5;
    scene.add(gridHelper);

    // Axes
    const axesMat = new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.5 });
    const axisLen = displayRadius * 2;
    for (const dir of [[1,0,0],[0,1,0],[0,0,1]]) {
      const pts = [new THREE.Vector3(0,0,0), new THREE.Vector3(dir[0]*axisLen, dir[1]*axisLen, dir[2]*axisLen)];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      scene.add(new THREE.Line(geo, axesMat));
    }

    const state = {
      scene, camera, renderer,
      animFrameId: 0,
      isDragging: false,
      lastMouse: { x: 0, y: 0 },
      spherical: { theta: 0.5, phi: 0.3, radius: displayRadius * 3.5 },
    };

    // Mouse controls
    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', (e) => {
      state.isDragging = true;
      state.lastMouse = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!state.isDragging) return;
      const dx = e.clientX - state.lastMouse.x;
      const dy = e.clientY - state.lastMouse.y;
      state.spherical.theta -= dx * 0.01;
      state.spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, state.spherical.phi + dy * 0.01));
      state.lastMouse = { x: e.clientX, y: e.clientY };
      updateCamera(state);
    });
    canvas.addEventListener('mouseup', () => { state.isDragging = false; });
    canvas.addEventListener('wheel', (e) => {
      state.spherical.radius = Math.max(displayRadius * 0.5, Math.min(displayRadius * 10, state.spherical.radius * (1 + e.deltaY * 0.001)));
      updateCamera(state);
    }, { passive: true });

    // Touch controls
    let lastTouchDist = 0;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        state.isDragging = true;
        state.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && state.isDragging) {
        const dx = e.touches[0].clientX - state.lastMouse.x;
        const dy = e.touches[0].clientY - state.lastMouse.y;
        state.spherical.theta -= dx * 0.01;
        state.spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, state.spherical.phi + dy * 0.01));
        state.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        updateCamera(state);
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        state.spherical.radius *= lastTouchDist / dist;
        state.spherical.radius = Math.max(displayRadius * 0.5, Math.min(displayRadius * 10, state.spherical.radius));
        lastTouchDist = dist;
        updateCamera(state);
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { state.isDragging = false; });

    sceneRef.current = state;

    // Animation loop
    const animate = () => {
      state.animFrameId = requestAnimationFrame(animate);
      // Slow auto-rotation
      if (!state.isDragging) {
        state.spherical.theta += 0.003;
        updateCamera(state);
      }
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(state.animFrameId);
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [displayRadius]);

  function updateCamera(state: { camera: THREE.PerspectiveCamera; spherical: { theta: number; phi: number; radius: number } }) {
    const { theta, phi, radius } = state.spherical;
    state.camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta)
    );
    state.camera.lookAt(0, 0, 0);
  }

  // Build particle system from electron density
  const buildParticles = useCallback(() => {
    if (!sceneRef.current || !result) return;
    const { scene } = sceneRef.current;

    // Remove old particles
    if (sceneRef.current.particles) {
      scene.remove(sceneRef.current.particles);
      sceneRef.current.particles.geometry.dispose();
      (sceneRef.current.particles.material as THREE.Material).dispose();
    }
    if (sceneRef.current.nucleus) {
      scene.remove(sceneRef.current.nucleus);
      sceneRef.current.nucleus.geometry.dispose();
      (sceneRef.current.nucleus.material as THREE.Material).dispose();
    }

    const { electronDensity, radialGrid } = result;
    const rMax = Math.min(displayRadius, radialGrid[radialGrid.length - 1]);
    const dr = radialGrid[1] - radialGrid[0];

    // Find max density for normalization
    let maxRho = 0;
    for (let i = 0; i < electronDensity.length; i++) {
      maxRho = Math.max(maxRho, electronDensity[i]);
    }
    if (maxRho === 0) return;

    // Monte Carlo sampling of electron density to place particles
    const NUM_PARTICLES = 18000;
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    // Generate particles using importance sampling
    let attempts = 0;
    const maxAttempts = NUM_PARTICLES * 30;

    while (positions.length / 3 < NUM_PARTICLES && attempts < maxAttempts) {
      attempts++;
      // Random point in sphere
      const u1 = Math.random() * 2 - 1;
      const u2 = Math.random() * 2 - 1;
      const u3 = Math.random() * 2 - 1;
      const rad = Math.sqrt(u1 * u1 + u2 * u2 + u3 * u3) * rMax;
      
      if (rad > rMax || rad < 1e-6) continue;

      // Get density at this radius
      const idx = rad / dr;
      const iLow = Math.min(Math.floor(idx), electronDensity.length - 2);
      const frac = idx - iLow;
      const rhoVal = (1 - frac) * electronDensity[iLow] + frac * electronDensity[iLow + 1];

      // Rejection sampling
      const normalizedRho = rhoVal / maxRho;
      
      // Enhanced acceptance to show shell structure
      const threshold = isoLevel * 0.1;
      if (normalizedRho < threshold) continue;
      if (Math.random() > normalizedRho) continue;

      const nx = u1 / Math.sqrt(u1*u1 + u2*u2 + u3*u3 + 1e-30);
      const ny = u2 / Math.sqrt(u1*u1 + u2*u2 + u3*u3 + 1e-30);
      const nz = u3 / Math.sqrt(u1*u1 + u2*u2 + u3*u3 + 1e-30);

      positions.push(nx * rad * 0.529177, ny * rad * 0.529177, nz * rad * 0.529177);

      const [cr, cg, cb] = getColor(Math.pow(normalizedRho, 0.4), colorScheme);
      colors.push(cr, cg, cb);
      sizes.push(0.02 + normalizedRho * 0.06);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    sceneRef.current.particles = particles;

    // Nucleus sphere
    const nucGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const nucColor = result.Z <= 2 ? 0x60a5fa : result.Z <= 10 ? 0x34d399 : result.Z <= 18 ? 0xf59e0b : 0xf472b6;
    const nucMat = new THREE.MeshPhongMaterial({
      color: nucColor,
      emissive: nucColor,
      emissiveIntensity: 0.6,
      shininess: 100,
    });
    const nucleus = new THREE.Mesh(nucGeo, nucMat);
    scene.add(nucleus);
    sceneRef.current.nucleus = nucleus;

    // Electron shell rings
    addShellRings(scene, result, rMax, colorScheme);

  }, [result, displayRadius, isoLevel, colorScheme]);

  // Add electron shell ring indicators
  function addShellRings(
    scene: THREE.Scene,
    result: SCFResult,
    rMax: number,
    _scheme: string
  ) {
    // Remove old rings
    const toRemove = scene.children.filter(c => c.userData.isRing);
    toRemove.forEach(c => scene.remove(c));

    for (const orb of result.orbitals) {
      // Find peak of radial probability density
      let maxP = 0, peakR = 0;
      for (let i = 0; i < orb.pDensity.length; i++) {
        if (orb.pDensity[i] > maxP) {
          maxP = orb.pDensity[i];
          peakR = result.radialGrid[i] * 0.529177; // convert to Angstrom
        }
      }
      if (peakR > rMax * 0.529177 || peakR < 0.01) continue;

      const lColors = [0x60a5fa, 0x34d399, 0xf59e0b, 0xf472b6];
      const ringColor = lColors[orb.l % 4];

      const ringGeo = new THREE.TorusGeometry(peakR, 0.006, 8, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: 0.4,
        wireframe: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.userData.isRing = true;

      // Different orientations for different l values
      if (orb.l === 1) ring.rotation.x = Math.PI / 2;
      if (orb.l === 2) { ring.rotation.x = Math.PI / 4; ring.rotation.z = Math.PI / 4; }
      if (orb.l === 3) { ring.rotation.y = Math.PI / 3; ring.rotation.x = Math.PI / 5; }

      scene.add(ring);
    }
  }

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, [initScene]);

  useEffect(() => {
    buildParticles();
  }, [buildParticles]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full"
      style={{ cursor: 'grab' }}
    />
  );
};

export default AtomCanvas3D;
