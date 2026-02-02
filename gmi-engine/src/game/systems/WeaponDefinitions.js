/**
 * WeaponDefinitions.js - Weapon type configurations for Vampire Survivors-style auto-attacking weapons
 *
 * Weapon Categories:
 * - Projectile: Fires bullets/orbs that travel and hit enemies
 * - Melee: Close-range attacks with arc/area hitboxes
 * - Area: AOE effects around the ball
 *
 * All weapons auto-fire based on cooldown timers.
 */

export const WEAPON_TYPES = {
  // ========== PROJECTILE WEAPONS ==========

  PEA_SHOOTER: {
    id: 'PEA_SHOOTER',
    name: 'Pea Shooter',
    type: 'projectile',
    description: 'Basic single shot forward',
    cooldown: 800, // ms between shots
    damage: 5,
    projectileSpeed: 6,
    projectileRadius: 4,
    projectileColor: 0x44ff44,
    projectileLifetime: 3000,
    piercing: false,
    knockback: 0.5,
    icon: '🟢'
  },

  SHOTGUN: {
    id: 'SHOTGUN',
    name: 'Shotgun',
    type: 'projectile',
    description: '5-pellet spread shot',
    cooldown: 1200,
    damage: 3,
    projectileSpeed: 7,
    projectileRadius: 3,
    projectileColor: 0xff8844,
    projectileLifetime: 2000,
    pelletCount: 5,
    spreadAngle: Math.PI / 6, // 30 degree total spread
    piercing: false,
    knockback: 0.3,
    icon: '🔶'
  },

  HOMING_ORB: {
    id: 'HOMING_ORB',
    name: 'Homing Orb',
    type: 'projectile',
    description: 'Seeks nearest enemy ball',
    cooldown: 1500,
    damage: 8,
    projectileSpeed: 4,
    projectileRadius: 6,
    projectileColor: 0x8844ff,
    projectileLifetime: 4000,
    homing: true,
    homingStrength: 0.08, // Turn rate per frame
    piercing: false,
    knockback: 1.0,
    icon: '🟣'
  },

  BOUNCY_SHOT: {
    id: 'BOUNCY_SHOT',
    name: 'Bouncy Shot',
    type: 'projectile',
    description: 'Bounces off walls up to 5 times',
    cooldown: 1000,
    damage: 4,
    projectileSpeed: 5,
    projectileRadius: 5,
    projectileColor: 0x44ffff,
    projectileLifetime: 5000,
    bounces: 5,
    piercing: false,
    knockback: 0.6,
    isSensor: false, // Bounces off walls (non-sensor)
    icon: '🔵'
  },

  // ========== MELEE WEAPONS ==========

  SWORD: {
    id: 'SWORD',
    name: 'Sword',
    type: 'melee',
    description: '90° slash arc attack',
    cooldown: 600,
    damage: 25, // BUFFED from 12
    range: 120, // BUFFED from 40
    arcAngle: Math.PI / 2, // 90 degrees
    arcDuration: 150, // ms the hitbox is active
    knockback: 1.5,
    color: 0xcccccc,
    icon: '⚔️'
  },

  FLAIL: {
    id: 'FLAIL',
    name: 'Flail',
    type: 'melee',
    description: 'Orbits ball constantly dealing contact damage',
    cooldown: 0, // Passive - always active
    damage: 12, // BUFFED from 2
    hitCooldown: 400, // Increased from 300ms for balance
    orbitRadius: 35,
    orbitSpeed: 4, // Radians per second
    size: 8, // Flail head radius
    color: 0x888888,
    passive: true,
    knockback: 0.4,
    icon: '⛓️'
  },

  SPIKE: {
    id: 'SPIKE',
    name: 'Spike Aura',
    type: 'melee',
    description: 'Contact damage aura around ball',
    cooldown: 0, // Passive
    damage: 18, // BUFFED from 3
    hitCooldown: 500,
    auraRadius: 25, // Extends beyond ball radius
    color: 0xff4444,
    passive: true,
    knockback: 0.2,
    icon: '💥'
  },

  HAMMER: {
    id: 'HAMMER',
    name: 'Hammer',
    type: 'melee',
    description: '180° sweep with big knockback',
    cooldown: 1800,
    damage: 45, // BUFFED from 20
    range: 130, // BUFFED from 50
    arcAngle: Math.PI, // 180 degrees
    arcDuration: 300,
    knockback: 3.0,
    color: 0xaa6633,
    icon: '🔨'
  },

  // ========== AREA WEAPONS ==========

  FREEZE_AURA: {
    id: 'FREEZE_AURA',
    name: 'Freeze Aura',
    type: 'area',
    description: 'Slows nearby enemies by 50% for 2s',
    cooldown: 5000,
    damage: 0,
    effectRadius: 80,
    effectDuration: 2000, // How long slow lasts
    slowAmount: 0.5, // Multiplier (0.5 = 50% speed)
    color: 0x88ccff,
    pulseColor: 0xaaeeff,
    icon: '❄️'
  },

  LIGHTNING: {
    id: 'LIGHTNING',
    name: 'Lightning',
    type: 'area',
    description: 'Chains to up to 3 enemies',
    cooldown: 3000,
    damage: 15,
    chainCount: 3,
    chainRange: 100, // Max distance to chain
    chainDelay: 100, // ms between chain hits
    knockback: 0.8,
    color: 0xffff44,
    icon: '⚡'
  }
};

// Weapon tiers for progression/roulette weighting
export const WEAPON_TIERS = {
  common: ['PEA_SHOOTER', 'SPIKE'],
  uncommon: ['SHOTGUN', 'SWORD', 'FLAIL'],
  rare: ['BOUNCY_SHOT', 'HAMMER', 'FREEZE_AURA'],
  epic: ['HOMING_ORB', 'LIGHTNING']
};

// Get all weapon IDs as array
export const ALL_WEAPONS = Object.keys(WEAPON_TYPES);

// Get weapon by ID
export function getWeapon(id) {
  return WEAPON_TYPES[id] || null;
}

// Get weapons by type
export function getWeaponsByType(type) {
  return Object.values(WEAPON_TYPES).filter(w => w.type === type);
}

// Get weapons by tier
export function getWeaponsByTier(tier) {
  const ids = WEAPON_TIERS[tier] || [];
  return ids.map(id => WEAPON_TYPES[id]);
}

// Get random weapon with tier weighting
export function getRandomWeapon(tierWeights = { common: 50, uncommon: 30, rare: 15, epic: 5 }) {
  const totalWeight = Object.values(tierWeights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;

  for (const [tier, weight] of Object.entries(tierWeights)) {
    roll -= weight;
    if (roll <= 0) {
      const tierWeapons = WEAPON_TIERS[tier];
      const randomId = tierWeapons[Math.floor(Math.random() * tierWeapons.length)];
      return WEAPON_TYPES[randomId];
    }
  }

  // Fallback
  return WEAPON_TYPES.PEA_SHOOTER;
}
