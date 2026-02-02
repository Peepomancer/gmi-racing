/**
 * ItemSystem.js - Manages item spawning, pickup, and buff application
 */

import { ITEM_TYPES, getRandomItem, getItem } from './ItemDefinitions.js';
import { getRandomWeapon } from './WeaponDefinitions.js';

export class ItemSystem {
  constructor(scene) {
    this.scene = scene;

    // Active item pickups on the map
    this.items = [];

    // Item spawn points from editor
    this.spawnPoints = [];

    // Timer for random spawns
    this.randomSpawnTimer = 0;
    this.randomSpawnInterval = 10000; // 10 seconds

    // Maximum items on map at once
    this.maxItems = 8;
  }

  /**
   * Initialize item system with spawn points from map data
   */
  init(mapData) {
    this.clear();

    // Load spawn points from editor map data
    if (mapData && mapData.itemSpawns) {
      this.spawnPoints = mapData.itemSpawns.map(spawn => ({
        id: spawn.id,
        x: spawn.x,
        y: spawn.y,
        itemType: spawn.itemType || 'random',
        spawnOnStart: spawn.spawnOnStart !== false,
        respawnTime: spawn.respawnTime || 0,
        lastSpawnTime: 0,
        isActive: false
      }));

      console.log(`[ItemSystem] Loaded ${this.spawnPoints.length} spawn points`);
    }
  }

  /**
   * Spawn initial items at start of race
   */
  spawnInitialItems() {
    for (const spawn of this.spawnPoints) {
      if (spawn.spawnOnStart) {
        this.spawnItemAtPoint(spawn);
      }
    }
  }

  /**
   * Spawn an item at a spawn point
   */
  spawnItemAtPoint(spawnPoint) {
    if (spawnPoint.isActive) return;

    const itemDef = spawnPoint.itemType === 'random'
      ? getRandomItem()
      : getItem(spawnPoint.itemType);

    if (!itemDef) {
      console.warn(`[ItemSystem] Unknown item type: ${spawnPoint.itemType}`);
      return;
    }

    this.createItem(itemDef, spawnPoint.x, spawnPoint.y, spawnPoint);
    spawnPoint.isActive = true;
    spawnPoint.lastSpawnTime = Date.now();
  }

  /**
   * Spawn a random item at a random position
   */
  spawnRandomItem() {
    if (this.items.length >= this.maxItems) return;

    const itemDef = getRandomItem();
    const margin = 50;

    // Random position avoiding edges
    const x = margin + Math.random() * (this.scene.gameWidth - margin * 2);
    const y = margin + Math.random() * (this.scene.gameHeight - margin * 2);

    this.createItem(itemDef, x, y);
  }

  /**
   * Create an item pickup at position
   */
  createItem(itemDef, x, y, spawnPoint = null) {
    // Create graphics
    const graphics = this.scene.add.graphics();
    this.drawItemGraphics(graphics, itemDef);
    graphics.x = x;
    graphics.y = y;

    // Create physics body (sensor - detects collision but doesn't block)
    const body = this.scene.matter.add.circle(x, y, itemDef.radius + 5, {
      isSensor: true,
      isStatic: true,
      label: 'item'
    });

    const item = {
      body,
      graphics,
      definition: itemDef,
      x,
      y,
      spawnPoint,
      spawnTime: Date.now(),
      bobOffset: Math.random() * Math.PI * 2 // For floating animation
    };

    this.items.push(item);

    // Store reference on body for collision detection
    body.itemRef = item;

    console.log(`[ItemSystem] Spawned ${itemDef.name} at (${Math.round(x)}, ${Math.round(y)})`);
  }

  /**
   * Draw item pickup graphics
   */
  drawItemGraphics(graphics, itemDef) {
    graphics.clear();

    // Glow effect
    graphics.fillStyle(itemDef.color, 0.2);
    graphics.fillCircle(0, 0, itemDef.radius + 5);

    // Main circle
    graphics.fillStyle(itemDef.color, 1);
    graphics.fillCircle(0, 0, itemDef.radius);

    // Outline
    graphics.lineStyle(2, itemDef.outlineColor, 1);
    graphics.strokeCircle(0, 0, itemDef.radius);

    // Inner highlight
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillCircle(-itemDef.radius / 3, -itemDef.radius / 3, itemDef.radius / 3);
  }

  /**
   * Handle ball picking up an item
   */
  pickupItem(item, ball) {
    const itemDef = item.definition;

    console.log(`[ItemSystem] ${ball.name} picked up ${itemDef.name}`);

    // Apply item effect
    switch (itemDef.type) {
      case 'weapon':
        this.applyWeaponCrate(ball, itemDef);
        break;

      case 'buff':
        this.applyBuff(ball, itemDef);
        break;

      case 'consumable':
        this.applyConsumable(ball, itemDef);
        break;
    }

    // Create pickup effect
    this.createPickupEffect(item.x, item.y, itemDef.color);

    // Remove item
    this.destroyItem(item);

    // Handle respawn point
    if (item.spawnPoint && item.spawnPoint.respawnTime > 0) {
      item.spawnPoint.isActive = false;
      // Respawn will be handled in update()
    }
  }

  /**
   * Apply weapon crate pickup
   */
  applyWeaponCrate(ball, itemDef) {
    if (!this.scene.inventorySystem) return;

    const weapon = getRandomWeapon(itemDef.tierWeights);
    const added = this.scene.inventorySystem.addWeapon(ball.name, weapon.id);

    if (added) {
      console.log(`[ItemSystem] ${ball.name} received weapon: ${weapon.name}`);
      this.showPickupText(ball, `+${weapon.name}!`, 0xffaa00);
    } else {
      // Inventory full - could give XP or upgrade random weapon
      console.log(`[ItemSystem] ${ball.name} inventory full`);
      this.showPickupText(ball, 'Inventory Full!', 0xff4444);
    }
  }

  /**
   * Apply buff pickup
   */
  applyBuff(ball, itemDef) {
    if (!this.scene.inventorySystem) return;

    this.scene.inventorySystem.addBuff(ball.name, itemDef.effect, itemDef.duration, {
      multiplier: itemDef.multiplier,
      sizeMultiplier: itemDef.sizeMultiplier
    });

    this.showPickupText(ball, `${itemDef.name}!`, itemDef.color);
  }

  /**
   * Apply consumable pickup
   */
  applyConsumable(ball, itemDef) {
    if (itemDef.effect === 'heal') {
      const oldHp = ball.hp;
      ball.hp = Math.min(ball.maxHp, ball.hp + itemDef.healAmount);
      const healed = ball.hp - oldHp;
      this.showPickupText(ball, `+${healed} HP`, 0x44ff44);
    }
  }

  /**
   * Show floating text above ball
   */
  showPickupText(ball, text, color) {
    const x = ball.body.position.x;
    const y = ball.body.position.y - 30;

    const textObj = this.scene.add.text(x, y, text, {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Animate up and fade
    this.scene.tweens.add({
      targets: textObj,
      y: y - 30,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => textObj.destroy()
    });
  }

  /**
   * Create pickup particle effect
   */
  createPickupEffect(x, y, color) {
    const particleCount = 8;
    const graphics = this.scene.add.graphics();

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i;
      const px = x + Math.cos(angle) * 20;
      const py = y + Math.sin(angle) * 20;

      const particle = this.scene.add.graphics();
      particle.fillStyle(color, 1);
      particle.fillCircle(0, 0, 4);
      particle.x = x;
      particle.y = y;

      this.scene.tweens.add({
        targets: particle,
        x: px,
        y: py,
        alpha: 0,
        scale: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  /**
   * Destroy an item
   */
  destroyItem(item) {
    if (item.graphics) item.graphics.destroy();
    if (item.body) this.scene.matter.world.remove(item.body);
    this.items = this.items.filter(i => i !== item);
  }

  /**
   * Update item system
   */
  update(delta) {
    const now = Date.now();

    // Floating animation for items
    for (const item of this.items) {
      item.bobOffset += 0.003 * delta;
      const bob = Math.sin(item.bobOffset) * 3;
      item.graphics.y = item.y + bob;
    }

    // Check for respawns
    for (const spawn of this.spawnPoints) {
      if (!spawn.isActive && spawn.respawnTime > 0) {
        if (now - spawn.lastSpawnTime >= spawn.respawnTime) {
          this.spawnItemAtPoint(spawn);
        }
      }
    }

    // Random spawns (only if enabled and below max items)
    if (this.scene.isRacing && this.items.length < this.maxItems) {
      this.randomSpawnTimer += delta;
      if (this.randomSpawnTimer >= this.randomSpawnInterval) {
        this.randomSpawnTimer = 0;
        this.spawnRandomItem();
      }
    }
  }

  /**
   * Handle collision between ball and item
   */
  handleCollision(ballBody, itemBody) {
    const ball = this.scene.balls.find(b => b.body === ballBody);
    const item = itemBody.itemRef;

    if (ball && item && !ball.finished && !ball.isRespawning) {
      this.pickupItem(item, ball);
      return true;
    }
    return false;
  }

  /**
   * Clear all items
   */
  clear() {
    for (const item of this.items) {
      if (item.graphics) item.graphics.destroy();
      if (item.body) this.scene.matter.world.remove(item.body);
    }
    this.items = [];
    this.spawnPoints = [];
    this.randomSpawnTimer = 0;
  }

  /**
   * Get item count on map
   */
  getItemCount() {
    return this.items.length;
  }
}
