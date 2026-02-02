# GMI Racing Engine - Project Status

*Last Updated: 2026-02-02*

## Project Overview

GMI Racing is a Phaser 3 + Matter.js physics-based ball racing game with:
- Vampire Survivors-style auto-attacking weapons
- CS:GO loot box style roulette rewards
- Betting/volume pumping system
- Campaign/chain progression with boss fights

---

## Architecture

### Tech Stack
- **Framework**: Phaser 3 with Matter.js physics
- **Build**: esbuild (bundles to `src/bundle.js`)
- **Entry**: `src/renderer.js` (main game), `src/editor.js` (map editor)

### Key Files

```
src/
├── renderer.js          # Main game entry, UI, chain system
├── editor.js            # Map editor
├── index.html           # Main game page
├── editor.html          # Map editor page
└── game/
    ├── Game.js          # Phaser game wrapper, race timing
    ├── scenes/
    │   └── RaceScene.js # Main game scene (2800+ lines)
    └── systems/
        ├── MapChain.js        # Campaign/level progression
        ├── BettingSystem.js   # Pre-race betting, live pumping
        ├── PointSystem.js     # Points tracking, multipliers
        ├── RouletteSystem.js  # CS:GO style reward roulette
        ├── WeaponSystem.js    # Auto-attack weapons
        ├── InventorySystem.js # Per-ball weapon/buff tracking
        ├── ItemSystem.js      # Pickups and spawning
        ├── BossSystem.js      # Boss enemies, patterns, projectiles
        ├── VolumeSystem.js    # Ball volume tracking
        ├── StatisticsSystem.js# Win rates, weapon stats, comebacks
        └── GameLog.js         # In-game event logging
```

### Data Flow

1. **Chain Start**: User selects chain → Betting phase (30s) → Load first map
2. **Race Loop**: Race → Finish → Record points → Roulette → Next level
3. **Level Complete**: Points calculated → Inventory serialized → Next map loaded → Inventory restored
4. **Chain Complete**: Final results screen with point totals

---

## Implemented Features (Working)

### Core Racing
- [x] 5 balls with DVD-screensaver bouncing physics
- [x] Multiple obstacle types (static, rotating, moving, breakable)
- [x] Finish zone detection
- [x] Progress tracking (% to finish)
- [x] Finish time recording
- [x] Race countdown timer (15s after half finish)

### Weapons & Items
- [x] 10 weapon types (projectile, melee, passive, area)
- [x] Weapon inventory (3 slots per ball)
- [x] Item pickups (weapon crates, buffs)
- [x] Weapons damage other balls and boss
- [x] Buff system (speed, shield, damage, ghost, shrink)

### Boss System
- [x] Boss spawning with health bar
- [x] Attack patterns (spiral, spread, aimed, mixed)
- [x] Damage tracking per ball
- [x] Boss death triggers level complete
- [x] Damage-based rankings for boss levels

### Betting & Points
- [x] Pre-race betting UI with countdown
- [x] Live volume pumping during race (30s cooldown)
- [x] Pump gives temporary speed + damage buff
- [x] Point system: 10/8/6/4/2 for positions
- [x] Escalating multipliers: 1x → 1.25x → 1.5x → 2x (final)
- [x] Boss bonuses: +1 per 50 damage, +5 kill shot, +2 first blood
- [x] Comeback bonuses: +3 for 2+ jump, +5 for 3+ jump, +5 underdog win

### Roulette System
- [x] ALL 5 balls get roulette simultaneously
- [x] Tiered odds based on placement (1st=30% S-tier, 5th=2% S-tier)
- [x] 4 tiers: S (best weapons), A (good), B (basic), C (buffs)
- [x] "LUCKY!" celebration for S-tier wins
- [x] Weapons/buffs applied to inventory

### Campaign/Chain
- [x] Map chain progression system
- [x] Built-in chains: Race (3), Boss (3), Mixed (6), Weapons Test (3)
- [x] Inventory persists across levels within chain
- [x] Chain complete screen with full results

### UI/Debug
- [x] Debug panel (toggle with button) showing timing, ball states, inventory
- [x] Game log panel with event history
- [x] Export logs as JSON
- [x] Standings panel with points and damage

### Statistics System
- [x] Statistics tracking (`StatisticsSystem.js`)
- [x] Ball win rates, chain wins, average positions
- [x] Weapon effectiveness (win rate when held, avg damage)
- [x] Comeback tracking (position jumps, underdog wins)
- [x] Race history logging (last 100 races)
- [x] Chain history logging (last 50 chains)
- [x] Stats dashboard UI (sidebar Stats tab)
- [x] Export/reset stats functionality
- [x] Persists to localStorage

### Multi-Simulation System (NEW - 2026-02-02)
- [x] Parallel simulation runner (`multi-sim.js`, `sim-runner.js`)
- [x] Run 16-50+ simulations simultaneously via iframes
- [x] Real Matter.js physics in each simulation
- [x] Speed control (2x, 4x)
- [x] Live results dashboard with win rates
- [x] Per-map standings breakdown
- [x] Weapon statistics tracking (damage, awards, win correlation)
- [x] Export stats as JSON (anytime, including partial)
- [x] **Balance System**:
  - Equal starting stats for all balls (bypasses VolumeSystem)
  - Achieved ~20% win rate for each ball (was 32-36% Red/Blue dominance)
- [x] **Melee Weapon Buffs**:
  - SWORD: 12→25 damage, range 40→120
  - FLAIL: 2→12 damage
  - SPIKE: 3→18 damage
  - HAMMER: 20→45 damage, range 50→130
- [x] **Ball Safety Systems**:
  - Out-of-bounds detection & respawn
  - Stuck ball detection & push
  - Race timeout (30s real time)
  - Global scene watchdog (45s)
- [x] **Diagnostics Tracking**:
  - Out-of-bounds respawn count
  - Stuck push count
  - Timeout/force-finish tracking
  - Detailed event log with positions

### Multi-Sim URLs
- **Multi-sim viewer**: http://localhost:3000/multi-sim.html
- **Individual sim**: http://localhost:3000/sim-runner.html?simId=X&chainType=mixed&speed=2

---

## Known Issues / TODO

### Bugs to Fix
- [ ] Some weapon animations not visible (lightning)
- [ ] Weapon visual effects need polish

### Features to Add
- [x] Statistics tracking system (win rates, weapon effectiveness) - DONE
- [x] Meta dashboard UI - DONE (Stats tab in sidebar)
- [x] Multi-simulation balance testing system - DONE
- [x] Ball balance (equal win rates) - DONE
- [x] Melee weapon rebalancing - DONE
- [ ] Sound effects
- [ ] Better weapon animations/particles
- [ ] Replay system for close finishes

### Polish
- [x] Tune weapon balance - DONE (melee weapons buffed)
- [ ] Tune point multipliers
- [ ] Add dramatic UI elements
- [ ] Mobile/touch support

---

## How to Run

```bash
cd gmi-engine
npm install
npm run build
npm start        # Starts server on localhost:3000
```

- **Game**: http://localhost:3000
- **Editor**: http://localhost:3000/editor.html

---

## Key Code Patterns

### Starting a Race
```javascript
// Through Game wrapper (sets raceStartTime correctly)
window.game.startRace();

// NOT directly on scene (timing breaks)
// scene.startRace();  // DON'T DO THIS
```

### Level Complete Flow
```javascript
// In RaceScene when race ends:
if (window.onLevelComplete) {
  window.onLevelComplete();
}

// renderer.js handles:
// 1. Record points
// 2. Show roulette (all balls)
// 3. Serialize inventory
// 4. Load next map
// 5. Restore inventory
// 6. Start next race
```

### Adding Weapons via Roulette
```javascript
// RouletteSystem.applyAllRewards()
scene.inventorySystem.addWeapon(ballName, weaponId);
scene.inventorySystem.addBuff(ballName, buffId, duration);
```

---

## Configuration

### Ball Config (in renderer.js config)
```javascript
balls: {
  count: 5,
  radius: 15,
  speed: 5,
  hp: 100
}
```

### Point Values (PointSystem.js)
```javascript
POSITION_POINTS = { 1: 10, 2: 8, 3: 6, 4: 4, 5: 2 }
BONUS_POINTS = {
  BOSS_KILL: 5,
  FIRST_BLOOD: 2,
  DAMAGE_PER_50: 1,
  POSITION_JUMP_2: 3,
  POSITION_JUMP_3: 5,
  UNDERDOG_WIN: 5,
  MOST_PUMPED: 2
}
```

### Roulette Odds (RouletteSystem.js)
```javascript
PLACEMENT_ODDS = {
  1: { S: 30, A: 40, B: 20, C: 10 },
  2: { S: 20, A: 35, B: 30, C: 15 },
  3: { S: 10, A: 30, B: 40, C: 20 },
  4: { S: 5, A: 20, B: 45, C: 30 },
  5: { S: 2, A: 15, B: 43, C: 40 }
}
```

---

## Design Documents

- `docs/COMPETITION_SYSTEM_DESIGN.md` - Detailed design for betting/points systems
- `docs/PROJECT_STATUS.md` - This file

---

## Recent Changes (2026-01-31)

1. Fixed finish time showing 0:00 (was calling scene.startRace instead of game.startRace)
2. Fixed chain skipping 5 levels (roulette was calling close() 5 times)
3. Added race countdown timer (15s after half finish)
4. Added debug panel for troubleshooting
5. Fixed "LUCKY!" text not cleaning up
6. Cleared inventory at chain start (balls start fresh)
7. Added transition guard to prevent double level completion
8. Added complete statistics tracking system (`StatisticsSystem.js`)
9. Added Stats dashboard UI with win rates, weapon effectiveness, comeback stats

---

## Contact / Notes

This is a "brainrot" style racing game for streaming/betting content. Key goals:
- Comebacks must be possible (no runaway winners)
- Drama and close finishes
- Simple enough to follow while watching
- Engagement through betting/pumping
