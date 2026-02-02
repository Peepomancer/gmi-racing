# Test Maps Setup Instructions

## Quick Setup (Browser Console Method)

1. Open the editor: http://127.0.0.1:3000/editor.html
2. Open browser DevTools (F12)
3. Go to Console tab
4. Paste this script and press Enter:

```javascript
// Create test maps and chain for Weapon/Item system testing
(async () => {
  const storage = window.editorUI?.mapStorage;
  if (!storage) { console.error('Map storage not ready'); return; }

  // Map 1: Item Intro
  const map1 = await storage.saveMap({
    name: "Level 1 - Item Intro",
    width: 800,
    height: 600,
    data: {
      startZone: { x: 50, y: 500, width: 700, height: 60 },
      finishZone: { x: 50, y: 30, width: 700, height: 40 },
      obstacles: [
        { id: "obs-1", type: "rectangle", x: 0, y: 250, width: 250, height: 25, color: "#e74c3c", behavior: "static" },
        { id: "obs-2", type: "rectangle", x: 550, y: 250, width: 250, height: 25, color: "#e74c3c", behavior: "static" },
        { id: "obs-3", type: "rectangle", x: 200, y: 380, width: 400, height: 25, color: "#3498db", behavior: "static" },
        { id: "obs-4", type: "circle", x: 400, y: 150, radius: 40, color: "#9b59b6", behavior: "rotating", rotationSpeed: 2, rotationDirection: "cw" }
      ],
      itemSpawns: [
        { id: "item-1", x: 150, y: 420, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 0 },
        { id: "item-2", x: 400, y: 420, itemType: "random", spawnOnStart: true, respawnTime: 0 },
        { id: "item-3", x: 650, y: 420, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 0 },
        { id: "item-4", x: 400, y: 300, itemType: "speed_boost", spawnOnStart: true, respawnTime: 5000 },
        { id: "item-5", x: 200, y: 180, itemType: "health_pack", spawnOnStart: true, respawnTime: 8000 },
        { id: "item-6", x: 600, y: 180, itemType: "shield", spawnOnStart: true, respawnTime: 10000 }
      ]
    }
  });
  console.log('Created Map 1:', map1.id);

  // Map 2: Weapon Arena
  const map2 = await storage.saveMap({
    name: "Level 2 - Weapon Arena",
    width: 800,
    height: 700,
    data: {
      startZone: { x: 50, y: 600, width: 700, height: 60 },
      finishZone: { x: 50, y: 30, width: 700, height: 40 },
      obstacles: [
        { id: "obs-wall-left", type: "rectangle", x: 0, y: 200, width: 150, height: 25, color: "#e74c3c", behavior: "static" },
        { id: "obs-wall-right", type: "rectangle", x: 650, y: 200, width: 150, height: 25, color: "#e74c3c", behavior: "static" },
        { id: "obs-moving-1", type: "rectangle", x: 200, y: 350, width: 120, height: 25, color: "#f39c12", behavior: "moving", moveDirection: "horizontal", moveDistance: 200, moveSpeed: 60 },
        { id: "obs-moving-2", type: "rectangle", x: 480, y: 350, width: 120, height: 25, color: "#f39c12", behavior: "moving", moveDirection: "horizontal", moveDistance: 200, moveSpeed: 60 },
        { id: "obs-spinner-1", type: "rectangle", x: 350, y: 480, width: 100, height: 20, color: "#9b59b6", behavior: "rotating", rotationSpeed: 3, rotationDirection: "cw" },
        { id: "obs-breakable-1", type: "rectangle", x: 300, y: 150, width: 80, height: 80, color: "#2ecc71", behavior: "breakable", health: 3, breakableBy: ["Red", "Blue", "Green", "Yellow", "Purple"] },
        { id: "obs-breakable-2", type: "rectangle", x: 420, y: 150, width: 80, height: 80, color: "#2ecc71", behavior: "breakable", health: 3, breakableBy: ["Red", "Blue", "Green", "Yellow", "Purple"] }
      ],
      itemSpawns: [
        { id: "item-wep-1", x: 100, y: 450, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 8000 },
        { id: "item-wep-2", x: 700, y: 450, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 8000 },
        { id: "item-wep-3", x: 400, y: 550, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 5000 },
        { id: "item-damage", x: 400, y: 280, itemType: "damage_boost", spawnOnStart: true, respawnTime: 12000 },
        { id: "item-speed-1", x: 200, y: 280, itemType: "speed_boost", spawnOnStart: true, respawnTime: 6000 },
        { id: "item-speed-2", x: 600, y: 280, itemType: "speed_boost", spawnOnStart: true, respawnTime: 6000 },
        { id: "item-ghost", x: 400, y: 400, itemType: "ghost", spawnOnStart: true, respawnTime: 15000 },
        { id: "item-heal-1", x: 100, y: 280, itemType: "health_pack", spawnOnStart: true, respawnTime: 10000 },
        { id: "item-heal-2", x: 700, y: 280, itemType: "health_pack", spawnOnStart: true, respawnTime: 10000 }
      ]
    }
  });
  console.log('Created Map 2:', map2.id);

  // Map 3: Boss Battle
  const map3 = await storage.saveMap({
    name: "Level 3 - Boss Battle",
    width: 900,
    height: 700,
    data: {
      startZone: { x: 50, y: 600, width: 800, height: 60 },
      finishZone: null,
      obstacles: [
        { id: "obs-pillar-1", type: "rectangle", x: 150, y: 300, width: 40, height: 200, color: "#7f8c8d", behavior: "static" },
        { id: "obs-pillar-2", type: "rectangle", x: 350, y: 300, width: 40, height: 200, color: "#7f8c8d", behavior: "static" },
        { id: "obs-pillar-3", type: "rectangle", x: 510, y: 300, width: 40, height: 200, color: "#7f8c8d", behavior: "static" },
        { id: "obs-pillar-4", type: "rectangle", x: 710, y: 300, width: 40, height: 200, color: "#7f8c8d", behavior: "static" },
        { id: "obs-cover-1", type: "rectangle", x: 100, y: 450, width: 150, height: 30, color: "#34495e", behavior: "static" },
        { id: "obs-cover-2", type: "rectangle", x: 650, y: 450, width: 150, height: 30, color: "#34495e", behavior: "static" },
        { id: "obs-breakable-center", type: "rectangle", x: 400, y: 350, width: 100, height: 100, color: "#27ae60", behavior: "breakable", health: 5, breakableBy: ["Red", "Blue", "Green", "Yellow", "Purple"] }
      ],
      itemSpawns: [
        { id: "item-wep-left", x: 80, y: 550, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 6000 },
        { id: "item-wep-right", x: 820, y: 550, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 6000 },
        { id: "item-wep-center", x: 450, y: 550, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 4000 },
        { id: "item-shield-1", x: 250, y: 400, itemType: "shield", spawnOnStart: true, respawnTime: 12000 },
        { id: "item-shield-2", x: 650, y: 400, itemType: "shield", spawnOnStart: true, respawnTime: 12000 },
        { id: "item-damage-boost", x: 450, y: 480, itemType: "damage_boost", spawnOnStart: true, respawnTime: 15000 },
        { id: "item-heal-left", x: 175, y: 550, itemType: "health_pack", spawnOnStart: true, respawnTime: 8000 },
        { id: "item-heal-right", x: 725, y: 550, itemType: "health_pack", spawnOnStart: true, respawnTime: 8000 },
        { id: "item-speed-center", x: 450, y: 400, itemType: "speed_boost", spawnOnStart: true, respawnTime: 10000 }
      ],
      bossConfig: { x: 450, y: 120, width: 200, height: 100, hp: 150, attackPattern: "mixed", attackCooldown: 2000, winCondition: "boss" }
    }
  });
  console.log('Created Map 3:', map3.id);

  // Create Chain
  const chains = JSON.parse(localStorage.getItem('gmi-chains') || '[]');
  const newChain = {
    id: 'chain-test-weapons-' + Date.now(),
    name: 'Weapon Test Chain',
    maps: [
      { id: map1.id, name: map1.name, width: map1.width, height: map1.height },
      { id: map2.id, name: map2.name, width: map2.width, height: map2.height },
      { id: map3.id, name: map3.name, width: map3.width, height: map3.height }
    ],
    createdAt: Date.now()
  };
  chains.push(newChain);
  localStorage.setItem('gmi-chains', JSON.stringify(chains));
  console.log('Created Chain:', newChain.id);

  // Refresh UI
  window.editorUI?.refreshMapList?.();
  window.editorUI?.refreshChainList?.();

  alert('Test maps and chain created! Refresh the page and look for "Weapon Test Chain" in the Chains tab.');
})();
```

5. Refresh the editor page
6. Go to the "Chains" tab in the left sidebar
7. Find "Weapon Test Chain" and click it
8. Click "Test Chain" button to play!

## What to Test

### Level 1 - Item Intro
- Balls spawn at bottom
- Multiple item pickups (weapon crates, speed boost, health, shield)
- Pick up items by rolling over them
- Finish at top to proceed

### Level 2 - Weapon Arena
- More obstacles and moving platforms
- Multiple weapon crates that respawn
- Damage boost, ghost mode, speed boosts
- Breakable obstacles (hit them with weapons!)
- **Watch weapons auto-fire!**

### Level 3 - Boss Battle
- Final boss at the top
- No finish line - defeat boss to win
- Tons of item spawns for weapons
- Use weapons to damage the boss
- Collect shields and health to survive boss attacks

### After Each Level
- **Roulette wheel** spins for the winner
- Winner gets a random weapon reward
- Weapons persist across levels!

## Features to Observe

1. **Auto-Attacking Weapons**: Balls automatically fire their weapons
2. **Projectiles**: See bullets/orbs flying around
3. **Item Pickups**: Glowing circles on the map
4. **Buff Effects**: Speed boost, invincibility shield, ghost mode
5. **Roulette System**: CS:GO style reward wheel between levels
6. **Inventory Persistence**: Weapons carry over to next level
