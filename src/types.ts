export enum GameState {
  START,
  PLAYING,
  GAMEOVER
}

export enum Theme {
  NEON = 'neon',
  COSMIC = 'cosmic',
  DARK_MATTER = 'dark-matter'
}

export interface ThemeColors {
  player: string;
  particle: string;
  enemy: string;
  blackHole: string;
  background: string;
  ui: string;
}

export const THEMES: Record<Theme, ThemeColors> = {
  [Theme.NEON]: {
    player: '#ff0066',
    particle: '#00ffcc',
    enemy: '#ff3300',
    blackHole: '#1a1a1a',
    background: '#000000',
    ui: '#00ffcc'
  },
  [Theme.COSMIC]: {
    player: '#e0aaff',
    particle: '#7b2cbf',
    enemy: '#ff9e00',
    blackHole: '#10002b',
    background: '#240046',
    ui: '#e0aaff'
  },
  [Theme.DARK_MATTER]: {
    player: '#ffffff',
    particle: '#4a4e69',
    enemy: '#9a8c98',
    blackHole: '#000000',
    background: '#22223b',
    ui: '#f2e9e4'
  }
};

export interface GameStats {
  score: number;
  energy: number;
  level: number;
  highScore: number;
}
