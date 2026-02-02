/**
 * ChainCompleteScreen - Chain completion overlay display
 * Extracted from renderer.js for modularity
 */

import { pointSystem } from '../game/systems/PointSystem.js';
import { statisticsSystem } from '../game/systems/StatisticsSystem.js';
import { volumeSystem } from '../game/systems/VolumeSystem.js';

/**
 * Show chain complete screen with final results
 * @param {Function} onClose - Callback when screen is closed
 */
export function showChainCompleteScreen(onClose) {
  // Get final results from point system
  const finalResults = pointSystem.getFinalResults();
  const leaderboard = finalResults.standings;

  // Record chain completion in statistics
  statisticsSystem.recordChainComplete(finalResults);

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'chain-complete-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    font-family: Arial, sans-serif;
    overflow-y: auto;
    padding: 20px;
  `;

  const winner = leaderboard[0];
  const balls = volumeSystem.getAllBalls();
  const getBallColor = (name) => balls.find(b => b.name === name)?.color || '#888';

  overlay.innerHTML = `
    <div style="text-align: center; color: white; max-width: 600px;">
      <h1 style="color: #ffd700; font-size: 3em; margin-bottom: 10px;">CHAIN COMPLETE!</h1>
      <div style="font-size: 1.5em; color: #888; margin-bottom: 10px;">
        ${finalResults.totalLevels} Levels Completed
      </div>
      <div style="font-size: 2em; color: #ffd700; margin-bottom: 30px;">
        🏆 ${winner?.name || 'Unknown'} WINS! 🏆
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 40px;">
        ${leaderboard.map((entry, i) => `
          <div style="
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px 25px;
            background: ${i === 0 ? '#ffd70033' : '#2d3748'};
            border-radius: 10px;
            border: 2px solid ${i === 0 ? '#ffd700' : 'transparent'};
          ">
            <span style="font-size: 1.8em; min-width: 50px;">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</span>
            <div style="width: 28px; height: 28px; border-radius: 50%; background: ${getBallColor(entry.name)}; border: 2px solid white;"></div>
            <span style="font-size: 1.2em; min-width: 80px; text-align: left;">${entry.name}</span>
            <span style="color: #ffd700; font-size: 1.4em; font-weight: bold; flex: 1; text-align: right;">${entry.points} pts</span>
            ${entry.gap > 0 ? `<span style="color: #888; font-size: 0.9em;">(-${entry.gap})</span>` : ''}
          </div>
        `).join('')}
      </div>

      <div style="background: #1a1a2e; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
        <div style="color: #888; margin-bottom: 10px;">Level History</div>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          ${finalResults.history.map((level, i) => {
            const levelWinner = level.results[0];
            return `
              <div style="background: #2d3748; padding: 8px 12px; border-radius: 6px; text-align: center;">
                <div style="font-size: 0.8em; color: #888;">L${i + 1}</div>
                <div style="color: ${getBallColor(levelWinner?.name)}; font-weight: bold;">${levelWinner?.name || '?'}</div>
                <div style="font-size: 0.8em; color: #ffd700;">${level.multiplier}x</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <button id="btn-close-complete" style="
        padding: 15px 50px;
        font-size: 1.3em;
        background: #48bb78;
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
      ">Continue</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Use querySelector on the overlay itself instead of getElementById
  const closeBtn = overlay.querySelector('#btn-close-complete');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('[Chain] Continue button clicked, closing overlay');
      overlay.remove();
      // Reset point system for next chain
      pointSystem.reset();
      // Call the onClose callback
      if (onClose) onClose();
    });
  } else {
    console.error('[Chain] Close button not found in overlay!');
  }
}
