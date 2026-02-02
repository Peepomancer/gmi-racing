# GMI Racing - Technical Debt

This document lists technical debt items that can be safely addressed in a separate branch without breaking core functionality. Each item is isolated and can be tackled independently.

---

## Priority 1: Code Quality (Safe to refactor)

### 1.1 RaceScene.js is too large (2800+ lines)
**File**: `src/game/scenes/RaceScene.js`
**Problem**: Single file handles too many responsibilities
**Solution**: Extract into smaller modules:
```
src/game/scenes/
├── RaceScene.js          # Main scene, delegates to managers
├── managers/
│   ├── BallManager.js    # Ball creation, physics, state
│   ├── ObstacleManager.js# Obstacle creation and updates
│   ├── CollisionManager.js# All collision handlers
│   ├── RaceStateManager.js# Race start/finish logic
│   └── UIManager.js      # HUD, labels, progress bars
```
**Risk**: Low - just moving code, no logic changes
**Effort**: Medium

### 1.2 Magic numbers scattered throughout code
**Files**: Multiple
**Problem**: Hardcoded values like `15` (ball radius), `0.8` (bounce), `5` (ball count)
**Solution**: Create `src/game/config/Constants.js`:
```javascript
export const BALL = {
  RADIUS: 15,
  COUNT: 5,
  DEFAULT_HP: 100
};
export const PHYSICS = {
  BOUNCE: 0.8,
  FRICTION: 0.001,
  AIR_RESISTANCE: 0.01
};
export const RACE = {
  COUNTDOWN_SECONDS: 15,
  HALF_FINISHED_THRESHOLD: 3
};
```
**Risk**: Low
**Effort**: Low

### 1.3 Inconsistent error handling
**Files**: Multiple system files
**Problem**: Some functions silently fail, others throw, others log
**Solution**: Create consistent error handling pattern:
```javascript
// Add to each system
handleError(context, error) {
  console.error(`[${this.constructor.name}] ${context}:`, error);
  // Optionally emit event for UI notification
}
```
**Risk**: Low
**Effort**: Low

---

## Priority 2: Performance (Noticeable improvements)

### 2.1 Redundant DOM queries
**File**: `src/renderer.js`
**Problem**: `document.getElementById()` called repeatedly in loops
**Solution**: Cache DOM references at initialization:
```javascript
const domCache = {
  standingsPanel: document.getElementById('standings-panel'),
  statsRaces: document.getElementById('stat-total-races'),
  // ... etc
};
```
**Risk**: Low
**Effort**: Low

### 2.2 Bundle size too large (7MB)
**Files**: Build output
**Problem**: Full Phaser included even though we don't use all features
**Solution**:
- Use Phaser's custom build feature
- Tree-shake unused modules
- Consider dynamic imports for editor vs game
**Risk**: Medium - might break something
**Effort**: Medium

### 2.3 No object pooling for projectiles
**File**: `src/game/systems/WeaponSystem.js`
**Problem**: New projectiles created/destroyed frequently, causing GC pressure
**Solution**: Implement object pool:
```javascript
class ProjectilePool {
  constructor(maxSize = 100) {
    this.pool = [];
    this.active = new Set();
  }
  get() { /* return from pool or create new */ }
  release(projectile) { /* return to pool */ }
}
```
**Risk**: Low
**Effort**: Medium

---

## Priority 3: Architecture (Better organization)

### 3.1 Global state management
**File**: `src/renderer.js`
**Problem**: Global variables (`game`, `config`, `mapChain`) scattered
**Solution**: Create AppState singleton:
```javascript
class AppState {
  constructor() {
    this.game = null;
    this.config = null;
    this.mapChain = null;
  }
  static getInstance() { /* ... */ }
}
```
**Risk**: Medium - affects many files
**Effort**: Medium

### 3.2 Event system inconsistency
**Files**: Multiple
**Problem**: Mix of callbacks, events, direct function calls
**Solution**: Standardize on EventEmitter pattern:
```javascript
// Central event bus
import { EventEmitter } from 'events';
export const gameEvents = new EventEmitter();

// Usage
gameEvents.emit('race:complete', results);
gameEvents.on('race:complete', handleRaceComplete);
```
**Risk**: Medium
**Effort**: High

### 3.3 No TypeScript / JSDoc
**Files**: All
**Problem**: No type safety, hard to refactor safely
**Solution**:
- Option A: Add JSDoc comments for IDE support
- Option B: Migrate to TypeScript gradually
**Risk**: Low for JSDoc, Medium for TypeScript
**Effort**: High

---

## Priority 4: Testing (Quality assurance)

### 4.1 No unit tests
**Problem**: No automated testing
**Solution**: Add Jest + test files:
```
tests/
├── systems/
│   ├── PointSystem.test.js
│   ├── StatisticsSystem.test.js
│   └── RouletteSystem.test.js
└── utils/
    └── helpers.test.js
```
**Risk**: None - additive only
**Effort**: High (ongoing)

### 4.2 No integration tests
**Problem**: Can't verify full game flow automatically
**Solution**: Add Playwright/Puppeteer tests for:
- Chain completion flow
- Roulette animation completion
- Statistics persistence
**Risk**: None
**Effort**: High

---

## Priority 5: Features incomplete/broken

### 5.1 Lightning weapon animation missing
**File**: `src/game/systems/WeaponSystem.js`
**Problem**: Lightning weapon fires but no visual
**Solution**: Add lightning bolt graphics:
```javascript
createLightningBolt(from, to) {
  const graphics = this.scene.add.graphics();
  // Draw jagged line between points
  // Add glow effect
  // Tween fade out
}
```
**Risk**: Low
**Effort**: Low

### 5.2 Some weapon effects not visible
**File**: `src/game/systems/WeaponSystem.js`
**Problem**: Freeze aura, sword slash need better visuals
**Solution**: Add particle effects and proper graphics
**Risk**: Low
**Effort**: Medium

### 5.3 Simulation runs fake races
**File**: `src/game/systems/SimulationSystem.js`
**Problem**: Current simulation just generates random results
**Solution**: Run actual physics simulation at high speed:
- Set Phaser timeScale to 4x
- Skip roulette animations
- Auto-progress chain
**Risk**: Medium
**Effort**: High

---

## Priority 6: Code cleanup

### 6.1 Dead code removal
**Files**: Multiple
**Candidates**:
- Unused imports in renderer.js
- Commented-out code blocks
- Unused CSS classes in index.html
**Risk**: Low
**Effort**: Low

### 6.2 Console.log cleanup
**Files**: Multiple
**Problem**: Debug logs left in production code
**Solution**:
- Create debug logger that respects DEBUG flag
- Remove or wrap all console.log in debug check
**Risk**: Low
**Effort**: Low

### 6.3 CSS cleanup
**File**: `src/index.html` (inline styles)
**Problem**: Lots of inline styles, hard to maintain
**Solution**: Extract to separate CSS file:
```
src/
├── styles/
│   ├── main.css
│   ├── panels.css
│   └── game.css
```
**Risk**: Low
**Effort**: Medium

---

## Quick Wins (Can do in <30 min each)

1. **Add Constants.js** - Extract magic numbers
2. **Cache DOM refs** - Speed up UI updates
3. **Add JSDoc to StatisticsSystem** - Document the API
4. **Remove dead console.logs** - Cleaner output
5. **Add loading indicator** - Better UX during map load
6. **Fix favicon 404** - Add a favicon.ico file

---

## Notes for AI Implementation

When tackling these items:

1. **Always create a new branch** before making changes
2. **Run `npm run build`** after changes to verify no errors
3. **Test the game manually** after each change:
   - Start a chain
   - Complete at least one level
   - Verify roulette works
   - Check stats tab updates
4. **Keep commits small** - one debt item per commit
5. **Don't change multiple systems at once** - isolate changes

### Safe files to modify (low risk):
- `StatisticsSystem.js`
- `SimulationSystem.js`
- `GameLog.js`
- `Constants.js` (new file)
- CSS/styling

### Risky files (be careful):
- `RaceScene.js` - core game logic
- `renderer.js` - glue code, many dependencies
- `RouletteSystem.js` - complex animation timing
- `MapChain.js` - progression logic

---

*Document created: 2026-01-31*
