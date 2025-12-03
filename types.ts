export enum ShapeType {
  SPHERE = 'Sphere',
  HEART = 'Heart',
  FLOWER = 'Flower',
  SATURN = 'Saturn',
  BUDDHA = 'Meditate', // Simplified representation
  FIREWORKS = 'Fireworks',
  DNA = 'DNA'
}

export interface HandData {
  expansion: number; // 0 to 1 (distance between hands)
  tension: number; // 0 to 1 (fist clenched vs open)
  isPresent: boolean;
  centerX: number; // -1 to 1
  centerY: number; // -1 to 1
}

export interface AppState {
  currentShape: ShapeType;
  particleColor: string;
  particleCount: number;
}
