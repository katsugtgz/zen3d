import * as THREE from 'three';
import { ShapeType } from '../types';

export const PARTICLE_COUNT = 8000;

const random = (min: number, max: number) => Math.random() * (max - min) + min;

export const generateParticles = (shape: ShapeType, count: number = PARTICLE_COUNT): Float32Array => {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;
    const idx = i * 3;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    switch (shape) {
      case ShapeType.SPHERE: {
        const r = 2.5 * Math.cbrt(Math.random()); 
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
        break;
      }

      case ShapeType.HEART: {
        // Parametric Heart
        // x = 16sin^3(t)
        // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
        const t = Math.random() * Math.PI * 2;
        // Distribute points inside volume slightly
        const r = Math.sqrt(Math.random()) * 0.15; 
        
        x = r * (16 * Math.pow(Math.sin(t), 3));
        y = r * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        z = random(-1, 1) * r * 10; // Thickness
        // Adjust center
        y += 1;
        break;
      }

      case ShapeType.FLOWER: {
        const k = 4; // Petals
        const angle = u * Math.PI * 2;
        const rad = Math.cos(k * angle) + 1.5;
        const dist = v * 2;
        
        x = dist * rad * Math.cos(angle);
        y = dist * rad * Math.sin(angle);
        z = (Math.random() - 0.5) * 1.5 * (1 - dist/2); // Center is thicker
        break;
      }

      case ShapeType.SATURN: {
        if (i < count * 0.4) {
          // Planet
          const r = 1.5 * Math.cbrt(Math.random());
          x = r * Math.sin(phi) * Math.cos(theta);
          y = r * Math.sin(phi) * Math.sin(theta);
          z = r * Math.cos(phi);
        } else {
          // Rings
          const angle = Math.random() * Math.PI * 2;
          const dist = random(2.2, 4.5);
          x = dist * Math.cos(angle);
          z = dist * Math.sin(angle);
          y = (Math.random() - 0.5) * 0.1; // Flat ring
        }
        break;
      }

      case ShapeType.DNA: {
        const t = i * 0.05;
        const radius = 1.5;
        const helix = i % 2 === 0 ? 1 : -1; // Double helix
        x = Math.cos(t * 0.5) * radius;
        z = Math.sin(t * 0.5) * radius;
        y = (i / count) * 10 - 5; // Height spread
        
        // Add thickness
        x += (Math.random() - 0.5) * 0.5;
        z += (Math.random() - 0.5) * 0.5;
        break;
      }
      
      case ShapeType.BUDDHA: {
        // Approximate seated figure with spheres
        const roll = Math.random();
        
        if (roll < 0.4) {
          // Body (Base)
          const r = 1.8 * Math.sqrt(Math.random());
          const a = Math.random() * Math.PI * 2;
          x = r * Math.cos(a);
          z = r * Math.sin(a) * 0.8; // flatter depth
          y = (Math.random() * 2) - 2.5; 
        } else if (roll < 0.7) {
           // Torso
           const r = 1.2 * Math.sqrt(Math.random());
           const a = Math.random() * Math.PI * 2;
           x = r * Math.cos(a);
           z = r * Math.sin(a) * 0.8;
           y = (Math.random() * 2) - 0.5;
        } else if (roll < 0.9) {
          // Head
          const r = 0.8 * Math.cbrt(Math.random()); 
          x = r * Math.sin(phi) * Math.cos(theta);
          y = r * Math.sin(phi) * Math.sin(theta) + 2; // Offset up
          z = r * Math.cos(phi);
        } else {
          // Halo
          const angle = Math.random() * Math.PI * 2;
          const dist = 2.5 + Math.random() * 0.2;
          x = dist * Math.cos(angle);
          y = dist * Math.sin(angle) + 2;
          z = (Math.random()-0.5) * 0.1;
        }
        break;
      }

      case ShapeType.FIREWORKS: {
        // Explosion vectors
        const r = Math.pow(Math.random(), 0.5) * 4;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
        break;
      }

      default:
        x = (Math.random() - 0.5) * 5;
        y = (Math.random() - 0.5) * 5;
        z = (Math.random() - 0.5) * 5;
        break;
    }

    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
  }

  return positions;
};
