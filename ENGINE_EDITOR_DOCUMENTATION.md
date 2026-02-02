# GMI Racing Engine Editor - Complete Documentation

**Project:** GMI Racing Engine Editor  
**Purpose:** Visual tool for designing and balancing racing game mechanics  
**Approach:** Tool-first, not code-first  
**Philosophy:** Everything adjustable via GUI, nothing requires coding  

---

## 📖 TABLE OF CONTENTS

1. [Vision & Philosophy](#vision--philosophy)
2. [Why Build an Editor?](#why-build-an-editor)
3. [Architecture Overview](#architecture-overview)
4. [Feature Roadmap](#feature-roadmap)
5. [How to Use the Editor](#how-to-use-the-editor)
6. [Expanding the Engine](#expanding-the-engine)
7. [Technical Details](#technical-details)
8. [From Editor to Production](#from-editor-to-production)

---

## 🎯 VISION & PHILOSOPHY

### **The Core Idea**

**You're a motion designer, not a programmer.**

Traditional game development forces you to:
- Write code for every change
- Ask developers to implement tweaks
- Wait for builds
- Debug cryptic errors

**This sucks for creative iteration.**

### **The Solution: Visual Engine Editor**

Build a **tool** where you:
- Adjust sliders and see results instantly
- Add features through forms, not code
- Test 100 variations in an hour
- Focus on game feel, not implementation

**Like After Effects is for animation, this editor is for game design.**

---

## 💡 WHY BUILD AN EDITOR?

### **Comparison: Traditional vs Editor Approach**

#### **Traditional Game Development:**

```
YOU: "Blue shell is too strong"
↓
Ask Claude to edit code
↓
Claude changes stun_duration = 8 to stun_duration = 6
↓
You run the game
↓
Test
↓
"Still too strong"
↓
Ask Claude to change to 5
↓
Repeat 10 times
↓
Finally perfect after 1 hour
```

**Problem:** Every single tweak requires:
- Communicating to Claude
- Waiting for code change
- Re-running program
- Testing
- Repeating

**Result:** Slow, frustrating, kills creative flow.

---

#### **Editor Approach:**

```
YOU: "Blue shell is too strong"
↓
Open editor
↓
Drag "Stun Duration" slider: 8 → 6
↓
Click "Test Race"
↓
Watch result immediately
↓
"Still too strong"
↓
Drag slider: 6 → 5
↓
Test again
↓
Perfect in 2 minutes
```

**Benefit:** Instant feedback loop.

**Result:** Find perfect balance 30x faster.

---

### **The Math**

**Testing 50 Balance Scenarios:**

**Traditional:**
- 50 messages to Claude
- 50 code edits
- 50 re-runs
- Time: ~5 hours

**Editor:**
- 50 slider adjustments
- 50 instant tests
- Time: ~30 minutes

**You save 90% of iteration time.**

---

## 🏗️ ARCHITECTURE OVERVIEW

### **Three-Layer System**

```
┌─────────────────────────────────────┐
│         UI LAYER (React)            │
│  Panels, Sliders, Dropdowns, Forms │
│                                     │
│  User interacts here only           │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│      CONFIG LAYER (JSON)            │
│  All parameters stored as data      │
│                                     │
│  Bridges UI and Engine              │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│      ENGINE LAYER (JS)              │
│  Race simulation, physics, items    │
│                                     │
│  Reads config, runs game logic      │
└─────────────────────────────────────┘
```

### **Flow:**

1. **You adjust slider** in UI
2. **UI updates config** JSON
3. **Engine reads config** and applies changes
4. **You see result** in test race

**You never touch layers 2 or 3.**

---

### **Modular Panel System**

```
src/renderer/components/
├── RaceSettings.jsx      → Configures race duration, speed, etc
├── ItemEditor.jsx        → Creates and edits racing items
├── PhysicsPanel.jsx      → Adjusts collision/physics
├── TestRace.jsx          → Live race simulation
├── AssetManager.jsx      → Manage visual files
├── ConfigManager.jsx     → Save/load configs
│
├── WeatherPanel.jsx      → (Future) Weather effects
├── TeamPanel.jsx         → (Future) Team mechanics  
├── AIPanel.jsx           → (Future) AI opponents
└── ...                   → Any future feature
```

**Each panel = One feature domain**

**Adding features = Adding panels**

**Panels don't interfere with each other**

---

## 🗺️ FEATURE ROADMAP

### **Phase 1: Core Framework (Week 1)**

**What:**
- Electron app shell
- Tab navigation
- Dark theme UI
- Config save/load system

**Deliverable:**
- Empty app that launches
- Can switch between tabs
- Basic styling in place

**Why First:**
- Foundation for everything else
- Establishes patterns
- Gets development environment working

---

### **Phase 2: Race Settings (Week 1)**

**What:**
- Race duration controls
- Volume → speed curve editor
- Balance ratio sliders
- Diminishing returns tuning

**Deliverable:**
- Can configure all core race mechanics
- Graph shows speed curve visually
- Changes save to config

**Why Second:**
- Core game mechanics need tuning first
- Most important parameters
- Everything else builds on these

---

### **Phase 3: Item Editor (Week 1-2)**

**What:**
- Add/edit/delete items
- Item effect configuration
- Drop rate management
- Asset linking

**Deliverable:**
- Can create custom racing items
- Adjust power/duration/effects
- Control rarity percentages

**Why Third:**
- Items are 30% of game outcome
- Need item system before testing races
- Most complex UI component

---

### **Phase 4: Physics Panel (Week 2)**

**What:**
- Collision system toggles
- Physics parameter sliders
- Bounce/friction controls

**Deliverable:**
- Can enable/disable physics
- Tune collision behavior
- See effects in test races

**Why Fourth:**
- Optional feature (can be disabled)
- Easier to add after core is solid
- Nice-to-have not must-have

---

### **Phase 5: Test Race (Week 2)**

**What:**
- Live race simulation
- Mock volume inputs
- Event logging
- Pause/resume/speed controls

**Deliverable:**
- Can run test races with current config
- See items/physics in action
- Iterate rapidly on balance

**Why Fifth:**
- Need items/physics implemented first
- Critical for tuning
- Ties everything together

---

### **Phase 6: Asset Manager (Week 2-3)**

**What:**
- File browser
- Asset assignment
- Preview system
- Missing asset warnings

**Deliverable:**
- Can link AE/C4D files to tokens/effects
- Preview animations
- Validate asset completeness

**Why Sixth:**
- Need game logic working first
- Visual polish comes after mechanics
- Can test without assets initially

---

### **Phase 7: Config Manager (Week 3)**

**What:**
- Save current config
- Load saved configs
- Export/import JSON
- Config library

**Deliverable:**
- Multiple config presets
- Share configs with others
- Version control for balance changes

**Why Last:**
- Builds on all other panels
- Quality of life feature
- Final polish

---

## 🎮 HOW TO USE THE EDITOR

### **Typical Workflow**

#### **Starting a New Game Configuration:**

1. **Open Race Settings**
   - Set race duration (10 min default)
   - Adjust volume → speed curve
   - Set skill/luck ratio (70/30)

2. **Create Items**
   - Add 5 starter items (Banana, Boost, Shield, Red Shell, Blue Shell)
   - Configure each item's power/duration
   - Set drop rates (60% Common, 30% Rare, 10% Legendary)

3. **Configure Physics (Optional)**
   - Enable collisions
   - Set bounce force
   - Adjust friction

4. **Test the Game**
   - Enter mock volumes for 5 tokens
   - Start race
   - Watch what happens
   - Take notes on what feels wrong

5. **Iterate**
   - Adjust sliders based on tests
   - Re-test immediately
   - Repeat until perfect

6. **Save Configuration**
   - Name it (e.g., "Balanced Competitive v1")
   - Save to library
   - Can load later or export

---

### **Example: Balancing Blue Shell**

**Goal:** Blue Shell should create comebacks but not be OP.

**Process:**

```
Test 1:
- Stun duration: 8 sec
- Result: Leader gets destroyed, always loses
- Problem: Too strong

Test 2:
- Stun duration: 5 sec
- Result: Leader barely slows down
- Problem: Too weak

Test 3:
- Stun duration: 6 sec
- AoE radius: 10% → 15%
- Result: Leader slows, 2nd place also affected
- Problem: 2nd place shouldn't be hit as hard

Test 4:
- Primary stun: 6 sec (1st place)
- Secondary stun: 3 sec (nearby tokens)
- Secondary AoE: 10%
- Result: PERFECT

Final Settings:
- Target: 1st Place
- Stun Duration: 6 sec
- AoE: 10%
- Secondary Effect: 50% power (3 sec stun)
- Drop Rate: Legendary (10%)
```

**Took 15 minutes to find perfect balance.**

**Without editor? Would take hours of back-and-forth with Claude.**

---

### **Example: Testing Different Race Durations**

**Goal:** Find optimal race length.

**Process:**

```
Test 1: 5 minute races
- Too fast
- No time for comebacks
- Feels rushed

Test 2: 15 minute races
- Too slow
- Boring middle section
- Loses excitement

Test 3: 10 minute races
- Perfect pacing
- Time for 2-3 comeback moments
- Maintains tension

Test 4: 10 min, but 3x speed multiplier in final 2 min
- Even better!
- Calm start
- Chaotic finish
- PERFECT
```

**Found optimal settings in 30 minutes by testing 4 variations.**

---

## 🔧 EXPANDING THE ENGINE

### **How to Add Any Feature**

**The beauty of the modular system: Adding features is always the same process.**

#### **Example: Adding Weather System**

**Step 1: Tell Claude**
```
"Add a weather system where random weather events 
affect race speed. I want to configure:
- Weather types (rain, tornado, etc)
- Each type's effect on speed
- Frequency of weather events
- Duration of each weather type"
```

**Step 2: Claude Builds**
- Creates `WeatherPanel.jsx` component
- Adds weather logic to engine
- Updates config structure
- Adds new tab to sidebar

**Step 3: You Use It**
```
┌─ WEATHER SYSTEM ───────────────────┐
│                                     │
│ Enable Weather: [✓]                │
│                                     │
│ Weather Types:                      │
│                                     │
│ ⛈️ Rain                             │
│ Effect: [-20%] speed                │
│ Duration: [30-60] sec               │
│ Frequency: [Every 2-3 min]         │
│ [Edit] [Delete]                    │
│                                     │
│ 🌪️ Tornado                          │
│ Effect: [Shuffle positions]        │
│ Duration: [5] sec                   │
│ Frequency: [Rare - 10%]            │
│ [Edit] [Delete]                    │
│                                     │
│ [+ Add Weather Type]                │
└─────────────────────────────────────┘
```

**Step 4: Test & Iterate**
- Toggle weather on/off
- Adjust percentages
- Test in races
- Find perfect balance

**Total time: 1 conversation + 30 min testing**

---

### **Features You Could Add**

**Simple Features (1 panel):**
- Max speed limits
- Starting delays
- Lap systems
- Checkpoint bonuses
- Time penalties
- Speed zones

**Medium Features (1-2 panels):**
- Weather effects
- Track hazards
- Lane switching
- Power-up combos
- Boost pads
- Shortcuts

**Complex Features (2-3 panels):**
- Team mechanics
- AI opponents
- Dynamic difficulty
- Championship series
- Betting systems
- Achievement unlocks

**All follow same pattern:**
1. Ask Claude to add it
2. Claude creates panel(s)
3. You configure via GUI
4. Done

---

## 🛠️ TECHNICAL DETAILS

### **Tech Stack Choices**

#### **Why Electron?**

✅ **Desktop app** - Feels professional, not a web toy  
✅ **File system access** - Can read/write configs and assets  
✅ **No server needed** - Runs completely offline  
✅ **Cross-platform** - Works on Windows, Mac, Linux  
✅ **Package as .exe/.app** - Distribute easily  

**Alternatives considered:**
- Web app: Requires server, less "pro" feeling
- Native app: Too complex to build
- Unity/Unreal: Overkill for an editor

**Verdict: Electron is perfect for this use case.**

---

#### **Why React?**

✅ **Component-based** - Each panel is isolated  
✅ **Easy state management** - Config updates propagate automatically  
✅ **Rich ecosystem** - Tons of UI libraries available  
✅ **Claude knows it well** - Easier to build with AI assistance  

**Alternatives considered:**
- Vue: Also good, slightly less popular
- Svelte: Newer, less Claude experience
- Vanilla JS: Too much boilerplate

**Verdict: React is the safe, powerful choice.**

---

#### **Why JSON Config?**

✅ **Human-readable** - Can edit manually if needed  
✅ **Easy to share** - Copy/paste configs  
✅ **Version control friendly** - Git diffs work  
✅ **No database** - Simpler architecture  
✅ **Portable** - Works anywhere  

**Alternatives considered:**
- SQLite: Overkill, harder to share
- Binary format: Not human-readable
- YAML: Less universal support

**Verdict: JSON is the obvious choice.**

---

### **File Structure**

```
gmi-racing-engine/
│
├── package.json              # Project config
├── main.js                   # Electron main process
│
├── src/
│   │
│   ├── renderer/             # UI Layer (React)
│   │   ├── App.jsx           # Main app component
│   │   ├── components/       # Individual panels
│   │   │   ├── RaceSettings.jsx
│   │   │   ├── ItemEditor.jsx
│   │   │   ├── PhysicsPanel.jsx
│   │   │   ├── TestRace.jsx
│   │   │   ├── AssetManager.jsx
│   │   │   └── ConfigManager.jsx
│   │   │
│   │   ├── styles/           # CSS
│   │   │   └── main.css
│   │   │
│   │   └── index.html        # HTML shell
│   │
│   ├── engine/               # Game Logic Layer
│   │   ├── RaceEngine.js     # Main race orchestrator
│   │   ├── Token.js          # Token/racer class
│   │   ├── MysteryBox.js     # Box spawn system
│   │   ├── Item.js           # Item implementations
│   │   ├── Physics.js        # Collision/physics
│   │   └── Config.js         # Config validator
│   │
│   └── utils/                # Helpers
│       ├── FileManager.js    # File I/O
│       └── Validator.js      # Data validation
│
├── assets/                   # User Assets
│   ├── tokens/               # Token animations
│   │   ├── red/
│   │   │   ├── idle.json
│   │   │   ├── boost.json
│   │   │   └── stunned.json
│   │   ├── blue/
│   │   └── ...
│   │
│   ├── effects/              # Item effects
│   │   ├── blueshell.json
│   │   ├── banana.json
│   │   └── ...
│   │
│   └── tracks/               # Track backgrounds
│       ├── default.mp4
│       └── ...
│
└── configs/                  # Saved Configurations
    ├── default.json
    ├── balanced.json
    ├── chaos-mode.json
    └── ...
```

---

### **Data Flow**

```
User Action → React Component → Update State
    ↓
State Change → Update Config Object
    ↓
Config Object → Save to JSON File
    ↓
Engine Reads Config → Applies Parameters
    ↓
Race Simulation → Generate Events
    ↓
Events → Update UI → User Sees Result
```

**Everything is reactive and instant.**

---

## 🚀 FROM EDITOR TO PRODUCTION

### **Development Phases**

#### **Phase 1: Build the Editor (Week 1-3)**
Focus: Tool creation  
Output: Working desktop editor  
Users: Just you  

#### **Phase 2: Game Balancing (Week 3-5)**
Focus: Finding perfect parameters  
Output: Balanced game config  
Users: You + test group (10-20 friends)  

#### **Phase 3: Visual Production (Week 5-6)**
Focus: Creating beautiful assets  
Output: Professional visuals  
Tools: After Effects + Cinema 4D  

#### **Phase 4: Integration (Week 6-7)**
Focus: Connecting visuals to engine  
Output: Rendered race output  
Format: MP4 or live canvas  

#### **Phase 5: Streaming (Week 7-8)**
Focus: Broadcasting to platforms  
Output: 24/7 live stream  
Platforms: Kick, YouTube, Twitch  

#### **Phase 6: Tokenomics (Week 8+)**
Focus: Real money integration  
Output: pump.fun/LetsBonk tokens  
Revenue: Creator fees from trades  

---

### **The Editor's Role in Each Phase**

**Week 1-3: Primary Tool**
- You're building and testing the editor itself
- Claude implements features
- You test and give feedback

**Week 3-5: Balance Laboratory**
- Run 100+ test races with different configs
- Tune every parameter until perfect
- Save multiple config presets
- Find "the one" balanced config

**Week 5-6: Asset Reference**
- Editor shows what animations are needed
- Asset manager lists missing files
- You create assets based on editor requirements

**Week 6-7: Integration Partner**
- Editor exports config for production engine
- Renderer loads config and assets
- Everything matches editor behavior

**Week 7-8: Testing Ground**
- Test stream output in editor first
- Verify everything works before going live
- Editor becomes staging environment

**Week 8+: Live Configuration**
- Can adjust parameters while streaming
- Hot-reload config changes
- Fine-tune based on real player data

---

### **From Config to Live Stream**

```
1. Editor (Desktop)
   ↓ Export race_config.json
   
2. Production Engine (Server)
   ↓ Reads config.json
   ↓ Loads assets from asset manager
   ↓ Connects to pump.fun API
   
3. Renderer (Canvas/WebGL)
   ↓ Applies config parameters
   ↓ Plays your AE/C4D assets
   ↓ Simulates race with real volume
   
4. Encoder (FFmpeg)
   ↓ Captures canvas at 60fps
   ↓ Encodes to H.264
   
5. Streamer (OBS/RTMP)
   ↓ Sends to Kick/YouTube
   
6. Viewers Watch Live
```

**The editor's config file becomes the source of truth.**

**Change editor → Production updates automatically.**

---

## 🎨 ASSET WORKFLOW

### **How Your AE/C4D Skills Integrate**

#### **Step 1: Build Game Mechanics (Editor)**

```
Week 1-3: Use editor to find perfect game feel
- Race duration: 10 min
- Blue shell stun: 6 sec
- Speed boost: +50% for 10 sec
- Collision bounce: 1.5 force
- Etc.
```

**Output: Perfected config.json**

---

#### **Step 2: Create Asset List (Editor)**

```
Editor Asset Manager shows what's needed:

Tokens (5 colors × 4 states):
- Red: idle, boost, stunned, shield
- Blue: idle, boost, stunned, shield
- Green: idle, boost, stunned, shield
- Yellow: idle, boost, stunned, shield
- Purple: idle, boost, stunned, shield

Effects (10 items):
- Blue Shell explosion
- Banana spin
- Speed boost trail
- Shield bubble
- Star sparkles
- Red shell impact
- Tornado swirl
- Position swap flash
- Collision sparks
- Mystery box appear

Track:
- 10-minute looping background

Total: ~30 animations needed
```

**Output: Complete asset requirements list**

---

#### **Step 3: Create Assets (After Effects + C4D)**

**In Cinema 4D:**
```
1. Create race track scene
   - 5 lanes
   - Beautiful lighting
   - Camera animation (10 min loop)
   
2. Render as MP4
   - 1920×1080
   - 60fps
   - H.264 codec
   
3. Save to assets/tracks/default.mp4
```

**In After Effects:**
```
1. Create token animations
   - Design 5 colored characters/shapes
   - Animate 4 states each:
     * Idle (looping)
     * Boost (speed effect)
     * Stunned (dizzy stars)
     * Shield (bubble)
   
2. Export as Lottie JSON
   - token_red_idle.json
   - token_red_boost.json
   - etc.
   
3. Save to assets/tokens/[color]/

4. Create item effects
   - Animate explosions, trails, impacts
   - Export as Lottie or PNG sequences
   - Save to assets/effects/
```

**Output: All visual assets created**

---

#### **Step 4: Link Assets (Editor)**

```
Open Asset Manager in editor:

1. Click "Auto-Link Assets"
   - Editor scans assets/ folder
   - Finds all .json and .mp4 files
   - Matches to required assets
   
2. Review assignments
   - Red token idle: ✓ token_red_idle.json
   - Blue shell effect: ✓ blueshell.json
   - Track: ✓ default.mp4
   
3. Preview assets
   - Click preview button
   - See animation play
   - Verify it looks good
   
4. Save asset config
   - Links saved to config.json
   - Production engine will use these
```

**Output: Assets linked to game elements**

---

#### **Step 5: Test Integration (Editor Test Race)**

```
1. Run test race with assets enabled
2. See your animations playing
3. Verify:
   - Tokens animate correctly
   - Effects trigger on items
   - Track background loops
   - Everything syncs
   
4. Make adjustments if needed:
   - Token too big? Resize in editor
   - Effect too fast? Adjust duration
   - Colors wrong? Re-export from AE
```

**Output: Fully integrated visual game**

---

#### **Step 6: Export for Production**

```
From editor:
1. Click "Export Production Package"
2. Editor creates:
   - race_config.json (all parameters)
   - assets/ folder (linked files)
   - production_engine.js (configured)
   
3. Upload to server
4. Server runs production engine
5. Goes live on stream
```

**Output: Production-ready package**

---

### **Asset Format Guide**

**For Tokens:**
```
Format: Lottie JSON (from AE Bodymovin plugin)
Size: 200×200px recommended
Duration: 
  - Idle: 2-3 sec loop
  - Boost: 1 sec
  - Stunned: 2 sec loop
  - Shield: 3 sec loop
Naming: token_[color]_[state].json
```

**For Effects:**
```
Format: Lottie JSON or PNG sequence
Size: Variable (typically 300×300px)
Duration: 0.5-2 sec
Naming: [effect_name].json or [effect_name]_####.png
```

**For Tracks:**
```
Format: MP4 (H.264)
Resolution: 1920×1080
FPS: 60 (or 30 minimum)
Duration: 10+ minutes (looping)
Naming: track_[name].mp4
```

**All files go in respective folders in `assets/`**

---

## 📊 CONFIGURATION EXAMPLES

### **Example 1: Balanced Competitive**

**Goal:** Skill matters most, but comebacks possible.

```json
{
  "name": "Balanced Competitive",
  "race": {
    "duration": 600,
    "tickRate": 2
  },
  "balance": {
    "diminishingReturns": 500,
    "skillRatio": 0.75,
    "luckRatio": 0.25
  },
  "boxes": {
    "spawnInterval": [35, 50],
    "dropRates": {
      "common": 0.65,
      "rare": 0.30,
      "legendary": 0.05
    }
  },
  "items": [
    {
      "name": "Blue Shell",
      "rarity": "legendary",
      "effect": {
        "type": "stun",
        "duration": 5
      }
    }
  ]
}
```

**Characteristics:**
- Higher skill ratio (75/25)
- Fewer legendary items (5%)
- Longer box intervals
- **Result:** Volume mostly determines winner, but comebacks happen occasionally

---

### **Example 2: Maximum Chaos**

**Goal:** Unpredictable, anyone can win.

```json
{
  "name": "Maximum Chaos",
  "race": {
    "duration": 420
  },
  "balance": {
    "skillRatio": 0.5,
    "luckRatio": 0.5
  },
  "boxes": {
    "spawnInterval": [15, 25],
    "dropRates": {
      "common": 0.30,
      "rare": 0.40,
      "legendary": 0.30
    }
  },
  "items": [
    {
      "name": "Blue Shell",
      "effect": {
        "duration": 8,
        "aoe": 0.2
      }
    }
  ]
}
```

**Characteristics:**
- Equal skill/luck (50/50)
- High legendary rate (30%)
- Frequent boxes (15-25 sec)
- Stronger item effects
- **Result:** Total chaos, anyone can win

---

### **Example 3: Whale-Friendly**

**Goal:** Big volume = almost guaranteed win.

```json
{
  "name": "Whale-Friendly",
  "balance": {
    "diminishingReturns": 2000,
    "skillRatio": 0.9,
    "luckRatio": 0.1
  },
  "boxes": {
    "spawnInterval": [60, 90],
    "dropRates": {
      "legendary": 0.02
    }
  }
}
```

**Characteristics:**
- Very high skill ratio (90/10)
- Weak diminishing returns (whales stay fast)
- Rare boxes
- Few legendary drops
- **Result:** Highest volume almost always wins

---

## 🎯 BEST PRACTICES

### **Config Management**

**DO:**
- ✅ Save frequently during testing
- ✅ Name configs descriptively ("Chaos Mode v3")
- ✅ Keep multiple versions
- ✅ Export before major changes
- ✅ Document what each config is for

**DON'T:**
- ❌ Overwrite your only good config
- ❌ Make too many changes at once
- ❌ Delete configs without backing up
- ❌ Share untested configs

---

### **Balancing Strategy**

**Start Conservative:**
```
1. Begin with 70/30 skill/luck
2. Test 20 races
3. Note win rates
4. If highest volume wins >80%: Increase luck
5. If highest volume wins <60%: Increase skill
6. Iterate until 65-75% win rate
```

**Test Systematically:**
```
Fixed variables:
- Use same 5 mock volumes
- Run 10 races per config
- Track statistics

Changed variables:
- Only adjust ONE thing at a time
- Test, measure, adjust
- Repeat
```

**Document Findings:**
```
Config: Balanced v3
Test Date: Jan 27, 2026
Results:
- Highest volume won 7/10 races
- Average lead changes: 2.3
- Blue shell used: 4 times
- Notes: Feels good, maybe reduce stun by 1 sec

Next Test:
- Blue shell: 6 sec → 5 sec
```

---

## 🚀 LAUNCH CHECKLIST

### **Before Going Live:**

**Game Mechanics:**
- [ ] Tested 50+ races
- [ ] Balance feels right (65-75% favorite win rate)
- [ ] Every item tested
- [ ] Physics (if enabled) tested
- [ ] No crashes in 24-hour test
- [ ] Config saved and backed up

**Assets:**
- [ ] All token animations complete
- [ ] All item effects complete
- [ ] Track background rendered
- [ ] Assets linked in editor
- [ ] Previews look good
- [ ] No missing asset warnings

**Technical:**
- [ ] Editor exports production config
- [ ] Production engine reads config correctly
- [ ] Rendering works at 60fps
- [ ] Stream encodes properly
- [ ] OBS receives feed
- [ ] Can stream to Kick/YouTube

**Final Tests:**
- [ ] Shown to 10+ people
- [ ] Positive feedback
- [ ] Clip-worthy moments every race
- [ ] Would watch even without betting
- [ ] Confident it will get volume

**Only launch when ALL boxes checked.**

---

## 🎓 LEARNING CURVE

### **Day 1: Learning the Editor**
- Explore all tabs
- Adjust some sliders
- Run a test race
- See what each parameter does

### **Day 2-3: Basic Balancing**
- Find good race duration
- Tune volume curve
- Test a few items
- Get comfortable with iteration

### **Week 1: Advanced Tuning**
- Fine-tune all items
- Test physics
- Run systematic tests
- Find near-perfect balance

### **Week 2: Mastery**
- Create multiple config presets
- Know exactly what each parameter does
- Can balance new features quickly
- Editor feels like second nature

**By Week 2, you're a pro at using the tool.**

---

## 🔮 FUTURE POSSIBILITIES

### **Features to Add Later:**

**Gameplay:**
- Championship series (10-race tournaments)
- Season system with standings
- Handicap system for champions
- Team relay races
- Multi-round elimination brackets

**Technical:**
- Live config hot-reload (change while streaming)
- A/B testing system (compare 2 configs)
- AI opponent generator
- Replay system with annotations
- Statistical analysis dashboard

**Production:**
- Multi-track support (random track each race)
- Dynamic camera angles
- Crowd/audience simulation
- Commentator AI integration
- Highlight reel auto-generation

**Community:**
- Config sharing marketplace
- Community voting on configs
- Tournament brackets
- Leaderboards
- Fan-submitted item ideas

**All possible. Just ask Claude to add the panel.**

---

## 📈 SUCCESS METRICS

### **Editor Quality Metrics:**

**Usability:**
- Can adjust any parameter in <30 seconds
- No need to ask Claude for help after Week 1
- Can test 50 configs in 1 hour
- Friends can use it with <10 min tutorial

**Functionality:**
- Zero crashes in normal use
- Config saves/loads reliably
- Test races run smoothly
- Asset linking works automatically

**Iteration Speed:**
- Idea → Test → Result: <5 minutes
- Find perfect item balance: <1 hour
- Create new feature config: <30 minutes
- Export production package: <2 minutes

**If you hit these metrics, the editor is a success.**

---

## 🎬 CONCLUSION

### **What You're Building:**

**Not a racing game.**  
**A racing game MAKER.**

Like how:
- After Effects makes videos
- Photoshop makes images
- Blender makes 3D models

**GMI Racing Engine Editor makes racing games.**

### **The Power:**

Once the editor is built:
- You control EVERYTHING visually
- No code knowledge needed ever
- Add features by asking Claude once
- Iterate 100x faster than traditional dev
- Focus on creative vision, not implementation

### **The Process:**

1. **Build editor** (Week 1-3 with Claude)
2. **Balance game** (Week 3-5 with editor)
3. **Create assets** (Week 5-6 with AE/C4D)
4. **Integrate** (Week 6-7)
5. **Stream** (Week 7-8)
6. **Add tokens** (Week 8+)
7. **Make money** (Week 9+)

### **The Result:**

A professional racing entertainment platform that:
- Looks incredible (your AE/C4D work)
- Plays perfectly (balanced via editor)
- Streams reliably (tested thoroughly)
- Makes money (if it's fun)

### **Your Role:**

**You are the designer.**  
**The editor is your tool.**  
**Claude builds the tool.**  
**You create the game.**

---

**NOW GO BUILD IT! 🚀**

---

## 🎬 ANIMATION SYSTEM

### **Overview**

The animation system allows you to create moving obstacles with keyframe-based animations. Animated obstacles can move, rotate, and scale using an After Effects-style multi-layer timeline.

---

### **Multi-Layer Timeline UI**

The timeline shows ALL animated objects as collapsible layers, similar to After Effects:

```
┌─ ANIMATION TIMELINE ─────────────────────────────────────────────────┐
│ [▶ Play] [⏹ Stop]  Duration: [2000ms]  Loop: [Ping-Pong ▼]          │
├──────────────────────────────────────────────────────────────────────┤
│ Layers                    │  0ms     500ms   1000ms   1500ms  2000ms │
│                           │   │        │        │        │        │  │
│                           │   ▼ (playhead)                           │
├───────────────────────────┼──────────────────────────────────────────┤
│ ▼ Rectangle (obs-123)     │                                          │
│   └─ x                    │   ◆────────────◆────────────◆           │
│   └─ y                    │   ◆────────────────────────◆            │
│   └─ rotation             │                                          │
├───────────────────────────┼──────────────────────────────────────────┤
│ ▼ Circle (obs-456)        │                                          │
│   └─ x                    │      ◆─────────◆                        │
│   └─ y                    │   ◆─────────────────◆                   │
└───────────────────────────┴──────────────────────────────────────────┘
```

**Features:**
- **Collapsible Layers:** Each animated obstacle appears as a layer with expandable tracks
- **Property Tracks:** x, y, rotation, scaleX, scaleY - each property has its own track
- **Keyframe Display:** Diamond markers show where keyframes are placed
- **Playhead:** Scrub through time to preview all animations simultaneously
- **Multi-Object Preview:** All animated objects move together during preview

---

### **Creating Animations**

1. **Select an Obstacle** in the map editor
2. **Open Animation Panel** (Tab key or button)
3. **Add Keyframes:**
   - Move playhead to desired time
   - Adjust property values (x, y, rotation, etc.)
   - Keyframes are created automatically
4. **Set Loop Mode:**
   - `none` - Play once, stop at end
   - `loop` - Repeat from beginning
   - `pingpong` - Oscillate back and forth
   - `hold` - Play once, hold at end
5. **Preview:** Click Play to see all animated objects move together

---

### **Animation Properties**

| Property | Description | Units |
|----------|-------------|-------|
| `x` | Horizontal offset from base position | Pixels (relative) |
| `y` | Vertical offset from base position | Pixels (relative) |
| `rotation` | Rotation offset from base angle | Degrees |
| `scaleX` | Horizontal scale multiplier | 1.0 = 100% |
| `scaleY` | Vertical scale multiplier | 1.0 = 100% |

**Important:** Values are RELATIVE to the obstacle's original position. Setting `x: 100` means "move 100 pixels right from start position."

---

### **Easing Functions**

Each keyframe can have an easing function for smooth interpolation:

- `linear` - Constant speed
- `easeIn` - Start slow, end fast
- `easeOut` - Start fast, end slow
- `easeInOut` - Slow at both ends
- `easeInQuad/Cubic/Quart/Quint` - Polynomial easing (different intensities)
- `easeOutQuad/Cubic/Quart/Quint` - Polynomial easing (different intensities)
- `easeInOutQuad/Cubic/Quart/Quint` - Combined polynomial easing
- `bounce` - Bouncy effect
- `elastic` - Spring/elastic effect

---

### **Animated Obstacle Behavior**

**Crusher Behavior:** All animated/moving obstacles act as crushers:
- If a ball gets squeezed between an animated obstacle and a wall, it's eliminated
- If a ball gets squeezed between an animated obstacle and another obstacle, it's eliminated
- This prevents physics glitches where balls get stuck or pass through objects

**Collision Resolution:**
- Animated obstacles push balls out of the way when moving
- Balls are given velocity in the direction of obstacle movement
- If a ball would be trapped inside an obstacle, it's pushed to the nearest safe position

---

### **Animation Data Structure**

Animations are stored in the map's JSON data under the `animations` key:

```json
{
  "animations": {
    "obs-1234567890": {
      "duration": 2000,
      "loop": "pingpong",
      "loopCount": 0,
      "tracks": {
        "x": {
          "keyframes": [
            { "time": 0, "value": 0, "easing": "easeInOut" },
            { "time": 1000, "value": 150, "easing": "easeInOut" },
            { "time": 2000, "value": 0, "easing": "linear" }
          ]
        },
        "y": {
          "keyframes": [
            { "time": 0, "value": 0, "easing": "linear" },
            { "time": 2000, "value": 50, "easing": "linear" }
          ]
        }
      }
    }
  }
}
```

---

### **Technical Implementation**

**Key Files:**
- `src/animation/AnimationController.js` - Editor animation management
- `src/animation/AnimationPlayer.js` - Runtime animation playback
- `src/animation/Timeline.js` - Multi-layer timeline UI
- `src/animation/Easings.js` - Easing function library

**How It Works:**
1. **Editor:** AnimationController stores keyframe data, Timeline UI visualizes it
2. **Preview:** AnimationPlayer evaluates keyframes and updates obstacle positions
3. **Game:** RaceScene loads animations, AnimationPlayer updates physics bodies

**Validation:**
- Orphaned animations (for deleted obstacles) are automatically removed on save
- Invalid animation data is filtered out on load
- Boundary enforcement prevents balls from escaping the map

---

## 📞 NEXT STEPS

1. **Read ULTIMATE_VIBE_CODING_PROMPT.md**
2. **Open Claude Code CLI**
3. **Paste the entire prompt**
4. **Let Claude build Phase 1**
5. **Test the framework**
6. **Give feedback**
7. **Add Phase 2, 3, 4...**
8. **Iterate until perfect**
9. **Launch and make bank**

**Let's fucking go! 🏁💰**
