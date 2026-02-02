# GMI Racing - Goals & Development Roadmap

**Project:** GMI Racing Platform
**Creator:** Peepomancer Motion Studios
**Focus:** Game First, Token Later
**Status:** Active Development - Core Engine Built
**Last Updated:** January 2026

---

## CORE VISION (UPDATED)

**"Build the most entertaining simulation triathlon. Nail-biting, dopamine-pumping, brainrot-level addictive."**

Inspired by:
- **Earclacks** - Weapon ball battle simulations
- **Jelle's Marble Runs** - Marble racing drama
- **Mario Kart** - Items, chaos, comebacks
- **TikTok/Shorts** - Non-stop dopamine, no waiting

---

## THE GMI TRIATHLON

### Game Structure

```
3 MIN BETTING WINDOW (only wait)
         |
         v
    +---------+     +---------+     +---------+
    |  RACE   | --> |   PVP   | --> |  BOSS   |
    |  MODE   |     |  MODE   |     |  MODE   |
    +---------+     +---------+     +---------+
         |               |               |
    (Map 1)         (Map 2)         (Map 3)
         |               |               |
         +-------+-------+-------+-------+
                         |
                         v
                  FINAL STANDINGS
                  Top 3 = Paid
                  Bottom 2 = Nothing
```

### Core Principle: No Waiting

- **3 min initial bet** = Only pause
- **After that** = NON-STOP ACTION
- **Transitions** = 3 seconds max (seamless)
- **Volume pumping** = Anytime during events (real-time stat changes)
- **Something happening** = Every 3-5 seconds

---

## GAME MODES

### Mode 1: Race
- Standard race to finish line
- Obstacles, breakables, chaos
- Placement determines points
- Mystery boxes spawn
- Random events mid-race

### Mode 2: PvP Battle
- All balls fight in arena
- Weapons attached to balls (Earclacks style)
- Damage, knockback, eliminations
- Shrinking zone optional
- Last alive OR most damage = winner

### Mode 3: Boss Fight
- All balls vs Giant Boss
- Boss has attack patterns
- Damage dealt = points
- Boss drops loot mid-fight
- Weak spots for bonus damage
- Rage mode at low HP

---

## MULTI-MAP ROUTING SYSTEM

### Concept
Each "tournament" is a sequence of maps/modes:

```json
{
  "tournament": "Chaos Gauntlet",
  "stages": [
    { "map": "speed-track", "mode": "race" },
    { "map": "battle-arena", "mode": "pvp" },
    { "map": "boss-lair", "mode": "boss" }
  ]
}
```

### Map Transitions
- Ball crosses finish in Race -> Teleport to PvP arena
- PvP ends -> Arena transforms into Boss lair
- Seamless, no loading screens
- Camera effects for drama

### Customizable Flows
- Race only (classic)
- Race -> PvP (elimination style)
- Race -> Boss (cooperative)
- PvP -> Boss (battle then unite)
- Full triathlon (Race -> PvP -> Boss)
- Any permutation testable

---

## VOLUME SYSTEM

### Fake Volume (For Testing)
- UI panel with Buy/Sell buttons per ball
- Random fluctuation mode
- Manual pump simulation
- Real-time stat updates

### Volume -> Stats
```
Volume Rank    Speed     HP      Damage    Size
--------------------------------------------------------
1st (highest)  +20%     +30%     +25%     Bigger
2nd            +10%     +20%     +15%
3rd            base     base     base     Medium
4th            -10%     -10%     -10%
5th (lowest)   -15%     -20%     -15%     Smaller
```

### Real-Time Updates
- Pump volume MID-EVENT = stats change immediately
- Viewers see: "Ball C SURGE! +15% damage!"
- Creates FOMO and engagement
- Comeback mechanic for losing balls

---

## WEAPON SYSTEM (Earclacks Style)

### Weapon Types
| Weapon | Damage | Range | Special |
|--------|--------|-------|---------|
| Blade | High | Short | Spin attack |
| Hammer | Very High | Short | Knockback |
| Spear | Medium | Long | Reach advantage |
| Flail | High | Medium | Unpredictable |
| Shield | Low | - | Blocks damage |
| Spikes | Medium | Touch | Passive damage |
| Axe | High | Medium | Can break weapons |
| Mace | High | Short | Stun chance |

### Weapon Tiers (RNG)
```
Common (40%)     - Base stats
Rare (30%)       - +25% damage
Epic (20%)       - +50% damage + ability
Legendary (10%)  - +100% damage + unique power
```

### Volume Affects Luck
Higher volume = Better odds for good weapons
But low volume CAN still roll Legendary (upset potential)

---

## RNG & DOPAMINE SYSTEMS

### Slot Spins
- Pre-event weapon roulette
- Triple match = Legendary
- Visual drama, chat predictions

### Critical Hits
- 5% base crit chance
- +1% per volume rank
- 3.5x damage on crit
- Screen flash, sound effect

### Mystery Boxes
- Spawn every 15 seconds
- First to touch = gets reward
- Common/Rare/Epic/Legendary tiers
- Creates mini-races within events

### Random Events
- Trigger every 30 seconds
- "Gravity Flip!", "Floor is Lava!", "Speed Lanes!"
- Chaos modifiers that change gameplay
- Keeps viewers on edge

### Near-Miss Drama
- Photo finish slow-mo
- "1 HP SURVIVAL!" callouts
- Clutch moment replays
- Designed for close outcomes

---

## SCORING SYSTEM

### Points Per Event
```
Place    Race    PvP     Boss
--------------------------------
1st      10      15      damage%
2nd       8      12      damage%
3rd       6       9      damage%
4th       4       6      damage%
5th       2       3      damage%
```

### Final Payout
```
Total Points -> Final Placement

1st: 50% of volume pool
2nd: 30%
3rd: 20%
4th: 0% (NOTHING)
5th: 0% (NOTHING)
```

### Why Top 3 Only
- Clear stakes: Make podium or lose everything
- Drama for 3rd/4th battle
- 4th place = survived most, got nothing (brutal)
- Incentivizes pumping to not be bottom 2

---

## SPRITE/ENTITY SYSTEM (Future)

### Current: Balls
- Simple circles with physics
- Color-coded
- Graphics object rendering

### Future: Custom Sprites
- PNG/sprite sheet support
- Character designs
- Animated sprites
- Same physics, different visuals
- Per-ball customization

### Implementation Plan
```
Ball Entity
├── physics body (Matter.js)
├── visual (Graphics OR Sprite)
├── stats (HP, Speed, Damage)
├── weapon (optional)
└── effects (particles, trails)
```

---

## AI-FRIENDLY CONFIG SYSTEM

### Race Config Format
```json
{
  "race_id": "test_001",
  "name": "Chaos Gauntlet",

  "balls": [
    { "name": "Red", "color": "#ff0000", "volume": 50000 },
    { "name": "Blue", "color": "#0000ff", "volume": 45000 }
  ],

  "stages": [
    {
      "type": "race",
      "map": "breakable-test",
      "duration": 120,
      "settings": {
        "random_events": true,
        "mystery_boxes": true
      }
    },
    {
      "type": "pvp",
      "map": "battle-arena",
      "duration": 150,
      "settings": {
        "weapons": true,
        "shrinking_zone": true
      }
    },
    {
      "type": "boss",
      "map": "boss-lair",
      "duration": 150,
      "settings": {
        "boss_type": "giant",
        "boss_hp": 1000
      }
    }
  ],

  "scoring": { ... },
  "volume_effects": { ... }
}
```

### AI Can Generate
- "Create a fast-paced race with lots of breakables"
- "Make a PvP arena with shrinking zone"
- "Design a boss fight with rage mode"
- AI outputs JSON -> Game runs it

---

## MODULAR ARCHITECTURE

### Core Systems (Independent)
```
BallSystem        - Stats, movement, physics
VolumeSystem      - Fake volume, buy/sell, -> stats
WeaponSystem      - Types, tiers, attach/detach
DamageSystem      - HP, damage, healing, death
CritSystem        - Crit chance, multipliers
LootSystem        - Mystery boxes, drops
EventSystem       - Random events, triggers
ScoringSystem     - Points, rankings
TransitionSystem  - Seamless mode changes
ConfigSystem      - JSON loading, AI-friendly
```

### Game Modes (Use Core Systems)
```
RaceMode    -> uses: Ball, Volume, Loot, Event, Scoring
PvPMode     -> uses: Ball, Volume, Weapon, Damage, Crit, Scoring
BossMode    -> uses: Ball, Volume, Weapon, Damage, Crit, Loot, Scoring
```

### Permutation Testing
- Enable/disable any system per mode
- Mix and match mechanics
- Quick iteration to find fun combos
- All configurable via JSON

---

## FILE STRUCTURE (NEW)

```
gmi-engine/src/
├── game/
│   ├── scenes/
│   │   ├── RaceScene.js         # Enhanced main scene
│   │   └── TournamentScene.js   # Multi-stage manager
│   │
│   ├── modes/
│   │   ├── BaseMode.js          # Shared mode logic
│   │   ├── RaceMode.js
│   │   ├── PvPMode.js
│   │   └── BossMode.js
│   │
│   ├── systems/
│   │   ├── VolumeSystem.js      # Fake volume + stats
│   │   ├── WeaponSystem.js
│   │   ├── DamageSystem.js
│   │   ├── CritSystem.js
│   │   ├── LootSystem.js
│   │   ├── EventSystem.js
│   │   ├── ScoringSystem.js
│   │   ├── TransitionSystem.js
│   │   └── ConfigSystem.js
│   │
│   ├── entities/
│   │   ├── Ball.js              # Ball with stats
│   │   ├── Weapon.js
│   │   ├── Boss.js
│   │   ├── MysteryBox.js
│   │   └── Sprite.js            # Future: custom sprites
│   │
│   └── config/
│       ├── default-tournament.json
│       ├── race-only.json
│       ├── pvp-test.json
│       └── boss-test.json
│
├── ui/
│   ├── VolumePanel.js           # Buy/sell simulator
│   ├── StatsOverlay.js          # HP bars, rankings
│   ├── EventFeed.js             # "CRIT!" popups
│   └── SlotMachine.js           # Weapon spins
│
└── editor/
    ├── editor.js                # Existing map editor
    ├── TournamentEditor.js      # Stage routing editor
    └── WeaponEditor.js          # Weapon config editor
```

---

## DEVELOPMENT PHASES (UPDATED)

### Phase 1: Foundation [PRIORITY]
1. Ball Stats System (HP, Speed, Size, Damage)
2. Fake Volume System + UI
3. Volume -> Stats linking
4. Config Loader (JSON)

### Phase 2: Combat Core
5. Damage/HP System
6. Basic PvP Mode (balls ram each other)
7. Knockback physics
8. Crit System

### Phase 3: Weapons
9. Weapon System (types, attach)
10. Weapon RNG (tiers, slots)
11. Weapon abilities

### Phase 4: Boss
12. Boss Entity (HP, size, attacks)
13. Boss Attack Patterns
14. Boss Mode integration
15. Weak spots, rage mode

### Phase 5: Polish & Chaos
16. Mystery Box System
17. Random Events
18. Seamless Transitions
19. Multi-map routing
20. Scoring/Payout UI

### Phase 6: Future
21. Custom sprite support
22. Sound effects
23. Particle effects
24. Streaming/OBS mode
25. Real crypto integration

---

## TESTING WORKFLOW

```
1. Create/edit JSON config (or ask AI)
2. Load config in game
3. Use Volume Panel to simulate pumping
4. Watch tournament play out
5. Check: Is it fun? Dramatic? Nail-biting?
6. Tweak config -> Repeat
7. When fun: Lock in that config
```

---

## SUCCESS CRITERIA

### Entertainment Test
- [ ] Non-stop action (no dead moments)
- [ ] 3+ "oh shit" moments per tournament
- [ ] Comebacks happen regularly
- [ ] Close finishes common
- [ ] Would watch even without betting

### Addiction Test
- [ ] Want to watch "just one more"
- [ ] Volume pumping feels impactful
- [ ] RNG creates excitement not frustration
- [ ] Every ball has a chance
- [ ] Brainrot-level engaging

### Technical Test
- [ ] Smooth 60fps
- [ ] Seamless transitions
- [ ] No crashes
- [ ] Config system works
- [ ] AI can generate valid configs

---

## IMMEDIATE NEXT STEPS

1. **Plan the architecture** (this doc)
2. **Build Ball Stats System**
3. **Build Fake Volume UI**
4. **Link Volume -> Stats**
5. **Test with Race mode**
6. **Add basic PvP collision damage**
7. **Iterate on what's fun**

---

**Build the simulation you can't stop watching.**
