# GMI Racing - Multi-Simulation System

## Quick Start

```bash
cd gmi-engine
npm install
npm run build
npm start
# Open http://127.0.0.1:3000/multi-sim.html
```

---

## Project Overview

**GMI Racing** is a ball racing game with:
- 5 colored balls (Red, Blue, Green, Yellow, Purple) racing through obstacle courses
- Boss fights where balls deal damage to defeat the boss
- Weapon/item system awarded via roulette after each race
- Chain campaigns (multiple maps in sequence, cumulative points determine winner)

**Multi-Simulation System** runs 16-50+ parallel simulations to gather statistical data for game balance.

---

## Current Architecture

```
gmi-engine/
├── src/
│   ├── multi-sim.html      # Parent page UI
│   ├── multi-sim.js        # Parent controller (stats aggregation)
│   ├── multi-sim-bundle.js # Built bundle
│   ├── sim-runner.html     # iframe page (hosts Phaser game)
│   ├── sim-runner.js       # Simulation game logic
│   ├── sim-runner-bundle.js# Built bundle
│   └── game/
│       ├── systems/
│       │   ├── MapChain.js     # Chain definitions (CHAIN_MIXED, etc.)
│       │   ├── VolumeSystem.js # Ball stats (CURRENTLY GIVES UNEQUAL STATS)
│       │   ├── BossSystem.js   # Boss AI and projectiles
│       │   ├── WeaponSystem.js # Weapon firing logic
│       │   └── RouletteSystem.js # Weapon award odds
│       └── scenes/
│           └── RaceScene.js    # Main game race scene
```

---

## Key Files to Understand

### 1. `sim-runner.js` (The Simulation Engine)

This is a self-contained Phaser game that:
- Loads chain maps and runs races
- Handles ball physics, collisions, finish detection
- Manages boss fights with damage tracking
- Awards weapons via instant roulette (no animation)
- Reports results to parent via postMessage

**Important State Variables:**
```javascript
let cumulativePoints = { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 };
let weaponStats = {
  awarded: {},      // { SHOTGUN: 5, SWORD: 3, ... }
  damageDealt: {},  // { SHOTGUN: 1500, collision: 7000, ... }
  ballWeapons: { Red: [], Blue: [], ... }  // weapons per ball
};
```

**Ball Creation (lines ~380-475):**
```javascript
// Currently uses volumeSystem which gives UNEQUAL stats
const stats = volumeSystem.getStatsForBall(colorData.name);

// EQUAL DAMAGE already implemented:
const baseDamage = 10;  // Same for all balls

// But SPEED is still unequal from volumeSystem!
// This needs to be fixed for equal stats
```

### 2. `multi-sim.js` (Parent Controller)

Manages:
- iframe creation and lifecycle
- Message handling from simulations
- Stats aggregation across all sims
- UI updates (progress, weapon stats, standings)
- Export to JSON

### 3. `VolumeSystem.js` (Ball Stats - PROBLEM SOURCE)

Currently gives unequal stats:
```javascript
// From VolumeSystem
Red:    { speed: 1.2, hp: 200, damage: 15 }
Blue:   { speed: 1.1, hp: 175, damage: 12 }
Green:  { speed: 1.0, hp: 150, damage: 10 }
Yellow: { speed: 0.9, hp: 125, damage: 7 }
Purple: { speed: 0.8, hp: 100, damage: 5 }
```

**This is why Red/Blue dominate** - they're literally faster.

---

## Current Balance Problem

**50 Simulation Results (Mixed Campaign):**
```
Chain Wins: Red 32%, Blue 36%, Green 8%, Yellow 16%, Purple 8%
```

**Root Causes:**
1. Speed advantage compounds (faster = win more = better weapons = win more)
2. No comeback mechanic
3. Melee weapons are underpowered
4. Collision damage dominates boss fights

---

## GOALS FOR NEXT SESSION

### Goal 1: Equal Starting Stats
All balls should start with identical stats:
```javascript
// In sim-runner.js createBalls(), replace volumeSystem usage:
const EQUAL_STATS = {
  speed: 1.0,
  hp: 150,
  damage: 10
};
// Apply to all balls regardless of color
```

### Goal 2: In-Game Comeback Mechanics
Add rubber-banding during races:

**Speed Boost for Trailing Balls:**
```javascript
// In update(), calculate distance to leader
const leaderY = Math.min(...this.balls.filter(b => !b.finished).map(b => b.body.position.y));
this.balls.forEach(ball => {
  if (ball.finished) return;
  const distanceBehind = ball.body.position.y - leaderY;
  const catchupMultiplier = 1 + Math.min(distanceBehind / 300, 0.3); // up to 30% boost
  // Apply to ball velocity
});
```

**Other Comeback Ideas:**
- Trailing balls get brief invincibility after being hit
- "Desperation boost" when very far behind
- Items that only activate when not in 1st place

### Goal 3: Keep Winner Rewards
The current roulette system (1st place gets better weapons) should stay.
This rewards skill/early performance while comeback mechanics keep it competitive.

### Goal 4: Weapon Rebalance
Melee weapons need buffs:
```javascript
const WEAPON_DEFS = {
  // Projectile (already decent)
  SHOTGUN: { damage: 15, cooldown: 1200, range: 200 },

  // Melee (BUFF THESE)
  SWORD:  { damage: 25, cooldown: 600, range: 100 },  // was 12 dmg, 60 range
  FLAIL:  { damage: 10, cooldown: 300, range: 80 },   // was 2 dmg
  SPIKE:  { damage: 15, cooldown: 500, range: 80 },   // was 3 dmg
  HAMMER: { damage: 40, cooldown: 1500, range: 100 }, // was 20 dmg
};
```

### Goal 5: Reduce Collision Damage Dominance
Currently collision does 7770 damage vs weapons combined ~12000.
Options:
- Reduce collision damage from 10 to 5
- Add collision cooldown (already 1000ms, maybe increase)
- Or leave it as "base" damage and accept it

---

## How to Test Changes

1. Make changes to `sim-runner.js`
2. Run `npm run build`
3. Open `http://127.0.0.1:3000/multi-sim.html`
4. Select chain, set 50 simulations
5. Click "Start Simulations"
6. Check results in sidebar and export JSON

**Target Win Rates:** Each ball should win ~20% (±5%) of chains

---

## Feature Checklist

### Implemented
- [x] Parallel iframe simulations (16-50+)
- [x] Real Matter.js physics
- [x] Race maps with finish line detection
- [x] Boss fights with damage tracking
- [x] Weapon roulette system (instant, no animation)
- [x] Weapon stats tracking (awarded, damage dealt)
- [x] Visual mode toggle (shows projectiles)
- [x] Equal base damage for boss fights
- [x] Randomized spawn order
- [x] Half-finished countdown timer
- [x] Per-map standings display
- [x] JSON export with detailed stats

### TODO
- [ ] **Equal starting stats (speed/hp)** ← PRIORITY
- [ ] **Rubber-banding speed boost** ← PRIORITY
- [ ] Weapon rebalance (buff melee)
- [ ] Blue shell / targeting items
- [ ] Random events (wind, shuffle)
- [ ] Flatter point curve (8,7,6,5,4 instead of 10,8,6,4,2)

---

## Build Commands

```bash
npm run build          # Build all bundles
npm start              # Start dev server on port 3000
npm run build:watch    # Watch mode (if configured)
```

---

## Communication Protocol

Parent ↔ iframe communication via postMessage:

**From iframe to parent:**
```javascript
// Race complete
{ type: 'sim-race-complete', simId, winner, level, totalLevels, mapName, results }

// Chain complete
{ type: 'sim-chain-complete', simId, winner, standings, raceResults, weaponStats }

// Error
{ type: 'sim-error', simId, error }
```

**URL Parameters for iframe:**
```
sim-runner.html?simId=0&speed=4&levels=6&chainType=mixed&visual=1
```

---

## Useful Debug Info

- Debug overlay shows: `L{map}/{total} F:{finished}/{balls} T:{countdown}`
- Console logs prefixed with `[SimRunner {id}]` or `[MultiSim]`
- Visual mode shows weapon projectiles and boss attacks

---

## Contact / History

This project was developed with Claude AI assistance.
Key conversation topics:
1. iframe-based parallel simulation architecture
2. Phaser.js + Matter.js physics integration
3. Weapon/roulette system matching main game
4. Balance analysis and comeback mechanics

Last updated: 2026-02-02
