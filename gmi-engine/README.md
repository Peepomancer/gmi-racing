# GMI Racing Engine

A 2D ball racing simulation engine for livestream betting content. Balls bounce around procedurally generated (or custom) maps in DVD-screensaver style physics, racing to reach the finish line.

## Features

- **DVD-Style Physics**: Balls bounce perpetually with no gravity, maintaining constant speed
- **Procedural Maps**: Noise-based obstacle generation with configurable density
- **SVG Map Import**: Design custom maps in Illustrator, export as SVG, import into engine
- **Visual Map Editor**: Draw obstacles, place start/finish zones, configure special behaviors
- **Boss System**: Add boss enemies with multiple attack patterns and win conditions
- **Chain Editor**: Create sequences of maps to play in order with drag & drop interface
- **Special Obstacles**: Crushers, breakable walls, rotating platforms, moving obstacles
- **Collision Chaos**: Proper physics reflection with random angle variation prevents stuck patterns
- **Anti-Slide Detection**: Balls can't slide along walls - forced to bounce away
- **Live Standings**: Real-time progress tracking with finish order display
- **Config System**: Save/load configurations via localStorage

## Tech Stack

- **Phaser 3** - Game framework
- **Matter.js** - Physics engine (via Phaser)
- **Simplex Noise** - Procedural map generation
- **IndexedDB** - Map storage for editor
- **esbuild** - Bundler & dev server

## Getting Started

### Install
```bash
npm install
```

### Run Dev Server
```bash
npm run dev
```
Then open http://localhost:3000

### Build Only
```bash
npm run build
```

## Project Structure

```
gmi-engine/
├── src/
│   ├── index.html          # Main HTML with UI
│   ├── renderer.js         # App entry point, UI logic, chain playback
│   ├── bundle.js           # Built output (generated)
│   ├── editor.html         # Visual Map Editor UI
│   ├── editor.js           # Editor logic, boss config, chain editor
│   ├── editor-bundle.js    # Editor built output
│   ├── game/
│   │   ├── Game.js         # Phaser game wrapper
│   │   ├── scenes/
│   │   │   └── RaceScene.js    # Main game scene, physics, boss battles
│   │   └── systems/
│   │       ├── MapGenerator.js  # Procedural map generation
│   │       ├── SVGMapLoader.js  # SVG import parser
│   │       ├── MapLoader.js     # Editor map loader
│   │       └── BossSystem.js    # Boss AI and attack patterns
│   └── shared/
│       └── MapStorage.js   # IndexedDB map storage
├── package.json
└── README.md
```

## Controls

| Button | Action |
|--------|--------|
| Start Race | Launch balls with random diagonal velocities |
| Stop Race | Pause the race |
| Reset | Return balls to starting positions |
| New Map | Generate new procedural map (random seed) |
| Export Bounce Logs | Download JSON log of all collisions for analysis |

## Special Obstacle Types

### Static (Default)
Normal solid obstacle that balls bounce off.

### Crusher
Moving obstacle that can eliminate balls by squishing them against walls.
- `crusherDirection`: up, down, left, right
- `crusherSpeed`: pixels per second
- `crusherResetDelay`: milliseconds before returning to start

### Breakable
Obstacle that can be destroyed after taking damage.
- `health`: hits required to destroy
- `breakableBy`: array of ball colors that can damage it (empty = all)

### Rotating
Obstacle that spins continuously.
- `rotationSpeed`: RPM
- `rotationDirection`: cw (clockwise) or ccw

### Moving
Obstacle that moves back and forth.
- `moveDirection`: horizontal or vertical
- `moveDistance`: total distance in pixels
- `moveSpeed`: pixels per second

## Map Editor

Access via the "Open Map Editor" button in the Map tab.

### Features
- Draw rectangles and circles with visual tools
- Place start zone (green) and finish zone (checkered)
- Configure obstacle properties (type, color, behavior)
- Place boss enemies with attack pattern configuration
- Customize viewport background, floor color, and grid
- Save maps to IndexedDB
- Export/Import maps as JSON for sharing
- Chain editor for creating map sequences

### Keyboard Shortcuts
| Key | Tool |
|-----|------|
| `V` | Select tool |
| `R` | Rectangle tool |
| `C` | Circle tool |
| `S` | Start zone tool |
| `F` | Finish zone tool |
| `B` | Boss placement tool |
| `Delete` | Delete selected obstacle |

### Left Toolbar (Photoshop-style)
The editor features a vertical toolbar on the left side with quick access to all drawing tools.

### Map Settings Panel
Configure visual appearance:
- **Viewport Background**: Color shown outside the playable area
- **Floor Color**: Color of the playable map area
- **Grid Color**: Color of the alignment grid
- **Grid Size**: Spacing between grid lines (default: 50px)
- **Show Grid**: Toggle grid visibility

### Boss Configuration Panel
When the Boss tool is selected:
- **Attack Pattern**: spiral, spread, aimed, random, burst
- **Position**: X/Y coordinates (or click canvas to place)
- **Health**: Boss hit points
- **Shape**: circle or rectangle
- **Size**: Width and height
- **Color**: Visual color for the boss
- **Win Condition**:
  - `boss` - Win by killing the boss only
  - `finish` - Must reach finish line (boss is optional)
  - `either` - Win by killing boss OR reaching finish

## Chain Editor

Create sequences of maps that play in order.

### Creating a Chain
1. Open the Library window (Maps & Chains button)
2. In the Chains section, click "+ New Chain"
3. Drag maps from the Maps list to the Chain drop zone
4. Reorder maps by dragging within the chain
5. Remove maps by clicking the X button
6. Save the chain with a name

### Editing a Chain
1. Select a chain in the library
2. Click "Edit Chain" to enter Chain Edit Mode
3. The right sidebar shows the map list for navigation
4. Click any map in the list to load and edit it
5. Use "Add Current Map" to append new maps to the chain
6. Click "Exit Chain Mode" when done

### Testing Chains
- Use "Test Chain" button to play through all maps in sequence
- Each map must be completed before advancing
- Progress is tracked across the chain

## Boss System

Add boss enemies to create combat-focused maps.

### Attack Patterns
| Pattern | Description |
|---------|-------------|
| `spiral` | Fires projectiles in a rotating spiral pattern |
| `spread` | Fires multiple projectiles in a fan shape |
| `aimed` | Targets the nearest ball |
| `random` | Fires projectiles in random directions |
| `burst` | Fires rapid bursts of projectiles |

### Boss Properties
- **Health**: Number of hits to defeat (projectiles fired by boss damage balls, ball collisions damage boss)
- **Fire Rate**: Interval between attacks in milliseconds
- **Projectile Speed**: How fast projectiles travel
- **Win Condition**: Determines how to complete the level

### Win Conditions
- `boss` - Level completes when boss is defeated. Finish zone is ignored.
- `finish` - Level completes when balls reach finish. Boss is optional challenge.
- `either` - Level completes when boss is defeated OR finish zone is reached.

## Physics System

### Ball Collision
- Uses Matter.js collision normals for accurate reflection
- Formula: `v' = v - 2(v·n)n` where n is collision normal
- Random angle twist (±20-40°) added for unpredictability
- Constant speed maintained after each bounce

### Anti-Stuck Systems
1. **Collision Debounce**: Prevents rapid micro-bounces on same obstacle
2. **Trap Detection**: If ball bounces 6+ times in 500ms, forces escape
3. **Anti-Slide**: If ball contacts surface >80ms, forces strong bounce away
4. **Wall Parallel Detection**: If moving too parallel to wall, bounces toward center
5. **Position History**: If stuck in same spot for 30+ frames, forces escape

### Crush Detection
- Finds nearest large obstacle (>100px) in crusher's direction
- Calculates gap between crusher edge and target wall
- Ball eliminated when gap < ball diameter × 0.9
- Visual "danger" indicator when gap < ball diameter × 3

## Debug Tools

### Bounce Log (Press L)
Dumps last 500 bounces to console showing:
- Ball name, position, hit type
- Pre/post velocity and angle
- Suspicious bounces flagged

### Export Bounce Logs
Downloads full JSON file with:
- All collision events
- Summary statistics
- Timestamps for analysis

### Physics Test Maps
Built-in "Crush Physics Test" map for testing crusher mechanics:
- Narrow corridor with thin wall
- Trap zone to catch physics breaches
- Balls turn red if they tunnel through walls

## Configuration Tabs

### Race
- Ball count (1-10)
- Race duration

### Balls
- Ball radius
- Ball density

### Map
- **Editor Maps**: Load maps created in the Map Editor
- **Built-in Test Maps**: Pre-made maps for testing
- **SVG Import**: Drag & drop custom SVG maps
- Noise scale (procedural)
- Platform density (procedural)
- Seed (procedural)

### Physics
- Ball speed (1-20)
- Obstacle density

## Creating Custom Maps

### Using the Visual Editor (Recommended)
1. Click "Open Map Editor"
2. Set canvas size
3. Draw obstacles with rectangle/circle tools
4. Place start and finish zones
5. Configure special behaviors in properties panel
6. Save map

### Using Illustrator (SVG Import)
1. Create document (recommended: 800x600px)
2. Create layers:
   - `collision` - Draw rectangles/circles for physics obstacles
   - `finish` - Rectangle marking finish line (top of map)
   - `spawn` - Rectangle marking ball spawn area (bottom of map)
3. Export: File > Export > Export As > SVG
4. Import: Drag SVG into the Map tab drop zone

## Roadmap

- [x] Special obstacle types (crusher, breakable, rotating, moving)
- [x] Visual map editor
- [x] Improved physics collision handling
- [x] Anti-stuck and anti-slide systems
- [x] Boss system with attack patterns
- [x] Chain editor for map sequences
- [x] Boss win conditions (boss, finish, either)
- [x] Map settings (viewport bg, floor color, grid)
- [ ] Mario Kart-style items/powerups
- [ ] Visual effects (trails, particles)
- [ ] Sound effects
- [ ] Race replays
- [ ] Betting integration
- [ ] OBS/streaming overlay mode

## Development Notes

This project uses a "vibe coding" approach - designed to be AI-friendly for easy feature additions. Key principles:
- JSON-driven configuration
- Modular scene/system architecture
- Clear separation of physics, rendering, and UI
- Extensive debug logging for physics analysis

### Key Files for Physics
- `RaceScene.js`: All collision handling, special obstacles, ball physics
- `Game.js`: Matter.js configuration (iterations, gravity)

### Key Files for Editor
- `editor.html` / `editor.js`: Visual map editor
- `MapStorage.js`: IndexedDB persistence
- `MapLoader.js`: Load editor maps into game

### Key Files for Boss System
- `BossSystem.js`: Boss AI, attack patterns, projectile management
- `RaceScene.js`: Boss rendering, collision detection, win conditions

## Data Formats

### Map Data (JSON)
```json
{
  "id": "unique-id",
  "name": "My Map",
  "width": 800,
  "height": 600,
  "data": {
    "obstacles": [
      {
        "id": "obs-1",
        "type": "rectangle",
        "x": 100,
        "y": 200,
        "width": 50,
        "height": 100,
        "color": "#ff0000",
        "behavior": "static"
      }
    ],
    "startZone": { "x": 0, "y": 500, "width": 800, "height": 100 },
    "finishZone": { "x": 0, "y": 0, "width": 800, "height": 60 },
    "bossConfig": {
      "enabled": true,
      "x": 400,
      "y": 100,
      "health": 10,
      "shape": "circle",
      "width": 60,
      "height": 60,
      "color": "#ff0000",
      "attackPattern": "spiral",
      "winCondition": "boss"
    }
  }
}
```

### Chain Data (localStorage)
```json
{
  "id": "chain-id",
  "name": "My Chain",
  "mapIds": ["map-1", "map-2", "map-3"],
  "createdAt": 1706745600000,
  "updatedAt": 1706745600000
}
```

### Obstacle Behaviors
| Behavior | Properties |
|----------|------------|
| `static` | None |
| `breakable` | `health`, `breakableBy` |
| `rotating` | `rotationSpeed`, `rotationDirection` |
| `moving` | `moveDirection`, `moveDistance`, `moveSpeed` |
| `crusher` | `crusherDirection`, `crusherSpeed`, `crusherResetDelay` |

## Storage

### IndexedDB (Maps)
Maps are stored in IndexedDB database `GMIMapEditor` in the `maps` object store.
- Accessed via `MapStorage.js` singleton
- Supports: save, load, list, delete, export, import

### localStorage (Chains & Settings)
- Chains: `gmi-chains` key stores JSON array of chain objects
- Editor settings: Various keys for UI state

---

Built for livestream racing content.
