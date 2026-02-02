/**
 * ItemDefinitions.js - Item and buff configurations for pickups
 *
 * Item Types:
 * - Weapon Crate: Awards a random weapon
 * - Buff items: Temporary effects (speed, shield, etc.)
 * - Consumables: Instant effects (health)
 */

export const ITEM_TYPES = {
  // ========== WEAPON CRATE ==========

  WEAPON_CRATE: {
    id: 'WEAPON_CRATE',
    name: 'Weapon Crate',
    type: 'weapon',
    description: 'Awards a random weapon',
    color: 0xffaa00,
    outlineColor: 0xff8800,
    radius: 15,
    icon: '📦',
    // Tier weights for weapon selection
    tierWeights: { common: 40, uncommon: 35, rare: 20, epic: 5 }
  },

  // ========== BUFF ITEMS ==========

  SHIELD: {
    id: 'SHIELD',
    name: 'Shield',
    type: 'buff',
    description: 'Invincibility for 3 seconds',
    color: 0x44aaff,
    outlineColor: 0x2288ff,
    radius: 12,
    icon: '🛡️',
    effect: 'invincible',
    duration: 3000,
    visualEffect: 'shield_glow'
  },

  SPEED_BOOST: {
    id: 'SPEED_BOOST',
    name: 'Speed Boost',
    type: 'buff',
    description: '1.5x speed for 5 seconds',
    color: 0x44ff44,
    outlineColor: 0x22dd22,
    radius: 12,
    icon: '⚡',
    effect: 'speed',
    multiplier: 1.5,
    duration: 5000,
    visualEffect: 'speed_trail'
  },

  GHOST: {
    id: 'GHOST',
    name: 'Ghost',
    type: 'buff',
    description: 'Phase through obstacles for 4 seconds',
    color: 0xaaaaff,
    outlineColor: 0x8888ff,
    radius: 12,
    icon: '👻',
    effect: 'ghost',
    duration: 4000,
    visualEffect: 'ghost_fade'
  },

  SHRINK: {
    id: 'SHRINK',
    name: 'Shrink',
    type: 'buff',
    description: '0.5x size for 6 seconds (easier to navigate)',
    color: 0xff88ff,
    outlineColor: 0xff44ff,
    radius: 12,
    icon: '🔮',
    effect: 'shrink',
    sizeMultiplier: 0.5,
    duration: 6000,
    visualEffect: 'shrink_sparkle'
  },

  // ========== CONSUMABLES ==========

  HEALTH_PACK: {
    id: 'HEALTH_PACK',
    name: 'Health Pack',
    type: 'consumable',
    description: 'Instant +50 HP',
    color: 0xff4444,
    outlineColor: 0xff2222,
    radius: 14,
    icon: '❤️',
    effect: 'heal',
    healAmount: 50
  },

  DAMAGE_BOOST: {
    id: 'DAMAGE_BOOST',
    name: 'Damage Boost',
    type: 'buff',
    description: '2x weapon damage for 8 seconds',
    color: 0xff6600,
    outlineColor: 0xff4400,
    radius: 12,
    icon: '💪',
    effect: 'damage',
    multiplier: 2.0,
    duration: 8000,
    visualEffect: 'damage_aura'
  }
};

// Item rarity for spawn weighting
export const ITEM_RARITY = {
  common: ['HEALTH_PACK', 'SPEED_BOOST'],
  uncommon: ['WEAPON_CRATE', 'SHIELD', 'SHRINK'],
  rare: ['GHOST', 'DAMAGE_BOOST']
};

// Get all item IDs
export const ALL_ITEMS = Object.keys(ITEM_TYPES);

// Get item by ID
export function getItem(id) {
  return ITEM_TYPES[id] || null;
}

// Get items by type
export function getItemsByType(type) {
  return Object.values(ITEM_TYPES).filter(i => i.type === type);
}

// Get random item with rarity weighting
export function getRandomItem(rarityWeights = { common: 50, uncommon: 35, rare: 15 }) {
  const totalWeight = Object.values(rarityWeights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;

  for (const [rarity, weight] of Object.entries(rarityWeights)) {
    roll -= weight;
    if (roll <= 0) {
      const rarityItems = ITEM_RARITY[rarity];
      const randomId = rarityItems[Math.floor(Math.random() * rarityItems.length)];
      return ITEM_TYPES[randomId];
    }
  }

  // Fallback
  return ITEM_TYPES.HEALTH_PACK;
}

// Get random item excluding certain types
export function getRandomItemExcluding(excludeTypes = [], rarityWeights = { common: 50, uncommon: 35, rare: 15 }) {
  let item = getRandomItem(rarityWeights);
  let attempts = 0;

  while (excludeTypes.includes(item.id) && attempts < 10) {
    item = getRandomItem(rarityWeights);
    attempts++;
  }

  return item;
}

// Buff effect definitions for applying to balls
export const BUFF_EFFECTS = {
  invincible: {
    apply: (ball) => {
      ball.isInvincible = true;
    },
    remove: (ball) => {
      ball.isInvincible = false;
    }
  },

  speed: {
    apply: (ball, multiplier) => {
      ball.speedMultiplier = (ball.speedMultiplier || 1) * multiplier;
    },
    remove: (ball, multiplier) => {
      ball.speedMultiplier = (ball.speedMultiplier || 1) / multiplier;
    }
  },

  ghost: {
    apply: (ball) => {
      ball.isGhost = true;
      // Will need to update collision category in RaceScene
    },
    remove: (ball) => {
      ball.isGhost = false;
    }
  },

  shrink: {
    apply: (ball, sizeMultiplier) => {
      ball.sizeMultiplier = (ball.sizeMultiplier || 1) * sizeMultiplier;
      // Will need to update physics body in RaceScene
    },
    remove: (ball, sizeMultiplier) => {
      ball.sizeMultiplier = (ball.sizeMultiplier || 1) / sizeMultiplier;
    }
  },

  damage: {
    apply: (ball, multiplier) => {
      ball.damageMultiplier = (ball.damageMultiplier || 1) * multiplier;
    },
    remove: (ball, multiplier) => {
      ball.damageMultiplier = (ball.damageMultiplier || 1) / multiplier;
    }
  }
};
