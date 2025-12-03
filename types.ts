export enum ShapeType {
  SPHERE = 'Sphere',
  HEART = 'Heart',
  FLOWER = 'Flower',
  SATURN = 'Saturn',
  BUDDHA = 'Meditate',
  FIREWORKS = 'Fireworks',
  DNA = 'DNA',
  // New iconic shapes
  GALAXY = 'Galaxy',
  TORNADO = 'Tornado',
  LOTUS = 'Lotus',
  INFINITY = 'Infinity',
  PHOENIX = 'Phoenix',
  WAVE = 'Wave'
}

export interface HandData {
  expansion: number;      // 0 to 1 (distance between hands)
  tension: number;        // 0 to 1 (fist clenched vs open)
  isPresent: boolean;
  centerX: number;        // -1 to 1
  centerY: number;        // -1 to 1
  // New gesture data
  rotation: number;       // -1 to 1 (hands moving in opposite Y directions)
  twist: number;          // 0 to 1 (hands rotating around each other)
  velocity: number;       // Speed of hand movement (for clap detection)
  grabbing: boolean;      // Both hands in fist
}

export interface AppState {
  currentShape: ShapeType;
  particleColor: string;
  particleCount: number;
}
