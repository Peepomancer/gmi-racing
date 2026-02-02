/**
 * BossSystem - Manages boss fights with projectile attack patterns
 *
 * PURPOSE:
 * Creates boss entities that shoot projectiles at balls.
 * Balls damage the boss by bouncing into it (using their damage stat).
 * Boss death triggers level completion in chain mode.
 *
 * FEATURES:
 * - Boss entity with health bar and visual representation
 * - Multiple attack patterns (spiral, spread, aimed, random, burst)
 * - Projectiles with configurable lifetime (auto-cleanup)
 * - Death animation with callback to scene
 *
 * ATTACK PATTERNS:
 * - spiral: Single projectile rotating around boss
 * - spread: 5 projectiles in a fan pattern downward
 * - aimed: 3 projectiles targeted at nearest ball
 * - random: 3 projectiles in random directions
 * - burst: Rapid-fire downward shots
 *
 * USAGE:
 *   const boss = new BossSystem(scene);
 *   boss.spawn(400, 100, { health: 100, pattern: 'spiral' });
 *   boss.startAttacking();     // Begin shooting
 *   boss.takeDamage(15);       // Ball hit the boss
 *   boss.cleanup();            // Remove boss
 *
 * COLLISION:
 * - Ball hitting boss: Ball's damage stat applied to boss HP
 * - Projectile hitting ball: Ball takes projectile damage (default 10)
 * - Projectiles auto-destroy after 5 seconds or leaving screen
 *
 * @module BossSystem
 */

import { gameLog } from './GameLog.js';

export class BossSystem {
  constructor(scene) {
    this.scene = scene;
    this.boss = null;
    this.projectiles = [];
    this.projectileLifetime = 5000; // ms before projectile disappears
    this.attackInterval = null;
    this.isActive = false;

    // Attack pattern settings
    this.currentPattern = 'spiral';
    this.patternIndex = 0;
    this.attackCooldown = 800; // ms between attacks
  }

  /**
   * Spawn a boss at position
   */
  spawn(x, y, config = {}) {
    // Clean up any existing boss first to prevent duplicates
    if (this.boss || this.healthBar || this.healthBarBg) {
      console.log('[BossSystem] Cleaning up existing boss before spawn');
      this.cleanup();
    }

    const {
      width = 80,
      height = 80,
      health = 100,
      color = 0xff0000,
      shape = 'rectangle' // 'rectangle', 'circle', 'diamond'
    } = config;

    // Create boss graphics
    const graphics = this.scene.add.graphics();
    this.drawBoss(graphics, 0, 0, width, height, color, shape);

    // Create physics body (static)
    const body = this.scene.matter.add.rectangle(x, y, width, height, {
      isStatic: true,
      label: 'boss',
      isSensor: false
    });

    this.boss = {
      body,
      graphics,
      x,
      y,
      width,
      height,
      health,
      maxHealth: health,
      color,
      shape,
      isAlive: true
    };

    // Position graphics
    graphics.x = x;
    graphics.y = y;

    // Draw health bar
    this.healthBarBg = this.scene.add.graphics();
    this.healthBar = this.scene.add.graphics();
    this.updateHealthBar();

    console.log('[BossSystem] Boss spawned at', x, y, 'with', health, 'HP');
    gameLog.bossSpawn(health, this.currentPattern);
    return this.boss;
  }

  /**
   * Draw boss shape
   */
  drawBoss(graphics, x, y, width, height, color, shape) {
    graphics.clear();

    // Outline
    graphics.lineStyle(3, 0x000000, 1);
    graphics.fillStyle(color, 1);

    switch (shape) {
      case 'circle':
        const radius = Math.min(width, height) / 2;
        graphics.fillCircle(x, y, radius);
        graphics.strokeCircle(x, y, radius);
        break;

      case 'diamond':
        graphics.beginPath();
        graphics.moveTo(x, y - height / 2);
        graphics.lineTo(x + width / 2, y);
        graphics.lineTo(x, y + height / 2);
        graphics.lineTo(x - width / 2, y);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;

      case 'rectangle':
      default:
        graphics.fillRect(x - width / 2, y - height / 2, width, height);
        graphics.strokeRect(x - width / 2, y - height / 2, width, height);
        break;
    }

    // Evil eyes
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(x - width / 5, y - height / 6, 8);
    graphics.fillCircle(x + width / 5, y - height / 6, 8);
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(x - width / 5, y - height / 6 + 2, 4);
    graphics.fillCircle(x + width / 5, y - height / 6 + 2, 4);
  }

  /**
   * Update health bar display
   */
  updateHealthBar() {
    if (!this.boss || !this.healthBarBg || !this.healthBar) return;

    const barWidth = 100;
    const barHeight = 10;
    const x = this.boss.x;
    const y = this.boss.y - this.boss.height / 2 - 20;

    // Background
    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x333333, 0.8);
    this.healthBarBg.fillRect(x - barWidth / 2, y, barWidth, barHeight);

    // Health fill
    const hpPercent = Math.max(0, this.boss.health / this.boss.maxHealth);
    const fillWidth = Math.round(barWidth * hpPercent);

    this.healthBar.clear();
    let hpColor = 0x00ff00;
    if (hpPercent < 0.3) hpColor = 0xff0000;
    else if (hpPercent < 0.6) hpColor = 0xffaa00;

    this.healthBar.fillStyle(hpColor, 1);
    this.healthBar.fillRect(x - barWidth / 2 + 2, y + 2, fillWidth - 4, barHeight - 4);
  }

  /**
   * Start boss attack pattern
   */
  startAttacking() {
    if (this.attackInterval) return;
    this.isActive = true;

    this.attackInterval = setInterval(() => {
      if (this.boss && this.boss.isAlive && this.isActive) {
        this.executeAttackPattern();
      }
    }, this.attackCooldown);

    console.log('[BossSystem] Boss started attacking with pattern:', this.currentPattern);
  }

  /**
   * Stop boss attacks
   */
  stopAttacking() {
    this.isActive = false;
    if (this.attackInterval) {
      clearInterval(this.attackInterval);
      this.attackInterval = null;
    }
  }

  /**
   * Execute current attack pattern
   */
  executeAttackPattern() {
    if (!this.boss || !this.boss.isAlive) return;

    switch (this.currentPattern) {
      case 'spiral':
        this.patternSpiral();
        break;
      case 'spread':
        this.patternSpread();
        break;
      case 'aimed':
        this.patternAimed();
        break;
      case 'random':
        this.patternRandom();
        break;
      case 'burst':
        this.patternBurst();
        break;
      default:
        this.patternSpiral();
    }

    this.patternIndex++;
  }

  /**
   * Pattern: Spiral - single projectile rotating around
   */
  patternSpiral() {
    const angle = (this.patternIndex * 15) * (Math.PI / 180); // 15 degrees per shot
    this.fireProjectile(angle);
  }

  /**
   * Pattern: Spread - multiple projectiles in a fan
   */
  patternSpread() {
    const baseAngle = Math.PI / 2; // Down
    const spreadCount = 5;
    const spreadAngle = Math.PI / 4; // 45 degree spread total

    for (let i = 0; i < spreadCount; i++) {
      const offset = (i - (spreadCount - 1) / 2) * (spreadAngle / (spreadCount - 1));
      this.fireProjectile(baseAngle + offset);
    }
  }

  /**
   * Pattern: Aimed - shoot toward nearest ball
   */
  patternAimed() {
    const balls = this.scene.balls.filter(b => !b.finished && b.hp > 0);
    if (balls.length === 0) return;

    // Find nearest ball
    let nearest = balls[0];
    let nearestDist = Infinity;

    balls.forEach(ball => {
      const dx = ball.body.position.x - this.boss.x;
      const dy = ball.body.position.y - this.boss.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = ball;
      }
    });

    const dx = nearest.body.position.x - this.boss.x;
    const dy = nearest.body.position.y - this.boss.y;
    const angle = Math.atan2(dy, dx);

    // Fire with slight spread
    this.fireProjectile(angle);
    this.fireProjectile(angle - 0.2);
    this.fireProjectile(angle + 0.2);
  }

  /**
   * Pattern: Random - shoot in random directions
   */
  patternRandom() {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.fireProjectile(angle);
    }
  }

  /**
   * Pattern: Burst - quick succession of projectiles downward
   */
  patternBurst() {
    const burstPhase = this.patternIndex % 10;
    if (burstPhase < 5) {
      const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      this.fireProjectile(angle);
    }
  }

  /**
   * Fire a single projectile
   */
  fireProjectile(angle, speed = 4) {
    if (!this.boss) return;

    const x = this.boss.x;
    const y = this.boss.y;

    // Create projectile graphics
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xff6600, 1);
    graphics.fillCircle(0, 0, 6);
    graphics.lineStyle(2, 0xff0000, 1);
    graphics.strokeCircle(0, 0, 6);
    graphics.x = x;
    graphics.y = y;

    // Create physics body
    const body = this.scene.matter.add.circle(x, y, 6, {
      isSensor: true, // Pass through walls, only detect balls
      label: 'projectile',
      frictionAir: 0
    });

    // Set velocity
    this.scene.matter.body.setVelocity(body, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    });

    const projectile = {
      body,
      graphics,
      spawnTime: Date.now(),
      damage: 10
    };

    this.projectiles.push(projectile);
  }

  /**
   * Update projectiles (call in scene update)
   */
  update() {
    const now = Date.now();

    // Update projectile positions and cleanup old ones
    this.projectiles = this.projectiles.filter(proj => {
      // Check lifetime
      if (now - proj.spawnTime > this.projectileLifetime) {
        this.destroyProjectile(proj);
        return false;
      }

      // Check if out of bounds
      const pos = proj.body.position;
      if (pos.x < -50 || pos.x > this.scene.gameWidth + 50 ||
          pos.y < -50 || pos.y > this.scene.gameHeight + 50) {
        this.destroyProjectile(proj);
        return false;
      }

      // Update graphics position
      proj.graphics.x = pos.x;
      proj.graphics.y = pos.y;

      return true;
    });
  }

  /**
   * Destroy a projectile
   */
  destroyProjectile(proj) {
    if (proj.graphics) proj.graphics.destroy();
    if (proj.body) this.scene.matter.world.remove(proj.body);
  }

  /**
   * Boss takes damage
   */
  takeDamage(amount) {
    if (!this.boss || !this.boss.isAlive) return false;

    this.boss.health -= amount;
    this.updateHealthBar();

    // Flash effect
    if (this.boss.graphics) {
      this.boss.graphics.setAlpha(0.3);
      this.scene.time.delayedCall(100, () => {
        if (this.boss && this.boss.graphics) {
          this.boss.graphics.setAlpha(1);
        }
      });
    }

    console.log('[BossSystem] Boss took', amount, 'damage, HP:', this.boss.health);

    if (this.boss.health <= 0) {
      this.die();
      return true; // Boss died
    }

    return false;
  }

  /**
   * Boss death
   */
  die() {
    if (!this.boss || !this.boss.isAlive) return;

    console.log('[BossSystem] Boss defeated!');
    this.boss.isAlive = false;
    this.stopAttacking();

    // Hide health bar immediately
    if (this.healthBar) this.healthBar.setAlpha(0);
    if (this.healthBarBg) this.healthBarBg.setAlpha(0);

    // Notify scene immediately (don't wait for animation)
    // This triggers the chain progression
    if (this.scene.onBossDeath) {
      this.scene.onBossDeath();
    }

    // Death animation - flash and fade (cleanup will be called by loadChainMap)
    if (this.boss && this.boss.graphics) {
      this.scene.tweens.add({
        targets: this.boss.graphics,
        alpha: 0,
        scale: 1.5,
        duration: 500,
        onComplete: () => {
          // Only cleanup if not already cleaned up by chain transition
          if (this.boss) {
            this.cleanup();
          }
        }
      });
    }
  }

  /**
   * Set attack pattern
   */
  setPattern(pattern) {
    const validPatterns = ['spiral', 'spread', 'aimed', 'random', 'burst'];
    if (validPatterns.includes(pattern)) {
      this.currentPattern = pattern;
      this.patternIndex = 0;
      console.log('[BossSystem] Pattern set to:', pattern);
    }
  }

  /**
   * Set attack speed
   */
  setAttackCooldown(ms) {
    this.attackCooldown = ms;
    if (this.attackInterval) {
      this.stopAttacking();
      this.startAttacking();
    }
  }

  /**
   * Clean up all boss resources
   */
  cleanup() {
    console.log('[BossSystem] Cleanup called');
    this.stopAttacking();

    // Cancel any pending tweens on boss graphics
    if (this.boss && this.boss.graphics) {
      this.scene.tweens.killTweensOf(this.boss.graphics);
    }

    // Destroy projectiles
    this.projectiles.forEach(proj => this.destroyProjectile(proj));
    this.projectiles = [];

    // Destroy boss - be thorough
    if (this.boss) {
      // Remove physics body first
      if (this.boss.body) {
        try {
          this.scene.matter.world.remove(this.boss.body);
        } catch (e) {
          console.warn('[BossSystem] Error removing boss body:', e);
        }
        this.boss.body = null;
      }
      // Then destroy graphics
      if (this.boss.graphics) {
        try {
          this.boss.graphics.destroy();
        } catch (e) {
          console.warn('[BossSystem] Error destroying boss graphics:', e);
        }
        this.boss.graphics = null;
      }
      this.boss = null;
    }

    // Destroy health bars
    if (this.healthBar) {
      try {
        this.healthBar.destroy();
      } catch (e) {}
      this.healthBar = null;
    }
    if (this.healthBarBg) {
      try {
        this.healthBarBg.destroy();
      } catch (e) {}
      this.healthBarBg = null;
    }

    console.log('[BossSystem] Cleanup complete');
  }

  /**
   * Check if boss exists and is alive
   */
  isAlive() {
    return this.boss && this.boss.isAlive;
  }

  /**
   * Get boss info
   */
  getInfo() {
    if (!this.boss) return null;
    return {
      x: this.boss.x,
      y: this.boss.y,
      health: this.boss.health,
      maxHealth: this.boss.maxHealth,
      isAlive: this.boss.isAlive,
      pattern: this.currentPattern
    };
  }
}
