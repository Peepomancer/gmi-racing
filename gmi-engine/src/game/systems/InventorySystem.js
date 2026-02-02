/**
 * InventorySystem.js - Per-ball inventory tracking for weapons and buffs
 *
 * Features:
 * - 3 weapon mount points per ball (120° apart)
 * - Active buff tracking with expiration
 * - Serialization for chain persistence
 */

import { WEAPON_TYPES } from './WeaponDefinitions.js';
import { BUFF_EFFECTS } from './ItemDefinitions.js';

export class InventorySystem {
  constructor(scene) {
    this.scene = scene;

    // Map of ball name -> inventory data
    this.inventories = new Map();

    // Maximum weapons per ball
    this.maxWeapons = 3;

    // Mount point angles (120° apart, starting from "forward" direction)
    this.mountAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  }

  /**
   * Initialize inventory for a ball
   */
  initBall(ballName) {
    if (this.inventories.has(ballName)) return;

    this.inventories.set(ballName, {
      weapons: [], // Array of { id, mountIndex, level, cooldownRemaining }
      activeBuffs: [], // Array of { effect, expiresAt, data }
      stats: {
        speedMultiplier: 1,
        damageMultiplier: 1,
        sizeMultiplier: 1,
        isInvincible: false,
        isGhost: false
      }
    });
  }

  /**
   * Get inventory for a ball
   */
  getInventory(ballName) {
    return this.inventories.get(ballName) || null;
  }

  /**
   * Get weapons for a ball
   */
  getWeapons(ballName) {
    const inv = this.inventories.get(ballName);
    return inv ? inv.weapons : [];
  }

  /**
   * Get active buffs for a ball
   */
  getBuffs(ballName) {
    const inv = this.inventories.get(ballName);
    return inv ? inv.activeBuffs : [];
  }

  /**
   * Get ball stats (including buff modifiers)
   */
  getStats(ballName) {
    const inv = this.inventories.get(ballName);
    return inv ? inv.stats : { speedMultiplier: 1, damageMultiplier: 1, sizeMultiplier: 1, isInvincible: false, isGhost: false };
  }

  /**
   * Add a weapon to a ball's inventory
   * Returns: true if added, false if inventory full
   */
  addWeapon(ballName, weaponId) {
    const inv = this.inventories.get(ballName);
    if (!inv) return false;

    // Check if already has this weapon (upgrade instead)
    const existingWeapon = inv.weapons.find(w => w.id === weaponId);
    if (existingWeapon) {
      existingWeapon.level = Math.min(existingWeapon.level + 1, 5);
      console.log(`[Inventory] ${ballName} upgraded ${weaponId} to level ${existingWeapon.level}`);
      return true;
    }

    // Check if inventory full
    if (inv.weapons.length >= this.maxWeapons) {
      console.log(`[Inventory] ${ballName} inventory full, cannot add ${weaponId}`);
      return false;
    }

    // Find next available mount index
    const usedMounts = new Set(inv.weapons.map(w => w.mountIndex));
    let mountIndex = 0;
    for (let i = 0; i < this.maxWeapons; i++) {
      if (!usedMounts.has(i)) {
        mountIndex = i;
        break;
      }
    }

    // Add weapon
    const weaponDef = WEAPON_TYPES[weaponId];
    inv.weapons.push({
      id: weaponId,
      mountIndex,
      level: 1,
      cooldownRemaining: 0
    });

    console.log(`[Inventory] ${ballName} acquired ${weaponDef?.name || weaponId} at mount ${mountIndex}`);
    return true;
  }

  /**
   * Remove a weapon from a ball's inventory
   */
  removeWeapon(ballName, weaponId) {
    const inv = this.inventories.get(ballName);
    if (!inv) return false;

    const idx = inv.weapons.findIndex(w => w.id === weaponId);
    if (idx !== -1) {
      inv.weapons.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Get mount angle for a weapon (in radians)
   */
  getMountAngle(mountIndex) {
    return this.mountAngles[mountIndex % this.mountAngles.length];
  }

  /**
   * Add a buff to a ball
   */
  addBuff(ballName, buffId, duration, data = {}) {
    const inv = this.inventories.get(ballName);
    if (!inv) return false;

    // Remove existing buff of same type (refresh)
    this.removeBuff(ballName, buffId);

    const expiresAt = Date.now() + duration;
    inv.activeBuffs.push({
      effect: buffId,
      expiresAt,
      duration,
      data
    });

    // Apply buff effect to stats
    this.applyBuffEffect(ballName, buffId, data, true);

    console.log(`[Inventory] ${ballName} gained buff ${buffId} for ${duration}ms`);
    return true;
  }

  /**
   * Remove a buff from a ball
   */
  removeBuff(ballName, buffId) {
    const inv = this.inventories.get(ballName);
    if (!inv) return false;

    const idx = inv.activeBuffs.findIndex(b => b.effect === buffId);
    if (idx !== -1) {
      const buff = inv.activeBuffs[idx];
      // Remove buff effect from stats
      this.applyBuffEffect(ballName, buffId, buff.data, false);
      inv.activeBuffs.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Apply or remove buff effect to ball stats
   */
  applyBuffEffect(ballName, buffId, data, apply) {
    const inv = this.inventories.get(ballName);
    if (!inv) return;

    const ball = this.scene.balls.find(b => b.name === ballName);

    switch (buffId) {
      case 'invincible':
      case 'shield':
        inv.stats.isInvincible = apply;
        if (ball) ball.isInvincible = apply;
        break;

      case 'speed':
        if (apply) {
          inv.stats.speedMultiplier *= data.multiplier || 1.5;
        } else {
          inv.stats.speedMultiplier /= data.multiplier || 1.5;
        }
        if (ball) ball.speedMultiplier = inv.stats.speedMultiplier;
        break;

      case 'ghost':
        inv.stats.isGhost = apply;
        if (ball) ball.isGhost = apply;
        break;

      case 'shrink':
        if (apply) {
          inv.stats.sizeMultiplier *= data.sizeMultiplier || 0.5;
        } else {
          inv.stats.sizeMultiplier /= data.sizeMultiplier || 0.5;
        }
        if (ball) ball.sizeMultiplier = inv.stats.sizeMultiplier;
        break;

      case 'damage':
        if (apply) {
          inv.stats.damageMultiplier *= data.multiplier || 2.0;
        } else {
          inv.stats.damageMultiplier /= data.multiplier || 2.0;
        }
        if (ball) ball.damageMultiplier = inv.stats.damageMultiplier;
        break;
    }
  }

  /**
   * Update all inventories (check buff expirations)
   */
  update(delta) {
    const now = Date.now();

    for (const [ballName, inv] of this.inventories) {
      // Check for expired buffs
      const expiredBuffs = inv.activeBuffs.filter(b => b.expiresAt <= now);
      for (const buff of expiredBuffs) {
        console.log(`[Inventory] ${ballName} buff ${buff.effect} expired`);
        this.removeBuff(ballName, buff.effect);
      }

      // Update weapon cooldowns
      for (const weapon of inv.weapons) {
        if (weapon.cooldownRemaining > 0) {
          weapon.cooldownRemaining -= delta;
        }
      }
    }
  }

  /**
   * Check if ball has a specific buff
   */
  hasBuff(ballName, buffId) {
    const inv = this.inventories.get(ballName);
    if (!inv) return false;
    return inv.activeBuffs.some(b => b.effect === buffId);
  }

  /**
   * Check if ball has a specific weapon
   */
  hasWeapon(ballName, weaponId) {
    const inv = this.inventories.get(ballName);
    if (!inv) return false;
    return inv.weapons.some(w => w.id === weaponId);
  }

  /**
   * Get weapon level
   */
  getWeaponLevel(ballName, weaponId) {
    const inv = this.inventories.get(ballName);
    if (!inv) return 0;
    const weapon = inv.weapons.find(w => w.id === weaponId);
    return weapon ? weapon.level : 0;
  }

  /**
   * Clear all inventories
   */
  clear() {
    this.inventories.clear();
  }

  /**
   * Serialize inventories for chain persistence
   */
  serialize() {
    const data = {};
    for (const [ballName, inv] of this.inventories) {
      data[ballName] = {
        weapons: inv.weapons.map(w => ({
          id: w.id,
          mountIndex: w.mountIndex,
          level: w.level
        })),
        // Don't persist buffs across levels (they're temporary)
        activeBuffs: []
      };
    }
    return JSON.stringify(data);
  }

  /**
   * Deserialize inventories from chain persistence
   */
  deserialize(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      for (const [ballName, invData] of Object.entries(data)) {
        // Initialize if not exists
        this.initBall(ballName);

        const inv = this.inventories.get(ballName);
        if (inv) {
          // Restore weapons
          inv.weapons = invData.weapons.map(w => ({
            id: w.id,
            mountIndex: w.mountIndex,
            level: w.level,
            cooldownRemaining: 0
          }));
          // Clear any active buffs (fresh start per level)
          inv.activeBuffs = [];
        }
      }

      console.log('[Inventory] Deserialized from chain data');
    } catch (e) {
      console.error('[Inventory] Failed to deserialize:', e);
    }
  }

  /**
   * Get summary of all inventories (for UI)
   */
  getSummary() {
    const summary = [];
    for (const [ballName, inv] of this.inventories) {
      summary.push({
        ballName,
        weaponCount: inv.weapons.length,
        weapons: inv.weapons.map(w => ({ id: w.id, level: w.level })),
        buffCount: inv.activeBuffs.length,
        buffs: inv.activeBuffs.map(b => b.effect)
      });
    }
    return summary;
  }
}
