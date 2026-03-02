# Quantum Gravity Arena

Quantum Gravity Arena is a physics-driven browser game built with **React, TypeScript, and HTML5 Canvas**.

The player controls a gravitational core that attracts surrounding particles while managing energy stability. As difficulty scales, hostile entities, black holes, and dynamic physics systems increase instability.

This project was developed as a structured learning exercise focused on real-time simulation, game loop architecture, state management, and feature-driven iteration.

---

## 🌍 Deployment

Quantum Gravity Arena is available online:

* 🔗 **Live Demo (Netlify):** 
* 💻 **Source Code (GitHub):**  https://iqra-mahfooz.github.io/quantum-gravity-arena/

The game runs entirely in the browser and requires no backend services.

---

## Technical Overview

The application is structured as a single-page React app with canvas-based rendering and layered UI components.

### Core Systems

#### Canvas Rendering Engine

* `requestAnimationFrame` game loop
* Delta-time based updates
* Real-time object simulation
* Screen shake transform effects

#### Physics Simulation

* Inverse-square gravity model

  ```
  F = (G * m) / r²
  ```

* Mouse-controlled gravitational attractor

* Black hole gravity fields

* Velocity damping for stability

* Particle merging via radius-based collision resolution

#### Entity System

* Base `GameObject` class
* `Particle` subclasses (normal, enemy, powerup)
* `BlackHole` entity with independent motion logic

#### Gameplay Mechanics

* Energy overload system
* Shield with cooldown timing
* Level progression via score thresholds
* Power-up effects (slow, double score, invincibility)
* Enemy chase behavior
* High score persistence via `localStorage`

#### Audio Engine

* Web Audio API oscillator synthesis
* Procedural tone generation
* Event-driven sound feedback

#### State Management

* React state for UI
* `useRef` for mutable simulation state
* Controlled game state enum (START / PLAYING / GAMEOVER)

---

## Design Separation

* Rendering and simulation logic handled inside the animation loop
* UI elements (HUD, menus, overlays) handled declaratively via React
* Game state isolated from UI state using refs
* Theme system centralized in `types.ts`

---

## Features

* Real-time gravitational particle simulation
* Enemy entities with pursuit mechanics
* Moving black holes with independent gravity fields
* Shield ability with cooldown management
* Particle merging system
* Level progression and difficulty scaling
* Power-up system with timed effects
* Screen shake and synthesized sound effects
* Theme switching (Neon, Cosmic, Dark Matter)
* High score persistence

---

## Controls

* Move mouse / touch → Control gravitational core
* `Space` → Activate shield (cooldown based)
* Absorb particles to increase score
* Avoid energy overload

---

## Tech Stack

* React
* TypeScript
* HTML5 Canvas
* Tailwind CSS
* Web Audio API
* Lucide Icons
* Motion (animation library)

---

## Learning Objectives

This project explores:

* Real-time rendering patterns in React
* Physics-based simulations in JavaScript
* Delta-time update modeling
* Mutable vs declarative state separation
* Feature-based incremental development
* Canvas + React UI integration

---

## Future Improvements

* Performance optimization for large particle counts
* Spatial partitioning (quad-tree) for collision efficiency
* Configurable physics constants
* Mobile performance tuning
* Advanced particle behaviors

---

## Development

Install dependencies:

```
npm install
```

Run locally:

```
npm run dev
```

---

## Author Notes

Quantum Gravity Arena is an evolving learning project focused on improving system design, simulation modeling, and interactive UI architecture in modern frontend environments.

---

