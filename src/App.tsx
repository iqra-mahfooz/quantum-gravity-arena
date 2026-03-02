/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Shield, Zap, Info, Settings, Trophy } from 'lucide-react';
import { GameState, Theme, THEMES, GameStats } from './types';

// --- Constants & Config ---
const MAX_ENERGY = 100;
const SHIELD_DURATION = 3000;
const SHIELD_COOLDOWN = 5000;
const LEVEL_THRESHOLD = 100;
const G = 0.5; // Gravity constant

// --- Sound System ---
class SoundManager {
  private ctx: AudioContext | null = null;

  init() {
    if (!this.ctx) this.ctx = new AudioContext();
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playAbsorb() { this.playTone(440, 'sine', 0.1, 0.1); }
  playEnemyHit() { this.playTone(110, 'sawtooth', 0.3, 0.2); }
  playLevelUp() { 
    this.playTone(523.25, 'triangle', 0.2, 0.1);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.2, 0.1), 100);
    setTimeout(() => this.playTone(783.99, 'triangle', 0.4, 0.1), 200);
  }
  playShield() { this.playTone(880, 'sine', 0.5, 0.05); }
}

const sounds = new SoundManager();

// --- Game Objects ---
class GameObject {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  color: string;

  constructor(x: number, y: number, radius: number, color: string) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.mass = radius;
    this.color = color;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Particle extends GameObject {
  type: 'normal' | 'enemy' | 'powerup';
  powerupType?: 'slow' | 'double' | 'invincibility';

  constructor(x: number, y: number, type: 'normal' | 'enemy' | 'powerup' = 'normal', color: string) {
    super(x, y, 3 + Math.random() * 4, color);
    this.type = type;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    if (type === 'powerup') {
      const types: any[] = ['slow', 'double', 'invincibility'];
      this.powerupType = types[Math.floor(Math.random() * types.length)];
      this.radius = 8;
    }
  }
}

class BlackHole extends GameObject {
  constructor(x: number, y: number, color: string) {
    super(x, y, 15 + Math.random() * 10, color);
    this.vx = (Math.random() - 0.5) * 1;
    this.vy = (Math.random() - 0.5) * 1;
  }

  update(width: number, height: number) {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > width) this.vx *= -1;
    if (this.y < 0 || this.y > height) this.vy *= -1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2);
    gradient.addColorStop(0, this.color);
    gradient.addColorStop(0.5, this.color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [theme, setTheme] = useState<Theme>(Theme.NEON);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    energy: 0,
    level: 1,
    highScore: parseInt(localStorage.getItem('qga_highscore') || '0')
  });
  
  const [shieldActive, setShieldActive] = useState(false);
  const [shieldCooldown, setShieldCooldown] = useState(0);
  const [powerupActive, setPowerupActive] = useState<string | null>(null);

  const stateRef = useRef({
    mouse: { x: 0, y: 0 },
    particles: [] as Particle[],
    blackHoles: [] as BlackHole[],
    stats: { score: 0, energy: 0, level: 1 },
    shield: { active: false, cooldown: 0, lastUsed: 0 },
    shake: 0,
    lastTime: 0,
    powerup: { type: null as string | null, endTime: 0 }
  });

  const colors = THEMES[theme];

  const startGame = () => {
    sounds.init();
    stateRef.current.particles = [];
    stateRef.current.blackHoles = [];
    stateRef.current.stats = { score: 0, energy: 0, level: 1 };
    stateRef.current.shield = { active: false, cooldown: 0, lastUsed: 0 };
    stateRef.current.powerup = { type: null, endTime: 0 };
    setStats(prev => ({ ...prev, score: 0, energy: 0, level: 1 }));
    setGameState(GameState.PLAYING);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      const now = Date.now();
      if (now - stateRef.current.shield.lastUsed > SHIELD_COOLDOWN) {
        stateRef.current.shield.active = true;
        stateRef.current.shield.lastUsed = now;
        sounds.playShield();
        setShieldActive(true);
        setTimeout(() => {
          stateRef.current.shield.active = false;
          setShieldActive(false);
        }, SHIELD_DURATION);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const spawn = () => {
      const { level } = stateRef.current.stats;
      const spawnRate = 0.05 + (level * 0.02);
      
      if (Math.random() < spawnRate) {
        const type = Math.random() < 0.2 ? 'enemy' : (Math.random() < 0.02 ? 'powerup' : 'normal');
        const color = type === 'enemy' ? colors.enemy : (type === 'powerup' ? '#fff' : colors.particle);
        stateRef.current.particles.push(new Particle(Math.random() * canvas.width, Math.random() * canvas.height, type, color));
      }

      if (stateRef.current.blackHoles.length < Math.floor(level / 2) + 1) {
        if (Math.random() < 0.005) {
          stateRef.current.blackHoles.push(new BlackHole(Math.random() * canvas.width, Math.random() * canvas.height, colors.blackHole));
        }
      }
    };

    const update = (time: number) => {
      const dt = (time - stateRef.current.lastTime) / 16.67;
      stateRef.current.lastTime = time;

      const { mouse, particles, blackHoles, shield, powerup } = stateRef.current;
      
      // Update shield cooldown UI
      const now = Date.now();
      const cdRemaining = Math.max(0, SHIELD_COOLDOWN - (now - shield.lastUsed));
      setShieldCooldown(cdRemaining);

      // Powerup logic
      if (powerup.type && now > powerup.endTime) {
        stateRef.current.powerup.type = null;
        setPowerupActive(null);
      }

      // Screen shake
      if (stateRef.current.shake > 0) stateRef.current.shake -= 0.5;

      ctx.save();
      if (stateRef.current.shake > 0) {
        ctx.translate((Math.random() - 0.5) * stateRef.current.shake, (Math.random() - 0.5) * stateRef.current.shake);
      }

      ctx.fillStyle = colors.background;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;

      // Draw Player
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = colors.player;
      ctx.fill();
      if (shield.active) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 25, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Update Black Holes
      blackHoles.forEach(bh => {
        bh.update(canvas.width, canvas.height);
        bh.draw(ctx);
      });

      // Update Particles
      stateRef.current.particles = particles.filter((p, i) => {
        // Realistic Gravity from Mouse
        let dx = mouse.x - p.x;
        let dy = mouse.y - p.y;
        let distSq = dx * dx + dy * dy;
        let dist = Math.sqrt(distSq);
        
        // Inverse square gravity
        let force = (G * 1000) / (distSq + 100);
        if (powerup.type === 'slow') force *= 0.5;
        
        p.vx += (force * dx / dist) * dt;
        p.vy += (force * dy / dist) * dt;

        // Gravity from Black Holes
        blackHoles.forEach(bh => {
          let bdx = bh.x - p.x;
          let bdy = bh.y - p.y;
          let bdistSq = bdx * bdx + bdy * bdy;
          let bdist = Math.sqrt(bdistSq);
          let bforce = (G * 5000) / (bdistSq + 500);
          p.vx += (bforce * bdx / bdist) * dt;
          p.vy += (bforce * bdy / bdist) * dt;

          if (bdist < bh.radius) {
            // Absorbed by black hole
            p.radius = 0;
          }
        });

        // Enemy Chasing
        if (p.type === 'enemy') {
          p.vx += (dx / dist * 0.1) * dt;
          p.vy += (dy / dist * 0.1) * dt;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Particle Merging
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          let mdx = p2.x - p.x;
          let mdy = p2.y - p.y;
          let mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < p.radius + p2.radius) {
            // Merge
            p.radius = Math.sqrt(p.radius * p.radius + p2.radius * p2.radius);
            p.mass = p.radius;
            p2.radius = 0; // Mark for removal
          }
        }

        // Absorption by Player
        if (dist < 20) {
          if (p.type === 'enemy') {
            if (!shield.active) {
              stateRef.current.stats.energy += 15;
              stateRef.current.shake = 10;
              sounds.playEnemyHit();
            }
          } else if (p.type === 'powerup') {
            stateRef.current.powerup = { type: p.powerupType!, endTime: Date.now() + 5000 };
            setPowerupActive(p.powerupType!);
            sounds.playLevelUp();
          } else {
            if (!shield.active) {
              const multiplier = powerup.type === 'double' ? 2 : 1;
              stateRef.current.stats.score += multiplier;
              stateRef.current.stats.energy = Math.max(0, stateRef.current.stats.energy - 1);
              sounds.playAbsorb();

              if (stateRef.current.stats.score % LEVEL_THRESHOLD === 0 && stateRef.current.stats.score > 0) {
                stateRef.current.stats.level++;
                sounds.playLevelUp();
              }
            }
          }
          return false;
        }

        p.draw(ctx);
        return p.radius > 0;
      });

      spawn();

      // Update Stats UI
      setStats(prev => ({
        ...prev,
        score: stateRef.current.stats.score,
        energy: stateRef.current.stats.energy,
        level: stateRef.current.stats.level
      }));

      if (stateRef.current.stats.energy >= MAX_ENERGY) {
        setGameState(GameState.GAMEOVER);
        if (stateRef.current.stats.score > stats.highScore) {
          localStorage.setItem('qga_highscore', stateRef.current.stats.score.toString());
          setStats(prev => ({ ...prev, highScore: stateRef.current.stats.score }));
        }
        return;
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(update);
    };

    const handleMouseMove = (e: MouseEvent) => {
      stateRef.current.mouse.x = e.clientX;
      stateRef.current.mouse.y = e.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        stateRef.current.mouse.x = e.touches[0].clientX;
        stateRef.current.mouse.y = e.touches[0].clientY;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    animationFrameId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, theme, colors, stats.highScore]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-mono">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block"
        style={{ cursor: 'none' }}
      />

      {/* HUD */}
      {gameState === GameState.PLAYING && (
        <div className="absolute top-6 left-6 flex flex-col gap-4 pointer-events-none">
          <div className="glass p-4 rounded-xl min-w-[180px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs opacity-60 uppercase tracking-widest">Score</span>
              <span className="text-xl font-bold neon-text" style={{ color: colors.ui }}>{stats.score}</span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs opacity-60 uppercase tracking-widest">Level</span>
              <span className="text-lg font-bold">{stats.level}</span>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] uppercase opacity-60">
                <span>Energy Overload</span>
                <span>{Math.round(stats.energy)}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-red-500"
                  animate={{ width: `${stats.energy}%` }}
                  transition={{ type: 'spring', bounce: 0 }}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className={`glass p-3 rounded-xl flex items-center gap-3 transition-opacity ${shieldCooldown > 0 ? 'opacity-50' : 'opacity-100'}`}>
              <Shield size={18} className={shieldActive ? 'text-blue-400 animate-pulse' : 'text-white'} />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase opacity-60">Shield [Space]</span>
                <span className="text-xs font-bold">
                  {shieldCooldown > 0 ? `${(shieldCooldown / 1000).toFixed(1)}s` : 'READY'}
                </span>
              </div>
            </div>
            
            {powerupActive && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass p-3 rounded-xl border-yellow-400/50 flex items-center gap-3"
              >
                <Zap size={18} className="text-yellow-400 animate-bounce" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase opacity-60">Powerup</span>
                  <span className="text-xs font-bold uppercase">{powerupActive}</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Start Menu */}
      <AnimatePresence>
        {gameState === GameState.START && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-6"
          >
            <div className="max-w-md w-full text-center">
              <motion.h1 
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                className="text-5xl font-black mb-2 tracking-tighter italic neon-text"
                style={{ color: colors.ui }}
              >
                QUANTUM GRAVITY
              </motion.h1>
              <p className="text-white/40 text-sm mb-12 tracking-widest uppercase">Arena Survival Simulation</p>
              
              <div className="grid grid-cols-1 gap-4 mb-12">
                <button 
                  onClick={startGame}
                  className="group relative flex items-center justify-center gap-3 bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-white/90 transition-all active:scale-95"
                >
                  <Play size={20} fill="currentColor" />
                  INITIALIZE CORE
                </button>
                
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(THEMES) as Theme[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`py-2 rounded-lg text-[10px] uppercase font-bold border transition-all ${theme === t ? 'bg-white/20 border-white' : 'border-white/10 hover:bg-white/5'}`}
                    >
                      {t.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass p-6 rounded-2xl text-left">
                <div className="flex items-center gap-2 mb-4 text-white/60">
                  <Info size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">Mission Briefing</span>
                </div>
                <ul className="text-xs space-y-3 text-white/80">
                  <li className="flex gap-3">
                    <span className="text-emerald-400 font-bold">01</span>
                    <span>Absorb <span style={{ color: colors.particle }}>cyan particles</span> to increase score and reduce energy.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-red-400 font-bold">02</span>
                    <span>Avoid <span style={{ color: colors.enemy }}>red hostiles</span>. They cause energy spikes.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-400 font-bold">03</span>
                    <span>Black holes pull everything. Don't get trapped.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-yellow-400 font-bold">04</span>
                    <span>Use <span className="bg-white/20 px-1 rounded">SPACE</span> for emergency shield.</span>
                  </li>
                </ul>
              </div>

              {stats.highScore > 0 && (
                <div className="mt-8 flex items-center justify-center gap-2 text-white/40">
                  <Trophy size={14} />
                  <span className="text-xs uppercase tracking-widest font-bold">Record: {stats.highScore}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over */}
      <AnimatePresence>
        {gameState === GameState.GAMEOVER && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-red-950/90 backdrop-blur-xl z-50 p-6"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="mb-8"
              >
                <h2 className="text-7xl font-black mb-2 tracking-tighter">OVERLOAD</h2>
                <p className="text-white/60 uppercase tracking-[0.5em]">Core Integrity Compromised</p>
              </motion.div>

              <div className="flex justify-center gap-12 mb-12">
                <div>
                  <p className="text-xs uppercase opacity-40 mb-1">Final Score</p>
                  <p className="text-5xl font-bold">{stats.score}</p>
                </div>
                <div>
                  <p className="text-xs uppercase opacity-40 mb-1">Max Level</p>
                  <p className="text-5xl font-bold">{stats.level}</p>
                </div>
              </div>

              <button 
                onClick={startGame}
                className="flex items-center gap-3 bg-white text-black px-12 py-4 rounded-full font-bold text-xl hover:scale-105 transition-transform active:scale-95"
              >
                <RotateCcw size={24} />
                REBOOT SYSTEM
              </button>
              
              <button 
                onClick={() => setGameState(GameState.START)}
                className="mt-6 text-white/40 uppercase text-xs tracking-widest hover:text-white transition-colors"
              >
                Return to Command Center
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Controls Hint */}
      {gameState === GameState.PLAYING && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white/20 uppercase tracking-[0.3em] pointer-events-none">
          Touch or Move Mouse to Control Core
        </div>
      )}
    </div>
  );
}
