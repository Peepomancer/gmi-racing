/**
 * GameLog - Real-time game event logging system
 *
 * PURPOSE:
 * Displays combat events, race progress, and system messages in a
 * scrollable log panel. Provides visual feedback for game events.
 *
 * FEATURES:
 * - Color-coded log entries by event type
 * - Auto-scroll to latest entry
 * - Timestamp on each entry
 * - Clear button to reset log
 * - Max 100 entries (oldest removed automatically)
 *
 * EVENT TYPES & COLORS:
 * - info (gray): General information
 * - damage (red): Damage dealt
 * - heal (green): Healing effects
 * - boss (dark red): Boss-related events
 * - death (bright red): Ball eliminated
 * - respawn (blue): Ball respawned
 * - hit (orange): Ball took damage
 * - victory (yellow): Win conditions
 * - system (purple): System messages
 *
 * USAGE:
 *   gameLog.init();                          // Connect to DOM
 *   gameLog.bossDamage('Red', 15, 85, 100);  // Red hit boss for 15
 *   gameLog.ballDamage('Blue', 10, 90, 100); // Blue took 10 damage
 *   gameLog.death('Green');                  // Green eliminated
 *   gameLog.respawn('Green');                // Green respawned
 *
 * @module GameLog
 */

class GameLogSystem {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
    this.containerEl = null;
  }

  /**
   * Initialize with DOM container
   */
  init() {
    this.containerEl = document.getElementById('game-log');

    // Clear button
    document.getElementById('btn-clear-log')?.addEventListener('click', () => {
      this.clear();
    });

    // Export buttons (sidebar panel and top toolbar)
    document.getElementById('btn-export-game-log')?.addEventListener('click', () => {
      this.export();
    });
    document.getElementById('btn-export-game-logs')?.addEventListener('click', () => {
      this.export();
    });

    console.log('[GameLog] Initialized');
  }

  /**
   * Add a log entry
   */
  log(message, type = 'info') {
    const entry = {
      time: Date.now(),
      message,
      type
    };

    this.logs.push(entry);

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Update UI
    this.renderEntry(entry);
  }

  /**
   * Log types with colors
   */
  getColor(type) {
    const colors = {
      info: '#888888',
      damage: '#ff6b6b',
      heal: '#51cf66',
      boss: '#cc3300',
      death: '#ff0000',
      respawn: '#4dabf7',
      hit: '#ffa94d',
      victory: '#ffd43b',
      system: '#845ef7'
    };
    return colors[type] || colors.info;
  }

  /**
   * Render a single entry to the UI
   */
  renderEntry(entry) {
    if (!this.containerEl) return;

    // Remove "waiting" message if present
    const waiting = this.containerEl.querySelector('[data-waiting]');
    if (waiting) waiting.remove();

    const div = document.createElement('div');
    div.style.color = this.getColor(entry.type);
    div.style.marginBottom = '2px';
    div.style.borderBottom = '1px solid #333';
    div.style.paddingBottom = '2px';

    const time = new Date(entry.time);
    const timeStr = time.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    div.innerHTML = `<span style="color:#666">[${timeStr}]</span> ${entry.message}`;

    this.containerEl.appendChild(div);

    // Auto-scroll to bottom
    this.containerEl.scrollTop = this.containerEl.scrollHeight;
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
    if (this.containerEl) {
      this.containerEl.innerHTML = '<div style="color: #666;" data-waiting>Log cleared</div>';
    }
  }

  /**
   * Export logs as JSON file download
   */
  export() {
    if (this.logs.length === 0) {
      alert('No logs to export. Start a race first!');
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalEntries: this.logs.length,
      logs: this.logs.map(log => ({
        time: new Date(log.time).toISOString(),
        type: log.type,
        message: log.message.replace(/<[^>]*>/g, '') // Strip HTML tags
      }))
    };

    // Download as JSON
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[GameLog] Exported', this.logs.length, 'log entries');
  }

  /**
   * Get all logs (for external access)
   */
  getLogs() {
    return this.logs;
  }

  // ========== Convenience methods ==========

  damage(attacker, target, amount, newHp = null) {
    const hpStr = newHp !== null ? ` (HP: ${newHp})` : '';
    this.log(`<span style="color:#ffa94d">${attacker}</span> dealt <span style="color:#ff6b6b">${amount}</span> damage to <span style="color:#4dabf7">${target}</span>${hpStr}`, 'damage');
  }

  ballDamage(ballName, amount, newHp, maxHp) {
    const percent = Math.round((newHp / maxHp) * 100);
    this.log(`<span style="color:#4dabf7">${ballName}</span> took <span style="color:#ff6b6b">${amount}</span> damage (${newHp}/${maxHp} HP - ${percent}%)`, 'hit');
  }

  bossDamage(ballName, amount, bossHp, bossMaxHp) {
    const percent = Math.round((bossHp / bossMaxHp) * 100);
    this.log(`<span style="color:#4dabf7">${ballName}</span> hit <span style="color:#cc3300">BOSS</span> for <span style="color:#ff6b6b">${amount}</span> (${bossHp}/${bossMaxHp} - ${percent}%)`, 'boss');
  }

  death(name) {
    this.log(`<span style="color:#ff6b6b">${name}</span> was eliminated!`, 'death');
  }

  respawn(name) {
    this.log(`<span style="color:#4dabf7">${name}</span> respawned`, 'respawn');
  }

  bossSpawn(hp, pattern) {
    this.log(`<span style="color:#cc3300">BOSS</span> spawned with ${hp} HP (${pattern} pattern)`, 'boss');
  }

  bossDeath() {
    this.log(`<span style="color:#ffd43b">BOSS DEFEATED!</span>`, 'victory');
  }

  raceStart() {
    this.log(`Race started!`, 'system');
  }

  raceEnd() {
    this.log(`Race ended`, 'system');
  }

  weaponPickup(ballName, weaponName) {
    this.log(`<span style="color:#4dabf7">${ballName}</span> picked up <span style="color:#ffa94d">${weaponName}</span>`, 'info');
  }

  itemPickup(ballName, itemName) {
    this.log(`<span style="color:#4dabf7">${ballName}</span> picked up <span style="color:#51cf66">${itemName}</span>`, 'info');
  }

  damageSummary(rankings) {
    this.log(`--- DAMAGE RANKINGS ---`, 'system');
    rankings.forEach((entry, i) => {
      const position = i + 1;
      const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`;
      this.log(`${medal} <span style="color:#4dabf7">${entry.name}</span>: <span style="color:#ff6b6b">${entry.damage}</span> damage`, 'victory');
    });
  }

  finish(name, position) {
    const ordinal = this.getOrdinal(position);
    this.log(`<span style="color:#51cf66">${name}</span> finished ${ordinal}!`, 'victory');
  }

  getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
}

// Singleton
export const gameLog = new GameLogSystem();
