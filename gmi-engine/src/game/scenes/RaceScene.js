import Phaser from 'phaser';
import { MapGenerator } from '../systems/MapGenerator.js';
import { getMapLoader } from '../systems/MapLoader.js';
import { AnimationPlayer } from '../../animation/AnimationPlayer.js';
import { volumeSystem } from '../systems/VolumeSystem.js';
import { BossSystem } from '../systems/BossSystem.js';
import { gameLog } from '../systems/GameLog.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { RouletteSystem } from '../systems/RouletteSystem.js';
import { WEAPON_TYPES } from '../systems/WeaponDefinitions.js';
import { getPendingGameConfig } from '../Game.js';
import { renderBallGraphics, renderHPBar, updateHPBar } from '../rendering/BallRenderer.js';
import { FinishTrackerUI } from '../rendering/FinishTrackerUI.js';
import { BreakableManager } from '../managers/BreakableManager.js';
import { CrushDetector } from '../managers/CrushDetector.js';

export class RaceScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RaceScene' });

    this.balls = [];
    this.obstacles = [];
    this.isRacing = false;
    this.mapGenerator = null;
    this.ballSpeed = 5;
    this.customMapData = null;
    this.editorMapData = null; // Map loaded from editor
    this.mapLoader = null;

    // Keyframe animation player
    this.animationPlayer = null;
    this.raceStartTime = 0;

    // Boss system
    this.bossSystem = null;
    this.bossWinCondition = 'finish'; // 'boss', 'finish', or 'either'
    this.respawnDelay = 2000; // ms before ball respawns

    // Weapon & Item systems
    this.weaponSystem = null;
    this.itemSystem = null;
    this.inventorySystem = null;
    this.rouletteSystem = null;

    // Turbo mode
    this.turboMode = false;
    this.timeScale = 1;

    // UI components
    this.finishTrackerUI = null;

    // Managers
    this.breakableManager = null;
    this.crushDetector = null;
  }

  /**
   * Set time scale for turbo mode
   */
  setTimeScale(scale) {
    this.timeScale = scale;
    if (this.matter && this.matter.world) {
      // Phaser Matter.js time scale
      this.matter.world.engine.timing.timeScale = scale;
    }
    if (this.time) {
      this.time.timeScale = scale;
    }
    console.log(`[RaceScene] Time scale set to ${scale}x`);
  }

  /**
   * Enable/disable turbo mode
   */
  setTurboMode(enabled, speed = 4) {
    this.turboMode = enabled;
    if (enabled) {
      this.setTimeScale(speed);
    } else {
      this.setTimeScale(1);
    }
    console.log(`[RaceScene] Turbo mode: ${enabled ? 'ON' : 'OFF'} at ${speed}x`);
  }

  setCustomMap(mapData) {
    this.customMapData = mapData;
    this.editorMapData = null; // Clear editor map when SVG is set
    console.log('Custom map set:', mapData ? 'yes' : 'cleared');
  }

  /**
   * Load an editor-created map by ID
   */
  async loadEditorMap(mapId) {
    try {
      if (!this.mapLoader) {
        this.mapLoader = getMapLoader();
        await this.mapLoader.init();
      }

      const mapData = await this.mapLoader.loadMap(mapId);
      if (mapData) {
        this.editorMapData = mapData;
        this.customMapData = null; // Clear SVG map
        console.log('Editor map loaded:', mapData.name);

        // Resize game if needed (with sanity checks)
        const newWidth = mapData.width || 800;
        const newHeight = mapData.height || 600;
        if (newWidth > 0 && newHeight > 0 && newWidth < 4000 && newHeight < 4000) {
          if (newWidth !== this.gameWidth || newHeight !== this.gameHeight) {
            this.gameWidth = newWidth;
            this.gameHeight = newHeight;
            this.scale.resize(newWidth, newHeight);
          }
        }

        this.regenerateMap();
      }
      return mapData;
    } catch (error) {
      console.error('[RaceScene] Error loading editor map:', error);
      // Fall back to procedural map
      this.editorMapData = null;
      this.regenerateMap();
      return null;
    }
  }

  /**
   * Load editor map data directly (for built-in maps)
   */
  loadEditorMapData(mapData) {
    if (mapData) {
      this.editorMapData = mapData;
      this.customMapData = null; // Clear SVG map
      console.log('Editor map loaded directly:', mapData.name);

      // Resize game if needed
      if (mapData.width !== this.gameWidth || mapData.height !== this.gameHeight) {
        this.gameWidth = mapData.width;
        this.gameHeight = mapData.height;
        this.scale.resize(mapData.width, mapData.height);
      }

      this.regenerateMap();
    }
    return mapData;
  }

  /**
   * Clear the editor map (return to procedural/SVG)
   */
  clearEditorMap() {
    this.editorMapData = null;
    console.log('Editor map cleared');
  }

  create() {
    console.log('RaceScene create() called');

    // Get config from registry, or fall back to pending config (race condition fix)
    this.config = this.registry.get('gameConfig') || getPendingGameConfig();
    this.controller = this.registry.get('controller');

    if (!this.config) {
      console.error('[RaceScene] No config available!');
    } else {
      console.log('[RaceScene] Config loaded, mapData:', this.config.mapData ? 'present' : 'none');
    }

    // Set ball speed from config
    this.ballSpeed = this.config?.physics?.gravity || 5;
    if (this.ballSpeed < 3) this.ballSpeed = 5;

    // Get actual game dimensions
    this.gameWidth = this.sys.game.config.width;
    this.gameHeight = this.sys.game.config.height;

    console.log('Game dimensions:', this.gameWidth, 'x', this.gameHeight);

    // Load map from config if provided (for simulation mode)
    if (this.config?.mapData) {
      this.editorMapData = this.config.mapData;
      console.log('[RaceScene] Map loaded from config:', this.config.mapName || 'Unnamed');
      console.log('[RaceScene] Map has obstacles:', this.config.mapData.obstacles?.length || 0);
      console.log('[RaceScene] Map has startZone:', !!this.config.mapData.startZone);
      console.log('[RaceScene] Map has .data property:', !!this.config.mapData.data);
      if (this.config.mapData.obstacles?.length > 0) {
        console.log('[RaceScene] First obstacle type:', this.config.mapData.obstacles[0]?.type);
      }
    } else {
      console.log('[RaceScene] NO mapData in config! Config keys:', Object.keys(this.config || {}));
    }

    // Initialize map generator
    this.mapGenerator = new MapGenerator(this, this.gameWidth, this.gameHeight);

    // Initialize animation player for keyframe animations
    this.animationPlayer = new AnimationPlayer();

    // Initialize boss system
    this.bossSystem = new BossSystem(this);

    // Initialize weapon & item systems
    this.weaponSystem = new WeaponSystem(this);
    this.itemSystem = new ItemSystem(this);
    this.inventorySystem = new InventorySystem(this);
    this.rouletteSystem = new RouletteSystem(this);

    // Initialize managers
    this.breakableManager = new BreakableManager(this);
    this.crushDetector = new CrushDetector(this);

    // Create graphics layers
    this.bgLayer = this.add.graphics();
    this.obstacleLayer = this.add.graphics();
    this.finishLayer = this.add.graphics();

    // Generate initial map
    this.generateMap();

    // Create balls
    this.createBalls();

    // Debug: bounce history for analysis
    this.bounceLog = [];
    this.debugMode = true; // Set to false to disable logging

    // Anti-micro-bounce system: track recent collisions per ball
    this.recentCollisions = new Map(); // ball.name -> { obstacleId, time }[]
    this.collisionDebounceMs = 100; // Minimum ms between collisions with same obstacle
    this.trapDetectionWindow = 500; // Window to detect trap (too many bounces)
    this.trapBounceThreshold = 6; // If this many bounces in window, ball is trapped

    // Keyboard shortcut: Press 'L' to dump bounce log to console
    this.input.keyboard.on('keydown-L', () => {
      console.log('=== BOUNCE LOG (Last 50 bounces) ===');
      console.table(this.bounceLog);

      // Analyze for patterns
      const wallBounces = this.bounceLog.filter(b => b.hitType === 'wall');
      const cornerBounces = this.bounceLog.filter(b => b.hitType === 'CORNER');
      const smallAngleChanges = this.bounceLog.filter(b => Math.abs(parseFloat(b.angleDiff)) < 15);

      console.log(`Total bounces: ${this.bounceLog.length}`);
      console.log(`Wall bounces: ${wallBounces.length}`);
      console.log(`Corner bounces: ${cornerBounces.length}`);
      console.log(`Suspicious (angle change < 15°): ${smallAngleChanges.length}`);

      if (smallAngleChanges.length > 0) {
        console.log('Suspicious bounces:', smallAngleChanges);
      }
    });

    // Collision handler - handles bounce randomness and breakable obstacles
    this.matter.world.on('collisionstart', (event) => {
      if (!this.isRacing) return;

      const now = Date.now();

      event.pairs.forEach(pair => {
        // ====== WEAPON PROJECTILE -> BOSS COLLISION ======
        // Check this first before ball-centric logic
        const isWeaponVsBoss = (pair.bodyA.label === 'weapon_projectile' && pair.bodyB.label === 'boss') ||
                               (pair.bodyB.label === 'weapon_projectile' && pair.bodyA.label === 'boss');

        if (isWeaponVsBoss && this.weaponSystem && this.bossSystem?.isAlive()) {
          const projBody = pair.bodyA.label === 'weapon_projectile' ? pair.bodyA : pair.bodyB;
          const proj = this.weaponSystem.projectiles.find(p => p.body === projBody);

          if (proj) {
            const damage = proj.damage || 10;
            const ownerBall = this.balls.find(b => b.name === proj.owner);
            const bossDied = this.bossSystem.takeDamage(damage);

            // Log damage
            console.log(`[WEAPON->BOSS] ${proj.owner} dealt ${damage} weapon damage to boss`);
            gameLog.bossDamage(proj.owner, damage, this.bossSystem.boss.health, this.bossSystem.boss.maxHealth);

            // Track damage for standings
            if (ownerBall) {
              ownerBall.damageDealtToBoss = (ownerBall.damageDealtToBoss || 0) + damage;
            }

            // Destroy projectile if not piercing
            if (!proj.piercing) {
              this.weaponSystem.destroyProjectile(proj);
            }

            if (bossDied) {
              console.log('[BOSS] Boss defeated by weapon! Triggering onBossDeath...');
              gameLog.bossDeath();
            }
          }
          return;
        }

        // Check if a ball is involved
        let ballBody = null;
        let otherBody = null;

        if (pair.bodyA.label === 'ball') {
          ballBody = pair.bodyA;
          otherBody = pair.bodyB;
        } else if (pair.bodyB.label === 'ball') {
          ballBody = pair.bodyB;
          otherBody = pair.bodyA;
        }

        if (ballBody) {
          // Find the ball object
          const ball = this.balls.find(b => b.body === ballBody);

          // Skip collision processing for finished or respawning balls
          if (ball && (ball.finished || ball.isRespawning)) return;

          // ====== BOSS COLLISION ======
          if (otherBody.label === 'boss' && ball && this.bossSystem && this.bossSystem.isAlive()) {
            const damage = ball.damage || 10;
            const bossDied = this.bossSystem.takeDamage(damage);
            console.log(`[BOSS HIT] ${ball.name} dealt ${damage} damage to boss`);
            gameLog.bossDamage(ball.name, damage, this.bossSystem.boss.health, this.bossSystem.boss.maxHealth);

            // Apply bounce off boss (strong bounce away)
            const bossPos = this.bossSystem.boss;
            const ballPos = ballBody.position;
            const dx = ballPos.x - bossPos.x;
            const dy = ballPos.y - bossPos.y;
            const bounceAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
            const effectiveSpeed = this.getBallSpeed(ball);

            this.matter.body.setVelocity(ballBody, {
              x: Math.cos(bounceAngle) * effectiveSpeed * 1.2,
              y: Math.sin(bounceAngle) * effectiveSpeed * 1.2
            });

            if (bossDied) {
              console.log('[BOSS] Boss defeated! Triggering onBossDeath...');
              gameLog.bossDeath();
            }
            return; // Skip normal collision processing
          }

          // ====== PROJECTILE COLLISION (Boss) ======
          if (otherBody.label === 'projectile' && ball) {
            // Find the projectile
            const proj = this.bossSystem?.projectiles.find(p => p.body === otherBody);
            if (proj) {
              const damage = proj.damage || 10;
              this.damageBall(ball, damage);
              // Destroy the projectile
              this.bossSystem.destroyProjectile(proj);
              this.bossSystem.projectiles = this.bossSystem.projectiles.filter(p => p !== proj);
            }
            return; // Don't process normal bounce
          }

          // ====== WEAPON PROJECTILE COLLISION ======
          if (otherBody.label === 'weapon_projectile' && ball) {
            const proj = this.weaponSystem?.projectiles.find(p => p.body === otherBody);
            if (proj && proj.owner !== ball.name) {
              this.weaponSystem.handleProjectileHit(proj, ball);
            }
            return; // Don't process normal bounce
          }

          // ====== ITEM PICKUP COLLISION ======
          if (otherBody.label === 'item' && ball) {
            if (this.itemSystem && otherBody.itemRef) {
              this.itemSystem.handleCollision(ballBody, otherBody);
            }
            return; // Don't process normal bounce
          }

          // ====== COLLISION DEBOUNCE SYSTEM ======
          // Prevent rapid micro-bounces on same obstacle
          const obstacleId = otherBody.id;
          const isObstacle = otherBody.label === 'obstacle';

          if (isObstacle && ball) {
            // Get or create collision history for this ball
            if (!this.recentCollisions.has(ball.name)) {
              this.recentCollisions.set(ball.name, []);
            }
            const collisionHistory = this.recentCollisions.get(ball.name);

            // Clean up old collisions outside the detection window
            while (collisionHistory.length > 0 && now - collisionHistory[0].time > this.trapDetectionWindow) {
              collisionHistory.shift();
            }

            // Check if we recently hit this same obstacle (debounce)
            const recentSameObstacle = collisionHistory.find(c => c.obstacleId === obstacleId && now - c.time < this.collisionDebounceMs);
            if (recentSameObstacle) {
              // Skip this collision - too soon after last one with same obstacle
              return;
            }

            // Record this collision
            collisionHistory.push({ obstacleId, time: now });

            // ====== TRAP DETECTION ======
            // If too many obstacle bounces in short window, ball is trapped
            if (collisionHistory.length >= this.trapBounceThreshold) {
              console.log(`[TRAP DETECTED] ${ball.name} had ${collisionHistory.length} bounces in ${this.trapDetectionWindow}ms - forcing escape!`);

              // Strong escape velocity in random direction (per-ball speed)
              const escapeAngle = Math.random() * Math.PI * 2;
              const escapeSpeed = this.getBallSpeed(ball) * 1.5;
              this.matter.body.setVelocity(ballBody, {
                x: Math.cos(escapeAngle) * escapeSpeed,
                y: Math.sin(escapeAngle) * escapeSpeed
              });

              // Clear history to reset trap detection
              collisionHistory.length = 0;
              return;
            }
          }

          // Check if collision is with an obstacle (for breakable handling)
          if (isObstacle && ball) {
            // Find the obstacle
            const obstacle = this.obstacles.find(o => o.body === otherBody);

            // Handle breakable obstacles using manager
            if (obstacle && obstacle.breakable && !obstacle.destroyed && this.breakableManager) {
              this.breakableManager.handleCollision(obstacle, ball, (obs) => {
                const color = obs.data?.color ? parseInt(obs.data.color.replace('#', ''), 16) : 0x4a5568;
                this.drawObstacleGraphics(obs.graphics, {
                  ...obs.data,
                  health: obs.health,
                  maxHealth: obs.maxHealth
                }, color);
              });
            }
          }

          // Store pre-bounce data for logging
          const preVel = { x: ballBody.velocity.x, y: ballBody.velocity.y };
          const pos = { x: ballBody.position.x, y: ballBody.position.y };
          const preAngle = Math.atan2(preVel.y, preVel.x) * 180 / Math.PI;

          // Calculate proper bounce using collision normal
          const vel = ballBody.velocity;
          const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

          if (speed > 0.1) {
            let newVelX, newVelY;
            let twistApplied = 0;
            const effectiveSpeed = this.getBallSpeed(ball);

            // Detect corner hits (near two walls at once)
            const nearLeft = pos.x < 30;
            const nearRight = pos.x > this.gameWidth - 30;
            const nearTop = pos.y < 30;
            const nearBottom = pos.y > this.gameHeight - 30;
            const isCorner = (nearLeft || nearRight) && (nearTop || nearBottom);

            if (isCorner) {
              // Corner hit: strong diagonal bounce away from corner
              const dirX = nearLeft ? 1 : -1;
              const dirY = nearTop ? 1 : -1;
              const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 0.5;
              newVelX = Math.cos(angle) * effectiveSpeed;
              newVelY = Math.sin(angle) * effectiveSpeed;
              twistApplied = 999;
            } else {
              // Use collision normal for proper reflection
              const collision = pair.collision;
              const normal = collision.normal;

              // Reflect velocity across normal: v' = v - 2(v·n)n
              const dotProduct = vel.x * normal.x + vel.y * normal.y;
              let reflectX = vel.x - 2 * dotProduct * normal.x;
              let reflectY = vel.y - 2 * dotProduct * normal.y;

              // Add randomness to prevent deterministic paths
              const twist = (0.2 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
              const reflectAngle = Math.atan2(reflectY, reflectX) + twist;

              newVelX = Math.cos(reflectAngle) * effectiveSpeed;
              newVelY = Math.sin(reflectAngle) * effectiveSpeed;
              twistApplied = twist;
            }

            // Apply the new velocity

            this.matter.body.setVelocity(ballBody, { x: newVelX, y: newVelY });

            // Log bounce data
            if (this.debugMode && ball) {
              const postAngle = Math.atan2(newVelY, newVelX) * 180 / Math.PI;
              const logEntry = {
                time: Date.now(),
                ball: ball.name,
                position: { x: Math.round(pos.x), y: Math.round(pos.y) },
                hitType: isCorner ? 'CORNER' : otherBody.label,
                preVelocity: { x: preVel.x.toFixed(2), y: preVel.y.toFixed(2) },
                postVelocity: { x: newVelX.toFixed(2), y: newVelY.toFixed(2) },
                preAngle: preAngle.toFixed(1),
                postAngle: postAngle.toFixed(1),
                angleDiff: (postAngle - preAngle).toFixed(1)
              };

              this.bounceLog.push(logEntry);

              // Keep last 500 bounces for better analysis
              if (this.bounceLog.length > 500) this.bounceLog.shift();

              // Log to console (reduced verbosity - only log every 5th bounce)
              if (this.bounceLog.length % 5 === 0) {
                console.log(`[BOUNCE] ${ball.name} hit ${logEntry.hitType} at (${logEntry.position.x}, ${logEntry.position.y}) | Angle: ${logEntry.preAngle}° → ${logEntry.postAngle}° (diff: ${logEntry.angleDiff}°)`);
              }

              // Detect suspicious bounces (angle barely changed on wall hit)
              if (otherBody.label === 'wall' && Math.abs(parseFloat(logEntry.angleDiff)) < 10) {
                console.warn(`[WARNING] Suspicious wall bounce - angle barely changed!`, logEntry);
              }
            }
          }
        }
      });
    });

    // Handle continuous collisions (sliding detection)
    this.matter.world.on('collisionactive', (event) => {
      if (!this.isRacing) return;

      event.pairs.forEach(pair => {
        let ballBody = null;
        let otherBody = null;

        if (pair.bodyA.label === 'ball') {
          ballBody = pair.bodyA;
          otherBody = pair.bodyB;
        } else if (pair.bodyB.label === 'ball') {
          ballBody = pair.bodyB;
          otherBody = pair.bodyA;
        }

        // Handle sliding on both obstacles AND walls
        if (ballBody && (otherBody.label === 'obstacle' || otherBody.label === 'wall')) {
          const ball = this.balls.find(b => b.body === ballBody);
          if (!ball || ball.finished || ball.eliminated) return;

          // Track sliding - if ball has been in contact for too long
          if (!ball.slideContactTime) ball.slideContactTime = 0;
          ball.slideContactTime += 16; // Approximate frame time

          // If sliding for more than 80ms, force a strong bounce (reduced from 100)
          if (ball.slideContactTime > 80) {
            const vel = ballBody.velocity;
            const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

            if (speed > 0) {
              // Get collision normal and bounce hard (per-ball speed)
              const normal = pair.collision.normal;
              const bounceAngle = Math.atan2(-normal.y, -normal.x) + (Math.random() - 0.5) * 1.0;
              const effectiveSpeed = this.getBallSpeed(ball);

              this.matter.body.setVelocity(ballBody, {
                x: Math.cos(bounceAngle) * effectiveSpeed * 1.1,
                y: Math.sin(bounceAngle) * effectiveSpeed * 1.1
              });

              ball.slideContactTime = 0;

              if (this.debugMode) {
                console.log(`[ANTI-SLIDE] ${ball.name} was sliding on ${otherBody.label}, forced bounce`);
              }
            }
          }
        }
      });
    });

    // Reset slide tracking when collision ends
    this.matter.world.on('collisionend', (event) => {
      event.pairs.forEach(pair => {
        let ballBody = pair.bodyA.label === 'ball' ? pair.bodyA : (pair.bodyB.label === 'ball' ? pair.bodyB : null);
        if (ballBody) {
          const ball = this.balls.find(b => b.body === ballBody);
          if (ball) ball.slideContactTime = 0;
        }
      });
    });

    console.log('RaceScene initialized with', this.balls.length, 'balls');
  }

  generateMap() {
    const mapSource = this.editorMapData ? '(editor map)' : (this.customMapData ? '(custom SVG)' : '(procedural)');
    console.log('Generating map...', mapSource);

    // Clear existing
    this.bgLayer.clear();
    this.obstacleLayer.clear();
    this.finishLayer.clear();

    // Remove old physics bodies
    this.obstacles.forEach(o => {
      if (o.body) this.matter.world.remove(o.body);
      if (o.graphics) o.graphics.destroy();
    });
    this.obstacles = [];

    // Draw background
    this.bgLayer.fillStyle(0xe8e0d0, 1);
    this.bgLayer.fillRect(0, 0, this.gameWidth, this.gameHeight);

    // Get map data from editor, SVG, or procedural
    let mapData;
    if (this.editorMapData) {
      // Editor maps store data in nested structure: { data: { obstacles, animations, ... } }
      // Handle both nested and flat structures for compatibility
      const editorData = this.editorMapData.data || this.editorMapData;
      mapData = {
        obstacles: editorData.obstacles || [],
        startZone: editorData.startZone || null,
        finishZone: editorData.finishZone || null,
        animations: editorData.animations || null,
        finishY: editorData.finishZone ? editorData.finishZone.y : 60,
        spawnY: editorData.startZone ? (editorData.startZone.y + (editorData.startZone.height || 0) / 2) : (this.gameHeight - 80),
        lanes: 5
      };
      console.log('[RaceScene] Loaded editor map data:', {
        obstacles: mapData.obstacles.length,
        hasAnimations: !!mapData.animations,
        animationKeys: mapData.animations ? Object.keys(mapData.animations) : []
      });
    } else if (this.customMapData) {
      mapData = {
        obstacles: this.customMapData.obstacles,
        finishY: this.customMapData.finishLine ? this.customMapData.finishLine.y : 60,
        spawnY: this.customMapData.spawnArea ? this.customMapData.spawnArea.y : this.gameHeight - 80,
        lanes: 5
      };
    } else {
      mapData = this.mapGenerator.generate(this.config.map);
    }

    // Create obstacles with special behaviors
    const defaultColor = 0x4a5568;

    // Pre-compute which obstacles have animations (need graphics objects)
    const animationData = mapData.animations || {};
    const animatedIds = new Set(Object.keys(animationData));

    console.log('[RaceScene] About to render obstacles:', mapData.obstacles.length, 'items');
    console.log('[RaceScene] editorMapData present:', !!this.editorMapData);
    console.log('[RaceScene] editorMapData.obstacles:', this.editorMapData?.obstacles?.length || 'N/A');
    if (mapData.obstacles.length > 0) {
      console.log('[RaceScene] First obstacle:', JSON.stringify(mapData.obstacles[0]));
    } else {
      console.warn('[RaceScene] WARNING: No obstacles to render!');
    }

    let obstacleCount = 0;
    mapData.obstacles.forEach(obs => {
      obstacleCount++;
      // Convert angle from degrees to radians (map data uses degrees)
      const angleDegrees = obs.angle || 0;
      const angleRadians = angleDegrees * (Math.PI / 180);
      // Add small random variation only if no explicit angle
      const angle = angleDegrees !== 0 ? angleRadians : (Math.random() - 0.5) * 0.15;
      const color = obs.color ? parseInt(obs.color.replace('#', ''), 16) : defaultColor;

      // Check if this obstacle has animation OR special behavior OR rotation
      const hasAnimation = obs.id && animatedIds.has(obs.id);
      const hasAngle = angleDegrees !== 0;
      const needsGraphics = hasAnimation || hasAngle || (obs.behavior && obs.behavior !== 'static');

      let body;
      let graphics = null;

      if (obs.type === 'circle') {
        body = this.matter.add.circle(obs.x, obs.y, obs.radius, {
          isStatic: true,
          friction: 0,
          restitution: 1,
          label: 'obstacle'
        });

        // Create graphics object for animated or special obstacles
        if (needsGraphics) {
          graphics = this.add.graphics();
          graphics.x = obs.x;
          graphics.y = obs.y;
          this.drawObstacleGraphics(graphics, obs, color);
        } else {
          this.obstacleLayer.fillStyle(color, 1);
          this.obstacleLayer.fillCircle(obs.x, obs.y, obs.radius);
        }
      } else {
        const centerX = obs.x + (obs.width || 0) / 2;
        const centerY = obs.y + (obs.height || 0) / 2;

        body = this.matter.add.rectangle(
          centerX, centerY,
          obs.width || 50,
          obs.height || 20,
          {
            isStatic: true,
            friction: 0,
            restitution: 1,
            angle: angle,
            label: 'obstacle'
          }
        );

        // Create graphics object for animated or special obstacles (or rotated ones)
        if (needsGraphics) {
          graphics = this.add.graphics();
          graphics.x = centerX;
          graphics.y = centerY;
          // Apply rotation to graphics to match physics body
          graphics.rotation = angle;
          this.drawObstacleGraphics(graphics, obs, color);
        } else {
          this.obstacleLayer.fillStyle(color, 1);
          this.obstacleLayer.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
      }

      // Store obstacle with all properties
      const obstacleObj = {
        body,
        graphics,
        data: obs,
        // Special properties
        behavior: obs.behavior || 'static',
        breakable: obs.breakable || obs.behavior === 'breakable',
        health: obs.health || 3,
        maxHealth: obs.maxHealth || 3,
        breakableBy: obs.breakableBy || [],
        rotating: obs.rotating || false,
        rotationSpeed: obs.rotationSpeed || 2,
        rotationDirection: obs.rotationDirection || 'cw',
        moving: obs.moving || false,
        moveDirection: obs.moveDirection || 'horizontal',
        moveDistance: obs.moveDistance || 100,
        moveSpeed: obs.moveSpeed || 50,
        movePhase: 0,
        moveStartX: obs.x + (obs.width || 0) / 2,
        moveStartY: obs.y + (obs.height || 0) / 2,
        destroyed: false,
        // Crusher properties
        crusher: obs.crusher || obs.behavior === 'crusher',
        crusherDirection: obs.crusherDirection || 'down', // down, up, left, right
        crusherSpeed: obs.crusherSpeed || 80, // pixels per second
        crusherResetDelay: obs.crusherResetDelay || 2000, // ms to wait before resetting
        crusherStartX: obs.x + (obs.width || 0) / 2,
        crusherStartY: obs.y + (obs.height || 0) / 2,
        crusherActive: true,
        crusherResetTimer: 0
      };

      this.obstacles.push(obstacleObj);
    });

    console.log('[RaceScene] Obstacles created:', this.obstacles.length);

    // Create walls
    this.createWalls();

    // Draw start zone if from editor
    if (mapData.startZone) {
      this.drawStartZone(mapData.startZone);
    }

    // Store finish zone from editor map
    this.finishZone = mapData.finishZone || null;

    // Draw finish line/zone
    const finishY = mapData.finishY || 60;
    this.drawFinishLine(finishY);
    this.finishY = finishY;

    // Store spawn info
    this.spawnY = mapData.spawnY || (this.gameHeight - 80);
    this.spawnZone = mapData.startZone || null;
    this.lanes = mapData.lanes || 5;

    // Create finish tracker display
    this.finishTrackerUI = new FinishTrackerUI(this);
    this.finishTrackerUI.create();

    // Load keyframe animations for obstacles (from editor map)
    // animationData was already extracted above for pre-computing animated obstacle IDs
    console.log('[RaceScene] Animation data:', animationData ?
      `Found ${Object.keys(animationData).length} animations` : 'None');

    if (animationData && Object.keys(animationData).length > 0) {
      // Filter animations to only include existing obstacles (remove orphans)
      const validAnimations = {};
      const obstacleIds = new Set(this.obstacles.map(o => o.data?.id).filter(Boolean));

      for (const [animId, anim] of Object.entries(animationData)) {
        if (obstacleIds.has(animId)) {
          validAnimations[animId] = anim;
        } else {
          console.log(`[RaceScene] Skipping orphaned animation: ${animId}`);
        }
      }

      this.animationPlayer.loadAnimations(validAnimations);

      // Debug: List all animation keys and obstacle IDs
      const animKeys = Object.keys(validAnimations);
      console.log('[RaceScene] Animation keys (after filtering):', animKeys);
      console.log('[RaceScene] Obstacle IDs:', [...obstacleIds]);

      // Store base positions for animated obstacles
      let matchedCount = 0;
      this.obstacles.forEach(obs => {
        if (obs.data?.id && this.animationPlayer.hasAnimation(obs.data.id)) {
          matchedCount++;

          // Store base position for animation offsets (graphics should already be created above)
          obs.animBaseX = obs.body.position.x;
          obs.animBaseY = obs.body.position.y;
          obs.animBaseRotation = obs.body.angle;
          obs.animBaseScaleX = 1;
          obs.animBaseScaleY = 1;

          console.log(`[Animation] Matched obstacle ${obs.data.id} at (${obs.animBaseX}, ${obs.animBaseY}), hasGraphics: ${!!obs.graphics}`);
        }
      });
      console.log(`[RaceScene] Matched ${matchedCount} obstacles with animations`);
    }

    console.log('Map generated with', this.obstacles.length, 'obstacles');

    // Handle boss spawning from editor map
    if (this.editorMapData) {
      const editorData = this.editorMapData.data || this.editorMapData;
      if (editorData.bossConfig) {
        const cfg = editorData.bossConfig;
        // Set win condition from boss config
        this.bossWinCondition = cfg.winCondition || 'boss';
        console.log('[RaceScene] Boss win condition:', this.bossWinCondition);

        // Cleanup any existing boss first
        if (this.bossSystem) {
          this.bossSystem.cleanup();
        }

        // Spawn boss after a short delay to ensure map is ready
        setTimeout(() => {
          if (this.bossSystem) {
            this.bossSystem.spawn(cfg.x, cfg.y, {
              width: cfg.width,
              height: cfg.height,
              health: cfg.health,
              color: cfg.color,
              shape: cfg.shape
            });
            this.bossSystem.setPattern(cfg.pattern || 'spiral');
            if (cfg.attackCooldown) {
              this.bossSystem.setAttackCooldown(cfg.attackCooldown);
            }
            console.log('[RaceScene] Boss spawned:', cfg.pattern, 'HP:', cfg.health);
          }
        }, 100);
      } else {
        // No boss - default to finish zone win condition
        this.bossWinCondition = 'finish';
      }
    }
  }

  /**
   * Draw a single obstacle's graphics (for animated obstacles)
   */
  drawObstacleGraphics(graphics, obs, color) {
    graphics.clear();
    graphics.fillStyle(color, 1);

    if (obs.type === 'circle') {
      graphics.fillCircle(0, 0, obs.radius);

      // Behavior indicators
      if (obs.behavior === 'rotating') {
        graphics.lineStyle(2, 0xffffff, 0.5);
        graphics.strokeCircle(0, 0, obs.radius * 0.6);
        // Rotation indicator line
        graphics.lineBetween(0, 0, obs.radius * 0.8, 0);
      } else if (obs.behavior === 'breakable') {
        this.drawBreakableIndicatorOnGraphics(graphics, obs.health, obs.maxHealth);
      } else if (obs.behavior === 'moving') {
        graphics.lineStyle(2, 0xffffff, 0.5);
        if (obs.moveDirection === 'horizontal') {
          graphics.lineBetween(-10, 0, 10, 0);
        } else {
          graphics.lineBetween(0, -10, 0, 10);
        }
      }
    } else {
      const w = obs.width || 50;
      const h = obs.height || 20;
      graphics.fillRect(-w / 2, -h / 2, w, h);

      // Behavior indicators
      if (obs.behavior === 'rotating') {
        graphics.lineStyle(2, 0xffffff, 0.5);
        graphics.strokeCircle(0, 0, Math.min(w, h) * 0.3);
        graphics.lineBetween(0, 0, Math.min(w, h) * 0.4, 0);
      } else if (obs.behavior === 'breakable') {
        this.drawBreakableIndicatorOnGraphics(graphics, obs.health, obs.maxHealth);
      } else if (obs.behavior === 'moving') {
        graphics.lineStyle(2, 0xffffff, 0.5);
        if (obs.moveDirection === 'horizontal') {
          graphics.lineBetween(-15, 0, 15, 0);
        } else {
          graphics.lineBetween(0, -15, 0, 15);
        }
      } else if (obs.behavior === 'crusher') {
        // Crusher: draw danger stripes and arrow
        graphics.lineStyle(3, 0x000000, 0.8);
        const stripeGap = 8;
        for (let i = -w/2; i < w/2; i += stripeGap * 2) {
          graphics.lineBetween(i, -h/2, i + stripeGap, h/2);
        }
        // Arrow showing direction
        graphics.lineStyle(2, 0xffffff, 1);
        const arrowSize = 8;
        switch (obs.crusherDirection) {
          case 'down':
            graphics.lineBetween(0, -h/4, 0, h/4);
            graphics.lineBetween(0, h/4, -arrowSize, h/4 - arrowSize);
            graphics.lineBetween(0, h/4, arrowSize, h/4 - arrowSize);
            break;
          case 'up':
            graphics.lineBetween(0, h/4, 0, -h/4);
            graphics.lineBetween(0, -h/4, -arrowSize, -h/4 + arrowSize);
            graphics.lineBetween(0, -h/4, arrowSize, -h/4 + arrowSize);
            break;
          case 'right':
            graphics.lineBetween(-w/4, 0, w/4, 0);
            graphics.lineBetween(w/4, 0, w/4 - arrowSize, -arrowSize);
            graphics.lineBetween(w/4, 0, w/4 - arrowSize, arrowSize);
            break;
          case 'left':
            graphics.lineBetween(w/4, 0, -w/4, 0);
            graphics.lineBetween(-w/4, 0, -w/4 + arrowSize, -arrowSize);
            graphics.lineBetween(-w/4, 0, -w/4 + arrowSize, arrowSize);
            break;
        }
      }
    }
  }

  /**
   * Draw breakable indicator with health
   */
  drawBreakableIndicatorOnGraphics(graphics, health, maxHealth) {
    graphics.lineStyle(2, 0xffffff, 0.7);
    // Draw crack lines based on damage
    const damage = maxHealth - health;
    if (damage >= 1) {
      graphics.lineBetween(-5, -5, 5, 5);
    }
    if (damage >= 2) {
      graphics.lineBetween(5, -5, -5, 5);
    }
  }

  /**
   * Draw start zone indicator
   */
  drawStartZone(zone) {
    this.bgLayer.fillStyle(0x00ff88, 0.15);
    this.bgLayer.fillRect(zone.x, zone.y, zone.width, zone.height);

    this.bgLayer.lineStyle(2, 0x00ff88, 0.5);
    // Dashed border
    const dashLength = 10;
    for (let i = zone.x; i < zone.x + zone.width; i += dashLength * 2) {
      this.bgLayer.lineBetween(i, zone.y, Math.min(i + dashLength, zone.x + zone.width), zone.y);
      this.bgLayer.lineBetween(i, zone.y + zone.height, Math.min(i + dashLength, zone.x + zone.width), zone.y + zone.height);
    }
  }

  createWalls() {
    const w = this.gameWidth;
    const h = this.gameHeight;
    const t = 20;

    if (this.walls) {
      this.walls.forEach(wall => {
        if (wall) this.matter.world.remove(wall);
      });
    }
    this.walls = [];

    const opts = { isStatic: true, friction: 0, restitution: 1, label: 'wall' };

    this.walls.push(this.matter.add.rectangle(-t/2, h/2, t, h, opts));
    this.walls.push(this.matter.add.rectangle(w + t/2, h/2, t, h, opts));
    this.walls.push(this.matter.add.rectangle(w/2, -t/2, w, t, opts));
    this.walls.push(this.matter.add.rectangle(w/2, h + t/2, w, t, opts));

    this.obstacleLayer.fillStyle(0x2d3748, 1);
    this.obstacleLayer.fillRect(0, 0, 10, h);
    this.obstacleLayer.fillRect(w - 10, 0, 10, h);
  }

  drawFinishLine(finishY) {
    // If we have a finish zone from editor, draw it as a zone
    if (this.finishZone) {
      this.drawFinishZone(this.finishZone);
      return;
    }

    // Fallback: draw checkered line for procedural maps
    const tileSize = 20;
    const cols = Math.ceil(this.gameWidth / tileSize);

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < 2; row++) {
        const isWhite = (col + row) % 2 === 0;
        this.finishLayer.fillStyle(isWhite ? 0xffffff : 0x000000, 1);
        this.finishLayer.fillRect(col * tileSize, finishY + row * tileSize, tileSize, tileSize);
      }
    }

    if (this.finishText) this.finishText.destroy();
    this.finishText = this.add.text(this.gameWidth / 2, finishY - 15, 'FINISH', {
      fontSize: '16px',
      color: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  /**
   * Draw finish zone with checkered pattern
   */
  drawFinishZone(zone) {
    const tileSize = 15;
    const cols = Math.ceil(zone.width / tileSize);
    const rows = Math.ceil(zone.height / tileSize);

    // Draw checkered pattern inside the zone
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const isWhite = (col + row) % 2 === 0;
        this.finishLayer.fillStyle(isWhite ? 0xffffff : 0x111111, 0.9);

        const x = zone.x + col * tileSize;
        const y = zone.y + row * tileSize;
        const w = Math.min(tileSize, zone.x + zone.width - x);
        const h = Math.min(tileSize, zone.y + zone.height - y);

        this.finishLayer.fillRect(x, y, w, h);
      }
    }

    // Red border
    this.finishLayer.lineStyle(3, 0xff4444, 1);
    this.finishLayer.strokeRect(zone.x, zone.y, zone.width, zone.height);

    // FINISH label
    if (this.finishText) this.finishText.destroy();
    this.finishText = this.add.text(
      zone.x + zone.width / 2,
      zone.y + zone.height / 2,
      'FINISH',
      {
        fontSize: '14px',
        color: '#ff4444',
        fontStyle: 'bold',
        backgroundColor: '#000000',
        padding: { x: 5, y: 2 }
      }
    ).setOrigin(0.5);
  }

  createBalls() {
    console.log('[RaceScene] Creating balls...');

    try {
      // Clear existing
      this.balls.forEach(ball => {
        if (ball.graphics) ball.graphics.destroy();
        if (ball.hpBar) ball.hpBar.destroy();
        if (ball.hpBarBg) ball.hpBarBg.destroy();
        if (ball.body) this.matter.world.remove(ball.body);
      });
      this.balls = [];

      const ballCount = this.config.race.ballCount;
      const radius = this.config.balls.radius;
      const colors = this.config.balls.colors;

      console.log(`[RaceScene] Ball config: count=${ballCount}, radius=${radius}, colors=${colors.length}`);

      // Calculate spawn positions based on spawn zone or default
      let spawnPositions;
      if (this.spawnZone) {
        // Use editor spawn zone
        const laneWidth = this.spawnZone.width / ballCount;
        spawnPositions = Array.from({ length: ballCount }, (_, i) => ({
          x: this.spawnZone.x + laneWidth * i + laneWidth / 2,
          y: this.spawnZone.y + this.spawnZone.height / 2
        }));
      } else {
        // Default: spread across width
        const laneWidth = (this.gameWidth - 40) / ballCount;
        const spawnY = this.spawnY || (this.gameHeight - 60);
        spawnPositions = Array.from({ length: ballCount }, (_, i) => ({
          x: 20 + laneWidth * i + laneWidth / 2,
          y: spawnY
        }));
      }

      for (let i = 0; i < ballCount; i++) {
        try {
          const colorData = colors[i % colors.length];
          const x = spawnPositions[i].x;
          const y = spawnPositions[i].y;

          // Create physics body
          const body = this.matter.add.circle(x, y, radius, {
            restitution: 1,
            friction: 0,
            frictionAir: 0,
            frictionStatic: 0,
            inertia: Infinity,
            label: 'ball'
          });

          // Create graphics using extracted renderer
          const graphics = renderBallGraphics(this, radius, colorData.color);

          // Get stats from volume system based on ball name
          const stats = volumeSystem.getStatsForBall(colorData.name);
          if (!stats) {
            console.warn(`[RaceScene] No stats found for ball ${colorData.name}, using defaults`);
          }

          // Create HP bar using extracted renderer
          const { hpBar, hpBarBg } = renderHPBar(this, radius);

          this.balls.push({
            body,
            graphics,
            color: colorData.color,
            name: colorData.name,
            radius,
            progress: 0,
            finished: false,
            finishTime: null,
            finishPosition: null,
            // Volume-based stats
            hp: stats?.hp || 100,
            maxHp: stats?.maxHp || 100,
            speed: stats?.speed || 1.0,
            damage: stats?.damage || 10,
            hpBar,
            hpBarBg,
            // Boss damage tracking for standings
            damageDealtToBoss: 0
          });
        } catch (ballError) {
          console.error(`[RaceScene] Error creating ball ${i}:`, ballError);
        }
      }

      console.log('[RaceScene] Created', this.balls.length, 'balls with volume stats');
    } catch (err) {
      console.error('[RaceScene] Error in createBalls:', err);
    }
  }

  /**
   * Get effective speed for a ball (base speed * volume multiplier)
   */
  getBallSpeed(ball) {
    const speedMultiplier = ball?.speed || 1.0;
    return this.ballSpeed * speedMultiplier;
  }

  /**
   * Damage a ball (from projectiles, etc.)
   */
  damageBall(ball, amount) {
    if (!ball || ball.isRespawning) return;

    ball.hp -= amount;
    console.log(`[BALL DAMAGE] ${ball.name} took ${amount} damage, HP: ${ball.hp}/${ball.maxHp}`);
    gameLog.ballDamage(ball.name, amount, ball.hp, ball.maxHp);

    // Flash effect
    if (ball.graphics) {
      ball.graphics.setAlpha(0.3);
      this.time.delayedCall(100, () => {
        if (ball.graphics && !ball.isRespawning) {
          ball.graphics.setAlpha(1);
        }
      });
    }

    // Check for death
    if (ball.hp <= 0) {
      this.respawnBall(ball);
    }
  }

  /**
   * Update weapon firing for all balls (auto-attack loop)
   */
  updateWeaponFiring(delta) {
    if (!this.inventorySystem || !this.weaponSystem) return;

    this.balls.forEach(ball => {
      if (ball.finished || ball.eliminated || ball.isRespawning) return;

      const weapons = this.inventorySystem.getWeapons(ball.name);
      weapons.forEach(weapon => {
        const weaponDef = WEAPON_TYPES[weapon.id];
        if (!weaponDef) return;

        // Skip passive weapons (they're always active, handled by WeaponSystem)
        if (weaponDef.passive) return;

        // Check cooldown
        if (weapon.cooldownRemaining <= 0) {
          // Fire weapon
          this.weaponSystem.fireWeapon(ball, weapon, this.inventorySystem);
          // Reset cooldown
          weapon.cooldownRemaining = weaponDef.cooldown;
        }
      });
    });
  }

  /**
   * Respawn a ball after death
   */
  respawnBall(ball) {
    if (!ball || ball.isRespawning) return;

    console.log(`[RESPAWN] ${ball.name} died, respawning in ${this.respawnDelay}ms...`);
    gameLog.death(ball.name);
    ball.isRespawning = true;

    // Hide ball
    if (ball.graphics) ball.graphics.setAlpha(0.2);
    if (ball.hpBar) ball.hpBar.setAlpha(0);
    if (ball.hpBarBg) ball.hpBarBg.setAlpha(0);

    // Stop ball
    this.matter.body.setVelocity(ball.body, { x: 0, y: 0 });

    // Respawn after delay
    this.time.delayedCall(this.respawnDelay, () => {
      if (!ball || ball.finished) return;

      // Calculate respawn position
      let respawnX, respawnY;
      if (this.spawnZone) {
        respawnX = this.spawnZone.x + this.spawnZone.width / 2;
        respawnY = this.spawnZone.y + this.spawnZone.height / 2;
      } else {
        respawnX = this.gameWidth / 2;
        respawnY = this.gameHeight - 60;
      }

      // Add some random offset to prevent stacking
      respawnX += (Math.random() - 0.5) * 100;

      // Reset position
      this.matter.body.setPosition(ball.body, { x: respawnX, y: respawnY });

      // Reset HP
      ball.hp = ball.maxHp;
      ball.isRespawning = false;

      // Show ball again
      if (ball.graphics) ball.graphics.setAlpha(1);
      if (ball.hpBar) ball.hpBar.setAlpha(1);
      if (ball.hpBarBg) ball.hpBarBg.setAlpha(1);

      // Give initial velocity
      const effectiveSpeed = this.getBallSpeed(ball);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2;
      this.matter.body.setVelocity(ball.body, {
        x: Math.cos(angle) * effectiveSpeed,
        y: Math.sin(angle) * effectiveSpeed
      });

      console.log(`[RESPAWN] ${ball.name} respawned at (${Math.round(respawnX)}, ${Math.round(respawnY)})`);
      gameLog.respawn(ball.name);
    });
  }

  /**
   * Spawn a boss in the scene
   */
  spawnBoss(x, y, config = {}) {
    if (this.bossSystem) {
      this.bossSystem.spawn(x, y, config);
    }
  }

  /**
   * Called when boss is defeated
   * For boss levels, rankings are determined by damage dealt to the boss
   */
  onBossDeath() {
    console.log('[RaceScene] Boss defeated!');

    // Check win condition - only complete level if boss death counts as win
    if (this.bossWinCondition === 'boss' || this.bossWinCondition === 'either') {
      console.log('[RaceScene] Win condition met (boss death). Level complete.');

      // Calculate damage-based rankings for boss levels
      this.calculateBossDamageRankings();

      this.stopRace();

      // Notify chain system
      if (window.onLevelComplete) {
        window.onLevelComplete();
      }
    } else {
      // Boss is just an obstacle, still need to reach finish
      console.log('[RaceScene] Boss defeated but win condition is "finish" - continue to finish zone.');
      gameLog.log('Boss defeated! Now reach the finish!', 'info');
    }
  }

  /**
   * Calculate and assign finish positions based on damage dealt to boss
   * Called when a boss level is won
   */
  calculateBossDamageRankings() {
    // Sort balls by damage dealt to boss (highest first)
    const rankings = [...this.balls]
      .filter(b => !b.eliminated)
      .sort((a, b) => {
        const damageA = a.damageDealtToBoss || 0;
        const damageB = b.damageDealtToBoss || 0;
        return damageB - damageA;
      });

    // Get current race time for finish timestamps
    const raceTime = this.controller ? this.controller.getRaceTime() : (Date.now() - this.raceStartTime) / 1000;

    // Assign finish positions based on damage ranking
    rankings.forEach((ball, index) => {
      ball.finished = true;
      ball.finishPosition = index + 1;
      ball.finishTime = raceTime;
      console.log(`[DAMAGE RANKING] #${index + 1}: ${ball.name} - ${ball.damageDealtToBoss || 0} damage, time: ${raceTime.toFixed(1)}s`);
    });

    // Log damage summary to game log
    const summaryRankings = rankings.map(b => ({
      name: b.name,
      damage: b.damageDealtToBoss || 0
    }));
    gameLog.damageSummary(summaryRankings);
  }

  update(time, delta) {
    try {
      const deltaSeconds = delta / 1000;

      // Update special obstacles (rotating, moving)
      this.updateSpecialObstacles(deltaSeconds);

      // Update boss system (projectiles, etc.)
      if (this.bossSystem && this.isRacing) {
        this.bossSystem.update();
      }

      // Update weapon & item systems
      if (this.isRacing) {
        // Update weapon system (projectiles, melee, passive)
        if (this.weaponSystem) {
          this.weaponSystem.update(delta);
        }

        // Update item system (spawning, pickups)
        if (this.itemSystem) {
          this.itemSystem.update(delta);
        }

        // Update inventory system (buff expirations)
        if (this.inventorySystem) {
          this.inventorySystem.update(delta);
        }

        // Auto-fire weapons for each ball
        this.updateWeaponFiring(delta);
      }

      // Update keyframe animations during race
      if (this.isRacing && this.animationPlayer) {
        const raceTime = Date.now() - this.raceStartTime;
        this.animationPlayer.update(this.obstacles, raceTime, this.matter);

        // After moving animated obstacles, check for balls trapped inside and push them out
        this.crushDetector.resolveAnimatedObstacleCollisions();
      }

      // Always enforce ball boundaries to prevent balls from escaping the map
      this.enforceBallBoundaries();

    // Update ball graphics positions
    this.balls.forEach(ball => {
      if (ball.body && ball.graphics) {
        ball.graphics.x = ball.body.position.x;
        ball.graphics.y = ball.body.position.y;

        // Update HP bar position and fill
        if (ball.hpBarBg && ball.hpBar) {
          ball.hpBarBg.x = ball.body.position.x;
          ball.hpBarBg.y = ball.body.position.y;
          ball.hpBar.x = ball.body.position.x;
          ball.hpBar.y = ball.body.position.y;

          // Update HP bar using extracted renderer
          updateHPBar(ball.hpBar, ball.hp, ball.maxHp, ball.radius);
        }
      }

      // Maintain constant speed during race (skip respawning balls)
      if (this.isRacing && !ball.finished && !ball.isRespawning) {
        const vel = ball.body.velocity;
        const pos = ball.body.position;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        const radius = ball.radius || 12;

        // Initialize position history for stuck detection
        if (!ball.posHistory) ball.posHistory = [];
        ball.posHistory.push({ x: pos.x, y: pos.y, time: Date.now() });
        if (ball.posHistory.length > 60) ball.posHistory.shift(); // Keep last 60 frames (~1 sec)

        // Wall detection with larger margin
        const wallMargin = 40;
        const nearLeftWall = pos.x < wallMargin;
        const nearRightWall = pos.x > this.gameWidth - wallMargin;
        const nearTopWall = pos.y < wallMargin;
        const nearBottomWall = pos.y > this.gameHeight - wallMargin;
        const nearAnyWall = nearLeftWall || nearRightWall || nearTopWall || nearBottomWall;

        // Check if truly stuck (hasn't moved much AND near a wall)
        // Only trigger near walls to avoid false positives from bouncing on obstacles mid-field
        let isStuck = false;
        if (ball.posHistory.length >= 30 && nearAnyWall) {
          const oldPos = ball.posHistory[0];
          const distMoved = Math.sqrt(Math.pow(pos.x - oldPos.x, 2) + Math.pow(pos.y - oldPos.y, 2));
          isStuck = distMoved < 15; // Less than 15 pixels in ~0.5 seconds while near wall
        }

        // If stuck near wall, force a strong random bounce toward center
        if (isStuck) {
          const centerX = this.gameWidth / 2;
          const centerY = this.gameHeight / 2;
          const toCenter = Math.atan2(centerY - pos.y, centerX - pos.x);
          const randomSpread = (Math.random() - 0.5) * Math.PI / 2; // +/- 45 degrees
          const escapeAngle = toCenter + randomSpread;

          const effectiveSpeed = this.getBallSpeed(ball);
          this.matter.body.setVelocity(ball.body, {
            x: Math.cos(escapeAngle) * effectiveSpeed * 1.2,
            y: Math.sin(escapeAngle) * effectiveSpeed * 1.2
          });
          ball.posHistory = []; // Clear history after unsticking
          console.log(`[UNSTICK] ${ball.name} was stuck at (${Math.round(pos.x)}, ${Math.round(pos.y)}), forced toward center`);
        }
        // If stopped, kick it
        else if (speed < 0.5) {
          const effectiveSpeed = this.getBallSpeed(ball);
          const angle = -Math.PI/2 + (Math.random() - 0.5) * Math.PI/2;
          this.matter.body.setVelocity(ball.body, {
            x: Math.cos(angle) * effectiveSpeed,
            y: Math.sin(angle) * effectiveSpeed
          });
        } else {
          const effectiveSpeed = this.getBallSpeed(ball);
          const absX = Math.abs(vel.x);
          const absY = Math.abs(vel.y);
          let newVelX = vel.x;
          let newVelY = vel.y;
          let needsAdjustment = false;

          // More aggressive wall detection (threshold 0.5 instead of 0.3)
          // Check if stuck on left/right walls (moving mostly vertical)
          if ((nearLeftWall || nearRightWall) && absX < absY * 0.5) {
            // Force strong bounce away from wall
            const bounceDir = nearLeftWall ? 1 : -1;
            const randomAngle = (Math.PI / 4) + Math.random() * (Math.PI / 4); // 45-90 degrees from wall
            newVelX = Math.cos(randomAngle) * effectiveSpeed * bounceDir;
            newVelY = vel.y > 0 ? Math.sin(randomAngle) * effectiveSpeed : -Math.sin(randomAngle) * effectiveSpeed;
            needsAdjustment = true;
          }
          // Check if stuck on top/bottom walls (moving mostly horizontal)
          else if ((nearTopWall || nearBottomWall) && absY < absX * 0.5) {
            // Force strong bounce away from wall
            const bounceDir = nearTopWall ? 1 : -1;
            const randomAngle = (Math.PI / 4) + Math.random() * (Math.PI / 4); // 45-90 degrees from wall
            newVelY = Math.sin(randomAngle) * effectiveSpeed * bounceDir;
            newVelX = vel.x > 0 ? Math.cos(randomAngle) * effectiveSpeed : -Math.cos(randomAngle) * effectiveSpeed;
            needsAdjustment = true;
          }
          // If near ANY wall and moving too parallel to it, bounce away
          else if (nearAnyWall) {
            const ratio = Math.min(absX, absY) / Math.max(absX, absY);
            if (ratio < 0.25) { // More aggressive: 0.25 instead of 0.15
              // Bounce toward center
              const centerX = this.gameWidth / 2;
              const centerY = this.gameHeight / 2;
              const toCenter = Math.atan2(centerY - pos.y, centerX - pos.x);
              const randomSpread = (Math.random() - 0.5) * Math.PI / 3;
              const newAngle = toCenter + randomSpread;
              newVelX = Math.cos(newAngle) * effectiveSpeed;
              newVelY = Math.sin(newAngle) * effectiveSpeed;
              needsAdjustment = true;
            }
          }
          // General check: if moving too parallel to any axis (not near wall)
          else {
            const ratio = Math.min(absX, absY) / Math.max(absX, absY);
            if (ratio < 0.1) {
              const currentAngle = Math.atan2(vel.y, vel.x);
              const nudge = (0.5 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1);
              const newAngle = currentAngle + nudge;
              newVelX = Math.cos(newAngle) * effectiveSpeed;
              newVelY = Math.sin(newAngle) * effectiveSpeed;
              needsAdjustment = true;
            }
          }

          if (needsAdjustment) {
            this.matter.body.setVelocity(ball.body, { x: newVelX, y: newVelY });
          } else {
            // Normal: maintain constant speed (per-ball)
            const scale = effectiveSpeed / speed;
            this.matter.body.setVelocity(ball.body, {
              x: vel.x * scale,
              y: vel.y * scale
            });
          }
        }
      }
    });

    // Update progress
    if (this.isRacing) {
      this.updateProgress();

      // === PHYSICS BREACH DETECTION ===
      // Detect if balls phase through crush wall into trap zone
      // Crush wall at x=380-390, trap zone is x > 390
      // If ball enters trap zone, it phased through - DON'T push it back, let it stay trapped as proof!
      this.balls.forEach(ball => {
        if (ball.finished || ball.eliminated) return;
        const pos = ball.body.position;
        const radius = ball.radius || 12;

        // Check if ball is in the TRAP ZONE (x > 395)
        if (pos.x > 395 && !ball.inTrapZone) {
          ball.inTrapZone = true;
          console.error(`[PHYSICS BREACH!] ${ball.name} phased through thin wall into TRAP ZONE!`);
          console.error(`  Position: (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
          console.error(`  Velocity: (${ball.body.velocity.x.toFixed(2)}, ${ball.body.velocity.y.toFixed(2)})`);

          // Log to bounce log for analysis
          this.bounceLog.push({
            time: Date.now(),
            ball: ball.name,
            position: { x: Math.round(pos.x), y: Math.round(pos.y) },
            hitType: 'PHYSICS_BREACH',
            preVelocity: { x: ball.body.velocity.x.toFixed(2), y: ball.body.velocity.y.toFixed(2) },
            postVelocity: { x: '0', y: '0' },
            preAngle: '0',
            postAngle: '0',
            angleDiff: '0'
          });

          // Visual indicator - flash ball
          if (ball.graphics) {
            ball.graphics.setAlpha(0.5);
          }

          // DON'T push back - let it stay trapped as visible proof of physics failure
        }
      });
    }
    } catch (error) {
      console.error('[RaceScene] Error in update loop:', error);
    }
  }

  /**
   * Update special obstacles (rotating, moving)
   */
  updateSpecialObstacles(deltaSeconds) {
    this.obstacles.forEach(obs => {
      if (obs.destroyed) return;

      // Handle rotating obstacles
      if (obs.rotating && obs.graphics) {
        const rpm = obs.rotationSpeed || 2;
        const direction = obs.rotationDirection === 'ccw' ? -1 : 1;
        const rotationAmount = (rpm * Math.PI * 2 / 60) * deltaSeconds * direction;

        // Update graphics rotation
        obs.graphics.rotation += rotationAmount;

        // Update physics body rotation
        this.matter.body.setAngle(obs.body, obs.body.angle + rotationAmount);
      }

      // Handle moving obstacles
      if (obs.moving && obs.graphics) {
        const speed = obs.moveSpeed || 50;
        const distance = obs.moveDistance || 100;

        // Update phase (oscillates 0 to 1 and back)
        obs.movePhase += (speed / distance) * deltaSeconds;
        if (obs.movePhase > 2) obs.movePhase -= 2;

        // Calculate offset (ping-pong motion)
        const t = obs.movePhase <= 1 ? obs.movePhase : 2 - obs.movePhase;
        const offset = (t - 0.5) * distance;

        let newX = obs.moveStartX;
        let newY = obs.moveStartY;

        if (obs.moveDirection === 'horizontal') {
          newX = obs.moveStartX + offset;
        } else {
          newY = obs.moveStartY + offset;
        }

        // Update graphics position
        obs.graphics.x = newX;
        obs.graphics.y = newY;

        // Update physics body position
        this.matter.body.setPosition(obs.body, { x: newX, y: newY });
      }

      // Handle crusher obstacles - ONLY move when race is active
      if (obs.crusher && obs.graphics && this.isRacing) {
        if (obs.crusherActive) {
          const speed = obs.crusherSpeed || 80;
          const currentPos = obs.body.position;
          let newX = currentPos.x;
          let newY = currentPos.y;
          let reachedEnd = false;

          // Move in crusher direction
          switch (obs.crusherDirection) {
            case 'down':
              newY += speed * deltaSeconds;
              if (newY >= this.gameHeight - 20) reachedEnd = true;
              break;
            case 'up':
              newY -= speed * deltaSeconds;
              if (newY <= 20) reachedEnd = true;
              break;
            case 'right':
              newX += speed * deltaSeconds;
              if (newX >= this.gameWidth - 20) reachedEnd = true;
              break;
            case 'left':
              newX -= speed * deltaSeconds;
              if (newX <= 20) reachedEnd = true;
              break;
          }

          // Update position
          obs.graphics.x = newX;
          obs.graphics.y = newY;
          this.matter.body.setPosition(obs.body, { x: newX, y: newY });

          // Check for crushed balls
          this.crushDetector.checkCrushedBalls(obs);

          // If reached end, start reset timer
          if (reachedEnd) {
            obs.crusherActive = false;
            obs.crusherResetTimer = obs.crusherResetDelay || 2000;
          }
        } else {
          // Waiting to reset
          obs.crusherResetTimer -= deltaSeconds * 1000;
          if (obs.crusherResetTimer <= 0) {
            // Reset to start position
            obs.graphics.x = obs.crusherStartX;
            obs.graphics.y = obs.crusherStartY;
            this.matter.body.setPosition(obs.body, {
              x: obs.crusherStartX,
              y: obs.crusherStartY
            });
            obs.crusherActive = true;
          }
        }
      }
    });
  }

  /**
   * Keep all balls within game boundaries
   * Called every frame to prevent balls from escaping
   */
  enforceBallBoundaries() {
    if (!this.balls) return;

    const Matter = Phaser.Physics.Matter.Matter;

    this.balls.forEach(ball => {
      if (!ball.body || ball.finished || ball.eliminated) return;

      const pos = ball.body.position;
      const vel = ball.body.velocity;
      const radius = ball.radius || 12;
      const margin = radius + 2;

      let newX = pos.x;
      let newY = pos.y;
      let newVelX = vel.x;
      let newVelY = vel.y;
      let needsUpdate = false;

      // Left boundary
      if (pos.x < margin) {
        newX = margin;
        newVelX = Math.abs(vel.x) * 0.8; // Bounce with some energy loss
        needsUpdate = true;
      }
      // Right boundary
      if (pos.x > this.gameWidth - margin) {
        newX = this.gameWidth - margin;
        newVelX = -Math.abs(vel.x) * 0.8;
        needsUpdate = true;
      }
      // Top boundary
      if (pos.y < margin) {
        newY = margin;
        newVelY = Math.abs(vel.y) * 0.8;
        needsUpdate = true;
      }
      // Bottom boundary
      if (pos.y > this.gameHeight - margin) {
        newY = this.gameHeight - margin;
        newVelY = -Math.abs(vel.y) * 0.8;
        needsUpdate = true;
      }

      if (needsUpdate) {
        Matter.Body.setPosition(ball.body, { x: newX, y: newY });
        Matter.Body.setVelocity(ball.body, { x: newVelX, y: newVelY });
      }
    });
  }

  // Placeholder to maintain code structure - old complex detection removed
  checkCrushedBalls_DISABLED(crusher) {
    if (!this.isRacing) return;

    const crusherPos = crusher.body.position;
    const crusherWidth = crusher.data.width || 50;
    const crusherHeight = crusher.data.height || 20;
    const crusherHalfH = crusherHeight / 2;
    const crusherHalfW = crusherWidth / 2;

    this.balls.forEach(ball => {
      if (ball.finished || ball.eliminated) return;

      const ballPos = ball.body.position;
      const ballRadius = ball.radius || 12;
      const ballDiameter = ballRadius * 2;

      // Find the closest surface in the crusher's direction
      let closestSurfaceDist = Infinity;

      // Check game walls first
      switch (crusher.crusherDirection) {
        case 'down': closestSurfaceDist = this.gameHeight; break;
        case 'up': closestSurfaceDist = 0; break;
        case 'right': closestSurfaceDist = this.gameWidth; break;
        case 'left': closestSurfaceDist = 0; break;
      }

      // Calculate gap between crusher edge and closest surface
      let crusherEdge, gap, ballInCrushZone;

      switch (crusher.crusherDirection) {
        case 'down':
          crusherEdge = crusherPos.y + crusherHalfH;
          gap = closestSurfaceDist - crusherEdge;
          ballInCrushZone = ballPos.x > crusherEdge - ballRadius &&
                           ballPos.x < closestSurfaceDist + ballRadius &&
                           ballPos.y >= crusherPos.y - crusherHalfH - ballRadius &&
                           ballPos.y <= crusherPos.y + crusherHalfH + ballRadius;
          break;
        case 'left':
          crusherEdge = crusherPos.x - crusherHalfW;
          gap = crusherEdge - closestSurfaceDist;
          ballInCrushZone = ballPos.x < crusherEdge + ballRadius &&
                           ballPos.x > closestSurfaceDist - ballRadius &&
                           ballPos.y >= crusherPos.y - crusherHalfH - ballRadius &&
                           ballPos.y <= crusherPos.y + crusherHalfH + ballRadius;
          break;
      }

      const inDanger = ballInCrushZone && gap < ballDiameter * 2;
      const crushed = ballInCrushZone && gap < ballDiameter * 0.8;

      // Visual danger feedback
      if (inDanger && !crushed && ball.graphics) {
        if (!ball.inDanger) {
          ball.inDanger = true;
          ball.graphics.setAlpha(0.6);
        }
      } else if (ball.inDanger && !inDanger && ball.graphics) {
        ball.inDanger = false;
        ball.graphics.setAlpha(1);
      }

      if (crushed) {
        this.eliminateBall(ball, 'crushed');
      }
    });
  }

  /**
   * Check if ball is near the crusher
   */
  isNearCrusher(ballPos, crusherPos, crusherWidth, crusherHeight, ballRadius) {
    const margin = ballRadius + 10;
    return Math.abs(ballPos.x - crusherPos.x) < crusherWidth / 2 + margin &&
           Math.abs(ballPos.y - crusherPos.y) < crusherHeight / 2 + margin;
  }

  /**
   * Check if ball is trapped between crusher and another obstacle
   * @param {Object} ball - Ball object
   * @param {Object} crusher - Crusher obstacle
   * @param {number} crushRadius - Smaller radius for grace (default: ball radius)
   */
  isBallTrappedAgainstObstacle(ball, crusher, crushRadius = null) {
    const ballPos = ball.body.position;
    const ballRadius = ball.radius || 12;
    const effectiveRadius = crushRadius || ballRadius;
    const crusherPos = crusher.body.position;

    // Check against other obstacles
    for (const obs of this.obstacles) {
      if (obs === crusher || obs.destroyed || obs.crusher) continue;

      const obsPos = obs.body.position;
      const obsWidth = obs.data.width || 50;
      const obsHeight = obs.data.height || 20;

      // Simple distance check for being trapped (using smaller crush radius for grace)
      const distToObs = Math.sqrt(
        Math.pow(ballPos.x - obsPos.x, 2) +
        Math.pow(ballPos.y - obsPos.y, 2)
      );
      const distToCrusher = Math.sqrt(
        Math.pow(ballPos.x - crusherPos.x, 2) +
        Math.pow(ballPos.y - crusherPos.y, 2)
      );

      // If ball is very close to both crusher and another obstacle
      // Using effectiveRadius (smaller) gives grace period
      if (distToObs < obsWidth / 2 + effectiveRadius && distToCrusher < 35) {
        return true;
      }
    }
    return false;
  }

  /**
   * Eliminate a ball from the race
   */
  eliminateBall(ball, reason) {
    if (ball.eliminated || ball.finished) return;

    ball.eliminated = true;
    ball.eliminationReason = reason;
    console.log(`${ball.name} was ${reason}!`);

    // Visual effect - squish and fade
    if (ball.graphics) {
      this.tweens.add({
        targets: ball.graphics,
        scaleX: 1.5,
        scaleY: 0.3,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          // Keep ball but make it invisible and static
          if (ball.body) {
            this.matter.body.setStatic(ball.body, true);
            this.matter.body.setPosition(ball.body, { x: -100, y: -100 });
          }
        }
      });
    }

    // Update finish tracker to show elimination
    this.updateFinishTrackerWithElimination(ball);
  }

  /**
   * Update finish tracker when a ball is eliminated
   */
  updateFinishTrackerWithElimination(eliminatedBall) {
    // The regular updateFinishTracker will handle this
    // Just need to call it after elimination
    if (this.finishTrackerUI) this.finishTrackerUI.update(this.balls);
  }


  updateProgress() {
    const startY = this.spawnY || (this.gameHeight - 60);
    const endY = this.finishY || 60;
    const totalDist = Math.abs(startY - endY);
    let finishedCount = this.balls.filter(b => b.finished).length;

    this.balls.forEach(ball => {
      if (ball.finished || ball.eliminated) return;

      const ballX = ball.body.position.x;
      const ballY = ball.body.position.y;

      // Calculate progress (distance traveled toward finish)
      ball.progress = Math.max(0, Math.min(100, ((startY - ballY) / totalDist) * 100));

      // Check if ball reached finish
      // Skip finish zone checking if win condition is 'boss' only (no finish zone needed)
      let hasFinished = false;

      if (this.bossWinCondition !== 'boss') {
        // Check finish zone for 'finish' and 'either' win conditions
        if (this.finishZone) {
          // Check if ball is inside finish zone rectangle
          hasFinished = this.isBallInZone(ballX, ballY, ball.radius, this.finishZone);
        } else {
          // Fallback: check Y position for procedural maps
          hasFinished = ballY <= endY + 40;
        }
      }

      if (hasFinished) {
        ball.finished = true;
        // Calculate finish time - use controller if available, otherwise use scene's raceStartTime
        const finishTime = this.controller ? this.controller.getRaceTime() : (Date.now() - this.raceStartTime) / 1000;
        ball.finishTime = finishTime > 0 ? finishTime : (Date.now() - this.raceStartTime) / 1000;
        ball.finishPosition = finishedCount + 1;
        console.log(`[FINISH] ${ball.name} finished at ${ball.finishTime.toFixed(2)}s (raceStartTime: ${this.raceStartTime}, controller: ${!!this.controller})`);
        finishedCount++; // Increment for next ball
        ball.progress = 100;
        console.log(ball.name, 'finished in position', ball.finishPosition);
        gameLog.finish(ball.name, ball.finishPosition);

        // Stop the ball and disable its collision so it doesn't block others
        this.matter.body.setVelocity(ball.body, { x: 0, y: 0 });
        this.matter.body.setStatic(ball.body, true);

        // Move ball out of the way (make it semi-transparent and smaller)
        if (ball.graphics) {
          ball.graphics.setAlpha(0.4);
          ball.graphics.setScale(0.7);
        }

        // Disable collision by setting collision filter
        ball.body.collisionFilter = {
          group: -1, // Negative group means no collision with same group
          category: 0x0002,
          mask: 0 // Don't collide with anything
        };

        // Update finish tracker
        if (this.finishTrackerUI) this.finishTrackerUI.update(this.balls);

        // Check if we should start countdown timer (non-boss races only)
        this.checkHalfFinishedTimer();
      }
    });

    // Race is complete when all balls are either finished or eliminated
    if (this.balls.every(b => b.finished || b.eliminated)) {
      this.onRaceComplete();
    }
  }

  /**
   * Start countdown timer when half the balls have finished (non-boss races only)
   */
  checkHalfFinishedTimer() {
    // Skip for boss levels
    if (this.bossWinCondition === 'boss') return;

    // Skip if timer already running
    if (this.halfFinishedTimerStarted) return;

    const totalBalls = this.balls.length;
    const finishedCount = this.balls.filter(b => b.finished || b.eliminated).length;
    const halfCount = Math.ceil(totalBalls / 2);

    // Start timer when half have finished
    if (finishedCount >= halfCount) {
      this.halfFinishedTimerStarted = true;
      this.raceCountdown = 15; // 15 seconds

      console.log(`[Race] ${finishedCount}/${totalBalls} finished, starting ${this.raceCountdown}s countdown`);

      // Create countdown display
      this.createCountdownDisplay();

      // Start countdown
      this.countdownTimer = this.time.addEvent({
        delay: 1000,
        repeat: this.raceCountdown - 1,
        callback: () => {
          this.raceCountdown--;
          this.updateCountdownDisplay();

          if (this.raceCountdown <= 0) {
            this.forceFinishRemainingBalls();
          }
        }
      });
    }
  }

  /**
   * Create countdown timer display
   */
  createCountdownDisplay() {
    if (this.countdownContainer) {
      this.countdownContainer.destroy();
    }

    this.countdownContainer = this.add.container(this.gameWidth / 2, 50);
    this.countdownContainer.setDepth(500);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(-80, -20, 160, 40, 10);
    bg.lineStyle(2, 0xff6600, 1);
    bg.strokeRoundedRect(-80, -20, 160, 40, 10);
    this.countdownContainer.add(bg);

    this.countdownText = this.add.text(0, 0, `TIME: ${this.raceCountdown}s`, {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ff6600'
    }).setOrigin(0.5);
    this.countdownContainer.add(this.countdownText);
  }

  /**
   * Update countdown display
   */
  updateCountdownDisplay() {
    if (this.countdownText) {
      this.countdownText.setText(`TIME: ${this.raceCountdown}s`);

      // Change color when low
      if (this.raceCountdown <= 5) {
        this.countdownText.setColor('#ff0000');
      }
    }
  }

  /**
   * Force finish remaining balls based on progress
   */
  forceFinishRemainingBalls() {
    console.log('[Race] Countdown expired, force finishing remaining balls');

    const raceTime = this.controller ? this.controller.getRaceTime() : (Date.now() - this.raceStartTime) / 1000;

    // Get unfinished balls sorted by progress (highest first)
    const unfinishedBalls = this.balls
      .filter(b => !b.finished && !b.eliminated)
      .sort((a, b) => (b.progress || 0) - (a.progress || 0));

    // Current finish count for position assignment
    let nextPosition = this.balls.filter(b => b.finished).length + 1;

    // Force finish each ball
    unfinishedBalls.forEach(ball => {
      ball.finished = true;
      ball.finishPosition = nextPosition++;
      ball.finishTime = raceTime;
      ball.timedOut = true; // Mark as timed out

      console.log(`[Race] ${ball.name} timed out at position ${ball.finishPosition} (progress: ${(ball.progress || 0).toFixed(1)}%)`);

      // Stop the ball
      this.matter.body.setVelocity(ball.body, { x: 0, y: 0 });
      this.matter.body.setStatic(ball.body, true);

      // Visual indicator for timed out
      if (ball.graphics) {
        ball.graphics.setAlpha(0.5);
      }
    });

    // Clean up countdown display
    if (this.countdownContainer) {
      this.countdownContainer.destroy();
      this.countdownContainer = null;
    }

    // Update tracker and complete race
    if (this.finishTrackerUI) this.finishTrackerUI.update(this.balls);
    this.onRaceComplete();
  }

  /**
   * Check if a ball is inside a zone
   */
  isBallInZone(ballX, ballY, ballRadius, zone) {
    // Check if ball center is inside zone (with some tolerance)
    return ballX >= zone.x &&
           ballX <= zone.x + zone.width &&
           ballY >= zone.y &&
           ballY <= zone.y + zone.height;
  }

  onRaceComplete() {
    console.log('Race complete!');
    this.isRacing = false;
    if (this.controller) {
      this.controller.isRacing = false;
    }

    // Determine if level should complete based on win condition
    // 'boss' - only boss death triggers completion (handled in onBossDeath)
    // 'finish' - reaching finish zone completes (handled here)
    // 'either' - both can complete (boss death OR finish zone)
    if (this.bossWinCondition === 'finish' || this.bossWinCondition === 'either') {
      // Finish zone reached - level complete
      if (window.onLevelComplete) {
        window.onLevelComplete();
      }
    }
    // For 'boss' win condition, level completion is handled by onBossDeath
  }

  startRace() {
    console.log('Starting race...');
    console.log('[RaceScene] Ball speed:', this.ballSpeed);
    console.log('[RaceScene] Balls count:', this.balls.length);
    gameLog.raceStart();
    console.log('[RaceScene] Obstacles count:', this.obstacles.length);

    this.isRacing = true;
    this.raceStartTime = Date.now();
    console.log(`[RaceScene] Race started at timestamp: ${this.raceStartTime}`);

    // Initialize ball inventories (don't add weapons - weapons come from roulette)
    if (this.inventorySystem) {
      this.balls.forEach(ball => {
        this.inventorySystem.initBall(ball.name);
      });
      console.log('[RaceScene] Ball inventories initialized (empty - weapons from roulette only)');
    }

    // Initialize item system with map data and spawn initial items
    if (this.itemSystem && this.editorMapData) {
      const editorData = this.editorMapData.data || this.editorMapData;
      this.itemSystem.init(editorData);
      this.itemSystem.spawnInitialItems();
      console.log('[RaceScene] Item system initialized');
    }

    // Start animation playback with debug mode
    if (this.animationPlayer) {
      this.animationPlayer.setDebugMode(true);
      this.animationPlayer.start(0);
      console.log('[RaceScene] Animation player started, animations:', this.animationPlayer.animations.size);
    }

    this.balls.forEach(ball => {
      const effectiveSpeed = this.getBallSpeed(ball);
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 2);
      const velX = Math.cos(angle) * effectiveSpeed;
      const velY = Math.sin(angle) * effectiveSpeed;
      console.log(`[RaceScene] ${ball.name} speed=${effectiveSpeed.toFixed(2)} initial velocity: (${velX.toFixed(2)}, ${velY.toFixed(2)})`);
      this.matter.body.setVelocity(ball.body, { x: velX, y: velY });
    });

    // Start boss attacks if boss exists
    if (this.bossSystem && this.bossSystem.isAlive()) {
      this.bossSystem.startAttacking();
      console.log('[RaceScene] Boss started attacking');
    }
  }

  stopRace() {
    this.isRacing = false;
    this.balls.forEach(ball => {
      this.matter.body.setVelocity(ball.body, { x: 0, y: 0 });
    });

    // Stop animation playback
    if (this.animationPlayer) {
      this.animationPlayer.stop();
    }

    // Stop boss attacks
    if (this.bossSystem) {
      this.bossSystem.stopAttacking();
    }

    // Clear weapon system projectiles
    if (this.weaponSystem) {
      this.weaponSystem.cleanup();
    }
  }

  reset() {
    console.log('Resetting...');
    this.isRacing = false;

    // Clean up countdown timer if running
    this.halfFinishedTimerStarted = false;
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }
    if (this.countdownContainer) {
      this.countdownContainer.destroy();
      this.countdownContainer = null;
    }

    // Note: Boss cleanup is handled by loadChainMap, not here
    // This allows reset() to be called without destroying the boss

    const ballCount = this.balls.length;

    // Calculate spawn positions
    let spawnPositions;
    if (this.spawnZone) {
      const laneWidth = this.spawnZone.width / ballCount;
      spawnPositions = Array.from({ length: ballCount }, (_, i) => ({
        x: this.spawnZone.x + laneWidth * i + laneWidth / 2,
        y: this.spawnZone.y + this.spawnZone.height / 2
      }));
    } else {
      const laneWidth = (this.gameWidth - 40) / ballCount;
      const spawnY = this.spawnY || (this.gameHeight - 60);
      spawnPositions = Array.from({ length: ballCount }, (_, i) => ({
        x: 20 + laneWidth * i + laneWidth / 2,
        y: spawnY
      }));
    }

    this.balls.forEach((ball, i) => {
      // Restore collision
      this.matter.body.setStatic(ball.body, false);
      ball.body.collisionFilter = {
        group: 0,
        category: 0x0001,
        mask: 0xFFFFFFFF // Collide with everything
      };

      // Restore graphics
      if (ball.graphics) {
        ball.graphics.setAlpha(1);
        ball.graphics.setScale(1);
        // Note: Graphics objects don't have clearTint(), only Sprites do
      }

      this.matter.body.setPosition(ball.body, spawnPositions[i]);
      this.matter.body.setVelocity(ball.body, { x: 0, y: 0 });

      ball.progress = 0;
      ball.finished = false;
      ball.finishTime = null;
      ball.finishPosition = null;
      ball.timedOut = false; // Reset timeout flag
      // Reset elimination state
      ball.eliminated = false;
      ball.eliminationReason = null;
      ball.inDanger = false;
      ball.slideContactTime = 0;
      ball.posHistory = [];
      ball.inTrapZone = false; // Reset trap zone detection
      // Reset HP and respawn state
      ball.hp = ball.maxHp;
      ball.isRespawning = false;
      // Reset boss damage tracking for new level
      ball.damageDealtToBoss = 0;
      if (ball.hpBar) ball.hpBar.setAlpha(1);
      if (ball.hpBarBg) ball.hpBarBg.setAlpha(1);
    });

    // Clear bounce log and collision tracking
    this.bounceLog = [];
    if (this.recentCollisions) {
      this.recentCollisions.clear();
    }

    // Reset all crushers to starting position
    this.obstacles.forEach(obs => {
      if (obs.crusher && obs.graphics) {
        obs.graphics.x = obs.crusherStartX;
        obs.graphics.y = obs.crusherStartY;
        this.matter.body.setPosition(obs.body, {
          x: obs.crusherStartX,
          y: obs.crusherStartY
        });
        obs.crusherActive = true;
        obs.crusherResetTimer = 0;
      }
    });

    // Reset animation player
    if (this.animationPlayer) {
      this.animationPlayer.reset();
      // Reset animated obstacles to base positions
      this.obstacles.forEach(obs => {
        if (obs.animBaseX !== undefined && obs.graphics) {
          obs.graphics.x = obs.animBaseX;
          obs.graphics.y = obs.animBaseY;
          obs.graphics.rotation = obs.animBaseRotation || 0;
          obs.graphics.scaleX = obs.animBaseScaleX || 1;
          obs.graphics.scaleY = obs.animBaseScaleY || 1;
          this.matter.body.setPosition(obs.body, {
            x: obs.animBaseX,
            y: obs.animBaseY
          });
          this.matter.body.setAngle(obs.body, obs.animBaseRotation || 0);
        }
      });
    }

    // Reset finish tracker
    if (this.finishTrackerUI) {
      this.finishTrackerUI.create();
    }

    // Clear and reinitialize weapon/item systems
    if (this.weaponSystem) {
      this.weaponSystem.cleanup();
    }
    if (this.itemSystem) {
      this.itemSystem.clear();
      // Re-initialize with map data and spawn items
      if (this.editorMapData) {
        const editorData = this.editorMapData.data || this.editorMapData;
        this.itemSystem.init(editorData);
        this.itemSystem.spawnInitialItems();
      }
    }
    // Note: Don't clear inventories on reset - weapons persist
  }

  regenerateMap() {
    this.generateMap();
    this.createBalls();
  }

  onConfigUpdate(newConfig) {
    this.config = newConfig;
    this.ballSpeed = newConfig.physics.gravity || 5;
    if (this.ballSpeed < 3) this.ballSpeed = 5;

    if (this.balls.length !== newConfig.race.ballCount) {
      this.createBalls();
    }
  }

  getStandings() {
    return [...this.balls]
      .sort((a, b) => {
        if (a.finished && b.finished) return a.finishPosition - b.finishPosition;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.progress - a.progress;
      })
      .map(ball => ({
        name: ball.name,
        color: ball.color,
        progress: Math.round(ball.progress),
        finished: ball.finished,
        finishTime: ball.finishTime,
        position: ball.finishPosition,
        damageDealtToBoss: ball.damageDealtToBoss || 0
      }));
  }
}
