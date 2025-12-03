import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { HandTracker } from './components/HandTracker';
import { generateParticles, PARTICLE_COUNT } from './utils/shapes';
import { HandData, ShapeType } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  lerpSpeed: 0.035,
  baseParticleSize: 0.15,
  glowIntensity: 0.85,
  idleRotationSpeed: 0.003,
  gestureResponseSpeed: 0.08,
  explosionForce: 2.0,
  explosionDecay: 0.92,
};

// Create soft glow texture for particles
const createParticleTexture = (): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.6)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeShape, setActiveShape] = useState<ShapeType>(ShapeType.GALAXY);
  const [particleColor, setParticleColor] = useState<string>('#4fd1c5');
  const [handPresent, setHandPresent] = useState(false);
  
  // Mutable state ref
  const stateRef = useRef({
    hand: {
      expansion: 0.5,
      tension: 0,
      isPresent: false,
      centerX: 0,
      centerY: 0,
      rotation: 0,
      twist: 0,
      velocity: 0,
      grabbing: false
    } as HandData,
    explosionActive: false,
    explosionVelocities: new Float32Array(PARTICLE_COUNT * 3),
    currentScale: 1.2,
    rotationVelocity: 0,
    targets: generateParticles(ShapeType.GALAXY),
  });

  // Three.js objects
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);

  // Hand update callback
  const handleHandUpdate = useCallback((data: HandData) => {
    const state = stateRef.current;
    const prevPresent = state.hand.isPresent;
    state.hand = data;
    
    if (prevPresent !== data.isPresent) {
      setHandPresent(data.isPresent);
    }
    
    // Clap detection
    if (data.velocity > 0.4 && data.expansion < 0.25 && !state.explosionActive && pointsRef.current) {
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      const velocities = state.explosionVelocities;
      
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];
        const dist = Math.sqrt(x * x + y * y + z * z) || 1;
        const force = CONFIG.explosionForce * (0.7 + Math.random() * 0.6);
        
        velocities[i3] = (x / dist) * force;
        velocities[i3 + 1] = (y / dist) * force;
        velocities[i3 + 2] = (z / dist) * force;
      }
      state.explosionActive = true;
    }
  }, []);

  // Shape change
  useEffect(() => {
    stateRef.current.targets = generateParticles(activeShape);
  }, [activeShape]);

  // Color change
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.color.set(particleColor);
    }
  }, [particleColor]);

  // ═══════════════════════════════════════════════════════════════════════════
  // THREE.JS SETUP
  // ═══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.015);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 12;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Geometry
    const geometry = new THREE.BufferGeometry();
    const positions = generateParticles(ShapeType.GALAXY);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();

    // Material
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(particleColor),
      size: CONFIG.baseParticleSize,
      map: createParticleTexture(),
      transparent: true,
      opacity: CONFIG.glowIntensity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    materialRef.current = material;

    // Points
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation
    let animationId: number;
    
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      const state = stateRef.current;
      const hand = state.hand;
      const positionAttr = geometry.attributes.position;
      const positions = positionAttr.array as Float32Array;
      const targets = state.targets;
      const velocities = state.explosionVelocities;

      // Scale
      const targetScale = hand.isPresent ? 0.5 + hand.expansion * 2.0 : 1.2;
      state.currentScale += (targetScale - state.currentScale) * CONFIG.gestureResponseSpeed;
      points.scale.setScalar(state.currentScale);

      // Rotation
      if (hand.isPresent) {
        const targetRotX = -hand.centerY * 0.6;
        const targetRotY = hand.centerX * 0.6;
        state.rotationVelocity += hand.rotation * 0.015;
        state.rotationVelocity *= 0.92;
        points.rotation.x += (targetRotX - points.rotation.x) * CONFIG.gestureResponseSpeed;
        points.rotation.y += (targetRotY - points.rotation.y) * CONFIG.gestureResponseSpeed;
        points.rotation.y += state.rotationVelocity;
      } else {
        points.rotation.y += CONFIG.idleRotationSpeed;
        points.rotation.x *= 0.995;
        state.rotationVelocity *= 0.92;
      }

      // Particle update
      const tension = hand.isPresent ? hand.tension : 0;
      const jitter = tension * 0.1;
      const lerpSpeed = CONFIG.lerpSpeed;
      let maxVel = 0;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        let tx = targets[i3];
        let ty = targets[i3 + 1];
        let tz = targets[i3 + 2];

        if (hand.grabbing || tension > 0.5) {
          const pull = hand.grabbing ? 0.6 : (tension - 0.5) * 0.8;
          tx *= (1 - pull);
          ty *= (1 - pull);
          tz *= (1 - pull);
        }

        if (state.explosionActive) {
          positions[i3] += velocities[i3];
          positions[i3 + 1] += velocities[i3 + 1];
          positions[i3 + 2] += velocities[i3 + 2];
          velocities[i3] *= CONFIG.explosionDecay;
          velocities[i3 + 1] *= CONFIG.explosionDecay;
          velocities[i3 + 2] *= CONFIG.explosionDecay;
          positions[i3] += (tx - positions[i3]) * lerpSpeed * 0.4;
          positions[i3 + 1] += (ty - positions[i3 + 1]) * lerpSpeed * 0.4;
          positions[i3 + 2] += (tz - positions[i3 + 2]) * lerpSpeed * 0.4;
          const vel = Math.abs(velocities[i3]) + Math.abs(velocities[i3 + 1]) + Math.abs(velocities[i3 + 2]);
          if (vel > maxVel) maxVel = vel;
        } else {
          positions[i3] += (tx - positions[i3]) * lerpSpeed + (Math.random() - 0.5) * jitter;
          positions[i3 + 1] += (ty - positions[i3 + 1]) * lerpSpeed + (Math.random() - 0.5) * jitter;
          positions[i3 + 2] += (tz - positions[i3 + 2]) * lerpSpeed + (Math.random() - 0.5) * jitter;
        }
      }

      if (state.explosionActive && maxVel < 0.008) {
        state.explosionActive = false;
      }

      positionAttr.needsUpdate = true;

      // Size pulse
      const twistPulse = hand.isPresent ? 1 + hand.twist * 0.25 : 1;
      material.size = CONFIG.baseParticleSize * twistPulse;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      pointsRef.current = null;
      materialRef.current = null;
    };
  }, []);


  // ═══════════════════════════════════════════════════════════════════════════
  // UI RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="relative h-screen w-full bg-[#030303] text-white overflow-hidden">
      {/* Three.js Canvas */}
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* Hand Tracker */}
      <HandTracker onHandUpdate={handleHandUpdate} />

      {/* UI Overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 md:p-10">
        
        {/* Header */}
        <header className="flex flex-col items-start space-y-2">
          <h1 className="text-4xl md:text-5xl font-extralight tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-purple-300 to-pink-200">
            ZenParticles
          </h1>
          <p className="text-sm text-white/40 max-w-sm leading-relaxed">
            Control {PARTICLE_COUNT.toLocaleString()} particles with your hands.
            <br />
            <span className="text-white/60">Spread</span> to expand · <span className="text-white/60">Clench</span> to compress · <span className="text-white/60">Clap</span> to explode
          </p>
        </header>

        {/* Shape & Color Controls */}
        <div className="pointer-events-auto flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          
          {/* Shape Buttons */}
          <div className="flex flex-wrap gap-2 max-w-3xl">
            {Object.values(ShapeType).map((shape) => (
              <button
                key={shape}
                onClick={() => setActiveShape(shape)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300
                  border backdrop-blur-sm
                  ${activeShape === shape 
                    ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.25)] scale-105' 
                    : 'bg-black/30 text-white/60 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'}
                `}
              >
                {shape}
              </button>
            ))}
          </div>

          {/* Color Picker */}
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10">
            <span className="text-[10px] font-medium uppercase tracking-widest text-white/50">Color</span>
            <div className="flex gap-1.5">
              {['#4fd1c5', '#9f7aea', '#f687b3', '#fbd38d', '#63b3ed', '#68d391', '#fc8181', '#ffffff'].map((c) => (
                <button
                  key={c}
                  onClick={() => setParticleColor(c)}
                  className={`w-5 h-5 rounded-full transition-all duration-200 ${
                    particleColor === c 
                      ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-black' 
                      : 'hover:scale-110 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input 
                type="color" 
                value={particleColor}
                onChange={(e) => setParticleColor(e.target.value)}
                className="w-5 h-5 rounded-full overflow-hidden border-0 p-0 cursor-pointer bg-transparent"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Status Indicator */}
      <div className={`
        absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none 
        transition-all duration-700
        ${handPresent ? 'opacity-0 translate-y-2' : 'opacity-60'}
      `}>
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <span className="w-2 h-2 rounded-full bg-white/30 animate-pulse" />
          Waiting for hands...
        </div>
      </div>
    </div>
  );
}