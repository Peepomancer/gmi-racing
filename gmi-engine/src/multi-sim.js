/**
 * Multi-Simulation System - REAL PHYSICS VERSION
 * Runs multiple real game instances in parallel using iframes
 * Each iframe runs the actual game with Matter.js physics
 */

import { getMapStorage } from './shared/MapStorage.js';
import { mapChain, CHAIN_RACE_MAPS, CHAIN_BOSS_MAPS, CHAIN_MIXED, CHAIN_WEAPONS_TEST } from './game/systems/MapChain.js';

// ============================================
// CONFIGURATION
// ============================================

const BALL_COLORS = {
  Red: '#e74c3c',
  Blue: '#3498db',
  Green: '#2ecc71',
  Yellow: '#f1c40f',
  Purple: '#9b59b6'
};

const BALL_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];

// Built-in chains for selection
// Built-in chains matching main game dropdown
const BUILT_IN_CHAINS = {
  'race': { name: 'Race Chain (3 levels)', maps: CHAIN_RACE_MAPS },
  'boss': { name: 'Boss Chain (3 bosses)', maps: CHAIN_BOSS_MAPS },
  'mixed': { name: 'Mixed Campaign (6 levels)', maps: CHAIN_MIXED },
  'weapons': { name: 'Weapons Test (3 levels)', maps: CHAIN_WEAPONS_TEST }
};

// ============================================
// MULTI-SIMULATION MANAGER
// ============================================

class MultiSimManager {
  constructor() {
    this.simCount = 16;
    this.timeScale = 4;
    this.visualMode = false;
    this.selectedChainId = 'weapons';
    this.isRunning = false;
    this.completedChains = 0;
    this.completedRaces = 0;
    this.startTime = null;
    this.mapStorage = null;
    this.availableChains = [];
    this.iframes = [];

    // Statistics
    this.stats = {
      chainWins: { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 },
      raceWins: { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 },
      totalRaces: 0,
      totalChains: 0,
      recentFinishes: [],
      // Detailed per-map stats
      mapStats: {},  // mapName -> { wins: {ball: count}, placements: {ball: [positions]} }
      // Per-simulation detailed data
      simulations: [],  // Array of full simulation results
      // Weapon statistics
      weaponStats: {
        awarded: {},  // weaponId -> count
        damageDealt: {},  // weaponId -> total damage
        // Track which weapons appeared in chain-winning builds
        weaponWins: {}  // weaponId -> number of chains won with this weapon
      }
    };

    this.init();
  }

  async init() {
    this.mapStorage = getMapStorage();
    await this.mapStorage.init();
    await this.loadAvailableChains();
    this.setupUI();
    this.setupMessageListener();
  }

  async loadAvailableChains() {
    // Start with built-in chains
    console.log('[MultiSim] BUILT_IN_CHAINS keys:', Object.keys(BUILT_IN_CHAINS));

    this.availableChains = Object.entries(BUILT_IN_CHAINS).map(([id, data]) => {
      console.log(`[MultiSim] Processing chain '${id}':`, data.name, 'maps:', data.maps?.length || 0);
      return {
        id,
        name: data.name,
        maps: data.maps,
        levelCount: data.maps?.length || 0,
        isBuiltIn: true
      };
    });

    // Load custom chains from localStorage
    const savedChains = JSON.parse(localStorage.getItem('gmi-chains') || '[]');
    console.log('[MultiSim] Found saved chains:', savedChains.length);

    savedChains.forEach(c => {
      this.availableChains.push({
        id: c.id,
        name: c.name || 'Unnamed Chain',
        maps: c.maps,
        levelCount: c.maps?.length || 0,
        isBuiltIn: false
      });
    });

    // Get all maps from IndexedDB
    const allMaps = await this.mapStorage.listMaps();
    console.log('[MultiSim] Found maps in IndexedDB:', allMaps.length);

    // Create "All Maps" chain if we have maps
    if (allMaps.length > 0) {
      this.availableChains.push({
        id: 'all-maps',
        name: `All Saved Maps (${allMaps.length})`,
        maps: allMaps.map(m => ({ id: m.id, name: m.name, width: m.width, height: m.height })),
        levelCount: allMaps.length,
        isBuiltIn: false,
        useIndexedDB: true
      });
    }
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || !data.type) return;

      switch (data.type) {
        case 'sim-status':
          this.handleSimStatus(data);
          break;
        case 'sim-race-complete':
          this.handleRaceComplete(data);
          break;
        case 'sim-chain-complete':
          this.handleChainComplete(data);
          break;
        case 'sim-error':
          this.handleSimError(data);
          break;
      }
    });
  }

  setupUI() {
    this.populateChainSelector();

    document.getElementById('btn-start')?.addEventListener('click', () => this.start());
    document.getElementById('btn-stop')?.addEventListener('click', () => this.stop());
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportStats());

    document.getElementById('sim-count')?.addEventListener('change', (e) => {
      this.simCount = parseInt(e.target.value);
      this.updateGridLayout();
    });

    document.getElementById('sim-speed')?.addEventListener('change', (e) => {
      this.timeScale = parseInt(e.target.value);
    });

    document.getElementById('visual-mode')?.addEventListener('change', (e) => {
      this.visualMode = e.target.checked;
    });

    this.updateGridLayout();
  }

  populateChainSelector() {
    const select = document.getElementById('chain-select');
    if (!select) return;

    select.innerHTML = '';

    // Add built-in chains first
    const builtInGroup = document.createElement('optgroup');
    builtInGroup.label = 'Built-in Chains';
    this.availableChains.filter(c => c.isBuiltIn).forEach(chain => {
      const option = document.createElement('option');
      option.value = chain.id;
      option.textContent = `${chain.name}`;
      builtInGroup.appendChild(option);
    });
    select.appendChild(builtInGroup);

    // Add custom chains
    const customChains = this.availableChains.filter(c => !c.isBuiltIn);
    if (customChains.length > 0) {
      const customGroup = document.createElement('optgroup');
      customGroup.label = 'Custom Chains';
      customChains.forEach(chain => {
        const option = document.createElement('option');
        option.value = chain.id;
        option.textContent = `${chain.name} (${chain.levelCount} levels)`;
        customGroup.appendChild(option);
      });
      select.appendChild(customGroup);
    }

    // Set default to mixed campaign
    select.value = 'mixed';
    this.selectedChainId = 'mixed';

    console.log('[MultiSim] Available chains:', this.availableChains.map(c => c.name));

    select.addEventListener('change', (e) => {
      this.selectedChainId = e.target.value;
    });
  }

  updateGridLayout() {
    const grid = document.getElementById('sim-grid');
    if (!grid) return;

    grid.className = 'sim-grid';

    if (this.simCount >= 50) {
      grid.classList.add('grid-50');
    } else if (this.simCount >= 25) {
      grid.classList.add('grid-25');
    } else if (this.simCount >= 16) {
      grid.classList.add('grid-16');
    } else {
      grid.classList.add('grid-9');
    }
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.completedChains = 0;
    this.completedRaces = 0;
    this.startTime = Date.now();

    // Reset stats
    this.stats = {
      chainWins: { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 },
      raceWins: { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 },
      totalRaces: 0,
      totalChains: 0,
      recentFinishes: [],
      mapStats: {},
      simulations: [],
      weaponStats: {
        awarded: {},
        damageDealt: {},
        weaponWins: {}
      },
      // Diagnostics for debugging
      diagnostics: {
        outOfBoundsRespawns: 0,
        stuckPushes: 0,
        raceTimeouts: 0,
        forceFinishedBalls: 0,
        ballsWithoutBody: 0,
        events: []
      }
    };

    // Update UI
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-stop').disabled = false;
    // Export button stays enabled - can export partial results anytime
    document.getElementById('btn-export').disabled = false;
    document.getElementById('loading-overlay')?.classList.remove('hidden');
    document.getElementById('loading-text').textContent = 'Preparing simulations...';

    // Get selected chain
    const chain = this.availableChains.find(c => c.id === this.selectedChainId);
    if (!chain) {
      console.error('[MultiSim] Chain not found:', this.selectedChainId);
      this.stop();
      return;
    }

    // Get map IDs for URL
    let mapIdsParam = '';
    if (chain.isBuiltIn) {
      // Built-in chains use inline data, we'll pass chain type
      mapIdsParam = `chainType=${chain.id}`;
    } else if (chain.useIndexedDB) {
      // Maps from IndexedDB - pass map IDs
      const mapIds = chain.maps.map(m => m.id).join(',');
      mapIdsParam = `mapIds=${mapIds}`;
    } else {
      // Custom chain from localStorage
      mapIdsParam = `chainId=${chain.id}`;
    }

    // Clear grid
    const grid = document.getElementById('sim-grid');
    grid.innerHTML = '';
    this.iframes = [];

    // Create simulation cells
    for (let i = 0; i < this.simCount; i++) {
      await this.createSimulation(i, grid, chain, mapIdsParam);
      document.getElementById('loading-text').textContent = `Creating simulation ${i + 1} / ${this.simCount}...`;
      // Small delay to prevent browser overload
      if (i % 5 === 0) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    document.getElementById('loading-overlay')?.classList.add('hidden');

    // Start timer
    this.timerInterval = setInterval(() => this.updateTimer(), 1000);

    console.log(`[MultiSim] Started ${this.simCount} simulations at ${this.timeScale}x speed`);
  }

  async createSimulation(simId, grid, chain, mapIdsParam) {
    // Create cell with cache-busting URL
    const cacheBust = Date.now();
    const visualParam = this.visualMode ? '&visual=1' : '';
    const iframeUrl = `sim-runner.html?simId=${simId}&speed=${this.timeScale}&levels=${chain.levelCount}&${mapIdsParam}${visualParam}&_t=${cacheBust}`;

    console.log(`[MultiSim] Creating sim ${simId} with URL params: ${mapIdsParam}`);

    const cell = document.createElement('div');
    cell.className = 'sim-cell';
    cell.id = `sim-cell-${simId}`;
    cell.innerHTML = `
      <div class="sim-cell-header">
        <span class="sim-cell-id">#${simId + 1}</span>
        <span class="sim-cell-status" id="sim-status-${simId}">L1/${chain.levelCount}</span>
      </div>
      <iframe
        id="sim-iframe-${simId}"
        class="sim-iframe"
        src="${iframeUrl}"
        sandbox="allow-scripts allow-same-origin"
      ></iframe>
      <div class="sim-cell-winner" id="sim-winner-${simId}"></div>
    `;
    grid.appendChild(cell);

    // Track iframe
    const iframe = cell.querySelector('iframe');
    this.iframes.push({
      id: simId,
      iframe,
      completed: false
    });
  }

  handleSimStatus(data) {
    console.log(`[MultiSim] Sim ${data.simId} status:`, data.status);
  }

  handleRaceComplete(data) {
    this.completedRaces++;
    this.stats.totalRaces++;

    // Track race winner
    if (data.winner) {
      this.stats.raceWins[data.winner]++;
    }

    // Track per-map stats
    const mapName = data.mapName || `Level ${data.level}`;
    if (!this.stats.mapStats[mapName]) {
      this.stats.mapStats[mapName] = {
        mapType: data.mapType || 'race',
        wins: { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 },
        placements: { Red: [], Blue: [], Green: [], Yellow: [], Purple: [] },
        races: []
      };
    }

    const mapStat = this.stats.mapStats[mapName];
    if (data.winner) {
      mapStat.wins[data.winner]++;
    }

    // Store detailed results for this race
    if (data.results) {
      data.results.forEach(r => {
        if (mapStat.placements[r.name]) {
          mapStat.placements[r.name].push(r.position);
        }
      });

      // Store full race data
      mapStat.races.push({
        simId: data.simId,
        results: data.results,
        bossDefeated: data.bossDefeated
      });
    }

    // Update level display
    const statusEl = document.getElementById(`sim-status-${data.simId}`);
    if (statusEl) {
      statusEl.textContent = `L${data.level}/${data.totalLevels}`;
    }

    // Update UI
    this.updateStatsUI();
    this.updateProgress();
    this.updatePerMapStandings();
  }

  handleChainComplete(data) {
    this.completedChains++;
    this.stats.totalChains++;

    // Track chain winner
    const winner = data.winner;
    if (winner) {
      this.stats.chainWins[winner]++;
    }

    // Store full simulation data
    this.stats.simulations.push({
      simId: parseInt(data.simId) + 1,
      winner: winner,
      standings: data.standings,
      raceResults: data.raceResults || [],
      weaponStats: data.weaponStats || null
    });

    // Aggregate weapon stats
    if (data.weaponStats) {
      // Merge awarded counts
      for (const [weaponId, count] of Object.entries(data.weaponStats.awarded || {})) {
        this.stats.weaponStats.awarded[weaponId] = (this.stats.weaponStats.awarded[weaponId] || 0) + count;
      }
      // Merge damage dealt
      for (const [source, damage] of Object.entries(data.weaponStats.damageDealt || {})) {
        this.stats.weaponStats.damageDealt[source] = (this.stats.weaponStats.damageDealt[source] || 0) + damage;
      }
      // Track weapons in winning builds
      if (winner && data.weaponStats.ballWeapons && data.weaponStats.ballWeapons[winner]) {
        const winnerWeapons = data.weaponStats.ballWeapons[winner];
        // Count each unique weapon (not duplicates)
        const uniqueWeapons = [...new Set(winnerWeapons)];
        for (const weaponId of uniqueWeapons) {
          this.stats.weaponStats.weaponWins[weaponId] = (this.stats.weaponStats.weaponWins[weaponId] || 0) + 1;
        }
      }
    }

    // Aggregate diagnostics
    if (data.diagnostics) {
      this.stats.diagnostics.outOfBoundsRespawns += data.diagnostics.outOfBoundsRespawns || 0;
      this.stats.diagnostics.stuckPushes += data.diagnostics.stuckPushes || 0;
      this.stats.diagnostics.raceTimeouts += data.diagnostics.raceTimeouts || 0;
      this.stats.diagnostics.forceFinishedBalls += data.diagnostics.forceFinishedBalls || 0;
      this.stats.diagnostics.ballsWithoutBody += data.diagnostics.ballsWithoutBody || 0;
      // Keep last 100 events across all simulations
      if (data.diagnostics.events) {
        this.stats.diagnostics.events.push(...data.diagnostics.events.map(e => ({
          ...e,
          simId: parseInt(data.simId) + 1
        })));
        if (this.stats.diagnostics.events.length > 100) {
          this.stats.diagnostics.events = this.stats.diagnostics.events.slice(-100);
        }
      }
    }

    // Add to recent finishes
    this.stats.recentFinishes.unshift({
      simId: parseInt(data.simId) + 1,
      winner,
      points: data.standings?.[0]?.points || 0
    });
    if (this.stats.recentFinishes.length > 20) {
      this.stats.recentFinishes.pop();
    }

    // Update cell
    const cell = document.getElementById(`sim-cell-${data.simId}`);
    const statusEl = document.getElementById(`sim-status-${data.simId}`);
    const winnerEl = document.getElementById(`sim-winner-${data.simId}`);

    if (cell) cell.classList.add('finished');
    if (statusEl) {
      statusEl.textContent = 'Done';
      statusEl.classList.add('complete');
    }
    if (winnerEl) {
      winnerEl.textContent = `${winner}`;
      winnerEl.style.color = BALL_COLORS[winner];
    }

    // Mark as completed
    const iframeData = this.iframes.find(f => f.id === parseInt(data.simId));
    if (iframeData) {
      iframeData.completed = true;
    }

    // Update UI
    this.updateStatsUI();
    this.updateProgress();
    this.updateRecentFinishes();
    this.updateWeaponStatsUI();

    // Check if all complete
    if (this.completedChains >= this.simCount) {
      this.onAllComplete();
    }
  }

  handleSimError(data) {
    console.error(`[MultiSim] Sim ${data.simId} error:`, data.error);

    const statusEl = document.getElementById(`sim-status-${data.simId}`);
    if (statusEl) {
      statusEl.textContent = 'Error';
      statusEl.style.color = '#ff4444';
    }
  }

  updateProgress() {
    const percent = (this.completedChains / this.simCount) * 100;
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const racesComplete = document.getElementById('races-complete');

    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${this.completedChains} / ${this.simCount}`;
    if (racesComplete) racesComplete.textContent = this.completedRaces;
  }

  updateTimer() {
    if (!this.startTime) return;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timerEl = document.getElementById('elapsed-time');
    if (timerEl) {
      timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }

  updateStatsUI() {
    const maxChainWins = Math.max(...Object.values(this.stats.chainWins), 1);
    const maxRaceWins = Math.max(...Object.values(this.stats.raceWins), 1);

    // Update chain wins
    const chainWinsContainer = document.getElementById('chain-wins-stats');
    if (chainWinsContainer) {
      BALL_NAMES.forEach((name, idx) => {
        const wins = this.stats.chainWins[name];
        const percent = (wins / maxChainWins) * 100;
        const bar = chainWinsContainer.querySelector(`.bg-${name.toLowerCase()}`);
        const value = chainWinsContainer.querySelectorAll('.ball-stat-value')[idx];
        if (bar) bar.style.width = `${percent}%`;
        if (value) value.textContent = wins;
      });
    }

    // Update race wins
    const raceWinsContainer = document.getElementById('race-wins-stats');
    if (raceWinsContainer) {
      BALL_NAMES.forEach((name, idx) => {
        const wins = this.stats.raceWins[name];
        const percent = (wins / maxRaceWins) * 100;
        const bar = raceWinsContainer.querySelector(`.bg-${name.toLowerCase()}`);
        const value = raceWinsContainer.querySelectorAll('.ball-stat-value')[idx];
        if (bar) bar.style.width = `${percent}%`;
        if (value) value.textContent = wins;
      });
    }
  }

  updatePerMapStandings() {
    const container = document.getElementById('per-map-standings');
    if (!container) return;

    const mapStats = this.stats.mapStats;
    const mapNames = Object.keys(mapStats);

    if (mapNames.length === 0) {
      container.innerHTML = '<div style="color: #666; font-size: 11px;">Results will appear as maps complete...</div>';
      return;
    }

    container.innerHTML = mapNames.map(mapName => {
      const stats = mapStats[mapName];
      const sortedBalls = BALL_NAMES
        .map(name => ({ name, wins: stats.wins[name] }))
        .sort((a, b) => b.wins - a.wins);

      return `
        <div class="map-standings-box">
          <h4>${mapName}</h4>
          <div class="map-standings-list">
            ${sortedBalls.map((ball, idx) => `
              <div class="map-standing-row">
                <span class="map-standing-position">${idx + 1}.</span>
                <span class="map-standing-name" style="color: ${BALL_COLORS[ball.name]}">${ball.name}</span>
                <span class="map-standing-wins">${ball.wins} wins</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  updateRecentFinishes() {
    const container = document.getElementById('recent-finishes');
    if (!container) return;

    container.innerHTML = this.stats.recentFinishes.map(f =>
      `<div style="margin-bottom: 4px;">
        <span style="color: #666;">#${f.simId}:</span>
        <span style="color: ${BALL_COLORS[f.winner]}; font-weight: bold;">${f.winner}</span>
        <span style="color: #888;">(${f.points}pts)</span>
      </div>`
    ).join('') || '<div style="color: #666;">Waiting for results...</div>';
  }

  updateWeaponStatsUI() {
    const container = document.getElementById('weapon-stats');
    if (!container) return;

    const awarded = this.stats.weaponStats.awarded;
    const damageDealt = this.stats.weaponStats.damageDealt;
    const weaponWins = this.stats.weaponStats.weaponWins;

    // Check if we have any data
    const totalAwarded = Object.values(awarded).reduce((a, b) => a + b, 0);
    if (totalAwarded === 0) {
      container.innerHTML = '<div style="color: #666;">Weapons awarded after races...</div>';
      return;
    }

    // Sort weapons by chain wins (highest first), then by damage
    const weaponData = Object.keys({ ...awarded, ...damageDealt, ...weaponWins })
      .filter(id => id !== 'collision') // Exclude collision damage
      .map(weaponId => ({
        id: weaponId,
        name: weaponId.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        awarded: awarded[weaponId] || 0,
        damage: damageDealt[weaponId] || 0,
        avgDamage: awarded[weaponId] ? Math.round((damageDealt[weaponId] || 0) / awarded[weaponId]) : 0,
        chainWins: weaponWins[weaponId] || 0
      }))
      .sort((a, b) => b.chainWins - a.chainWins || b.damage - a.damage);

    const maxWins = Math.max(...weaponData.map(w => w.chainWins), 1);
    const totalChains = this.stats.totalChains || 1;

    container.innerHTML = `
      <div style="margin-bottom: 8px; color: #888; font-size: 10px;">
        Total weapons awarded: ${totalAwarded}
      </div>
      ${weaponData.map(w => `
        <div style="margin-bottom: 6px; padding: 4px; background: #2a2a3e; border-radius: 3px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: #f1c40f;">${w.name}</span>
            <span style="color: #888;">x${w.awarded}</span>
          </div>
          <div style="height: 4px; background: #333; border-radius: 2px; overflow: hidden; margin-bottom: 2px;">
            <div style="height: 100%; width: ${(w.chainWins / maxWins) * 100}%; background: #2ecc71;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 9px; color: #666;">
            <span style="color: #2ecc71;">${w.chainWins} chain wins</span>
            <span>Dmg: ${w.damage}</span>
          </div>
        </div>
      `).join('')}
    `;
  }

  onAllComplete() {
    this.isRunning = false;
    clearInterval(this.timerInterval);

    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-stop').disabled = true;
    document.getElementById('btn-export').disabled = false;

    // Final UI update
    this.updateWeaponStatsUI();

    console.log('[MultiSim] All simulations complete!', this.stats);

    // Calculate win rates
    const totalChains = this.stats.totalChains || 1;
    const totalRaces = this.stats.totalRaces || 1;

    console.log('Chain Win Rates:');
    BALL_NAMES.forEach(name => {
      const rate = ((this.stats.chainWins[name] / totalChains) * 100).toFixed(1);
      console.log(`  ${name}: ${rate}%`);
    });

    console.log('Race Win Rates:');
    BALL_NAMES.forEach(name => {
      const rate = ((this.stats.raceWins[name] / totalRaces) * 100).toFixed(1);
      console.log(`  ${name}: ${rate}%`);
    });
  }

  stop() {
    this.isRunning = false;
    clearInterval(this.timerInterval);

    // Remove all iframes
    this.iframes.forEach(f => {
      if (f.iframe && f.iframe.parentNode) {
        f.iframe.parentNode.removeChild(f.iframe);
      }
    });
    this.iframes = [];

    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-stop').disabled = true;
    document.getElementById('btn-export').disabled = false;

    console.log('[MultiSim] Stopped');
  }

  exportStats() {
    // Calculate per-map summaries
    const mapSummaries = {};
    Object.entries(this.stats.mapStats).forEach(([mapName, mapData]) => {
      const totalRaces = mapData.races.length || 1;
      const avgPlacements = {};

      BALL_NAMES.forEach(name => {
        const placements = mapData.placements[name];
        if (placements.length > 0) {
          avgPlacements[name] = (placements.reduce((a, b) => a + b, 0) / placements.length).toFixed(2);
        } else {
          avgPlacements[name] = 'N/A';
        }
      });

      mapSummaries[mapName] = {
        mapType: mapData.mapType,
        totalRaces: totalRaces,
        winRates: Object.fromEntries(
          Object.entries(mapData.wins).map(([name, wins]) => [
            name,
            ((wins / totalRaces) * 100).toFixed(1) + '%'
          ])
        ),
        avgPlacement: avgPlacements
      };
    });

    const isComplete = this.completedChains >= this.simCount;
    const exportData = {
      timestamp: new Date().toISOString(),
      status: isComplete ? 'complete' : 'in_progress',
      progress: {
        completedChains: this.completedChains,
        totalChains: this.simCount,
        completedRaces: this.completedRaces,
        percentComplete: ((this.completedChains / this.simCount) * 100).toFixed(1) + '%'
      },
      config: {
        simCount: this.simCount,
        chainId: this.selectedChainId,
        chainName: this.availableChains.find(c => c.id === this.selectedChainId)?.name || 'Unknown',
        timeScale: this.timeScale
      },
      summary: {
        totalSimulations: this.stats.totalChains,
        totalRaces: this.stats.totalRaces,
        chainWinRates: Object.fromEntries(
          Object.entries(this.stats.chainWins).map(([name, wins]) => [
            name,
            this.stats.totalChains > 0 ? ((wins / this.stats.totalChains) * 100).toFixed(1) + '%' : '0%'
          ])
        ),
        raceWinRates: Object.fromEntries(
          Object.entries(this.stats.raceWins).map(([name, wins]) => [
            name,
            this.stats.totalRaces > 0 ? ((wins / this.stats.totalRaces) * 100).toFixed(1) + '%' : '0%'
          ])
        )
      },
      perMapStats: mapSummaries,
      rawStats: {
        chainWins: this.stats.chainWins,
        raceWins: this.stats.raceWins,
        mapStats: this.stats.mapStats
      },
      weaponStats: {
        awarded: this.stats.weaponStats.awarded,
        damageDealt: this.stats.weaponStats.damageDealt,
        // Weapons that appeared in winning builds
        weaponWins: this.stats.weaponStats.weaponWins,
        // Weapon win rate ranking - shows which weapons correlate with chain wins
        winRateRanking: Object.entries(this.stats.weaponStats.weaponWins)
          .sort((a, b) => b[1] - a[1])
          .map(([weapon, wins]) => ({
            weapon,
            chainWins: wins,
            timesAwarded: this.stats.weaponStats.awarded[weapon] || 0,
            winRate: this.stats.weaponStats.awarded[weapon]
              ? ((wins / this.stats.weaponStats.awarded[weapon]) * 100).toFixed(1) + '%'
              : 'N/A',
            totalDamage: this.stats.weaponStats.damageDealt[weapon] || 0
          })),
        // Sort by damage to show which weapons are strongest
        damageRanking: Object.entries(this.stats.weaponStats.damageDealt)
          .sort((a, b) => b[1] - a[1])
          .map(([weapon, damage]) => ({
            weapon,
            totalDamage: damage,
            timesAwarded: this.stats.weaponStats.awarded[weapon] || 0,
            avgDamagePerAward: this.stats.weaponStats.awarded[weapon]
              ? Math.round(damage / this.stats.weaponStats.awarded[weapon])
              : 0
          }))
      },
      // Diagnostics for debugging stuck balls, timeouts, etc.
      diagnostics: {
        summary: {
          outOfBoundsRespawns: this.stats.diagnostics.outOfBoundsRespawns,
          stuckPushes: this.stats.diagnostics.stuckPushes,
          raceTimeouts: this.stats.diagnostics.raceTimeouts,
          forceFinishedBalls: this.stats.diagnostics.forceFinishedBalls,
          ballsWithoutBody: this.stats.diagnostics.ballsWithoutBody
        },
        recentEvents: this.stats.diagnostics.events.slice(-50) // Last 50 events
      },
      simulations: this.stats.simulations
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const statusSuffix = isComplete ? '' : `-partial-${this.completedChains}of${this.simCount}`;
    a.download = `multi-sim-${Date.now()}${statusSuffix}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`[MultiSim] Exported ${isComplete ? 'complete' : 'partial'} stats (${this.completedChains}/${this.simCount} chains):`, Object.keys(mapSummaries));
  }
}

// ============================================
// INITIALIZE
// ============================================

window.addEventListener('DOMContentLoaded', () => {
  window.multiSim = new MultiSimManager();
});
