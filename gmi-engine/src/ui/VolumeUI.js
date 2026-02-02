/**
 * VolumeUI - Volume panel rendering functions
 * Extracted from renderer.js for modularity
 */

import { volumeSystem, VolumeSystem } from '../game/systems/VolumeSystem.js';

/**
 * Render the volume balls list with buy/sell buttons
 */
export function renderVolumeBallsList() {
  const container = document.getElementById('volume-balls-list');
  if (!container) return;

  const balls = volumeSystem.getAllBalls();

  container.innerHTML = balls.map(ball => `
    <div class="volume-ball-row" data-ball="${ball.name}">
      <div class="volume-ball-color" style="background: ${ball.color}"></div>
      <span class="volume-ball-name">${ball.name}</span>
      <span class="volume-ball-amount">${VolumeSystem.formatVolume(ball.volume)}</span>
      <div class="volume-ball-buttons">
        <button class="volume-btn buy" data-action="buy" data-amount="1000">+1K</button>
        <button class="volume-btn buy" data-action="buy" data-amount="5000">+5K</button>
        <button class="volume-btn sell" data-action="sell" data-amount="1000">-1K</button>
      </div>
    </div>
  `).join('');

  // Add click listeners to buttons
  container.querySelectorAll('.volume-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.target.closest('.volume-ball-row');
      const ballName = row.dataset.ball;
      const action = e.target.dataset.action;
      const amount = parseInt(e.target.dataset.amount);

      if (action === 'buy') {
        volumeSystem.addVolume(ballName, amount);
      } else if (action === 'sell') {
        volumeSystem.removeVolume(ballName, amount);
      }

      // Update display
      const amountEl = row.querySelector('.volume-ball-amount');
      amountEl.textContent = VolumeSystem.formatVolume(volumeSystem.getVolume(ballName));
    });
  });
}

/**
 * Update volume amounts in the balls list without re-rendering
 */
export function updateVolumeBallAmounts() {
  const container = document.getElementById('volume-balls-list');
  if (!container) return;

  const balls = volumeSystem.getAllBalls();
  balls.forEach(ball => {
    const row = container.querySelector(`[data-ball="${ball.name}"]`);
    if (row) {
      const amountEl = row.querySelector('.volume-ball-amount');
      amountEl.textContent = VolumeSystem.formatVolume(ball.volume);
    }
  });
}

/**
 * Render the volume rankings display
 */
export function renderVolumeRankings() {
  const container = document.getElementById('volume-rankings');
  if (!container) return;

  const ranks = volumeSystem.getVolumeRanks();
  const maxVolume = ranks.length > 0 ? ranks[0].volume : 1;

  container.innerHTML = ranks.map(ball => {
    const widthPercent = (ball.volume / maxVolume) * 100;
    const change = volumeSystem.getVolumeChange(ball.name);
    const changeClass = change.direction === 'up' ? 'up' : change.direction === 'down' ? 'down' : '';
    const changeText = change.direction !== 'neutral' ? `${change.direction === 'up' ? '+' : ''}${change.percent}%` : '';

    return `
      <div class="volume-rank-row">
        <span class="volume-rank-position rank-${ball.rank}">#${ball.rank}</span>
        <div class="volume-ball-color" style="background: ${ball.color}"></div>
        <span class="volume-ball-name">${ball.name}</span>
        <div class="volume-rank-bar">
          <div class="volume-rank-fill" style="width: ${widthPercent}%; background: ${ball.color}"></div>
        </div>
        ${changeText ? `<span class="volume-change ${changeClass}">${changeText}</span>` : ''}
      </div>
    `;
  }).join('');
}
