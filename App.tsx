import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { HandTracker } from './components/HandTracker';
import { generateParticles, PARTICLE_COUNT } from './utils/shapes';
import { HandData, ShapeType } from './types';

// Texture for particles to look soft
const createParticleTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeShape, setActiveShape] = useState<ShapeType>(ShapeType.SPHERE);
  const [particleColor, setParticleColor] = useState<string>('#4fd1c5'); // Teal default
  const [handData, setHandData] = useState<HandData>({
    expansion: 0.5,
    tension: 0,
    isPresent: false,
    centerX: 0,
    centerY: 0
  });

  // Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const targetPositionsRef = useRef<Float32Array>(generateParticles(ShapeType.SPHERE));
  const animationFrameRef = useRef<number>(0);

  // Initialize Three.js
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.02);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 15;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Particle System
    const geometry = new THREE.BufferGeometry();
    const positions = generateParticles(ShapeType.SPHERE);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Custom colors attribute to allow per-particle variation if needed, 
    // but we'll use material color for global control for now + tension effects.
    
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(particleColor),
      size: 0.15,
      map: createParticleTexture(),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;

    // Lighting (optional for points but good if we add meshes later)
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Resize Handler
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Handle Shape Changes
  useEffect(() => {
    targetPositionsRef.current = generateParticles(activeShape);
  }, [activeShape]);

  // Handle Color Changes
  useEffect(() => {
    if (pointsRef.current) {
      (pointsRef.current.material as THREE.PointsMaterial).color.set(particleColor);
    }
  }, [particleColor]);

  // Animation Loop
  useEffect(() => {
    let time = 0;

    const animate = () => {
      if (!pointsRef.current || !rendererRef.current || !cameraRef.current) return;

      time += 0.005;
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      const targets = targetPositionsRef.current;
      
      // Interpolation factor (smooth morphing)
      const lerpSpeed = 0.05;

      // Interaction Variables
      // Default scale is 1. If hands present, map expansion (0..1) to scale (0.5 .. 3.0)
      const targetScale = handData.isPresent ? 0.5 + handData.expansion * 2.5 : 1.2;
      
      // Interpolate current scale to target scale
      pointsRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

      // Rotation based on hand center
      if (handData.isPresent) {
        const targetRotX = -handData.centerY * 0.5;
        const targetRotY = handData.centerX * 0.5;
        pointsRef.current.rotation.x += (targetRotX - pointsRef.current.rotation.x) * 0.05;
        pointsRef.current.rotation.y += (targetRotY - pointsRef.current.rotation.y) * 0.05;
      } else {
        // Idle rotation
        pointsRef.current.rotation.y += 0.002;
      }

      // Update Particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        
        // Morphing Logic: Move current pos towards target pos
        // We add noise based on 'tension'
        
        const tx = targets[i3];
        const ty = targets[i3 + 1];
        const tz = targets[i3 + 2];

        // Jitter/Chaos based on tension (0..1)
        const tensionJitter = handData.tension * 0.2; 
        const jx = (Math.random() - 0.5) * tensionJitter;
        const jy = (Math.random() - 0.5) * tensionJitter;
        const jz = (Math.random() - 0.5) * tensionJitter;

        positions[i3] += (tx - positions[i3]) * lerpSpeed + jx;
        positions[i3 + 1] += (ty - positions[i3 + 1]) * lerpSpeed + jy;
        positions[i3 + 2] += (tz - positions[i3 + 2]) * lerpSpeed + jz;
      }

      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      
      // Optional: Pulse size with tension
      const material = pointsRef.current.material as THREE.PointsMaterial;
      // material.size = 0.15 + handData.tension * 0.1;

      rendererRef.current.render(sceneRef.current!, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [handData]); // Re-bind animate if handData ref logic was static, but here we read state in loop or use refs? 
  // Ideally, handData should be in a ref for the loop to access current value without re-binding loop.
  // Let's fix that pattern below using a Ref for handData to avoid restarting the loop.

  // --- Ref Pattern Correction for Animation Loop ---
  const handDataRef = useRef(handData);
  useEffect(() => { handDataRef.current = handData; }, [handData]);

  useEffect(() => {
    // Re-implement loop using ref to avoid dependency churn
    if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const animate = () => {
      if (!pointsRef.current || !rendererRef.current || !cameraRef.current) return;
      
      const currentHandData = handDataRef.current;
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      const targets = targetPositionsRef.current;
      const lerpSpeed = 0.03;

      // 1. Scale
      const targetScale = currentHandData.isPresent ? 0.5 + currentHandData.expansion * 2.5 : 1.2;
      pointsRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);

      // 2. Rotation
      if (currentHandData.isPresent) {
        const targetRotX = -currentHandData.centerY * 1.0;
        const targetRotY = currentHandData.centerX * 1.0;
        // Smooth damp
        pointsRef.current.rotation.x += (targetRotX - pointsRef.current.rotation.x) * 0.05;
        pointsRef.current.rotation.y += (targetRotY - pointsRef.current.rotation.y) * 0.05;
      } else {
        pointsRef.current.rotation.y += 0.001;
        pointsRef.current.rotation.x *= 0.98; // Return to level
      }

      // 3. Particle Position Update
      const tension = currentHandData.isPresent ? currentHandData.tension : 0;
      
      // Higher tension = more random vibration + pull towards center
      const jitterAmount = tension * 0.15;
      
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        let tx = targets[i3];
        let ty = targets[i3 + 1];
        let tz = targets[i3 + 2];

        // If high tension, pull particles slightly inward (implosion effect)
        if (tension > 0.5) {
            tx *= (1 - (tension - 0.5) * 0.5);
            ty *= (1 - (tension - 0.5) * 0.5);
            tz *= (1 - (tension - 0.5) * 0.5);
        }

        const jx = (Math.random() - 0.5) * jitterAmount;
        const jy = (Math.random() - 0.5) * jitterAmount;
        const jz = (Math.random() - 0.5) * jitterAmount;

        positions[i3] += (tx - positions[i3]) * lerpSpeed + jx;
        positions[i3 + 1] += (ty - positions[i3 + 1]) * lerpSpeed + jy;
        positions[i3 + 2] += (tz - positions[i3 + 2]) * lerpSpeed + jz;
      }
      
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      rendererRef.current.render(sceneRef.current!, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []); // Empty dependency array, relies on Refs


  return (
    <div className="relative h-screen w-full bg-[#050505] text-white overflow-hidden">
      {/* Three.js Container */}
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* Hand Tracker (Top Right) */}
      <HandTracker onHandUpdate={setHandData} />

      {/* UI Overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 md:p-12">
        
        {/* Header */}
        <header className="flex flex-col items-start space-y-2">
            <h1 className="text-4xl font-light tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-purple-300 drop-shadow-lg">
            ZenParticles
            </h1>
            <p className="text-sm text-white/50 max-w-md">
            Shape the universe with your hands. <br/>
            <span className="text-teal-400">Pinch</span> to condense, <span className="text-teal-400">Spread</span> to expand.
            </p>
        </header>

        {/* Controls Panel */}
        <div className="pointer-events-auto flex flex-col gap-6 md:flex-row md:items-end justify-between">
            
            {/* Shape Selectors */}
            <div className="flex flex-wrap gap-2 md:gap-4 max-w-2xl">
            {Object.values(ShapeType).map((shape) => (
                <button
                key={shape}
                onClick={() => setActiveShape(shape)}
                className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                    border border-white/10 backdrop-blur-sm
                    ${activeShape === shape 
                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] transform scale-105' 
                    : 'bg-black/20 text-white/70 hover:bg-white/10 hover:text-white'}
                `}
                >
                {shape}
                </button>
            ))}
            </div>

            {/* Color Picker */}
            <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md px-5 py-3 rounded-full border border-white/10">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Energy Color</span>
                <div className="flex gap-2">
                    {['#4fd1c5', '#9f7aea', '#f687b3', '#fbd38d', '#63b3ed', '#ffffff'].map((c) => (
                        <button
                            key={c}
                            onClick={() => setParticleColor(c)}
                            className={`w-6 h-6 rounded-full transition-transform duration-200 ${particleColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-black' : 'hover:scale-110'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <input 
                        type="color" 
                        value={particleColor}
                        onChange={(e) => setParticleColor(e.target.value)}
                        className="w-6 h-6 rounded-full overflow-hidden border-0 p-0 cursor-pointer"
                    />
                </div>
            </div>
        </div>
      </div>
      
      {/* Instructions / Status Overlay */}
      <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-500 ${handData.isPresent ? 'opacity-0' : 'opacity-70'}`}>
         <p className="text-white/40 text-sm animate-pulse">Waiting for hands...</p>
      </div>

    </div>
  );
}