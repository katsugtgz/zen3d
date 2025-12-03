import { ShapeType } from '../types';

// Performance: 16K particles for rich, immersive visuals
export const PARTICLE_COUNT = 16000;

const random = (min: number, max: number) => Math.random() * (max - min) + min;

// Pre-computed constants for performance
const TWO_PI = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2; // Golden ratio

export const generateParticles = (shape: ShapeType, count: number = PARTICLE_COUNT): Float32Array => {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;
    const idx = i * 3;
    const u = Math.random();
    const v = Math.random();
    const theta = TWO_PI * u;
    const phi = Math.acos(2 * v - 1);
    const t = i / count; // Normalized index for parametric shapes

    switch (shape) {
      case ShapeType.SPHERE: {
        const r = 2.5 * Math.cbrt(Math.random()); 
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
        break;
      }

      case ShapeType.HEART: {
        const angle = Math.random() * TWO_PI;
        const r = Math.sqrt(Math.random()) * 0.15; 
        x = r * (16 * Math.pow(Math.sin(angle), 3));
        y = r * (13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle));
        z = random(-1, 1) * r * 10;
        y += 1;
        break;
      }

      case ShapeType.FLOWER: {
        const k = 4;
        const angle = u * TWO_PI;
        const rad = Math.cos(k * angle) + 1.5;
        const dist = v * 2;
        x = dist * rad * Math.cos(angle);
        y = dist * rad * Math.sin(angle);
        z = (Math.random() - 0.5) * 1.5 * (1 - dist/2);
        break;
      }

      case ShapeType.SATURN: {
        if (i < count * 0.4) {
          const r = 1.5 * Math.cbrt(Math.random());
          x = r * Math.sin(phi) * Math.cos(theta);
          y = r * Math.sin(phi) * Math.sin(theta);
          z = r * Math.cos(phi);
        } else {
          const angle = Math.random() * TWO_PI;
          const dist = random(2.2, 4.5);
          x = dist * Math.cos(angle);
          z = dist * Math.sin(angle);
          y = (Math.random() - 0.5) * 0.1;
        }
        break;
      }

      case ShapeType.DNA: {
        const dnaT = i * 0.025;
        const radius = 1.5;
        const strand = i % 2;
        const helixOffset = strand * Math.PI;
        x = Math.cos(dnaT * 0.5 + helixOffset) * radius;
        z = Math.sin(dnaT * 0.5 + helixOffset) * radius;
        y = (i / count) * 10 - 5;
        x += (Math.random() - 0.5) * 0.3;
        z += (Math.random() - 0.5) * 0.3;
        break;
      }
      
      case ShapeType.BUDDHA: {
        const roll = Math.random();
        if (roll < 0.4) {
          const r = 1.8 * Math.sqrt(Math.random());
          const a = Math.random() * TWO_PI;
          x = r * Math.cos(a);
          z = r * Math.sin(a) * 0.8;
          y = (Math.random() * 2) - 2.5; 
        } else if (roll < 0.7) {
           const r = 1.2 * Math.sqrt(Math.random());
           const a = Math.random() * TWO_PI;
           x = r * Math.cos(a);
           z = r * Math.sin(a) * 0.8;
           y = (Math.random() * 2) - 0.5;
        } else if (roll < 0.9) {
          const r = 0.8 * Math.cbrt(Math.random()); 
          x = r * Math.sin(phi) * Math.cos(theta);
          y = r * Math.sin(phi) * Math.sin(theta) + 2;
          z = r * Math.cos(phi);
        } else {
          const angle = Math.random() * TWO_PI;
          const dist = 2.5 + Math.random() * 0.2;
          x = dist * Math.cos(angle);
          y = dist * Math.sin(angle) + 2;
          z = (Math.random()-0.5) * 0.1;
        }
        break;
      }

      case ShapeType.FIREWORKS: {
        const r = Math.pow(Math.random(), 0.5) * 4;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW ICONIC SHAPES - Mathematical poetry
      // ═══════════════════════════════════════════════════════════════

      case ShapeType.GALAXY: {
        // Logarithmic spiral arms with central bulge
        const armCount = 3;
        const arm = i % armCount;
        const armOffset = (arm / armCount) * TWO_PI;
        
        if (Math.random() < 0.25) {
          // Central bulge - dense core
          const r = Math.pow(Math.random(), 2) * 1.2;
          x = r * Math.sin(phi) * Math.cos(theta);
          y = (Math.random() - 0.5) * 0.3; // Flat disk
          z = r * Math.sin(phi) * Math.sin(theta);
        } else {
          // Spiral arms - logarithmic spiral
          const spiralT = Math.pow(Math.random(), 0.7) * 4;
          const spiralAngle = spiralT * 1.2 + armOffset;
          const r = spiralT + 0.5;
          const spread = 0.3 + spiralT * 0.15;
          
          x = r * Math.cos(spiralAngle) + (Math.random() - 0.5) * spread;
          z = r * Math.sin(spiralAngle) + (Math.random() - 0.5) * spread;
          y = (Math.random() - 0.5) * 0.2 * (1 + spiralT * 0.1);
        }
        break;
      }

      case ShapeType.TORNADO: {
        // Parametric vortex - wider at top, narrow at bottom
        const height = Math.random();
        const radius = 0.3 + height * 2.5; // Expands as it rises
        const angle = height * 12 + Math.random() * 0.5; // Spiral twist
        const noise = Math.random() * 0.3;
        
        x = (radius + noise) * Math.cos(angle);
        z = (radius + noise) * Math.sin(angle);
        y = height * 6 - 3; // -3 to 3 vertical range
        break;
      }

      case ShapeType.LOTUS: {
        // Layered petals in spherical arrangement
        const petalCount = 8;
        const layer = Math.floor(Math.random() * 4); // 4 layers of petals
        const petal = i % petalCount;
        const petalAngle = (petal / petalCount) * TWO_PI + layer * 0.2;
        
        // Petal shape: elongated ellipse that curves upward
        const petalT = Math.random();
        const petalLength = 2.5 - layer * 0.4;
        const petalWidth = 0.6 - layer * 0.1;
        const curvature = petalT * petalT * 0.8;
        
        const localX = (petalT - 0.5) * petalLength;
        const localY = Math.sin(petalT * Math.PI) * petalWidth;
        const lift = curvature * (1 - layer * 0.2);
        
        x = localX * Math.cos(petalAngle);
        z = localX * Math.sin(petalAngle);
        y = localY + lift - 0.5;
        
        // Add organic variation
        x += (Math.random() - 0.5) * 0.15;
        z += (Math.random() - 0.5) * 0.15;
        break;
      }

      case ShapeType.INFINITY: {
        // Lemniscate of Bernoulli in 3D with thickness
        const infT = t * TWO_PI * 2; // Two full loops
        const scale = 3;
        const thickness = 0.4;
        
        // Parametric lemniscate
        const denom = 1 + Math.sin(infT) * Math.sin(infT);
        const lemnX = (scale * Math.cos(infT)) / denom;
        const lemnY = (scale * Math.sin(infT) * Math.cos(infT)) / denom;
        
        // Add tube thickness
        const tubeAngle = Math.random() * TWO_PI;
        const tubeR = Math.random() * thickness;
        
        x = lemnX;
        y = tubeR * Math.cos(tubeAngle);
        z = lemnY + tubeR * Math.sin(tubeAngle);
        break;
      }

      case ShapeType.PHOENIX: {
        // Majestic bird rising - wings, body, tail flames
        const part = Math.random();
        
        if (part < 0.4) {
          // Wings - curved spans
          const wing = i % 2 === 0 ? 1 : -1;
          const wingT = Math.random();
          const wingspan = 4;
          const wingCurve = Math.sin(wingT * Math.PI) * 1.5;
          
          x = wing * wingT * wingspan;
          y = wingCurve - wingT * 0.5;
          z = (Math.random() - 0.5) * 0.3 * (1 - wingT);
        } else if (part < 0.6) {
          // Body - elongated ellipsoid
          const bodyT = Math.random();
          const bodyR = 0.4 * Math.sqrt(1 - Math.pow(bodyT * 2 - 1, 2));
          const bodyAngle = Math.random() * TWO_PI;
          
          x = bodyR * Math.cos(bodyAngle);
          y = bodyT * 2 - 0.5;
          z = bodyR * Math.sin(bodyAngle) * 0.6;
        } else if (part < 0.75) {
          // Head
          const headR = 0.35 * Math.cbrt(Math.random());
          x = headR * Math.sin(phi) * Math.cos(theta);
          y = headR * Math.sin(phi) * Math.sin(theta) + 1.8;
          z = headR * Math.cos(phi);
        } else {
          // Tail flames - streaming particles
          const flameT = Math.pow(Math.random(), 0.5);
          const flameSpread = flameT * 1.5;
          const flameAngle = Math.random() * TWO_PI;
          
          x = Math.cos(flameAngle) * flameSpread * 0.5;
          y = -1 - flameT * 3;
          z = Math.sin(flameAngle) * flameSpread * 0.3;
        }
        break;
      }

      case ShapeType.WAVE: {
        // Ocean wave grid - serene and hypnotic
        const gridSize = Math.sqrt(count);
        const gridX = (i % gridSize) / gridSize;
        const gridZ = Math.floor(i / gridSize) / gridSize;
        
        // Map to world space
        const worldX = (gridX - 0.5) * 8;
        const worldZ = (gridZ - 0.5) * 8;
        
        // Multiple sine waves for organic feel
        const wave1 = Math.sin(gridX * TWO_PI * 2 + gridZ * Math.PI) * 0.5;
        const wave2 = Math.sin(gridX * TWO_PI * 3 - gridZ * TWO_PI) * 0.3;
        const wave3 = Math.cos(gridZ * TWO_PI * 1.5) * 0.2;
        
        x = worldX;
        y = wave1 + wave2 + wave3;
        z = worldZ;
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
