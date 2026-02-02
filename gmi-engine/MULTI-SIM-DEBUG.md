# Multi-Sim Debugging Documentation

**Last Updated:** 2026-02-02
**Status:** PARTIALLY WORKING - Visual rendering fixed, gameplay issues remain

---

## Goal

Create a multi-simulation viewer that runs 50+ parallel ball racing simulations using real Matter.js physics. Each simulation should:
- Display 5 colored balls (Red, Blue, Green, Yellow, Purple)
- Show map obstacles and finish lines
- Run actual physics-based races
- Progress through chain maps (3-6 levels per chain)
- Report race results back to parent page

---

## Current Status (2026-02-02 6:00 PM)

**VISUAL RENDERING: FIXED**
- Balls, obstacles, and finish lines now render correctly
- Maps load and display properly
- Physics simulation runs

**REMAINING ISSUES:**

### 1. Level Indicator Not Updating
- All iframe cells show "L1/6" even when on different maps
- The sim-runner sends `sim-race-complete` but multi-sim.js doesn't update the cell label

### 2. Progress Bar Stuck at 0/16
- Top progress bar shows "0 / 16" despite races completing
- "Races Complete" counter works (shows 12), but progress doesn't

### 3. Finished Balls Block Finish Zone
- When a ball finishes, it stops but keeps its physics body
- Other balls collide with finished balls, blocking the finish zone
- Need to disable collision or move finished balls out of the way

### 4. Some Simulations Don't Advance to Next Map
- Some iframes get stuck and don't transition to next level
- Possibly race condition in scene restart logic

### 5. High Speed (8x) Causes Physics Glitches
- Balls may "despawn" or phase through walls at high time scales
- Matter.js struggles with large time steps

### 6. No Per-Map Statistics
- User wants detailed standings for each map in the chain
- Currently only tracking cumulative chain wins

### 7. No Last Place Elimination Timer
- Original game has a countdown that eliminates the last place ball
- Not implemented in sim-runner

---

## Previous Problem (SOLVED)

**The game logic worked but nothing rendered visually.**

Root cause: Game dimensions were 130x156 pixels (tiny iframe container size). All map coordinates (designed for 800x600) were off-screen.

Fix: Set fixed game size 800x600 with Phaser.Scale.FIT to scale canvas to iframe.

---

## Architecture

### Files Involved

1. **`src/multi-sim.html`** - Parent page with iframe grid
2. **`src/multi-sim.js`** - Creates iframes, tracks results, handles postMessage communication
3. **`src/sim-runner.html`** - Minimal HTML that loads the bundle
4. **`src/sim-runner.js`** - Self-contained Phaser game with SimRaceScene
5. **`src/sim-runner-bundle.js`** - esbuild bundle of sim-runner.js

### Data Flow

```
multi-sim.html
    └── Creates iframes with URL: sim-runner.html?simId=X&chainType=mixed&speed=2
        └── sim-runner.html loads sim-runner-bundle.js
            └── sim-runner.js:
                1. Parses URL params (chainType, speed, simId)
                2. Loads chain maps from MapChain.js
                3. Stores first map in window.__simMapData
                4. Creates Phaser.Game with SimRaceScene
                5. SimRaceScene.init() reads from window.__simMapData
                6. SimRaceScene.create() renders map + creates balls
                7. Race runs, results sent via postMessage
```

### Chain Maps Available

- `race` - CHAIN_RACE_MAPS (3 levels)
- `boss` - CHAIN_BOSS_MAPS (3 bosses)
- `mixed` - CHAIN_MIXED (6 levels)
- `weapons` - CHAIN_WEAPONS_TEST (3 levels)

---

## What's Been Tried

### Attempt 1: Use existing RaceScene
**Problem:** RaceScene depends on Game.js registry and gameConfig which wasn't initialized properly in iframe context.

### Attempt 2: Add pendingGameConfig global
**Problem:** Phaser auto-starts scenes before any config could be set in the registry.

### Attempt 3: Complete rewrite with self-contained SimRaceScene
**Result:** Game logic runs (balls created, race starts, balls finish) but nothing renders visually.

### Attempt 4: Store map data in window.__simMapData
**Result:** Scene now receives map data correctly. Console shows obstacles being rendered. Still no visual output.

### Attempt 5: Switch to Canvas renderer (Phaser.CANVAS)
**Result:** Removed WebGL context limit warnings. Still no visual output.

### Attempt 6: Fix game dimensions (THE FIX)
**Problem:** Container size was 130x156 pixels, map data uses 800x600 coordinates.
**Solution:** Set fixed game size 800x600 with Phaser.Scale.FIT mode.
**Result:** VISUAL RENDERING WORKS! Balls, obstacles, finish zones all visible.

### Attempt 7: Add time scale for speed control
**Result:** Speed control now works (2x, 4x). Capped at 4x to avoid physics glitches.

### Attempt 8: Add countdown timer for stuck balls
**Result:** When half the balls finish, a 10-second countdown starts. When it expires, remaining balls are force-finished based on their Y position (closest to finish = better placement).

### Attempt 9: Fix scene restart
**Problem:** `game.scene.start()` wasn't properly restarting the scene for next map.
**Solution:** Use `scene.scene.restart()` with new map data and update `window.__simMapData`.

### Attempt 10: Add per-map standings UI
**Result:** Sidebar now shows scrollable list of map boxes with standings for each map.

---

## Current Code State

### sim-runner.js Key Sections

**Initialization (lines 17-43):**
```javascript
const params = new URLSearchParams(window.location.search);
const simId = params.get('simId') || '0';
const chainType = params.get('chainType') || 'mixed';
const timeScale = parseFloat(params.get('speed')) || 2;

const chainMaps = CHAINS[chainType] || CHAIN_MIXED;
volumeSystem.initialize();
```

**SimRaceScene.init() (lines 68-80):**
```javascript
init(data) {
  if (data && data.mapData) {
    this.mapData = data.mapData;
    this.mapName = data.mapName;
  } else if (window.__simMapData) {
    // Fall back to global map data (for initial scene start)
    this.mapData = window.__simMapData;
    this.mapName = window.__simMapData?.name || 'Level 1';
  }
  this.timeScale = data?.timeScale || timeScale || 2;
}
```

**SimRaceScene.renderMap() (lines 116-239):**
- Creates background with bgLayer graphics
- Creates wall physics bodies
- Loops through map.obstacles and creates:
  - Matter.js static bodies
  - Graphics fills (fillCircle/fillRect)
- Renders checkered finish zone
- Renders spawn zone

**SimRaceScene.createBalls() (lines 241-301):**
- Creates 5 balls with Matter.js circle bodies
- Creates graphics for each ball (colored circle with eyes)
- Gets stats from volumeSystem

---

## Suspected Issues

### 1. WebGL Context Limits
Multiple Phaser games in iframes may exceed WebGL context limits. Browser warning: "WebGL Context restored. Renderer running again."

**Potential fix:** Use Canvas renderer instead of WebGL:
```javascript
game = new Phaser.Game({
  type: Phaser.CANVAS,  // Instead of Phaser.AUTO
  ...
});
```

### 2. Graphics Layer Not Visible
The graphics objects are created but may not be added to the display list correctly or may be rendered off-screen.

**Potential fix:** Check if graphics need explicit depth or if they're being rendered at wrong coordinates.

### 3. Canvas Sizing in Iframe
The game canvas may not be sizing correctly within the iframe container.

**Debug step:** Add visible border to canvas element:
```css
canvas { border: 5px solid red !important; }
```

### 4. Phaser Scene Lifecycle
The scene may be transitioning states before rendering completes.

**Debug step:** Add console.log in update() to verify the game loop is running.

---

## Diagnostic Tools Created

### test-chain.html
Verifies chain data is correctly exported from MapChain.js. **Result:** All chains have correct obstacles.

### diagnostic.html
Comprehensive diagnostic that:
- Verifies all chain data structures
- Tests single iframe simulation
- Shows map data flow

**Result:** "Chain data looks CORRECT. Issue is likely in rendering or config passing."

---

## What Works

1. **Main game (localhost:3000)** - All chains work perfectly with obstacles, balls, and physics
2. **Chain data export** - All CHAIN_* arrays have correct obstacle data
3. **Visual rendering** - Balls, obstacles, finish zones all render correctly
4. **Physics simulation** - Matter.js bouncing and collision works
5. **Race detection** - Balls crossing finish zone are detected and recorded
6. **Map transitions** - Simulations advance through chain maps using scene.restart()
7. **Speed control** - 2x, 4x speeds work (capped at 4x)
8. **postMessage communication** - Race complete events sent to parent
9. **Chain Wins tracking** - Cumulative wins displayed in Live Results
10. **Countdown timer** - 10-second countdown when half finish, force-finishes stuck balls
11. **Finished balls removed** - Balls are removed from physics when they finish
12. **Per-map standings UI** - Scrollable list showing standings per map in sidebar

## What Doesn't Work / Needs Testing

1. **Level indicator per cell** - Should now update (needs testing)
2. **Progress bar** - Shows completed chains (0/16), not individual races (this is correct behavior)
3. **High speed physics** - Capped at 4x to avoid issues
4. **Some edge cases** - Need more testing with all chain types

---

## Recommended Next Steps

### Priority 1: Fix Finished Ball Collision
In `SimRaceScene.onBallFinish()` or wherever ball finishes:
```javascript
// Disable collision for finished balls
this.matter.world.remove(ball.body);
// Or move ball off-screen
ball.graphics.setVisible(false);
```

### Priority 2: Fix Level Indicator Updates
In `multi-sim.js`, handle `sim-race-complete` message to update iframe cell label:
```javascript
case 'sim-race-complete':
  // Update the level indicator for this sim
  const levelLabel = document.querySelector(`#sim-cell-${data.simId} .level-indicator`);
  if (levelLabel) levelLabel.textContent = `L${data.level}/${data.totalLevels}`;
  break;
```

### Priority 3: Fix Progress Bar
Track individual sim progress and update the main progress bar when maps complete.

### Priority 4: Cap Time Scale
Limit maximum time scale to 4x to avoid physics glitches:
```javascript
const safeTimeScale = Math.min(timeScale, 4);
```

### Priority 5: Add Per-Map Statistics
Track standings after each map, not just chain wins:
```javascript
raceResults.push({
  level: currentMapIndex + 1,
  mapName: this.mapName,
  standings: results.map(r => ({ name: r.name, position: r.position })),
  items: [] // Track items used
});
```

### Priority 6: Add Elimination Timer
Port the last-place elimination timer from main RaceScene.

---

## Build Commands

```bash
cd gmi-engine
npm run build:simrunner  # Rebuilds sim-runner-bundle.js
```

---

## Files to Read

- `src/sim-runner.js` - The main simulation runner (complete code)
- `src/multi-sim.js` - Parent page controller
- `src/game/systems/MapChain.js` - Chain map definitions
- `src/game/scenes/RaceScene.js` - Reference for how main game renders (working)

---

## Contact/Context

The main game at http://127.0.0.1:3000 works perfectly. The issue is specifically with running multiple Phaser instances in iframes. The physics and game logic execute correctly - only the visual rendering is broken.
