# GMI Racing - Implementation Plan

## Phase 1: Foundation (Start Here)

### Task 1.1: Ball Stats System

**Goal:** Balls have stats that affect gameplay

**Create:** `src/game/entities/Ball.js`
```javascript
class Ball {
  constructor(config) {
    this.name = config.name;        // "Red", "Blue", etc.
    this.color = config.color;      // "#ff0000"
    this.volume = config.volume;    // 50000

    // Computed stats (from volume)
    this.stats = {
      speed: 5,      // base speed
      hp: 100,       // health points
      maxHp: 100,
      damage: 10,    // collision damage
      size: 15       // radius
    };

    // State
    this.isAlive = true;
    this.finished = false;
    this.points = 0;

    // Phaser/Matter refs
    this.body = null;
    this.graphics = null;
  }

  updateStatsFromVolume(volumeRank) { ... }
  takeDamage(amount) { ... }
  heal(amount) { ... }
  die() { ... }
}
```

**Integrate with:** Existing RaceScene.js ball creation

---

### Task 1.2: Fake Volume System

**Goal:** UI to simulate volume pumping

**Create:** `src/game/systems/VolumeSystem.js`
```javascript
class VolumeSystem {
  constructor() {
    this.balls = new Map();  // name -> volume
    this.autoFluctuate = false;
  }

  setVolume(ballName, amount) { ... }
  addVolume(ballName, amount) { ... }   // Buy
  removeVolume(ballName, amount) { ... } // Sell
  getVolumeRanks() { ... }              // Returns sorted rankings
  startAutoFluctuate() { ... }          // Random changes
  stopAutoFluctuate() { ... }
}
```

**Create:** Volume Panel UI in `index.html`
```html
<div id="volume-panel">
  <h3>Volume Simulator</h3>
  <div class="ball-volume" data-ball="Red">
    <span class="name">Red</span>
    <span class="volume">$50,000</span>
    <button class="buy-1k">+1K</button>
    <button class="buy-5k">+5K</button>
    <button class="sell-1k">-1K</button>
  </div>
  <!-- Repeat for each ball -->
  <button id="randomize-volume">Randomize All</button>
  <label><input type="checkbox" id="auto-fluctuate"> Auto-Fluctuate</label>
</div>
```

---

### Task 1.3: Volume -> Stats Linking

**Goal:** Volume rank changes ball stats in real-time

**Create:** `src/game/systems/StatsCalculator.js`
```javascript
const VOLUME_MODIFIERS = {
  // rank: { speed, hp, damage, size }
  1: { speed: 1.20, hp: 1.30, damage: 1.25, size: 1.15 },
  2: { speed: 1.10, hp: 1.20, damage: 1.15, size: 1.08 },
  3: { speed: 1.00, hp: 1.00, damage: 1.00, size: 1.00 },
  4: { speed: 0.90, hp: 0.90, damage: 0.90, size: 0.92 },
  5: { speed: 0.85, hp: 0.80, damage: 0.85, size: 0.85 }
};

function calculateStats(baseBall, volumeRank) {
  const mod = VOLUME_MODIFIERS[volumeRank];
  return {
    speed: baseBall.baseSpeed * mod.speed,
    hp: baseBall.baseHp * mod.hp,
    damage: baseBall.baseDamage * mod.damage,
    size: baseBall.baseSize * mod.size
  };
}
```

**Integration:**
- VolumeSystem emits 'volume-changed' event
- RaceScene listens and updates ball stats
- Visual feedback: "SURGE!" text popup

---

### Task 1.4: Config System

**Goal:** Load tournament from JSON

**Create:** `src/game/systems/ConfigSystem.js`
```javascript
class ConfigSystem {
  async loadTournament(configPath) {
    const response = await fetch(configPath);
    return await response.json();
  }

  validateConfig(config) { ... }

  getDefaultConfig() {
    return {
      balls: [...],
      stages: [...],
      scoring: {...}
    };
  }
}
```

**Create:** `src/game/config/test-tournament.json`
```json
{
  "name": "Test Tournament",
  "balls": [
    { "name": "Red", "color": "#ff0000", "volume": 50000 },
    { "name": "Blue", "color": "#0000ff", "volume": 45000 },
    { "name": "Green", "color": "#00ff00", "volume": 40000 },
    { "name": "Yellow", "color": "#ffff00", "volume": 35000 },
    { "name": "Purple", "color": "#9900ff", "volume": 30000 }
  ],
  "stages": [
    {
      "type": "race",
      "map": "builtin-breakable-test",
      "duration": 120
    }
  ]
}
```

---

## Phase 2: Combat Core

### Task 2.1: HP System

**Goal:** Balls can take damage and die

**Modify:** `Ball.js`
```javascript
takeDamage(amount, source) {
  this.stats.hp -= amount;
  this.emit('damaged', { amount, source, remaining: this.stats.hp });

  if (this.stats.hp <= 0) {
    this.die();
  }
}

die() {
  this.isAlive = false;
  this.emit('died');
  // Visual: fade out, particles
}
```

**Create:** HP Bar overlay
- Floating HP bar above each ball
- Green -> Yellow -> Red gradient
- Damage numbers popup

---

### Task 2.2: Basic PvP Mode

**Goal:** Balls damage each other on collision

**Create:** `src/game/modes/PvPMode.js`
```javascript
class PvPMode {
  constructor(scene) {
    this.scene = scene;
    this.setupCollisions();
  }

  setupCollisions() {
    this.scene.matter.world.on('collisionstart', (event) => {
      event.pairs.forEach(pair => {
        const ballA = this.getBall(pair.bodyA);
        const ballB = this.getBall(pair.bodyB);

        if (ballA && ballB) {
          this.handleBallCollision(ballA, ballB);
        }
      });
    });
  }

  handleBallCollision(ballA, ballB) {
    // Calculate damage based on relative velocity
    const relativeSpeed = this.getRelativeSpeed(ballA, ballB);
    const damageA = ballB.stats.damage * (relativeSpeed / 10);
    const damageB = ballA.stats.damage * (relativeSpeed / 10);

    ballA.takeDamage(damageA, ballB);
    ballB.takeDamage(damageB, ballA);
  }
}
```

---

### Task 2.3: Knockback Physics

**Goal:** Bigger balls push smaller balls more

**Add to:** PvPMode collision handling
```javascript
applyKnockback(attacker, victim) {
  const sizeDiff = attacker.stats.size / victim.stats.size;
  const knockbackForce = sizeDiff * 5;

  const angle = Phaser.Math.Angle.Between(
    attacker.body.position.x, attacker.body.position.y,
    victim.body.position.x, victim.body.position.y
  );

  Matter.Body.applyForce(victim.body, victim.body.position, {
    x: Math.cos(angle) * knockbackForce,
    y: Math.sin(angle) * knockbackForce
  });
}
```

---

### Task 2.4: Crit System

**Goal:** Random critical hits for drama

**Create:** `src/game/systems/CritSystem.js`
```javascript
class CritSystem {
  constructor() {
    this.baseCritChance = 0.05;  // 5%
    this.critMultiplier = 3.5;
  }

  getCritChance(ball, volumeRank) {
    // Higher volume = slightly better crit chance
    const volumeBonus = (6 - volumeRank) * 0.01;
    return this.baseCritChance + volumeBonus;
  }

  rollCrit(ball, volumeRank) {
    const chance = this.getCritChance(ball, volumeRank);
    const isCrit = Math.random() < chance;

    return {
      isCrit,
      multiplier: isCrit ? this.critMultiplier : 1
    };
  }
}
```

**Visual feedback:**
- "CRIT!" text popup
- Screen shake
- Flash effect
- Sound hook (for future)

---

## Phase 3: Weapons

### Task 3.1: Weapon System

**Create:** `src/game/entities/Weapon.js`
```javascript
const WEAPON_TYPES = {
  blade: { damage: 15, range: 20, speed: 'fast', special: 'spin' },
  hammer: { damage: 25, range: 15, speed: 'slow', special: 'knockback' },
  spear: { damage: 12, range: 35, speed: 'medium', special: 'reach' },
  shield: { damage: 5, range: 10, speed: 'medium', special: 'block' },
  spikes: { damage: 8, range: 0, speed: 'passive', special: 'contact' }
};

class Weapon {
  constructor(type, tier) {
    this.type = type;
    this.tier = tier;  // common, rare, epic, legendary
    this.baseStats = WEAPON_TYPES[type];
    this.stats = this.calculateStats();
  }

  calculateStats() {
    const tierMultipliers = {
      common: 1.0,
      rare: 1.25,
      epic: 1.5,
      legendary: 2.0
    };
    // Apply multiplier to base stats
  }

  attachTo(ball) { ... }
  detach() { ... }
}
```

**Create:** `src/game/systems/WeaponSystem.js`
```javascript
class WeaponSystem {
  constructor(scene) {
    this.scene = scene;
    this.weapons = new Map();
  }

  equipWeapon(ball, weapon) {
    // Create weapon visual attached to ball
    // Set up weapon collision detection
  }

  handleWeaponHit(weapon, target) {
    // Calculate damage with weapon stats
    // Apply special effects
  }
}
```

---

### Task 3.2: Weapon RNG / Slot Spin

**Create:** `src/game/systems/WeaponRNG.js`
```javascript
class WeaponRNG {
  constructor() {
    this.tierOdds = {
      // volumeRank: { legendary, epic, rare, common }
      1: { legendary: 0.20, epic: 0.30, rare: 0.30, common: 0.20 },
      2: { legendary: 0.15, epic: 0.25, rare: 0.30, common: 0.30 },
      3: { legendary: 0.10, epic: 0.20, rare: 0.30, common: 0.40 },
      4: { legendary: 0.05, epic: 0.15, rare: 0.30, common: 0.50 },
      5: { legendary: 0.03, epic: 0.12, rare: 0.25, common: 0.60 }
    };
  }

  rollWeapon(volumeRank) {
    const odds = this.tierOdds[volumeRank];
    const tier = this.rollTier(odds);
    const type = this.rollType();
    return new Weapon(type, tier);
  }

  // For slot machine visual
  async spinSlots(ball, volumeRank) {
    // Returns animation sequence + final result
  }
}
```

---

## Phase 4: Boss

### Task 4.1: Boss Entity

**Create:** `src/game/entities/Boss.js`
```javascript
class Boss {
  constructor(config) {
    this.type = config.type;       // 'giant', 'fast', 'tank'
    this.hp = config.hp;           // 1000
    this.maxHp = config.hp;
    this.size = config.size || 80;
    this.attacks = config.attacks; // ['spin', 'slam', 'charge']

    this.phase = 1;                // Changes at HP thresholds
    this.isRaging = false;         // Below 25% HP

    this.weakSpot = { x: 0, y: 0, angle: 0 };
    this.weakSpotMultiplier = 3;
  }

  takeDamage(amount, attacker, hitWeakSpot) {
    const finalDamage = hitWeakSpot ? amount * this.weakSpotMultiplier : amount;
    this.hp -= finalDamage;

    // Track damage per ball for scoring
    this.damageTracking[attacker.name] += finalDamage;

    this.checkPhaseChange();
  }

  checkPhaseChange() {
    if (this.hp < this.maxHp * 0.25 && !this.isRaging) {
      this.enterRageMode();
    }
  }

  enterRageMode() {
    this.isRaging = true;
    this.attackSpeed *= 1.5;
    // Visual: red glow, particles
  }
}
```

---

### Task 4.2: Boss Attack Patterns

**Create:** `src/game/systems/BossAI.js`
```javascript
class BossAI {
  constructor(boss, scene) {
    this.boss = boss;
    this.scene = scene;
    this.currentAttack = null;
  }

  update(delta) {
    if (!this.currentAttack) {
      this.chooseNextAttack();
    }
    this.executeAttack(delta);
  }

  attacks = {
    spin: {
      windup: 500,
      duration: 2000,
      damage: 20,
      radius: 100,
      execute: () => {
        // Spin boss, damage all in radius
      }
    },
    slam: {
      windup: 800,
      duration: 500,
      damage: 40,
      radius: 60,
      execute: () => {
        // Jump up, slam down, AOE damage
      }
    },
    charge: {
      windup: 300,
      duration: 1000,
      damage: 30,
      execute: () => {
        // Charge at lowest HP ball
      }
    }
  };
}
```

---

## Phase 5: Polish & Integration

### Task 5.1: Multi-Stage Tournament

**Create:** `src/game/scenes/TournamentScene.js`
```javascript
class TournamentScene extends Phaser.Scene {
  constructor() {
    super('TournamentScene');
    this.currentStageIndex = 0;
    this.stages = [];
    this.ballScores = new Map();
  }

  async loadTournament(config) {
    this.stages = config.stages;
    this.initializeBalls(config.balls);
    await this.startStage(0);
  }

  async startStage(index) {
    const stage = this.stages[index];

    // Transition animation
    await this.playTransition(stage.type);

    // Load mode
    switch (stage.type) {
      case 'race':
        this.currentMode = new RaceMode(this, stage);
        break;
      case 'pvp':
        this.currentMode = new PvPMode(this, stage);
        break;
      case 'boss':
        this.currentMode = new BossMode(this, stage);
        break;
    }

    await this.currentMode.start();
  }

  async onStageComplete(results) {
    this.recordScores(results);

    if (this.currentStageIndex < this.stages.length - 1) {
      this.currentStageIndex++;
      await this.startStage(this.currentStageIndex);
    } else {
      this.showFinalResults();
    }
  }
}
```

---

### Task 5.2: Seamless Transitions

**Create:** `src/game/systems/TransitionSystem.js`
```javascript
class TransitionSystem {
  constructor(scene) {
    this.scene = scene;
  }

  async transition(fromMode, toMode) {
    // 1. Slow-mo current action
    this.scene.time.timeScale = 0.3;

    // 2. Camera zoom out
    await this.zoomCamera(0.5, 500);

    // 3. Transform arena (walls rise, boss emerges, etc)
    await this.transformArena(toMode);

    // 4. Camera zoom in
    await this.zoomCamera(1.0, 500);

    // 5. Resume normal speed
    this.scene.time.timeScale = 1.0;

    // Total transition: ~3 seconds
  }
}
```

---

## File Checklist

### Phase 1 Files
- [ ] `src/game/entities/Ball.js`
- [ ] `src/game/systems/VolumeSystem.js`
- [ ] `src/game/systems/StatsCalculator.js`
- [ ] `src/game/systems/ConfigSystem.js`
- [ ] `src/game/config/test-tournament.json`
- [ ] Update `index.html` with Volume Panel

### Phase 2 Files
- [ ] `src/game/modes/PvPMode.js`
- [ ] `src/game/systems/CritSystem.js`
- [ ] `src/ui/HPBar.js`
- [ ] `src/ui/DamagePopup.js`

### Phase 3 Files
- [ ] `src/game/entities/Weapon.js`
- [ ] `src/game/systems/WeaponSystem.js`
- [ ] `src/game/systems/WeaponRNG.js`
- [ ] `src/ui/SlotMachine.js`

### Phase 4 Files
- [ ] `src/game/entities/Boss.js`
- [ ] `src/game/systems/BossAI.js`
- [ ] `src/game/modes/BossMode.js`

### Phase 5 Files
- [ ] `src/game/scenes/TournamentScene.js`
- [ ] `src/game/systems/TransitionSystem.js`
- [ ] `src/game/systems/ScoringSystem.js`
- [ ] `src/ui/FinalResults.js`

---

## Quick Start Commands

```bash
# Start development
cd gmi-engine && npm run dev

# Build
npm run build

# Test specific config
# (Add config loader to UI, select from dropdown)
```

---

## AI Prompt Examples

To generate tournament configs, ask AI:

> "Create a GMI Racing tournament config with:
> - 5 balls with random volumes between 30k-60k
> - 3 stages: race, pvp, boss
> - Race on breakable-test map, 2 min
> - PvP with weapons and shrinking zone, 2.5 min
> - Boss fight with giant boss, 1000 HP, rage mode at 25%
> Output as JSON matching the config schema."

AI outputs valid JSON -> Paste into config file -> Run tournament

---

## Next Immediate Action

**Start with Task 1.1: Ball Stats System**

1. Create `src/game/entities/Ball.js`
2. Modify `RaceScene.js` to use Ball class
3. Add HP display
4. Test that balls have stats

Then move to Task 1.2: Fake Volume System
