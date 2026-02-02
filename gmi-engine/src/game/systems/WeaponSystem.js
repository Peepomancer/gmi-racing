/**
 * WeaponSystem.js - Manages weapon firing, projectiles, melee attacks, and area effects
 *
 * Follows the BossSystem pattern for projectile management.
 */

import { WEAPON_TYPES } from './WeaponDefinitions.js';
import { gameLog } from './GameLog.js';

export class WeaponSystem {
  constructor(scene) {
    this.scene = scene;

    // Active projectiles
    this.projectiles = [];

    // Active melee hitboxes
    this.meleeHitboxes = [];

    // Active area effects
    this.areaEffects = [];

    // Passive weapon states (flail rotation, etc.)
    this.passiveStates = new Map(); // ballName -> { weaponId -> state }

    // Track hit cooldowns to prevent rapid multi-hits
    this.hitCooldowns = new Map(); // "attacker-target" -> timestamp
  }

  /**
   * Fire a weapon from a ball
   */
  fireWeapon(ball, weaponData, inventorySystem) {
    const weaponDef = WEAPON_TYPES[weaponData.id];
    if (!weaponDef) return;

    // Apply level bonuses
    const level = weaponData.level || 1;
    const damageMultiplier = 1 + (level - 1) * 0.2; // +20% per level

    // Get ball stats
    const stats = inventorySystem?.getStats(ball.name) || { damageMultiplier: 1 };
    const finalDamage = weaponDef.damage * damageMultiplier * stats.damageMultiplier;

    // Get firing direction (use ball velocity direction or mount angle)
    const mountAngle = inventorySystem?.getMountAngle(weaponData.mountIndex) || 0;
    const vel = ball.body.velocity;
    const moveAngle = Math.atan2(vel.y, vel.x);

    // Combine mount angle with movement direction
    const fireAngle = moveAngle + mountAngle;

    switch (weaponDef.type) {
      case 'projectile':
        this.fireProjectile(ball, weaponDef, fireAngle, finalDamage, level);
        break;
      case 'melee':
        if (!weaponDef.passive) {
          this.performMeleeAttack(ball, weaponDef, fireAngle, finalDamage);
        }
        break;
      case 'area':
        this.triggerAreaEffect(ball, weaponDef, finalDamage);
        break;
    }
  }

  /**
   * Fire a projectile weapon
   */
  fireProjectile(ball, weaponDef, angle, damage, level) {
    const x = ball.body.position.x;
    const y = ball.body.position.y;

    // Handle multi-shot weapons (shotgun)
    if (weaponDef.pelletCount) {
      const pelletCount = weaponDef.pelletCount + Math.floor(level / 2);
      const spread = weaponDef.spreadAngle;
      const angleStep = spread / (pelletCount - 1);
      const startAngle = angle - spread / 2;

      for (let i = 0; i < pelletCount; i++) {
        const pelletAngle = startAngle + angleStep * i;
        this.createProjectile(ball, weaponDef, x, y, pelletAngle, damage / pelletCount);
      }
    } else {
      // Single projectile
      this.createProjectile(ball, weaponDef, x, y, angle, damage);
    }
  }

  /**
   * Create a single projectile
   */
  createProjectile(ownerBall, weaponDef, x, y, angle, damage) {
    // Create projectile graphics
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(weaponDef.projectileColor, 1);
    graphics.fillCircle(0, 0, weaponDef.projectileRadius);
    graphics.lineStyle(1, 0xffffff, 0.5);
    graphics.strokeCircle(0, 0, weaponDef.projectileRadius);
    graphics.x = x;
    graphics.y = y;

    // Create physics body
    const isSensor = weaponDef.isSensor !== false; // Default to sensor (pass through walls)
    const body = this.scene.matter.add.circle(x, y, weaponDef.projectileRadius, {
      isSensor: isSensor,
      label: 'weapon_projectile',
      frictionAir: 0
    });

    // Set velocity
    const speed = weaponDef.projectileSpeed;
    this.scene.matter.body.setVelocity(body, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    });

    const projectile = {
      body,
      graphics,
      owner: ownerBall.name,
      weaponId: weaponDef.id,
      damage,
      knockback: weaponDef.knockback || 0,
      homing: weaponDef.homing || false,
      homingStrength: weaponDef.homingStrength || 0,
      bounces: weaponDef.bounces || 0,
      bouncesRemaining: weaponDef.bounces || 0,
      piercing: weaponDef.piercing || false,
      spawnTime: Date.now(),
      lifetime: weaponDef.projectileLifetime || 3000
    };

    this.projectiles.push(projectile);
  }

  /**
   * Perform a melee attack
   */
  performMeleeAttack(ball, weaponDef, angle, damage) {
    const x = ball.body.position.x;
    const y = ball.body.position.y;

    // Create melee hitbox
    const hitbox = {
      owner: ball.name,
      weaponId: weaponDef.id,
      x,
      y,
      angle,
      range: weaponDef.range,
      arcAngle: weaponDef.arcAngle,
      damage,
      knockback: weaponDef.knockback || 0,
      startTime: Date.now(),
      duration: weaponDef.arcDuration || 150,
      hitTargets: new Set(), // Track who we've hit
      graphics: null
    };

    // Create visual effect
    const graphics = this.scene.add.graphics();
    hitbox.graphics = graphics;

    this.meleeHitboxes.push(hitbox);
    this.drawMeleeArc(hitbox, weaponDef.color);
  }

  /**
   * Draw melee arc visual
   */
  drawMeleeArc(hitbox, color) {
    const g = hitbox.graphics;
    g.clear();
    g.fillStyle(color, 0.5);
    g.lineStyle(2, color, 0.8);

    // Draw arc
    g.beginPath();
    g.moveTo(hitbox.x, hitbox.y);

    const startAngle = hitbox.angle - hitbox.arcAngle / 2;
    const endAngle = hitbox.angle + hitbox.arcAngle / 2;
    const segments = 12;
    const angleStep = hitbox.arcAngle / segments;

    for (let i = 0; i <= segments; i++) {
      const a = startAngle + angleStep * i;
      const px = hitbox.x + Math.cos(a) * hitbox.range;
      const py = hitbox.y + Math.sin(a) * hitbox.range;
      g.lineTo(px, py);
    }

    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  /**
   * Trigger an area effect
   */
  triggerAreaEffect(ball, weaponDef, damage) {
    const x = ball.body.position.x;
    const y = ball.body.position.y;

    if (weaponDef.id === 'FREEZE_AURA') {
      this.triggerFreezeAura(ball, weaponDef, x, y);
    } else if (weaponDef.id === 'LIGHTNING') {
      this.triggerLightning(ball, weaponDef, x, y, damage);
    }
  }

  /**
   * Trigger freeze aura effect
   */
  triggerFreezeAura(ownerBall, weaponDef, x, y) {
    // Create visual pulse effect
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(weaponDef.color, 0.3);
    graphics.fillCircle(x, y, weaponDef.effectRadius);
    graphics.lineStyle(3, weaponDef.pulseColor, 0.8);
    graphics.strokeCircle(x, y, weaponDef.effectRadius);

    // Find and slow nearby enemy balls
    for (const ball of this.scene.balls) {
      if (ball.name === ownerBall.name || ball.finished || ball.isRespawning) continue;

      const dx = ball.body.position.x - x;
      const dy = ball.body.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < weaponDef.effectRadius) {
        // Apply slow effect via inventory system
        if (this.scene.inventorySystem) {
          this.scene.inventorySystem.addBuff(ball.name, 'speed', weaponDef.effectDuration, {
            multiplier: weaponDef.slowAmount
          });
        }
      }
    }

    // Fade out effect
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      scale: 1.5,
      duration: 500,
      onComplete: () => graphics.destroy()
    });
  }

  /**
   * Trigger lightning chain effect
   * Can target both balls and the boss
   */
  triggerLightning(ownerBall, weaponDef, x, y, damage) {
    const targets = [];
    const hitTargets = new Set([ownerBall.name]);

    // Find initial targets (balls and boss)
    let currentX = x;
    let currentY = y;

    for (let i = 0; i < weaponDef.chainCount; i++) {
      let nearest = null;
      let nearestDist = weaponDef.chainRange;
      let isBoss = false;

      // Check balls
      for (const ball of this.scene.balls) {
        if (hitTargets.has(ball.name) || ball.finished || ball.isRespawning) continue;

        const dx = ball.body.position.x - currentX;
        const dy = ball.body.position.y - currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = ball;
          isBoss = false;
        }
      }

      // Check boss as potential target
      if (this.scene.bossSystem?.isAlive() && !hitTargets.has('boss')) {
        const boss = this.scene.bossSystem.boss;
        if (boss) {
          const dx = boss.body.position.x - currentX;
          const dy = boss.body.position.y - currentY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = boss;
            isBoss = true;
          }
        }
      }

      if (nearest) {
        targets.push({ target: nearest, isBoss });
        hitTargets.add(isBoss ? 'boss' : nearest.name);
        currentX = nearest.body.position.x;
        currentY = nearest.body.position.y;
      } else {
        break;
      }
    }

    // Create lightning visuals and apply damage
    let prevX = x;
    let prevY = y;

    targets.forEach((entry, idx) => {
      this.scene.time.delayedCall(idx * weaponDef.chainDelay, () => {
        const tx = entry.target.body.position.x;
        const ty = entry.target.body.position.y;

        // Draw lightning bolt
        const graphics = this.scene.add.graphics();
        this.drawLightningBolt(graphics, prevX, prevY, tx, ty, weaponDef.color);

        // Apply damage
        if (entry.isBoss) {
          this.applyDamageToBoss(ownerBall.name, damage);
        } else {
          this.applyDamageToTarget(ownerBall.name, entry.target, damage, weaponDef.knockback, prevX, prevY);
        }

        // Fade out
        this.scene.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 300,
          onComplete: () => graphics.destroy()
        });

        prevX = tx;
        prevY = ty;
      });
    });
  }

  /**
   * Draw a jagged lightning bolt
   */
  drawLightningBolt(graphics, x1, y1, x2, y2, color) {
    graphics.lineStyle(3, color, 1);
    graphics.beginPath();
    graphics.moveTo(x1, y1);

    const segments = 5;
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;

    for (let i = 1; i < segments; i++) {
      const jitterX = (Math.random() - 0.5) * 20;
      const jitterY = (Math.random() - 0.5) * 20;
      graphics.lineTo(x1 + dx * i + jitterX, y1 + dy * i + jitterY);
    }

    graphics.lineTo(x2, y2);
    graphics.strokePath();
  }

  /**
   * Update all active weapons (projectiles, melee, passive)
   */
  update(delta) {
    const now = Date.now();

    // Update projectiles
    this.updateProjectiles(now, delta);

    // Update melee hitboxes
    this.updateMeleeHitboxes(now);

    // Update passive weapons
    this.updatePassiveWeapons(delta);
  }

  /**
   * Update projectiles
   */
  updateProjectiles(now, delta) {
    this.projectiles = this.projectiles.filter(proj => {
      // Check lifetime
      if (now - proj.spawnTime > proj.lifetime) {
        this.destroyProjectile(proj);
        return false;
      }

      // Check out of bounds
      const pos = proj.body.position;
      if (pos.x < -50 || pos.x > this.scene.gameWidth + 50 ||
          pos.y < -50 || pos.y > this.scene.gameHeight + 50) {
        this.destroyProjectile(proj);
        return false;
      }

      // Update graphics position
      proj.graphics.x = pos.x;
      proj.graphics.y = pos.y;

      // Handle homing
      if (proj.homing) {
        this.updateHomingProjectile(proj);
      }

      return true;
    });
  }

  /**
   * Update homing projectile direction
   * Targets nearest ball or boss
   */
  updateHomingProjectile(proj) {
    let nearestX = null;
    let nearestY = null;
    let nearestDist = Infinity;

    // Check balls as targets
    for (const ball of this.scene.balls) {
      if (ball.name === proj.owner || ball.finished || ball.isRespawning) continue;

      const dx = ball.body.position.x - proj.body.position.x;
      const dy = ball.body.position.y - proj.body.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestX = ball.body.position.x;
        nearestY = ball.body.position.y;
      }
    }

    // Check boss as target (prioritize boss if alive)
    if (this.scene.bossSystem?.isAlive()) {
      const boss = this.scene.bossSystem.boss;
      if (boss) {
        const dx = boss.body.position.x - proj.body.position.x;
        const dy = boss.body.position.y - proj.body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Prioritize boss as target if it's reasonably close
        if (dist < nearestDist * 1.5) {
          nearestDist = dist;
          nearestX = boss.body.position.x;
          nearestY = boss.body.position.y;
        }
      }
    }

    if (nearestX !== null) {
      const dx = nearestX - proj.body.position.x;
      const dy = nearestY - proj.body.position.y;
      const targetAngle = Math.atan2(dy, dx);

      const vel = proj.body.velocity;
      const currentAngle = Math.atan2(vel.y, vel.x);
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

      // Gradually turn toward target
      let angleDiff = targetAngle - currentAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const turn = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), proj.homingStrength);
      const newAngle = currentAngle + turn;

      this.scene.matter.body.setVelocity(proj.body, {
        x: Math.cos(newAngle) * speed,
        y: Math.sin(newAngle) * speed
      });
    }
  }

  /**
   * Update melee hitboxes
   */
  updateMeleeHitboxes(now) {
    this.meleeHitboxes = this.meleeHitboxes.filter(hitbox => {
      // Check duration
      if (now - hitbox.startTime > hitbox.duration) {
        if (hitbox.graphics) hitbox.graphics.destroy();
        return false;
      }

      // Check for hits on balls
      for (const ball of this.scene.balls) {
        if (ball.name === hitbox.owner || ball.finished || ball.isRespawning) continue;
        if (hitbox.hitTargets.has(ball.name)) continue;

        // Check if ball is in arc
        if (this.isInMeleeArc(hitbox, ball)) {
          hitbox.hitTargets.add(ball.name);
          this.applyDamageToTarget(hitbox.owner, ball, hitbox.damage, hitbox.knockback, hitbox.x, hitbox.y);
        }
      }

      // Check for hits on boss
      if (this.scene.bossSystem?.isAlive() && !hitbox.hitTargets.has('boss')) {
        const boss = this.scene.bossSystem.boss;
        if (boss && this.isInMeleeArcBoss(hitbox, boss)) {
          hitbox.hitTargets.add('boss');
          this.applyDamageToBoss(hitbox.owner, hitbox.damage);
        }
      }

      // Update position to follow owner
      const owner = this.scene.balls.find(b => b.name === hitbox.owner);
      if (owner) {
        hitbox.x = owner.body.position.x;
        hitbox.y = owner.body.position.y;
        // Update angle based on velocity
        const vel = owner.body.velocity;
        if (Math.abs(vel.x) > 0.1 || Math.abs(vel.y) > 0.1) {
          hitbox.angle = Math.atan2(vel.y, vel.x);
        }
        // Redraw at new position
        const weaponDef = WEAPON_TYPES[hitbox.weaponId];
        if (weaponDef && hitbox.graphics) {
          this.drawMeleeArc(hitbox, weaponDef.color);
        }
      }

      return true;
    });
  }

  /**
   * Check if a ball is within a melee arc
   */
  isInMeleeArc(hitbox, ball) {
    const dx = ball.body.position.x - hitbox.x;
    const dy = ball.body.position.y - hitbox.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check distance
    if (dist > hitbox.range + (ball.radius || 12)) return false;

    // Check angle
    const angleToBall = Math.atan2(dy, dx);
    let angleDiff = angleToBall - hitbox.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    return Math.abs(angleDiff) <= hitbox.arcAngle / 2;
  }

  /**
   * Check if boss is within a melee arc (boss has a rectangle body)
   */
  isInMeleeArcBoss(hitbox, boss) {
    // Boss center position
    const bossX = boss.body.position.x;
    const bossY = boss.body.position.y;

    // Boss half-dimensions (approximate from typical boss size)
    const bossHalfWidth = boss.width ? boss.width / 2 : 30;
    const bossHalfHeight = boss.height ? boss.height / 2 : 30;

    // Find closest point on boss rectangle to hitbox center
    const closestX = Math.max(bossX - bossHalfWidth, Math.min(hitbox.x, bossX + bossHalfWidth));
    const closestY = Math.max(bossY - bossHalfHeight, Math.min(hitbox.y, bossY + bossHalfHeight));

    const dx = closestX - hitbox.x;
    const dy = closestY - hitbox.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check distance to boss
    if (dist > hitbox.range) return false;

    // Check angle to closest point
    const angleToBoss = Math.atan2(dy, dx);
    let angleDiff = angleToBoss - hitbox.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    return Math.abs(angleDiff) <= hitbox.arcAngle / 2;
  }

  /**
   * Apply damage to boss from a weapon attack
   * @param {string} attackerName - Name of the ball that dealt the damage
   * @param {number} damage - Amount of damage to deal
   */
  applyDamageToBoss(attackerName, damage) {
    if (!this.scene.bossSystem?.isAlive()) return;

    const bossSystem = this.scene.bossSystem;
    const boss = bossSystem.boss;
    const bossDied = bossSystem.takeDamage(damage);

    // Log the damage (console + game log)
    console.log(`[WEAPON->BOSS] ${attackerName} dealt ${damage} weapon damage to boss`);
    gameLog.bossDamage(attackerName, damage, boss.health, boss.maxHealth);

    // Track damage for standings on the attacking ball
    const attackerBall = this.scene.balls.find(b => b.name === attackerName);
    if (attackerBall) {
      attackerBall.damageDealtToBoss = (attackerBall.damageDealtToBoss || 0) + damage;
    }

    if (bossDied) {
      console.log('[BOSS] Boss defeated by weapon! Triggering onBossDeath...');
      gameLog.bossDeath();
    }
  }

  /**
   * Update passive weapons (flail, spike aura)
   */
  updatePassiveWeapons(delta) {
    if (!this.scene.inventorySystem) return;

    for (const ball of this.scene.balls) {
      if (ball.finished || ball.isRespawning) continue;

      const weapons = this.scene.inventorySystem.getWeapons(ball.name);

      for (const weapon of weapons) {
        const weaponDef = WEAPON_TYPES[weapon.id];
        if (!weaponDef || !weaponDef.passive) continue;

        // Get or create passive state
        if (!this.passiveStates.has(ball.name)) {
          this.passiveStates.set(ball.name, new Map());
        }
        const ballStates = this.passiveStates.get(ball.name);

        if (!ballStates.has(weapon.id)) {
          ballStates.set(weapon.id, {
            angle: 0,
            graphics: this.scene.add.graphics(),
            hitCooldowns: new Map()
          });
        }

        const state = ballStates.get(weapon.id);

        if (weaponDef.id === 'FLAIL') {
          this.updateFlail(ball, weapon, weaponDef, state, delta);
        } else if (weaponDef.id === 'SPIKE') {
          this.updateSpikeAura(ball, weapon, weaponDef, state, delta);
        }
      }
    }
  }

  /**
   * Update flail passive weapon
   */
  updateFlail(ball, weapon, weaponDef, state, delta) {
    const now = Date.now();

    // Update rotation
    state.angle += weaponDef.orbitSpeed * (delta / 1000);

    // Calculate flail position
    const ballX = ball.body.position.x;
    const ballY = ball.body.position.y;
    const flailX = ballX + Math.cos(state.angle) * weaponDef.orbitRadius;
    const flailY = ballY + Math.sin(state.angle) * weaponDef.orbitRadius;

    // Draw flail
    const g = state.graphics;
    g.clear();
    // Chain
    g.lineStyle(2, 0x666666, 1);
    g.lineBetween(ballX, ballY, flailX, flailY);
    // Flail head
    g.fillStyle(weaponDef.color, 1);
    g.fillCircle(flailX, flailY, weaponDef.size);
    g.lineStyle(1, 0xffffff, 0.5);
    g.strokeCircle(flailX, flailY, weaponDef.size);

    // Check for hits on balls
    const damage = weaponDef.damage * (1 + (weapon.level - 1) * 0.2);
    for (const target of this.scene.balls) {
      if (target.name === ball.name || target.finished || target.isRespawning) continue;

      const dx = target.body.position.x - flailX;
      const dy = target.body.position.y - flailY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < weaponDef.size + (target.radius || 12)) {
        // Check hit cooldown
        const cooldownKey = target.name;
        const lastHit = state.hitCooldowns.get(cooldownKey) || 0;

        if (now - lastHit >= weaponDef.hitCooldown) {
          state.hitCooldowns.set(cooldownKey, now);
          this.applyDamageToTarget(ball.name, target, damage, weaponDef.knockback, flailX, flailY);
        }
      }
    }

    // Check for hits on boss
    if (this.scene.bossSystem?.isAlive()) {
      const boss = this.scene.bossSystem.boss;
      if (boss) {
        const bossX = boss.body.position.x;
        const bossY = boss.body.position.y;
        const bossHalfWidth = boss.width ? boss.width / 2 : 30;
        const bossHalfHeight = boss.height ? boss.height / 2 : 30;

        // Check if flail overlaps boss rectangle
        const closestX = Math.max(bossX - bossHalfWidth, Math.min(flailX, bossX + bossHalfWidth));
        const closestY = Math.max(bossY - bossHalfHeight, Math.min(flailY, bossY + bossHalfHeight));
        const dx = flailX - closestX;
        const dy = flailY - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < weaponDef.size) {
          const cooldownKey = 'boss';
          const lastHit = state.hitCooldowns.get(cooldownKey) || 0;

          if (now - lastHit >= weaponDef.hitCooldown) {
            state.hitCooldowns.set(cooldownKey, now);
            this.applyDamageToBoss(ball.name, damage);
          }
        }
      }
    }
  }

  /**
   * Update spike aura passive weapon
   */
  updateSpikeAura(ball, weapon, weaponDef, state, delta) {
    const now = Date.now();
    const ballX = ball.body.position.x;
    const ballY = ball.body.position.y;
    const ballRadius = ball.radius || 12;
    const auraRadius = ballRadius + weaponDef.auraRadius;

    // Draw aura
    const g = state.graphics;
    g.clear();
    g.lineStyle(2, weaponDef.color, 0.5);
    g.strokeCircle(ballX, ballY, auraRadius);

    // Draw spikes
    const spikeCount = 8;
    g.fillStyle(weaponDef.color, 0.7);
    for (let i = 0; i < spikeCount; i++) {
      const angle = (Math.PI * 2 / spikeCount) * i + (now / 1000);
      const x1 = ballX + Math.cos(angle) * (auraRadius - 5);
      const y1 = ballY + Math.sin(angle) * (auraRadius - 5);
      const x2 = ballX + Math.cos(angle) * (auraRadius + 5);
      const y2 = ballY + Math.sin(angle) * (auraRadius + 5);
      g.lineStyle(3, weaponDef.color, 0.8);
      g.lineBetween(x1, y1, x2, y2);
    }

    // Check for hits on balls
    const damage = weaponDef.damage * (1 + (weapon.level - 1) * 0.2);
    for (const target of this.scene.balls) {
      if (target.name === ball.name || target.finished || target.isRespawning) continue;

      const dx = target.body.position.x - ballX;
      const dy = target.body.position.y - ballY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < auraRadius + (target.radius || 12)) {
        // Check hit cooldown
        const cooldownKey = target.name;
        const lastHit = state.hitCooldowns.get(cooldownKey) || 0;

        if (now - lastHit >= weaponDef.hitCooldown) {
          state.hitCooldowns.set(cooldownKey, now);
          this.applyDamageToTarget(ball.name, target, damage, weaponDef.knockback, ballX, ballY);
        }
      }
    }

    // Check for hits on boss
    if (this.scene.bossSystem?.isAlive()) {
      const boss = this.scene.bossSystem.boss;
      if (boss) {
        const bossX = boss.body.position.x;
        const bossY = boss.body.position.y;
        const bossHalfWidth = boss.width ? boss.width / 2 : 30;
        const bossHalfHeight = boss.height ? boss.height / 2 : 30;

        // Check if aura overlaps boss rectangle
        const closestX = Math.max(bossX - bossHalfWidth, Math.min(ballX, bossX + bossHalfWidth));
        const closestY = Math.max(bossY - bossHalfHeight, Math.min(ballY, bossY + bossHalfHeight));
        const dx = ballX - closestX;
        const dy = ballY - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < auraRadius) {
          const cooldownKey = 'boss';
          const lastHit = state.hitCooldowns.get(cooldownKey) || 0;

          if (now - lastHit >= weaponDef.hitCooldown) {
            state.hitCooldowns.set(cooldownKey, now);
            this.applyDamageToBoss(ball.name, damage);
          }
        }
      }
    }
  }

  /**
   * Handle projectile collision with a ball
   */
  handleProjectileHit(projectile, ball) {
    if (ball.name === projectile.owner) return false;
    if (ball.finished || ball.isRespawning) return false;

    // Check invincibility
    const stats = this.scene.inventorySystem?.getStats(ball.name);
    if (stats?.isInvincible) return false;

    // Apply damage and knockback
    this.applyDamageToTarget(
      projectile.owner,
      ball,
      projectile.damage,
      projectile.knockback,
      projectile.body.position.x,
      projectile.body.position.y
    );

    // Destroy projectile if not piercing
    if (!projectile.piercing) {
      this.destroyProjectile(projectile);
      this.projectiles = this.projectiles.filter(p => p !== projectile);
      return true;
    }

    return false;
  }

  /**
   * Handle projectile bouncing off wall
   */
  handleProjectileBounce(projectile, collision) {
    if (projectile.bouncesRemaining <= 0) {
      this.destroyProjectile(projectile);
      this.projectiles = this.projectiles.filter(p => p !== projectile);
      return;
    }

    projectile.bouncesRemaining--;

    // Reflect velocity
    const vel = projectile.body.velocity;
    const normal = collision.normal;
    const dot = vel.x * normal.x + vel.y * normal.y;

    this.scene.matter.body.setVelocity(projectile.body, {
      x: vel.x - 2 * dot * normal.x,
      y: vel.y - 2 * dot * normal.y
    });
  }

  /**
   * Apply damage to a target ball
   */
  applyDamageToTarget(attackerName, targetBall, damage, knockback, sourceX, sourceY) {
    // Check invincibility
    const stats = this.scene.inventorySystem?.getStats(targetBall.name);
    if (stats?.isInvincible) return;

    // Apply damage through scene's damage function
    if (this.scene.damageBall) {
      this.scene.damageBall(targetBall, damage);
    }

    // Log the damage (console + game log)
    const newHp = targetBall.health || 0;
    const maxHp = targetBall.maxHealth || 100;
    console.log(`[WEAPON->BALL] ${attackerName} dealt ${damage} damage to ${targetBall.name} (HP: ${newHp}/${maxHp})`);
    gameLog.damage(attackerName, targetBall.name, damage, newHp);

    // Apply knockback
    if (knockback > 0) {
      const dx = targetBall.body.position.x - sourceX;
      const dy = targetBall.body.position.y - sourceY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const normalX = dx / dist;
      const normalY = dy / dist;

      const currentVel = targetBall.body.velocity;
      this.scene.matter.body.setVelocity(targetBall.body, {
        x: currentVel.x + normalX * knockback * 2,
        y: currentVel.y + normalY * knockback * 2
      });
    }
  }

  /**
   * Destroy a projectile
   */
  destroyProjectile(proj) {
    if (proj.graphics) proj.graphics.destroy();
    if (proj.body) this.scene.matter.world.remove(proj.body);
  }

  /**
   * Clean up all weapon effects
   */
  cleanup() {
    // Destroy all projectiles
    for (const proj of this.projectiles) {
      this.destroyProjectile(proj);
    }
    this.projectiles = [];

    // Destroy melee hitboxes
    for (const hitbox of this.meleeHitboxes) {
      if (hitbox.graphics) hitbox.graphics.destroy();
    }
    this.meleeHitboxes = [];

    // Destroy passive weapon graphics
    for (const [, ballStates] of this.passiveStates) {
      for (const [, state] of ballStates) {
        if (state.graphics) state.graphics.destroy();
      }
    }
    this.passiveStates.clear();
  }
}
