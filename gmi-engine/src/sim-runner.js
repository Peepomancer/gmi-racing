/**
 * Simulation Runner v2 - Complete Rewrite
 * Uses Phaser's native scene data passing to avoid race conditions
 */

import Phaser from 'phaser';
import { MapGenerator } from './game/systems/MapGenerator.js';
import { BossSystem } from './game/systems/BossSystem.js';
import { WeaponSystem } from './game/systems/WeaponSystem.js';
import { ItemSystem } from './game/systems/ItemSystem.js';
import { InventorySystem } from './game/systems/InventorySystem.js';
import { RouletteSystem } from './game/systems/RouletteSystem.js';
import { volumeSystem } from './game/systems/VolumeSystem.js';
import { CHAIN_RACE_MAPS, CHAIN_BOSS_MAPS, CHAIN_MIXED, CHAIN_WEAPONS_TEST } from './game/systems/MapChain.js';

// Parse URL parameters
const params = new URLSearchParams(window.location.search);
const simId = params.get('simId') || '0';
const chainType = params.get('chainType') || 'mixed';
// Cap time scale at 4x to avoid physics glitches (balls phasing through walls)
const timeScale = Math.min(parseFloat(params.get('speed')) || 2, 4);
const visualMode = params.get('visual') === '1';

console.log(`[SimRunner ${simId}] Starting with chainType=${chainType}, speed=${timeScale}, visualMode=${visualMode}`);

// Get chain maps
const CHAINS = {
  'race': CHAIN_RACE_MAPS,
  'boss': CHAIN_BOSS_MAPS,
  'mixed': CHAIN_MIXED,
  'weapons': CHAIN_WEAPONS_TEST
};

const chainMaps = CHAINS[chainType] || CHAIN_MIXED;
console.log(`[SimRunner ${simId}] Loaded chain with ${chainMaps.length} maps`);
console.log(`[SimRunner ${simId}] First map: ${chainMaps[0]?.name}, obstacles: ${chainMaps[0]?.obstacles?.length}`);

// State
let currentMapIndex = 0;
let cumulativePoints = { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 };
let raceResults = [];

// Weapon statistics tracking
let weaponStats = {
  awarded: {}, // { PEA_SHOOTER: 5, SWORD: 3, ... }
  damageDealt: {}, // { PEA_SHOOTER: 1500, SWORD: 800, ... }
  ballWeapons: { Red: [], Blue: [], Green: [], Yellow: [], Purple: [] }
};

// Diagnostics tracking for debugging stuck balls, timeouts, etc.
let chainDiagnostics = {
  outOfBoundsRespawns: 0,
  stuckPushes: 0,
  raceTimeouts: 0,
  forceFinishedBalls: 0,
  ballsWithoutBody: 0,
  events: []
};

// Reward tiers (from RouletteSystem.js)
const REWARD_TIERS = {
  S: { items: ['HOMING_ORB', 'LIGHTNING', 'HAMMER'] },
  A: { items: ['SHOTGUN', 'SWORD', 'FLAIL'] },
  B: { items: ['PEA_SHOOTER', 'BOUNCY_SHOT', 'SPIKE'] },
  C: { items: ['SPEED_BUFF', 'SHIELD_BUFF', 'DAMAGE_BUFF'] }
};

// Odds by placement (1st gets better weapons)
const PLACEMENT_ODDS = {
  1: { S: 30, A: 40, B: 20, C: 10 },
  2: { S: 20, A: 35, B: 30, C: 15 },
  3: { S: 10, A: 30, B: 40, C: 20 },
  4: { S: 5, A: 20, B: 45, C: 30 },
  5: { S: 2, A: 15, B: 43, C: 40 }
};

// Weapon definitions (simplified for simulation)
// Melee weapons BUFFED for balance - they were dealing < 10% of total damage before
const WEAPON_DEFS = {
  // Projectile weapons (with explicit range)
  PEA_SHOOTER: { name: 'Pea Shooter', damage: 5, cooldown: 800, range: 200, type: 'projectile' },
  SHOTGUN: { name: 'Shotgun', damage: 15, cooldown: 1200, range: 200, type: 'projectile' },
  HOMING_ORB: { name: 'Homing Orb', damage: 8, cooldown: 1500, range: 250, type: 'projectile' },
  BOUNCY_SHOT: { name: 'Bouncy Shot', damage: 4, cooldown: 1000, range: 200, type: 'projectile' },
  // Melee weapons - BUFFED damage and range
  SWORD: { name: 'Sword', damage: 25, cooldown: 600, range: 120, type: 'melee' },
  FLAIL: { name: 'Flail', damage: 12, cooldown: 400, range: 100, type: 'melee' },
  SPIKE: { name: 'Spike Aura', damage: 18, cooldown: 500, range: 90, type: 'melee' },
  HAMMER: { name: 'Hammer', damage: 45, cooldown: 1800, range: 130, type: 'melee' },
  // Area weapons
  LIGHTNING: { name: 'Lightning', damage: 20, cooldown: 3000, range: 300, type: 'area' },
  // Buffs (unchanged)
  SPEED_BUFF: { name: 'Speed Boost', damage: 0, cooldown: 0, type: 'buff', effect: 'speed' },
  SHIELD_BUFF: { name: 'Shield', damage: 0, cooldown: 0, type: 'buff', effect: 'shield' },
  DAMAGE_BUFF: { name: 'Damage Up', damage: 0, cooldown: 0, type: 'buff', effect: 'damage', multiplier: 2 }
};

// Centralized configuration for simulation parameters
// All magic numbers extracted here for easy tuning
const SIM_CONFIG = {
  // Ball physics
  ball: {
    radius: 15,
    defaultSpeed: 5,
    restitution: 1,
    friction: 0,
    frictionAir: 0,
    hp: 100,
    baseDamage: 10
  },

  // Safety systems - prevent stuck balls and infinite races
  safety: {
    outOfBoundsMargin: 50,        // pixels beyond map edge to detect escape
    stuckCheckInterval: 60,       // frames between stuck checks (~1s at 60fps)
    stuckThreshold: 5,            // consecutive stuck checks before push
    stuckMinMovement: 2,          // min pixels moved to not be stuck
    raceTimeoutMs: 30000,         // 30s max per race (real time)
    globalTimeoutMs: 45000        // 45s max per scene total
  },

  // Points awarded by position
  points: {
    position: [10, 8, 6, 4, 2]    // 1st through 5th place
  }
};

// Initialize volume system
volumeSystem.initialize();

// Ball config
const BALL_CONFIG = {
  radius: 15,
  colors: [
    { name: "Red", color: "#ff4444" },
    { name: "Blue", color: "#4444ff" },
    { name: "Green", color: "#44ff44" },
    { name: "Yellow", color: "#ffff44" },
    { name: "Purple", color: "#ff44ff" }
  ]
};

// Shuffle array helper (Fisher-Yates)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Instant roulette - assign weapons based on placement (no animation)
function runInstantRoulette(results) {
  console.log(`[SimRunner ${simId}] Running instant roulette for ${results.length} balls`);

  const awards = [];

  results.forEach((result, idx) => {
    const position = result.position;
    const odds = PLACEMENT_ODDS[position] || PLACEMENT_ODDS[5];

    // Roll for tier
    const roll = Math.random() * 100;
    let tier = 'C';
    let cumulative = 0;

    for (const [t, chance] of Object.entries(odds)) {
      cumulative += chance;
      if (roll < cumulative) {
        tier = t;
        break;
      }
    }

    // Get random item from tier
    const tierItems = REWARD_TIERS[tier].items;
    const weaponId = tierItems[Math.floor(Math.random() * tierItems.length)];
    const weaponDef = WEAPON_DEFS[weaponId];

    // Track weapon award
    weaponStats.awarded[weaponId] = (weaponStats.awarded[weaponId] || 0) + 1;
    weaponStats.ballWeapons[result.name].push(weaponId);

    awards.push({
      ballName: result.name,
      position,
      tier,
      weaponId,
      weaponName: weaponDef?.name || weaponId
    });

    console.log(`[Roulette] ${result.name} (${position}${getOrdinal(position)}) -> ${tier}-Tier: ${weaponDef?.name || weaponId}`);
  });

  return awards;
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Custom RaceScene for simulation - self-contained with all map data
 */
class SimRaceScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SimRaceScene' });
    this.balls = [];
    this.obstacles = [];
    this.isRacing = false;
    this.finishedCount = 0;
  }

  init(data) {
    // Reset ALL state for clean restart
    this.balls = [];
    this.obstacles = [];
    this.isRacing = false;
    this.finishedCount = 0;
    this.countdownStarted = false;
    this.countdown = 0;
    this.countdownTimer = null;
    this.countdownText = null;
    this.frameCount = 0;
    this.hasBoss = false;
    this.bossDamageByBall = { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 };
    this.lastDamageTime = 0;

    // Use global diagnostics (persists across scene restarts within chain)
    this.diagnostics = chainDiagnostics;

    // Reset global timeout tracking for new scene
    this.sceneStartRealTime = Date.now();
    this.globalTimeoutTriggered = false;

    // Receive map data - either from scene start data or from global variable
    if (data && data.mapData) {
      this.mapData = data.mapData;
      this.mapName = data.mapName;
    } else if (window.__simMapData) {
      // Fall back to global map data (for initial scene start)
      this.mapData = window.__simMapData;
      this.mapName = window.__simMapData?.name || 'Level 1';
    }
    this.timeScale = data?.timeScale || timeScale || 2;
    console.log(`[SimRunner ${simId}] init() map: ${this.mapName}, obstacles: ${this.mapData?.obstacles?.length}, mapIndex: ${currentMapIndex}`);
  }

  create() {
    console.log(`[SimRaceScene] create() called`);

    this.gameWidth = this.sys.game.config.width;
    this.gameHeight = this.sys.game.config.height;

    console.log(`[SimRaceScene] Game dimensions: ${this.gameWidth}x${this.gameHeight}`);

    // Create graphics layers with proper depth ordering
    this.bgLayer = this.add.graphics().setDepth(0);
    this.obstacleLayer = this.add.graphics().setDepth(1);
    this.finishLayer = this.add.graphics().setDepth(2);
    // Ball graphics will be depth 10

    // Initialize systems
    this.bossSystem = new BossSystem(this);
    this.weaponSystem = new WeaponSystem(this);
    this.itemSystem = new ItemSystem(this);
    this.inventorySystem = new InventorySystem(this);

    // Render the map
    this.renderMap();

    // Create balls
    this.createBalls();

    // Setup collision handling
    this.setupCollisions();

    // Apply time scale to physics and game time
    console.log(`[SimRunner ${simId}] Applying timeScale: ${this.timeScale}`);
    this.matter.world.engine.timing.timeScale = this.timeScale;
    this.time.timeScale = this.timeScale;

    // Debug overlay
    this.debugText = this.add.text(5, 5, '', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 }
    }).setDepth(1000);
    this.updateDebugText();

    // Auto-start race after short delay (adjusted for time scale)
    this.time.delayedCall(500 / this.timeScale, () => {
      this.startRace();
    });

    console.log(`[SimRaceScene] Created with ${this.obstacles.length} obstacles, ${this.balls.length} balls`);
  }

  renderMap() {
    const map = this.mapData;
    if (!map) {
      console.error('[SimRaceScene] No map data!');
      return;
    }

    // Background
    this.bgLayer.fillStyle(0xe8e0d0, 1);
    this.bgLayer.fillRect(0, 0, this.gameWidth, this.gameHeight);

    // Walls
    const wallThickness = 10;
    const wallBodies = [
      this.matter.add.rectangle(wallThickness/2, this.gameHeight/2, wallThickness, this.gameHeight, { isStatic: true, label: 'wall' }),
      this.matter.add.rectangle(this.gameWidth - wallThickness/2, this.gameHeight/2, wallThickness, this.gameHeight, { isStatic: true, label: 'wall' }),
      this.matter.add.rectangle(this.gameWidth/2, wallThickness/2, this.gameWidth, wallThickness, { isStatic: true, label: 'wall' }),
      this.matter.add.rectangle(this.gameWidth/2, this.gameHeight - wallThickness/2, this.gameWidth, wallThickness, { isStatic: true, label: 'wall' })
    ];

    this.obstacleLayer.fillStyle(0x2d3748, 1);
    this.obstacleLayer.fillRect(0, 0, wallThickness, this.gameHeight);
    this.obstacleLayer.fillRect(this.gameWidth - wallThickness, 0, wallThickness, this.gameHeight);

    // Render obstacles
    console.log(`[SimRaceScene] Rendering ${map.obstacles?.length || 0} obstacles`);

    (map.obstacles || []).forEach((obs, i) => {
      const color = obs.color ? parseInt(obs.color.replace('#', ''), 16) : 0x4a5568;
      const angle = (obs.angle || 0) * Math.PI / 180;

      let body;
      if (obs.type === 'circle') {
        body = this.matter.add.circle(obs.x, obs.y, obs.radius, {
          isStatic: true,
          friction: 0,
          restitution: 1,
          label: 'obstacle'
        });
        this.obstacleLayer.fillStyle(color, 1);
        this.obstacleLayer.fillCircle(obs.x, obs.y, obs.radius);
      } else {
        const cx = obs.x + (obs.width || 50) / 2;
        const cy = obs.y + (obs.height || 20) / 2;

        body = this.matter.add.rectangle(cx, cy, obs.width || 50, obs.height || 20, {
          isStatic: true,
          friction: 0,
          restitution: 1,
          angle: angle,
          label: 'obstacle'
        });

        // Draw rotated rectangle
        if (angle !== 0) {
          const graphics = this.add.graphics();
          graphics.fillStyle(color, 1);
          graphics.fillRect(-(obs.width || 50)/2, -(obs.height || 20)/2, obs.width || 50, obs.height || 20);
          graphics.x = cx;
          graphics.y = cy;
          graphics.rotation = angle;
        } else {
          this.obstacleLayer.fillStyle(color, 1);
          this.obstacleLayer.fillRect(obs.x, obs.y, obs.width || 50, obs.height || 20);
        }
      }

      this.obstacles.push({ body, data: obs });
    });

    // Render finish zone
    if (map.finishZone) {
      const fz = map.finishZone;
      this.finishZone = fz;

      // Checkered pattern
      const tileSize = 15;
      const cols = Math.ceil(fz.width / tileSize);
      const rows = Math.ceil(fz.height / tileSize);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const isWhite = (row + col) % 2 === 0;
          this.finishLayer.fillStyle(isWhite ? 0xffffff : 0x000000, 1);
          this.finishLayer.fillRect(
            fz.x + col * tileSize,
            fz.y + row * tileSize,
            Math.min(tileSize, fz.x + fz.width - (fz.x + col * tileSize)),
            Math.min(tileSize, fz.y + fz.height - (fz.y + row * tileSize))
          );
        }
      }

      // "FINISH" text
      this.add.text(fz.x + fz.width/2, fz.y + fz.height/2, 'FINISH', {
        fontSize: '14px',
        color: '#ff0000',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    // Render spawn zone (visual only)
    if (map.startZone) {
      const sz = map.startZone;
      this.spawnZone = sz;
      this.bgLayer.fillStyle(0x00ff88, 0.15);
      this.bgLayer.fillRect(sz.x, sz.y, sz.width, sz.height);
    }

    // Spawn boss if configured
    if (map.bossConfig) {
      const cfg = map.bossConfig;
      const mapHeight = map.height || 600;
      const scaleY = this.gameHeight / mapHeight;
      const bossY = cfg.y * scaleY;

      this.time.delayedCall(300, () => {
        this.bossSystem.spawn(cfg.x, bossY, {
          width: cfg.width,
          height: cfg.height,
          health: cfg.health,
          color: cfg.color
        });
        this.bossSystem.setPattern(cfg.pattern);
        this.hasBoss = true;
        console.log(`[SimRunner ${simId}] Boss spawned at (${cfg.x}, ${bossY}), pattern: ${cfg.pattern}`);
      });
    }
  }

  createBalls() {
    const count = 5;
    const radius = BALL_CONFIG.radius;

    // Randomize spawn order to remove positional bias
    const shuffledColors = shuffleArray(BALL_CONFIG.colors);

    // Get map dimensions for scaling
    const mapHeight = this.mapData?.height || 600;
    const scaleY = this.gameHeight / mapHeight;

    // Calculate spawn positions
    let positions;
    if (this.spawnZone) {
      const laneWidth = this.spawnZone.width / count;
      // Scale Y position to fit our game height
      let spawnY = this.spawnZone.y * scaleY + (this.spawnZone.height * scaleY) / 2;
      // Ensure balls spawn within visible area
      spawnY = Math.min(spawnY, this.gameHeight - radius - 10);

      positions = Array.from({ length: count }, (_, i) => ({
        x: this.spawnZone.x + laneWidth * i + laneWidth / 2,
        y: spawnY
      }));
    } else {
      const laneWidth = (this.gameWidth - 40) / count;
      positions = Array.from({ length: count }, (_, i) => ({
        x: 20 + laneWidth * i + laneWidth / 2,
        y: this.gameHeight - 60
      }));
    }

    for (let i = 0; i < count; i++) {
      const colorData = shuffledColors[i]; // Use shuffled order
      const pos = positions[i];

      const body = this.matter.add.circle(pos.x, pos.y, radius, {
        restitution: SIM_CONFIG.ball.restitution,
        friction: SIM_CONFIG.ball.friction,
        frictionAir: SIM_CONFIG.ball.frictionAir,
        label: 'ball'
      });

      const graphics = this.add.graphics();
      graphics.setDepth(10); // Above obstacles and finish line

      const colorNum = parseInt(colorData.color.replace('#', ''), 16);
      graphics.lineStyle(3, 0x000000, 1);
      graphics.strokeCircle(0, 0, radius);
      graphics.fillStyle(colorNum, 1);
      graphics.fillCircle(0, 0, radius - 2);
      // Eyes
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(-radius/3 - 3, -radius/4, 6, 6);
      graphics.fillRect(radius/3 - 3, -radius/4, 6, 6);
      graphics.fillStyle(0x000000, 1);
      graphics.fillRect(-radius/3 - 1, -radius/4 + 2, 2, 2);
      graphics.fillRect(radius/3 - 1, -radius/4 + 2, 2, 2);

      // Position graphics immediately at spawn position
      graphics.x = pos.x;
      graphics.y = pos.y;

      // EQUAL STATS for all balls (fair racing - bypasses VolumeSystem)
      // This ensures ~20% win rate for each ball instead of Red/Blue dominance
      const stats = { hp: SIM_CONFIG.ball.hp, maxHp: SIM_CONFIG.ball.hp, speed: 1.0 };

      // EQUAL DAMAGE for all balls (fair boss fights)
      // Weapons determine damage output instead
      const baseDamage = SIM_CONFIG.ball.baseDamage;

      // Get weapons this ball has from previous rounds
      const ballWeapons = weaponStats.ballWeapons[colorData.name] || [];

      this.balls.push({
        body,
        graphics,
        name: colorData.name,
        color: colorData.color,
        radius,
        finished: false,
        finishPosition: null,
        hp: stats?.hp || SIM_CONFIG.ball.hp,
        maxHp: stats?.maxHp || SIM_CONFIG.ball.hp,
        speed: stats?.speed || 1.0,
        damage: baseDamage,
        weapons: ballWeapons.map(id => ({
          id,
          def: WEAPON_DEFS[id],
          lastFired: 0,
          damageDealt: 0
        })),
        buffs: []
      });

      console.log(`[SimRaceScene] Created ball ${colorData.name} at (${pos.x}, ${pos.y}), weapons: ${ballWeapons.length}`);
    }
  }

  setupCollisions() {
    this.matter.world.on('collisionstart', (event) => {
      if (!this.isRacing) return;

      event.pairs.forEach(pair => {
        const ballBody = pair.bodyA.label === 'ball' ? pair.bodyA :
                        (pair.bodyB.label === 'ball' ? pair.bodyB : null);
        const otherBody = ballBody === pair.bodyA ? pair.bodyB : pair.bodyA;

        if (!ballBody) return;

        const ball = this.balls.find(b => b.body === ballBody);
        if (!ball || ball.finished) return;

        // Bounce with randomness
        const vel = ballBody.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        if (speed > 0.1) {
          const effectiveSpeed = SIM_CONFIG.ball.defaultSpeed * (ball.speed || 1.0);
          const twist = (Math.random() - 0.5) * 0.6;
          const currentAngle = Math.atan2(vel.y, vel.x);

          // Reflect and add twist
          let newAngle;
          if (otherBody.label === 'wall' || otherBody.label === 'obstacle') {
            const normal = pair.collision.normal;
            const dot = vel.x * normal.x + vel.y * normal.y;
            const reflectX = vel.x - 2 * dot * normal.x;
            const reflectY = vel.y - 2 * dot * normal.y;
            newAngle = Math.atan2(reflectY, reflectX) + twist;
          } else {
            newAngle = currentAngle + Math.PI + twist;
          }

          this.matter.body.setVelocity(ballBody, {
            x: Math.cos(newAngle) * effectiveSpeed,
            y: Math.sin(newAngle) * effectiveSpeed
          });
        }
      });
    });
  }

  startRace() {
    this.isRacing = true;
    this.finishedCount = 0;
    this.raceStartTime = this.time.now;
    this.raceStartRealTime = Date.now(); // Use real time for timeout (not affected by timeScale)

    // Initialize ball tracking for stuck detection
    this.balls.forEach(ball => {
      ball.stuckFrames = 0;
      ball.lastPosition = ball.body ? { x: ball.body.position.x, y: ball.body.position.y } : null;
    });

    // Give balls initial velocity
    this.balls.forEach(ball => {
      const speed = 5 * (ball.speed || 1.0);
      const angle = -Math.PI/2 + (Math.random() - 0.5) * 0.5; // Mostly upward
      this.matter.body.setVelocity(ball.body, {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      });
    });

    console.log(`[SimRaceScene] Race started!`);
  }

  updateAutoFire(delta) {
    // Weapon-based boss damage system
    // Each ball fires their weapons at the boss based on cooldowns
    const now = this.time.now;

    if (!this.bossSystem?.boss?.body) return;
    const bossPos = this.bossSystem.boss.body.position;
    const bossSize = this.bossSystem.boss.width || 100;

    this.balls.forEach(ball => {
      if (ball.finished || !ball.body) return;

      const ballPos = ball.body.position;
      const dx = ballPos.x - bossPos.x;
      const dy = ballPos.y - bossPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base collision damage (equal for all - 10 damage, cooldown 1000ms)
      if (!ball.lastCollisionDamage) ball.lastCollisionDamage = 0;
      if (dist < bossSize + 30 && now - ball.lastCollisionDamage > 1000) {
        const damage = ball.damage; // Base 10 damage
        this.dealBossDamage(ball, damage, 'collision');
        ball.lastCollisionDamage = now;
      }

      // Fire each weapon
      if (ball.weapons && ball.weapons.length > 0) {
        ball.weapons.forEach(weapon => {
          if (!weapon.def) return;

          const cooldown = weapon.def.cooldown || 1000;
          if (now - weapon.lastFired < cooldown) return;

          // Check range - use weapon-specific range if defined
          const range = weapon.def.range || (weapon.def.type === 'melee' ? 80 : 200);
          if (dist > range) return;

          // Fire weapon
          weapon.lastFired = now;

          // Calculate damage (apply damage buff if present)
          let damage = weapon.def.damage || 5;
          const hasDamageBuff = ball.buffs?.includes('DAMAGE_BUFF');
          if (hasDamageBuff) damage *= 2;

          // Visual mode - show projectile
          if (visualMode && weapon.def.type === 'projectile') {
            this.createVisualProjectile(ball, bossPos, weapon);
          } else if (visualMode && weapon.def.type === 'melee') {
            this.createMeleeEffect(ball, weapon);
          }

          // Deal damage
          this.dealBossDamage(ball, damage, weapon.id);
          weapon.damageDealt += damage;
        });
      }
    });
  }

  createVisualProjectile(ball, targetPos, weapon) {
    const ballPos = ball.body.position;
    const color = parseInt(ball.color.replace('#', ''), 16);

    // Create projectile circle
    const proj = this.add.circle(ballPos.x, ballPos.y, 4, color).setDepth(15);

    // Animate toward boss
    const dx = targetPos.x - ballPos.x;
    const dy = targetPos.y - ballPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Math.max(100, dist * 2);

    this.tweens.add({
      targets: proj,
      x: targetPos.x,
      y: targetPos.y,
      duration: duration / this.timeScale,
      onComplete: () => {
        // Flash on hit
        const flash = this.add.circle(targetPos.x, targetPos.y, 8, 0xffff00).setDepth(16);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          scale: 2,
          duration: 150 / this.timeScale,
          onComplete: () => flash.destroy()
        });
        proj.destroy();
      }
    });
  }

  createMeleeEffect(ball, weapon) {
    const ballPos = ball.body.position;
    const color = parseInt(ball.color.replace('#', ''), 16);

    // Create expanding ring for melee
    const ring = this.add.circle(ballPos.x, ballPos.y, 15, color, 0).setDepth(15);
    ring.setStrokeStyle(2, color);

    this.tweens.add({
      targets: ring,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 200 / this.timeScale,
      onComplete: () => ring.destroy()
    });
  }

  updateBossProjectileVisuals() {
    // Track boss projectiles with visual circles
    if (!this.bossSystem?.projectiles) return;

    // Initialize visual tracking
    if (!this.bossProjectileVisuals) {
      this.bossProjectileVisuals = new Map();
    }

    // Update/create visuals for each projectile
    this.bossSystem.projectiles.forEach((proj, idx) => {
      if (!proj.body) return;

      const pos = proj.body.position;
      let visual = this.bossProjectileVisuals.get(proj);

      if (!visual) {
        // Create visual for new projectile
        visual = this.add.circle(pos.x, pos.y, 6, 0xff4444).setDepth(14);
        visual.setStrokeStyle(2, 0xff0000);
        this.bossProjectileVisuals.set(proj, visual);
      } else {
        // Update position
        visual.x = pos.x;
        visual.y = pos.y;
      }
    });

    // Clean up visuals for destroyed projectiles
    this.bossProjectileVisuals.forEach((visual, proj) => {
      if (!proj.body || !this.bossSystem.projectiles.includes(proj)) {
        visual.destroy();
        this.bossProjectileVisuals.delete(proj);
      }
    });
  }

  dealBossDamage(ball, damage, source) {
    // Track damage for statistics
    this.bossDamageByBall[ball.name] = (this.bossDamageByBall[ball.name] || 0) + damage;

    // Track damage by weapon type globally
    weaponStats.damageDealt[source] = (weaponStats.damageDealt[source] || 0) + damage;

    const bossDied = this.bossSystem.takeDamage(damage);

    if (bossDied) {
      console.log(`[SimRunner ${simId}] Boss killed by ${ball.name} using ${source}!`);
      console.log(`[SimRunner ${simId}] Damage totals:`, this.bossDamageByBall);
      console.log(`[SimRunner ${simId}] Weapon damage stats:`, weaponStats.damageDealt);
      this.onBossDefeated();
    }
  }

  onBossDefeated() {
    if (!this.isRacing) return;
    this.isRacing = false;

    // Rank balls by damage dealt to boss (most damage = 1st place)
    const rankings = Object.entries(this.bossDamageByBall)
      .sort((a, b) => b[1] - a[1])
      .map(([name, damage], idx) => ({
        name,
        position: idx + 1,
        damage: Math.round(damage)
      }));

    console.log(`[SimRunner ${simId}] Boss rankings:`, rankings);

    // Mark balls as finished with their positions
    rankings.forEach(r => {
      const ball = this.balls.find(b => b.name === r.name);
      if (ball) {
        ball.finished = true;
        ball.finishPosition = r.position;
        ball.bossDamage = r.damage;
      }
    });

    this.finishedCount = this.balls.length;

    // Convert to standard results format
    const results = rankings.map(r => ({ name: r.name, position: r.position }));

    // Track points (same as regular race)
    results.forEach((r, idx) => {
      const points = SIM_CONFIG.points.position[idx] || 0;
      cumulativePoints[r.name] += points;
    });

    raceResults.push({
      level: currentMapIndex + 1,
      mapName: this.mapName,
      winner: results[0]?.name,
      results,
      isBoss: true,
      bossDamage: this.bossDamageByBall
    });

    // Report to parent
    reportRaceComplete(results[0]?.name, currentMapIndex + 1, chainMaps.length, this.mapName, results);

    // Next map
    currentMapIndex++;
    console.log(`[SimRunner ${simId}] Boss defeated, moving to map ${currentMapIndex + 1}/${chainMaps.length}`);

    if (currentMapIndex < chainMaps.length) {
      this.time.delayedCall(800, () => {
        console.log(`[SimRunner ${simId}] Loading next map after boss`);
        loadNextMap();
      });
    } else {
      this.time.delayedCall(800, () => finishChain());
    }
  }

  updateDebugText() {
    if (this.debugText) {
      const finished = this.finishedCount || 0;
      const total = this.balls?.length || 0;
      const mapIdx = currentMapIndex + 1;
      const totalMaps = chainMaps.length;
      const countdown = this.countdown > 0 ? ` T:${this.countdown}` : '';
      this.debugText.setText(`L${mapIdx}/${totalMaps} F:${finished}/${total}${countdown}`);
    }
  }

  // Check for balls that have escaped the map and respawn them
  checkOutOfBounds() {
    // Use actual game dimensions
    const mapWidth = this.gameWidth || 800;
    const mapHeight = this.gameHeight || 600;
    const margin = SIM_CONFIG.safety.outOfBoundsMargin;

    this.balls.forEach(ball => {
      if (ball.finished || !ball.body) return;

      const pos = ball.body.position;
      const isOutOfBounds =
        pos.x < -margin ||
        pos.x > mapWidth + margin ||
        pos.y < -margin ||
        pos.y > mapHeight + margin ||
        !isFinite(pos.x) || !isFinite(pos.y); // Also catch NaN/Infinity

      if (isOutOfBounds) {
        console.log(`[SimRaceScene] ${ball.name} out of bounds at (${pos.x?.toFixed(0) || 'NaN'}, ${pos.y?.toFixed(0) || 'NaN'}), respawning...`);

        // Track diagnostic
        this.diagnostics.outOfBoundsRespawns++;
        this.diagnostics.events.push({
          type: 'outOfBounds',
          ball: ball.name,
          position: { x: pos.x, y: pos.y },
          map: this.mapName,
          time: Date.now()
        });

        // Respawn at a safe position near center of map
        const safeX = mapWidth / 2 + (Math.random() - 0.5) * 100;
        const safeY = mapHeight / 2 + (Math.random() - 0.5) * 100;

        this.matter.body.setPosition(ball.body, { x: safeX, y: safeY });
        this.matter.body.setVelocity(ball.body, { x: (Math.random() - 0.5) * 4, y: -2 });

        // Update graphics immediately
        if (ball.graphics) {
          ball.graphics.x = safeX;
          ball.graphics.y = safeY;
        }

        // Reset stuck counter
        ball.stuckFrames = 0;
        ball.lastPosition = { x: safeX, y: safeY };
      }
    });
  }

  // Check for balls that are stuck (not moving) and handle them
  checkStuckBalls() {
    // Only check every N frames (~1 second at 60fps)
    if (this.frameCount % SIM_CONFIG.safety.stuckCheckInterval !== 0) return;

    const STUCK_THRESHOLD = SIM_CONFIG.safety.stuckThreshold;
    const MIN_MOVEMENT = SIM_CONFIG.safety.stuckMinMovement;

    this.balls.forEach(ball => {
      if (ball.finished || !ball.body) return;

      const pos = ball.body.position;

      // Initialize tracking if needed
      if (!ball.lastPosition) {
        ball.lastPosition = { x: pos.x, y: pos.y };
        ball.stuckFrames = 0;
        return;
      }

      // Calculate how much the ball has moved
      const dx = pos.x - ball.lastPosition.x;
      const dy = pos.y - ball.lastPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < MIN_MOVEMENT) {
        ball.stuckFrames = (ball.stuckFrames || 0) + 1;

        if (ball.stuckFrames >= STUCK_THRESHOLD) {
          console.log(`[SimRaceScene] ${ball.name} appears stuck at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}), giving it a push...`);

          // Track diagnostic
          this.diagnostics.stuckPushes++;
          this.diagnostics.events.push({
            type: 'stuckPush',
            ball: ball.name,
            position: { x: pos.x, y: pos.y },
            map: this.mapName,
            time: Date.now()
          });

          // Give the ball a random push to unstick it
          const pushX = (Math.random() - 0.5) * 8;
          const pushY = (Math.random() - 0.5) * 8 - 2; // Slight upward bias toward finish
          this.matter.body.setVelocity(ball.body, { x: pushX, y: pushY });

          ball.stuckFrames = 0;
        }
      } else {
        ball.stuckFrames = 0;
      }

      // Update last position
      ball.lastPosition = { x: pos.x, y: pos.y };
    });
  }

  // Global watchdog - catches stuck scenes even when isRacing is false
  checkGlobalTimeout() {
    // Initialize scene start time if not set
    if (!this.sceneStartRealTime) {
      this.sceneStartRealTime = Date.now();
    }

    const elapsed = Date.now() - this.sceneStartRealTime;
    const GLOBAL_TIMEOUT_MS = SIM_CONFIG.safety.globalTimeoutMs;

    if (elapsed > GLOBAL_TIMEOUT_MS && !this.globalTimeoutTriggered) {
      this.globalTimeoutTriggered = true;
      console.log(`[SimRaceScene] GLOBAL TIMEOUT after ${(elapsed / 1000).toFixed(0)}s - scene appears stuck (isRacing: ${this.isRacing})`);

      // Track diagnostic
      this.diagnostics.raceTimeouts++;
      this.diagnostics.events.push({
        type: 'globalTimeout',
        isRacing: this.isRacing,
        finishedCount: this.finishedCount,
        map: this.mapName,
        time: Date.now()
      });

      // Force the race to complete
      if (!this.isRacing) {
        // Race never started or already ended - just advance to next map
        console.log(`[SimRaceScene] Forcing advance to next map`);
        this.forceAdvanceToNextMap();
      } else {
        // Race is running but stuck - force finish all balls
        this.balls.filter(b => !b.finished).forEach(ball => {
          ball.finished = true;
          this.finishedCount++;
          ball.finishPosition = this.finishedCount;
          this.diagnostics.forceFinishedBalls++;
          if (ball.body) {
            this.matter.world.remove(ball.body);
            ball.body = null;
          }
        });
        // Trigger race complete
        this.onRaceComplete();
      }
    }
  }

  // Force advance when stuck in non-racing state
  forceAdvanceToNextMap() {
    // Create fake results based on current state
    const results = this.balls.map((ball, idx) => ({
      name: ball.name,
      position: ball.finishPosition || (idx + 1)
    })).sort((a, b) => a.position - b.position);

    // Award points
    results.forEach((r, idx) => {
      const points = SIM_CONFIG.points.position[idx] || 0;
      cumulativePoints[r.name] += points;
    });

    raceResults.push({
      level: currentMapIndex + 1,
      mapName: this.mapName || 'Unknown',
      winner: results[0]?.name || 'Unknown',
      results,
      forcedByTimeout: true
    });

    reportRaceComplete(results[0]?.name, currentMapIndex + 1, chainMaps.length, this.mapName, results);
    currentMapIndex++;

    if (currentMapIndex < chainMaps.length) {
      console.log(`[SimRunner ${simId}] Force loading next map`);
      loadNextMap();
    } else {
      finishChain();
    }
  }

  // Race timeout - force complete if taking too long
  checkRaceTimeout() {
    // Use real time (Date.now) instead of game time for consistent timeout
    if (!this.raceStartRealTime) {
      this.raceStartRealTime = Date.now();
    }

    const elapsed = Date.now() - this.raceStartRealTime;
    const TIMEOUT_MS = SIM_CONFIG.safety.raceTimeoutMs;

    if (elapsed > TIMEOUT_MS) {
      console.log(`[SimRaceScene] Race timeout after ${(elapsed / 1000).toFixed(0)}s real time, force completing...`);

      // Track diagnostic
      this.diagnostics.raceTimeouts++;

      // Force-finish all remaining balls
      // Include balls with no body (they vanished) - sort by finished status
      const unfinished = this.balls
        .filter(b => !b.finished)
        .sort((a, b) => {
          // Balls with bodies sorted by Y position (closest to finish first)
          if (a.body && b.body) return a.body.position.y - b.body.position.y;
          // Balls with bodies come before balls without
          if (a.body && !b.body) return -1;
          if (!a.body && b.body) return 1;
          return 0;
        });

      unfinished.forEach(ball => {
        ball.finished = true;
        this.finishedCount++;
        ball.finishPosition = this.finishedCount;
        const hadBody = !!ball.body;
        console.log(`[SimRaceScene] Force-finished ${ball.name} in position ${this.finishedCount} (had body: ${hadBody})`);

        // Track diagnostic
        this.diagnostics.forceFinishedBalls++;
        if (!hadBody) this.diagnostics.ballsWithoutBody++;
        this.diagnostics.events.push({
          type: 'forceFinish',
          ball: ball.name,
          hadBody: hadBody,
          position: ball.body ? { x: ball.body.position.x, y: ball.body.position.y } : null,
          map: this.mapName,
          time: Date.now()
        });

        if (ball.body) {
          this.matter.world.remove(ball.body);
          ball.body = null;
        }
      });

      // This will trigger onRaceComplete on next update
    }
  }

  update(time, delta) {
    this.frameCount = (this.frameCount || 0) + 1;

    // Update debug display every 30 frames
    if (this.frameCount % 30 === 0) {
      this.updateDebugText();
    }

    // Global watchdog - runs even if isRacing is false
    // Catches cases where scene gets stuck before/after race
    this.checkGlobalTimeout();

    if (!this.isRacing) return;

    // Update ball graphics positions
    this.balls.forEach(ball => {
      if (ball.graphics && ball.body) {
        ball.graphics.x = ball.body.position.x;
        ball.graphics.y = ball.body.position.y;
      }
    });

    // Ball safety checks
    this.checkOutOfBounds();    // Respawn balls that escaped the map
    this.checkStuckBalls();     // Push balls that are stuck
    this.checkRaceTimeout();    // Force-complete if race takes too long

    // Check finish zone
    if (this.finishZone) {
      this.balls.forEach(ball => {
        if (ball.finished) return;

        const pos = ball.body.position;
        const fz = this.finishZone;

        if (pos.x >= fz.x && pos.x <= fz.x + fz.width &&
            pos.y >= fz.y && pos.y <= fz.y + fz.height) {
          ball.finished = true;
          this.finishedCount++;
          ball.finishPosition = this.finishedCount;
          console.log(`[SimRaceScene] ${ball.name} finished in position ${this.finishedCount}`);

          // Remove ball from physics world so it doesn't block others
          this.matter.world.remove(ball.body);

          // Move graphics to podium area (bottom of finish zone)
          const podiumX = this.finishZone.x + 20 + (this.finishedCount - 1) * 25;
          const podiumY = this.finishZone.y + this.finishZone.height - 20;
          ball.graphics.x = podiumX;
          ball.graphics.y = podiumY;
          ball.graphics.setScale(0.7); // Shrink a bit
        }
      });

      // Check if race complete
      if (this.finishedCount >= this.balls.length) {
        this.onRaceComplete();
        return;
      }

      // Start countdown when half have finished
      const halfCount = Math.ceil(this.balls.length / 2);
      if (!this.countdownStarted && this.finishedCount >= halfCount) {
        this.countdownStarted = true;
        this.countdown = 8; // 8 seconds real-time
        console.log(`[SimRunner ${simId}] Half finished (${this.finishedCount}/${this.balls.length}), starting ${this.countdown}s countdown`);

        // Create countdown display
        this.countdownText = this.add.text(this.gameWidth / 2, 30, `TIME: ${this.countdown}s`, {
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#ff6600',
          backgroundColor: '#000000',
          padding: { x: 8, y: 4 }
        }).setOrigin(0.5).setDepth(100);

        // Countdown timer - use REAL time (1000ms), not game time
        this.countdownTimer = this.time.addEvent({
          delay: 1000, // Always 1 second real time
          repeat: this.countdown - 1,
          callback: () => {
            this.countdown--;
            if (this.countdownText) {
              this.countdownText.setText(`TIME: ${this.countdown}s`);
              if (this.countdown <= 3) this.countdownText.setColor('#ff0000');
            }
            if (this.countdown <= 0) {
              this.forceFinishRemaining();
            }
          }
        });
      }
    }

    // Update boss if present
    if (this.hasBoss && this.bossSystem) {
      this.bossSystem.update(delta);

      // Visual mode: show boss projectiles
      if (visualMode) {
        this.updateBossProjectileVisuals();
      }

      // Auto-fire weapons at boss (simplified for simulation)
      if (this.bossSystem.isAlive()) {
        this.updateAutoFire(delta);
      }
      // Boss death is handled in updateAutoFire -> onBossDefeated
    }

    // Update weapons
    if (this.weaponSystem) {
      this.weaponSystem.update(delta);
    }
  }

  forceFinishRemaining() {
    console.log(`[SimRunner ${simId}] Force finishing remaining balls`);

    // Get unfinished balls sorted by Y position (closest to finish first)
    const unfinished = this.balls
      .filter(b => !b.finished)
      .sort((a, b) => {
        // Handle case where body might have been removed
        const aY = a.body?.position?.y ?? 999;
        const bY = b.body?.position?.y ?? 999;
        return aY - bY;
      });

    console.log(`[SimRunner ${simId}] ${unfinished.length} balls to force-finish`);

    unfinished.forEach(ball => {
      ball.finished = true;
      this.finishedCount++;
      ball.finishPosition = this.finishedCount;
      console.log(`[SimRunner ${simId}] ${ball.name} force-finished in position ${this.finishedCount}`);

      // Remove from physics if still exists
      if (ball.body) {
        try {
          this.matter.world.remove(ball.body);
        } catch (e) {
          // Body might already be removed
        }
      }
      if (ball.graphics) {
        ball.graphics.setAlpha(0.5); // Dim to show forced
      }
    });

    // Clean up countdown
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }
    if (this.countdownText) {
      this.countdownText.destroy();
      this.countdownText = null;
    }

    this.onRaceComplete();
  }

  onRaceComplete() {
    console.log(`[SimRunner ${simId}] onRaceComplete called, isRacing: ${this.isRacing}`);
    if (!this.isRacing) {
      console.log(`[SimRunner ${simId}] Already completed, skipping`);
      return;
    }
    this.isRacing = false;

    // Get results
    const results = this.balls
      .sort((a, b) => {
        if (a.finished && b.finished) return a.finishPosition - b.finishPosition;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return 0;
      })
      .map((ball, idx) => ({
        name: ball.name,
        position: idx + 1
      }));

    console.log(`[SimRunner ${simId}] Race complete! Winner: ${results[0]?.name}, mapIndex: ${currentMapIndex}, totalMaps: ${chainMaps.length}`);

    // Track points
    results.forEach((r, idx) => {
      const points = SIM_CONFIG.points.position[idx] || 0;
      cumulativePoints[r.name] += points;
    });

    // Run instant roulette to award weapons (skip animation)
    const rouletteAwards = runInstantRoulette(results);

    raceResults.push({
      level: currentMapIndex + 1,
      mapName: this.mapName,
      winner: results[0]?.name,
      results,
      rouletteAwards // Track what weapons were given
    });

    // Report to parent
    reportRaceComplete(results[0]?.name, currentMapIndex + 1, chainMaps.length, this.mapName, results);

    // Next map or finish
    currentMapIndex++;
    console.log(`[SimRunner ${simId}] Moving to next map, newIndex: ${currentMapIndex}, totalMaps: ${chainMaps.length}`);

    if (currentMapIndex < chainMaps.length) {
      console.log(`[SimRunner ${simId}] Scheduling loadNextMap in 500ms`);
      this.time.delayedCall(500, () => {
        console.log(`[SimRunner ${simId}] Calling loadNextMap now`);
        loadNextMap();
      });
    } else {
      console.log(`[SimRunner ${simId}] Chain complete, scheduling finishChain`);
      this.time.delayedCall(500, () => finishChain());
    }
  }
}

// Game instance
let game = null;

function createGame() {
  // Use fixed game dimensions that match the map data scale
  // CSS will scale the canvas to fit the iframe
  const width = 800;
  const height = 600;

  const firstMap = chainMaps[currentMapIndex];
  console.log(`[SimRunner] Creating game with map: ${firstMap?.name}`);
  console.log(`[SimRunner] Map obstacles: ${firstMap?.obstacles?.length}`);

  // Store map data globally so scene can access it
  window.__simMapData = firstMap;

  game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game-container',
    width,
    height,
    backgroundColor: '#e8e0d0',
    scale: {
      mode: Phaser.Scale.FIT,  // Scale to fit container while maintaining aspect ratio
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: 'matter',
      matter: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: SimRaceScene
  });

  reportStatus('ready');
}

function loadNextMap() {
  const nextMap = chainMaps[currentMapIndex];
  if (!nextMap) {
    finishChain();
    return;
  }

  console.log(`[SimRunner ${simId}] Loading next map: ${nextMap.name} (index ${currentMapIndex})`);

  // Update global map data
  window.__simMapData = nextMap;

  // Stop current scene and start fresh
  const scene = game.scene.getScene('SimRaceScene');
  if (scene) {
    scene.scene.restart({
      mapData: nextMap,
      mapName: nextMap.name,
      timeScale: timeScale
    });
  } else {
    console.error(`[SimRunner ${simId}] Scene not found!`);
  }
}

function finishChain() {
  const standings = Object.entries(cumulativePoints)
    .sort((a, b) => b[1] - a[1])
    .map(([name, points], idx) => ({ name, points, position: idx + 1 }));

  const winner = standings[0]?.name;
  console.log(`[SimRunner ${simId}] Chain complete! Winner: ${winner}`);
  console.log(`[SimRunner ${simId}] Weapon stats:`, weaponStats);

  reportChainComplete(winner, standings);

  // Reset weapon stats for next chain (but keep global tracking)
}

// Communication with parent
function reportStatus(status) {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'sim-status', simId, status }, '*');
  }
}

function reportRaceComplete(winner, level, totalLevels, mapName, results) {
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'sim-race-complete',
      simId,
      winner,
      level,
      totalLevels,
      mapName,
      results
    }, '*');
    console.log(`[SimRunner ${simId}] Reported race complete: L${level}/${totalLevels}, winner: ${winner}`);
  }
}

function reportChainComplete(winner, standings) {
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'sim-chain-complete',
      simId,
      winner,
      standings,
      raceResults,
      weaponStats: {
        awarded: { ...weaponStats.awarded },
        damageDealt: { ...weaponStats.damageDealt },
        ballWeapons: { ...weaponStats.ballWeapons }
      },
      diagnostics: {
        outOfBoundsRespawns: chainDiagnostics.outOfBoundsRespawns,
        stuckPushes: chainDiagnostics.stuckPushes,
        raceTimeouts: chainDiagnostics.raceTimeouts,
        forceFinishedBalls: chainDiagnostics.forceFinishedBalls,
        ballsWithoutBody: chainDiagnostics.ballsWithoutBody,
        events: chainDiagnostics.events.slice(-20) // Last 20 events to avoid huge payloads
      }
    }, '*');
  }

  // Reset for next chain
  weaponStats.ballWeapons = { Red: [], Blue: [], Green: [], Yellow: [], Purple: [] };
  chainDiagnostics = {
    outOfBoundsRespawns: 0,
    stuckPushes: 0,
    raceTimeouts: 0,
    forceFinishedBalls: 0,
    ballsWithoutBody: 0,
    events: []
  };
}

// Start
createGame();
