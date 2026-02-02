/**
 * StatsUI - Statistics dashboard rendering
 * Extracted from renderer.js for modularity
 */

import { statisticsSystem } from '../game/systems/StatisticsSystem.js';

/**
 * Update the statistics dashboard with current data
 */
export function updateStatsDashboard() {
  const summary = statisticsSystem.getSummary();

  // Update totals
  document.getElementById('stat-total-races').textContent = summary.totalRaces;
  document.getElementById('stat-total-chains').textContent = summary.totalChains;

  // Update ball win rates
  const ballWinratesEl = document.getElementById('stats-ball-winrates');
  if (summary.totalRaces > 0) {
    const ballColors = {
      Red: '#e74c3c',
      Blue: '#3498db',
      Green: '#2ecc71',
      Yellow: '#f1c40f',
      Purple: '#9b59b6'
    };

    let html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<tr style="color: #888; font-size: 10px;"><th style="text-align: left;">Ball</th><th>Races</th><th>Win%</th><th>Avg Pos</th><th>Chain W</th></tr>';

    for (const [name, data] of Object.entries(summary.ballWinRates)) {
      const color = ballColors[name] || '#fff';
      html += `<tr style="border-top: 1px solid #333;">
        <td style="color: ${color}; padding: 4px 0;">${name}</td>
        <td style="text-align: center;">${data.races}</td>
        <td style="text-align: center;">${data.winRate}%</td>
        <td style="text-align: center;">${data.avgPosition}</td>
        <td style="text-align: center;">${data.chainWins}</td>
      </tr>`;
    }
    html += '</table>';
    ballWinratesEl.innerHTML = html;
  } else {
    ballWinratesEl.innerHTML = '<div style="color: #666;">No data yet. Play some races!</div>';
  }

  // Update weapon effectiveness
  const weaponsEl = document.getElementById('stats-weapons');
  if (summary.weaponEffectiveness.length > 0) {
    let html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<tr style="color: #888; font-size: 10px;"><th style="text-align: left;">Weapon</th><th>Held</th><th>Win%</th><th>Avg Dmg</th></tr>';

    for (const weapon of summary.weaponEffectiveness) {
      html += `<tr style="border-top: 1px solid #333;">
        <td style="padding: 3px 0;">${weapon.name}</td>
        <td style="text-align: center;">${weapon.racesHeld}</td>
        <td style="text-align: center; color: ${parseFloat(weapon.winRate) > 25 ? '#2ecc71' : '#fff'};">${weapon.winRate}%</td>
        <td style="text-align: center;">${weapon.avgDamage}</td>
      </tr>`;
    }
    html += '</table>';
    weaponsEl.innerHTML = html;
  } else {
    weaponsEl.innerHTML = '<div style="color: #666;">No weapon data yet.</div>';
  }

  // Update comeback stats
  const comebacksEl = document.getElementById('stats-comebacks');
  const comebacks = summary.comebacks;
  if (summary.totalRaces > 0) {
    comebacksEl.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div style="background: #2a2a3e; padding: 8px; border-radius: 4px;">
          <div style="color: #888; font-size: 9px;">2+ Position Jumps</div>
          <div style="font-size: 16px; color: #3498db;">${comebacks.positionJump2}</div>
          <div style="color: #666; font-size: 9px;">${comebacks.positionJump2Rate}% of races</div>
        </div>
        <div style="background: #2a2a3e; padding: 8px; border-radius: 4px;">
          <div style="color: #888; font-size: 9px;">3+ Position Jumps</div>
          <div style="font-size: 16px; color: #9b59b6;">${comebacks.positionJump3}</div>
          <div style="color: #666; font-size: 9px;">${comebacks.positionJump3Rate}% of races</div>
        </div>
        <div style="background: #2a2a3e; padding: 8px; border-radius: 4px;">
          <div style="color: #888; font-size: 9px;">Underdog Wins</div>
          <div style="font-size: 16px; color: #e74c3c;">${comebacks.underdogWins}</div>
          <div style="color: #666; font-size: 9px;">${comebacks.underdogWinRate}% of races</div>
        </div>
        <div style="background: #2a2a3e; padding: 8px; border-radius: 4px;">
          <div style="color: #888; font-size: 9px;">5th → 1st</div>
          <div style="font-size: 16px; color: #f1c40f;">${comebacks.fifthToFirst}</div>
          <div style="color: #666; font-size: 9px;">4th → 1st: ${comebacks.fourthToFirst}</div>
        </div>
      </div>
    `;
  } else {
    comebacksEl.innerHTML = '<div style="color: #666;">No comeback data yet.</div>';
  }

  // Update recent races
  const recentRacesEl = document.getElementById('stats-recent-races');
  const recentRaces = statisticsSystem.getRecentRaces(10);
  if (recentRaces.length > 0) {
    let html = '';
    recentRaces.forEach((race, idx) => {
      const winner = race.results[0]?.name || 'Unknown';
      const duration = race.duration ? race.duration.toFixed(1) : '?';
      html += `<div style="padding: 4px 0; border-bottom: 1px solid #333;">
        <span style="color: #888;">#${idx + 1}</span>
        <span style="color: #3498db;">${race.levelName || 'Level'}</span>
        <span style="color: #2ecc71;">→ ${winner}</span>
        <span style="color: #666; float: right;">${duration}s</span>
      </div>`;
    });
    recentRacesEl.innerHTML = html;
  } else {
    recentRacesEl.innerHTML = '<div style="color: #666;">No race history yet.</div>';
  }
}
