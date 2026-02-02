# GMI Racing - Competition System Design Document

> **See also**: `PROJECT_STATUS.md` for current implementation status and architecture overview.

## Overview
This document outlines multiple designs for the competition/betting system. Goal: Create an engaging, nail-biting experience where comebacks are possible, early leads matter but don't guarantee wins, and viewers stay engaged throughout.

**Current Implementation**: Design A "Escalating Stakes" is implemented and working.

---

## PHASE 1: Core Systems to Build

### 1.1 Betting UI (Pre-Race)
- **Betting Window**: 2 minute countdown before race starts
- **Bet Placement**: Click on ball to add volume/bet
- **Visual Feedback**:
  - Odds display that updates in real-time
  - Volume bars showing how much each ball has
  - "Your Bet" indicator
- **Commitment Lock**: Once race starts, initial bets locked

### 1.2 Live Volume Pumping (During Race)
- Can add more volume during race
- Each pump gives temporary boost (speed surge, damage up)
- Cooldown per ball (30 sec) to prevent spam
- Visual: "RED IS GETTING PUMPED!" announcement

### 1.3 Statistics Tracking System
Track across all races:
- Win rate per ball color
- Average finish position
- Weapon effectiveness (which weapons lead to wins)
- Item pickup correlation with wins
- Damage dealt averages
- Comeback frequency
- Upset frequency (underdog wins)

### 1.4 Meta Leaderboard
- Historical stats dashboard
- "Hot" and "Cold" streaks
- Weapon tier list based on win correlation
- Best ball by map type (race vs boss)

---

## PHASE 2: Roulette System Redesign

### Current: Only winner gets roulette
### New: ALL balls get roulette, odds based on placement

#### Reward Tiers
| Tier | Contents |
|------|----------|
| S-Tier | Best weapons (Homing Orb, Lightning, Hammer) |
| A-Tier | Good weapons (Shotgun, Sword, Flail) |
| B-Tier | Basic weapons (Pea Shooter, Bouncy Shot) |
| C-Tier | Buffs only (Speed, Shield, Damage boost) |

#### Odds by Placement
| Position | S-Tier | A-Tier | B-Tier | C-Tier |
|----------|--------|--------|--------|--------|
| 1st | 30% | 40% | 20% | 10% |
| 2nd | 20% | 35% | 30% | 15% |
| 3rd | 10% | 30% | 40% | 20% |
| 4th | 5% | 20% | 45% | 30% |
| 5th | 2% | 15% | 43% | 40% |

#### Roulette Display
- All 5 balls spin simultaneously (split screen or sequential)
- Dramatic reveal with particle effects
- Show what each ball got
- "LUCKY!" callout for underdogs getting S-tier

---

## PHASE 3: Point/Scoring Systems to Test

### Design A: "Escalating Stakes"
```
Level 1: Base points (10/8/6/4/2)
Level 2: 1.25x multiplier
Level 3: 1.5x multiplier
Final:   2x multiplier

Boss Bonuses:
- Most damage: +5
- Kill shot: +5
- First blood: +2
```
**Philosophy**: Early matters, but final level can flip everything.

### Design B: "Momentum Battle"
```
Base points: 10/8/6/4/2

Win Streak:
- 2 in a row: 1.2x
- 3 in a row: 1.5x
- Lose = reset to 1x

Cold Streak Protection:
- Last place 2x in a row: Next level 1.5x

Position Jump Bonus:
- Improve 2+ positions: +3 pts
- Improve 3+ positions: +5 pts
```
**Philosophy**: Momentum swings, streaks are powerful but fragile.

### Design C: "Bounty Hunter"
```
Base points: 10/8/6/4/2

Bounty System:
- 1st place has bounty worth 3 pts
- Any ball that damages leader claims bounty
- New leader = new bounty target

Underdog Bonus:
- 4th/5th finishing 1st = 2x points that level

Kill Steal:
- Final blow on boss = +5 pts
```
**Philosophy**: Leader is always hunted, creates alliances against top.

### Design D: "Investment Returns"
```
Base points: 10/8/6/4/2

Volume Multiplier:
- Your total volume = point multiplier at end
- e.g., 50k volume on Red = Red's points x1.5
- Rewards loyal supporters

Pump Bonus:
- Most pumped ball each level: +2 pts
- Creates bidding wars
```
**Philosophy**: Money talks, bettors directly influence outcomes.

### Design E: "Chaos Mode"
```
Base points: 10/8/6/4/2

Random Events (10% chance per level):
- Jackpot Level: 3x points
- Lucky Break: Random ball +3 pts
- Hazard Round: Extra obstacles
- Golden Item: One ball gets OP weapon

Clutch Factor:
- Win while 10+ pts behind: +5 bonus
```
**Philosophy**: RNG chaos, anything can happen.

---

## PHASE 4: Winner Tracking Designs

### Design 1: "Grand Prix Style"
- Total points across all levels
- Visible leaderboard at all times
- Gap to 1st shown: "Blue: 12 pts (8 behind)"
- Final standings = final points
- **Brainrot aspect**: Constant point updates, math in your head

### Design 2: "Race to X Points"
- First to reach 50 points wins
- Can end mid-chain if someone dominates
- Or goes to final level if no one hits 50
- **Brainrot aspect**: "They need 12 more points, that's a 1st and a 2nd..."

### Design 3: "Elimination Immunity" (No actual elimination)
- Each level, lowest scorer enters "danger zone"
- Danger zone = red glow, dramatic music
- If you're in danger zone: Must finish top 3 next level or...
- ...you get a DEBUFF (not elimination): -10% speed next level
- **Brainrot aspect**: "OH NO RED IS IN DANGER ZONE"

### Design 4: "Stock Market"
- Points = Stock price
- Your bet = shares owned
- Payout = shares x final stock price
- Price fluctuates based on performance
- **Brainrot aspect**: "RED IS UP 40% THIS LEVEL"

### Design 5: "Tournament Bracket" (for 8+ balls)
- Balls paired up each level
- Winner of pair advances bracket
- Losers go to losers bracket
- Grand finals: Winners bracket vs Losers bracket
- **Brainrot aspect**: Classic tournament hype

---

## PHASE 5: Betting UI Mockup

```
┌─────────────────────────────────────────────────────────┐
│  BETTING PHASE - 1:45 remaining                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  │  RED    │ │  BLUE   │ │ GREEN   │ │ YELLOW  │ │ PURPLE  │
│  │  (●)    │ │  (●)    │ │  (●)    │ │  (●)    │ │  (●)    │
│  │         │ │         │ │         │ │         │ │         │
│  │ Vol:45K │ │ Vol:32K │ │ Vol:28K │ │ Vol:15K │ │ Vol:10K │
│  │ Odds:1.8│ │ Odds:2.2│ │ Odds:2.5│ │ Odds:4.1│ │ Odds:5.5│
│  │         │ │         │ │         │ │         │ │         │
│  │ [+1K]   │ │ [+1K]   │ │ [+1K]   │ │ [+1K]   │ │ [+1K]   │
│  │ [+5K]   │ │ [+5K]   │ │ [+5K]   │ │ [+5K]   │ │ [+5K]   │
│  │ [+10K]  │ │ [+10K]  │ │ [+10K]  │ │ [+10K]  │ │ [+10K]  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
│                                                         │
│  YOUR BETS: Red 5K | Blue 2K         TOTAL: 7K         │
│                                                         │
│  [ START RACE ]                                         │
└─────────────────────────────────────────────────────────┘
```

### During Race UI
```
┌─────────────────────────────────────────────────────────┐
│  LEVEL 2/3 - BOSS FIGHT                    Points: 18   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  STANDINGS          PTS    DMG    YOUR BET              │
│  1. Red             18     245    ★ 5K                  │
│  2. Blue            14     180    ★ 2K                  │
│  3. Green           12     156                          │
│  4. Yellow           8      89                          │
│  5. Purple           6      45                          │
│                                                         │
│  [ PUMP RED +1K ]  [ PUMP BLUE +1K ]    (30s cooldown)  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## PHASE 6: Statistics Dashboard

### Race History Log
```
Race #1247 - Weapons Test Chain
Duration: 6:34
Winner: Blue (42 pts)

Level 1: Red 1st, Blue 2nd, Green 3rd
Level 2: Blue 1st, Red 2nd, Yellow 3rd
Level 3 (Boss): Blue 1st (kill shot!), Green 2nd, Red 3rd

MVP Weapon: Lightning (Blue) - 340 total damage
Upset Alert: Yellow jumped from 5th to 3rd in final level
Biggest Pump: Red received 12K volume during race
```

### Meta Statistics
```
ALL-TIME STATS (Last 100 races)

WIN RATES:
Red: 24% | Blue: 22% | Green: 19% | Yellow: 18% | Purple: 17%

WEAPON WIN CORRELATION:
1. Lightning - 34% win rate when held
2. Homing Orb - 31% win rate
3. Hammer - 28% win rate
4. Shotgun - 25% win rate
5. Pea Shooter - 18% win rate

COMEBACK FREQUENCY:
- 5th to 1st: 4% of races
- 4th to 1st: 8% of races
- 3+ position jump: 23% of races

BOSS KILL DISTRIBUTION:
Red: 28% | Blue: 24% | Green: 20% | Yellow: 15% | Purple: 13%
```

---

## Implementation Priority

### Sprint 1: Foundation - COMPLETE
1. [x] Betting UI (pre-race screen) - `BettingSystem.js`
2. [x] Point tracking system - `PointSystem.js`
3. [x] Chain-wide leaderboard - Shows in standings panel
4. [x] All-balls roulette with tiered odds - `RouletteSystem.js`

### Sprint 2: Engagement - COMPLETE
5. [x] Live volume pumping during race - Pump panel at bottom
6. [x] Pump visual effects - Speed + damage buff on pump
7. [x] Point multiplier system (Design A) - Escalating 1x→2x
8. [x] Position jump bonus - +3 for 2+ jump, +5 for 3+

### Sprint 3: Statistics - COMPLETE
9. [x] Race history logging - `GameLog.js` + export
10. [x] Win rate tracking - `StatisticsSystem.js`
11. [x] Weapon effectiveness tracking - `StatisticsSystem.js`
12. [x] Meta dashboard UI - Stats tab in sidebar

### Sprint 4: Polish & Test - PENDING
13. [ ] Test Design A vs B vs C
14. [ ] Tune odds and multipliers
15. [ ] Add dramatic UI elements
16. [ ] Sound effects for key moments

---

## Testing Checklist

For each design, test and rate 1-10:
- [ ] Is comeback possible? (needs to be 8+)
- [ ] Does early lead matter? (should be 5-7)
- [ ] Is it fun to watch? (needs to be 8+)
- [ ] Do I want to keep betting? (engagement)
- [ ] Are there "oh shit" moments? (drama)
- [ ] Is math simple enough to follow? (brainrot friendly)

---

## Notes & Ideas Parking Lot

- Consider team mode (Red+Blue vs Green+Yellow+Purple)
- Tournament mode for special events
- Daily/weekly challenges
- Seasonal rankings
- Ball customization unlocks based on performance
- Replay system for close finishes
- Clip export for social media
- Sound design: Crowd cheers, dramatic music, announcer voice?

---

## Additional Features Implemented (not in original design)

- **Race Countdown Timer**: When half the balls finish in a race (non-boss), a 15-second countdown starts. Remaining balls are ranked by progress when timer expires.
- **Debug Panel**: Toggle button in toolbar shows real-time timing, ball states, inventory info.
- **Inventory Persistence**: Weapons carry over between levels within a chain.
- **Buff System**: C-tier roulette rewards give temporary buffs (speed, shield, damage).

---

*Document created: 2026-01-31*
*Last updated: 2026-01-31 (Sprint 1 & 2 complete)*
