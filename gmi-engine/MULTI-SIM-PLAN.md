# Multi-Sim Improvement Plan

## Current Issues Identified

### 1. Boss Maps Give Deterministic Results
**Problem**: When boss dies, balls are ranked 1,2,3,4,5 by spawn order (Red always wins)
**Root Cause**: `onRaceComplete()` sorts unfinished balls by Y position, which equals spawn position
**Solution**: Track damage dealt to boss per ball, rank by damage when boss dies

### 2. Boss Fights Too Fast
**Problem**: Proximity damage kills boss instantly
**Root Cause**: All 5 balls damaging boss 2-5 HP every 300ms = 15-25 damage/tick
**Solution**: Reduce damage rate OR add proper weapons with cooldowns

### 3. No Real Weapon System
**Problem**: Simplified "proximity damage" doesn't track which ball did what
**Main Game**: Balls pick up weapon crates, fire projectiles, damage tracked per ball
**Solution**: Implement basic weapon firing with damage attribution

### 4. After Boss Death, Remaining Maps Skipped
**Problem**: Saw "all maps played in a few frames"
**Root Cause**: Scene restart might be failing OR boss death triggering race complete too fast
**Need**: Debug why maps 4-6 complete instantly after boss 1

---

## Main Game Mechanics Summary (for reference)

### Race Maps
- Win condition: Cross finish line first
- Half-finished timer: 15s countdown after 50% finish
- Force-finish ranks remaining by Y position (progress toward finish)

### Boss Maps
- Win condition: Defeat the boss
- No finish line (off-screen)
- Balls damage boss via:
  - Direct collision (ball.damage stat)
  - Weapon projectiles (weapon damage)
- When boss dies:
  - **Should rank balls by damage dealt to boss**
  - Ball with most boss damage = 1st place
  - This rewards active fighting, not just being first to spawn

### Ball Stats (from VolumeSystem)
| Ball | HP | Speed | Damage |
|------|-----|-------|--------|
| Red | 200 | 1.2x | 15 |
| Blue | 175 | 1.1x | 12 |
| Green | 150 | 1.0x | 10 |
| Yellow | 125 | 0.9x | 7 |
| Purple | 100 | 0.8x | 5 |

---

## Implementation Plan

### Phase 1: Fix Boss Fight Ranking (Priority: HIGH)

**File**: `src/sim-runner.js`

1. Track damage per ball:
```javascript
// In SimRaceScene class
this.bossDamageByBall = { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 };
```

2. Update damage function to track:
```javascript
updateAutoFire(delta) {
  // When ball damages boss, track it
  this.bossDamageByBall[ball.name] += damage;
}
```

3. When boss dies, rank by damage:
```javascript
onBossDefeated() {
  const rankings = Object.entries(this.bossDamageByBall)
    .sort((a, b) => b[1] - a[1])  // Highest damage first
    .map(([name, damage], idx) => ({
      name,
      position: idx + 1,
      damage
    }));

  // Now call onRaceComplete with these rankings
}
```

### Phase 2: Proper Weapon System (Priority: MEDIUM)

**Goal**: Each ball fires projectiles, damage tracked individually

1. Give balls basic weapon on boss maps:
```javascript
if (map.bossConfig) {
  this.balls.forEach(ball => {
    ball.weapon = { cooldown: 500, damage: ball.damage, lastFired: 0 };
  });
}
```

2. Fire projectiles with visual:
```javascript
fireBallWeapon(ball) {
  const proj = this.add.circle(ball.body.position.x, ball.body.position.y, 5, 0xffff00);
  // Move toward boss
  // On hit: this.bossDamageByBall[ball.name] += damage
}
```

### Phase 3: Data Export Enhancement (Priority: MEDIUM)

Track per-simulation:
- Weapon pickups per ball
- Damage dealt to boss per ball
- Items used
- Time to complete each map

Export format:
```json
{
  "simId": 1,
  "maps": [
    {
      "name": "Boss 1: Spiral",
      "type": "boss",
      "results": [
        { "name": "Green", "position": 1, "bossDamage": 45 },
        { "name": "Red", "position": 2, "bossDamage": 32 }
      ],
      "duration": 12.5
    }
  ]
}
```

### Phase 4: Maintainability (Priority: HIGH)

**Problem**: Main game updates might break sim-runner

**Solution 1: Shared Constants**
- Create `src/game/constants/GameConfig.js`
- Export ball colors, names, stats formulas
- Both main game and sim-runner import from same source

**Solution 2: Interface Abstraction**
- Define clear interfaces for what sim-runner needs:
  - MapChain data structure
  - Ball stats structure
  - Boss config structure
- If main game changes these, update interface adapter

**Solution 3: Version Checking**
- Add version number to MapChain.js
- Sim-runner checks version compatibility
- Warn if version mismatch detected

**Solution 4: Integration Tests**
- Create `test/sim-compatibility.test.js`
- Verifies sim-runner can load all chain types
- Verifies ball stats calculated correctly
- Run after main game changes

---

## File Structure Recommendation

```
gmi-engine/
├── src/
│   ├── game/                    # Main game
│   │   ├── constants/           # NEW: Shared constants
│   │   │   └── GameConfig.js    # Ball names, colors, stat formulas
│   │   ├── scenes/
│   │   └── systems/
│   │
│   ├── simulation/              # NEW: Organized sim files
│   │   ├── SimRunner.js         # Main simulation logic
│   │   ├── SimRaceScene.js      # Scene class
│   │   ├── SimBossLogic.js      # Boss fight simulation
│   │   └── SimDataExport.js     # Stats export
│   │
│   ├── multi-sim.js             # Parent page controller
│   └── multi-sim.html
│
├── test/
│   └── sim-compatibility.test.js
│
└── MULTI-SIM-DEBUG.md
```

---

## Quick Fixes (Can Do Now)

### Fix 1: Boss Damage Tracking
Add `bossDamageByBall` object, update when damaging boss, use for ranking

### Fix 2: Reduce Boss Damage Rate
Change from 300ms tick to 800ms, reduce damage per tick

### Fix 3: Debug Map Skipping
Add console.log at every map transition to find where skipping happens

---

## Long-term Goals

1. **Accurate Simulation**: Results should match main game mechanics
2. **Weapon Balance Data**: Export detailed weapon usage stats
3. **Map Balance Data**: Which maps favor which balls?
4. **Volume Impact**: How do stat differences affect win rates?
5. **Easy Updates**: Main game changes don't break simulation

---

## TODO List

### High Priority
- [ ] **Spawn System Improvements**
  - [ ] Randomize spawn order (not always Red first)
  - [ ] Add spawn position variance (slight random offset)
  - [ ] Option to test equal stats (remove volume advantage)
  - [ ] Test spawn lane shuffling

### Medium Priority
- [ ] **Boss Balance Options**
  - [ ] Option: Equal damage for all balls (test map design only)
  - [ ] Option: Weapon-based damage (not proximity)
  - [ ] Track time-to-kill for each ball

### Low Priority
- [ ] **Main Game Sync**
  - [ ] Create shared constants file
  - [ ] Add version checking between main game and sim
  - [ ] Integration tests for compatibility

---

## Points System Reference

### Per-Race Points
| Position | Points |
|----------|--------|
| 1st | 10 |
| 2nd | 8 |
| 3rd | 6 |
| 4th | 4 |
| 5th | 2 |

### Chain Winner Calculation
- Sum all points from all races in chain
- Highest total points = Chain Winner
- With 6 maps: max possible = 60 points (1st in every race)

### Why Current Results Favor Red/Blue
1. **Boss maps (3 of 6)**: Damage-based ranking
   - Red: 15 dmg → wins most boss fights
   - Blue: 12 dmg → 2nd most boss wins
   - Purple: 5 dmg → rarely wins bosses

2. **Cumulative effect**: 30 points available from bosses
   - Red/Blue typically get 24-30 points from bosses alone
   - Other balls can't catch up even if they win all race maps

### Potential Balance Changes to Test
1. **Reduce boss weight**: Fewer boss maps in chain
2. **Equal boss damage**: All balls deal same damage
3. **Randomize spawn**: Remove positional advantage
4. **Speed matters more**: Higher speed = more boss hits
