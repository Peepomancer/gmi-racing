# GMI Racing Engine - Architecture

## Overview

This document describes the modular architecture of the GMI Racing Engine after the tech debt refactoring.

## Directory Structure

```
src/
├── game/
│   ├── scenes/
│   │   └── RaceScene.js          # Main game scene (1954 lines)
│   ├── rendering/
│   │   ├── BallRenderer.js       # Ball graphics and HP bars
│   │   ├── FinishTrackerUI.js    # Finish order display panel
│   │   ├── ObstacleRenderer.js   # Obstacle graphics with behavior indicators
│   │   └── ZoneRenderer.js       # Start/finish zone rendering
│   ├── managers/
│   │   ├── BreakableManager.js   # Breakable obstacle damage handling
│   │   ├── BallBoundaryManager.js # Keep balls within game bounds
│   │   ├── CrushDetector.js      # Crush detection for balls
│   │   └── SpecialObstacleManager.js # Rotating/moving/crusher updates
│   └── systems/
│       ├── VolumeSystem.js       # Ball volume/betting system
│       ├── WeaponSystem.js       # Weapon mechanics
│       ├── BossSystem.js         # Boss encounters
│       └── ...
├── ui/
│   ├── ChainCompleteScreen.js    # Chain completion screen
│   ├── ConfigManager.js          # Configuration storage
│   ├── StatsUI.js                # Statistics dashboard
│   └── VolumeUI.js               # Volume panel UI
├── maps/
│   └── BuiltinMaps.js            # Built-in map definitions
├── renderer.js                    # Main UI controller (1622 lines)
└── test-runner.js                 # Automated test suite
```

## Module Responsibilities

### Rendering Modules (`src/game/rendering/`)

| Module | Purpose |
|--------|---------|
| `BallRenderer.js` | Renders ball graphics with eyes and HP bars |
| `FinishTrackerUI.js` | Shows finish order and eliminated balls |
| `ObstacleRenderer.js` | Draws obstacles with behavior indicators (rotating, breakable, crusher) |
| `ZoneRenderer.js` | Renders start zones (green dashed) and finish zones (checkered) |

### Manager Modules (`src/game/managers/`)

| Module | Purpose |
|--------|---------|
| `BreakableManager.js` | Handles damage to breakable obstacles and destruction effects |
| `BallBoundaryManager.js` | Enforces game boundaries, bounces balls off edges |
| `CrushDetector.js` | Detects when balls are crushed between obstacles/walls |
| `SpecialObstacleManager.js` | Updates rotating, moving, and crusher obstacles each frame |

### UI Modules (`src/ui/`)

| Module | Purpose |
|--------|---------|
| `ChainCompleteScreen.js` | Shows results when a race chain completes |
| `ConfigManager.js` | Saves/loads game configuration |
| `StatsUI.js` | Displays race statistics dashboard |
| `VolumeUI.js` | Ball volume selection and rankings panel |

## Refactoring Summary

### Before (February 2026)
- `RaceScene.js`: 2978 lines (monolithic)
- `renderer.js`: 2085 lines (monolithic)
- Dead code: ~120 lines
- Test coverage: Manual only

### After
- `RaceScene.js`: 1954 lines (-34%)
- `renderer.js`: 1622 lines (-22%)
- Dead code: 0 lines
- Test coverage: Automated (16 simulations)
- Modules extracted: 13

## Testing

Run automated tests:
```bash
npm run test:refactor
```

This runs 16 simulations at 4x speed and validates:
- 100% completion rate
- 0 race timeouts
- 0 stuck pushes
- Win rates within 5-45% range

## Development

```bash
# Install dependencies
npm install

# Build all bundles
npm run build

# Start development server
npm start

# Run tests
npm run test:refactor
```

## Future Improvements

Potential additional extractions (lower priority):
- Collision handler (~300 lines) - complex physics integration
- Ball spawning/respawning (~150 lines) - scene-coupled
- Map chain logic in renderer.js - DOM-heavy

These remain in the core files due to tight coupling with scene state.
