# Balance Goals & Implementation Guide

## Core Philosophy

**All balls start equal. Skill and luck during the race determine outcomes.**

Winners get better weapons (reward), but trailing balls get speed boosts (comeback).
This creates tension: "I'm behind but I'm catching up" vs "I'm ahead but they're gaining".

---

## Priority 1: Equal Starting Stats

### Current Problem
`VolumeSystem.js` gives unequal stats based on ball color:
- Red: 1.2x speed (20% faster!)
- Purple: 0.8x speed (20% slower!)

### Solution
In `sim-runner.js`, bypass VolumeSystem and use equal stats:

```javascript
// In createBalls() around line 443, REPLACE:
const stats = volumeSystem.getStatsForBall(colorData.name);

// WITH:
const stats = {
  speed: 1.0,
  hp: 150,
  maxHp: 150,
  damage: 10
};
```

### Expected Result
Win rates should be closer to 20% each (currently Red/Blue dominate at 32-36%).

---

## Priority 2: Rubber-Banding Speed Boost

### Concept
Balls that are behind get a speed boost. The further behind, the bigger the boost.
This keeps races competitive without punishing leaders.

### Implementation
Add to `SimRaceScene.update()` in `sim-runner.js`:

```javascript
update(time, delta) {
  // ... existing code ...

  if (!this.isRacing) return;

  // RUBBER BANDING - boost trailing balls
  this.applyRubberBanding();

  // ... rest of update ...
}

applyRubberBanding() {
  // Find the leader (lowest Y position = closest to finish at top)
  const activeBalls = this.balls.filter(b => !b.finished && b.body);
  if (activeBalls.length < 2) return;

  const leaderY = Math.min(...activeBalls.map(b => b.body.position.y));

  activeBalls.forEach(ball => {
    const distanceBehind = ball.body.position.y - leaderY;

    // Calculate boost (max 40% at 400+ pixels behind)
    const maxBoost = 0.4;
    const boostRange = 400;
    const boost = Math.min(distanceBehind / boostRange, 1) * maxBoost;

    // Apply boost to current velocity
    if (boost > 0.05) {  // Only apply if meaningful
      const vel = ball.body.velocity;
      const currentSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      const targetSpeed = 5 * (1 + boost);  // Base speed 5, boosted

      if (currentSpeed > 0.1 && currentSpeed < targetSpeed) {
        const scale = targetSpeed / currentSpeed;
        this.matter.body.setVelocity(ball.body, {
          x: vel.x * scale,
          y: vel.y * scale
        });
      }
    }
  });
}
```

### Tuning Parameters
- `maxBoost = 0.4` → 40% max speed increase
- `boostRange = 400` → pixels behind to reach max boost
- Adjust these based on simulation results

---

## Priority 3: Weapon Rebalance

### Current Problem
Melee weapons do almost no damage because:
1. Range is too short (60px vs boss size 100px)
2. Damage is too low
3. Balls rarely get close enough

### Solution
Update `WEAPON_DEFS` in `sim-runner.js`:

```javascript
const WEAPON_DEFS = {
  // Projectile weapons (keep similar)
  PEA_SHOOTER:  { name: 'Pea Shooter', damage: 5, cooldown: 800, range: 200, type: 'projectile' },
  SHOTGUN:      { name: 'Shotgun', damage: 15, cooldown: 1200, range: 200, type: 'projectile' },
  HOMING_ORB:   { name: 'Homing Orb', damage: 8, cooldown: 1500, range: 250, type: 'projectile' },
  BOUNCY_SHOT:  { name: 'Bouncy Shot', damage: 4, cooldown: 1000, range: 200, type: 'projectile' },

  // Melee weapons (BUFFED)
  SWORD:   { name: 'Sword', damage: 25, cooldown: 600, range: 120, type: 'melee' },
  FLAIL:   { name: 'Flail', damage: 12, cooldown: 400, range: 100, type: 'melee' },
  SPIKE:   { name: 'Spike Aura', damage: 18, cooldown: 500, range: 90, type: 'melee' },
  HAMMER:  { name: 'Hammer', damage: 45, cooldown: 1800, range: 130, type: 'melee' },

  // Area weapons
  LIGHTNING: { name: 'Lightning', damage: 20, cooldown: 3000, range: 300, type: 'area' },

  // Buffs (no direct damage)
  SPEED_BUFF:  { name: 'Speed Boost', damage: 0, cooldown: 0, type: 'buff', effect: 'speed' },
  SHIELD_BUFF: { name: 'Shield', damage: 0, cooldown: 0, type: 'buff', effect: 'shield' },
  DAMAGE_BUFF: { name: 'Damage Up', damage: 0, cooldown: 0, type: 'buff', effect: 'damage', multiplier: 2 }
};
```

Also update `updateAutoFire()` to use weapon range:
```javascript
// Change this line:
const range = weapon.def.type === 'melee' ? 60 : 200;

// To:
const range = weapon.def.range || (weapon.def.type === 'melee' ? 80 : 200);
```

---

## Optional: Flatter Point Curve

### Current
```
1st: 10, 2nd: 8, 3rd: 6, 4th: 4, 5th: 2
Gap: 8 points between 1st and 5th
```

### Proposed
```
1st: 8, 2nd: 7, 3rd: 6, 4th: 5, 5th: 4
Gap: 4 points between 1st and 5th
```

### Implementation
In `sim-runner.js`, find the points array and update:
```javascript
// Around line 639 and 854:
const points = [8, 7, 6, 5, 4][idx] || 0;
```

---

## Testing Protocol

After each change:
1. `npm run build`
2. Run 50 simulations on "Mixed Campaign"
3. Check chain win rates (target: 15-25% for each ball)
4. Check weapon damage stats (melee should be competitive)
5. Export JSON for comparison

### Success Metrics
- No ball wins more than 28% of chains
- No ball wins less than 12% of chains
- Melee weapon damage > 20% of total weapon damage
- Exciting races where lead changes happen

---

## Future Ideas (Lower Priority)

1. **Blue Shell Item**: Targets leader, only available to 4th/5th place
2. **Random Events**: Wind gusts, position shuffles
3. **Risk/Reward Paths**: Dangerous shortcuts
4. **Combo System**: Consecutive hits increase damage
5. **Underdog Buff**: Cumulative point deficit = passive buffs

---

## File Locations

- Main sim logic: `src/sim-runner.js`
- Parent controller: `src/multi-sim.js`
- Ball stats (bypass this): `src/game/systems/VolumeSystem.js`
- Weapon definitions: in `sim-runner.js` lines 67-80
- Point awards: in `sim-runner.js` lines 639, 854
