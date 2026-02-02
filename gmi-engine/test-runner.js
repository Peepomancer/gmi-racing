/**
 * Automated Test Runner for GMI Racing Engine
 *
 * Runs headless simulations and validates results.
 * Usage: npm run test:refactor
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  simCount: 16,
  chainType: 'mixed',
  speed: 4,
  port: 3001,
  timeout: 180000, // 3 minutes max
};

// Pass/Fail Criteria
// Note: Win rate bounds are very wide (5-45%) because 16 sims has HIGH variance
// For balance testing, run 50+ simulations manually
// For refactoring tests, we mainly care about completion rate and timeouts
const PASS_CRITERIA = {
  completionRate: 1.0,      // 100% chains must complete
  maxTimeouts: 0,           // Zero race timeouts allowed
  maxStuckPushes: 10,       // Reasonable stuck interventions
  winRateMin: 0.05,         // No ball below 5% win rate (very lenient)
  winRateMax: 0.45,         // No ball above 45% win rate (very lenient)
};

async function runTests() {
  console.log('='.repeat(60));
  console.log('GMI Racing Engine - Automated Test Runner');
  console.log('='.repeat(60));
  console.log(`Config: ${CONFIG.simCount} sims, ${CONFIG.chainType} chain, ${CONFIG.speed}x speed`);
  console.log('');

  let browser;
  try {
    // Launch headless browser
    console.log('Launching headless browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set up console logging from page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[Browser Error] ${msg.text()}`);
      }
    });

    // Navigate to multi-sim page
    const url = `http://localhost:${CONFIG.port}/multi-sim.html`;
    console.log(`Navigating to ${url}...`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded.');

    // Configure simulation
    console.log('Configuring simulation...');
    await page.waitForSelector('#chain-select option[value="mixed"]', { timeout: 10000 });
    await page.select('#sim-count', CONFIG.simCount.toString());
    await page.select('#chain-select', CONFIG.chainType);
    await page.select('#sim-speed', CONFIG.speed.toString());

    // Start simulations
    console.log('Starting simulations...');
    await page.click('#btn-start');

    // Wait for completion
    console.log('Waiting for completion (this may take a while)...');
    const startTime = Date.now();

    await page.waitForFunction(
      (simCount) => {
        // Check if all sims are complete by looking at the progress text
        const progressText = document.querySelector('#progress-text')?.textContent || '';
        const match = progressText.match(/(\d+)\s*\/\s*(\d+)/);
        if (match) {
          const completed = parseInt(match[1]);
          const total = parseInt(match[2]);
          return completed === total && total === simCount;
        }
        return false;
      },
      { timeout: CONFIG.timeout, polling: 1000 },
      CONFIG.simCount
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Simulations completed in ${duration}s`);

    // Extract results
    console.log('Extracting results...');
    const results = await page.evaluate(() => {
      // Get win rates from the multiSim stats object
      const winRates = {};
      const balls = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];

      if (window.multiSim && window.multiSim.stats) {
        const stats = window.multiSim.stats;
        const totalChains = stats.chainWins.Red + stats.chainWins.Blue +
                           stats.chainWins.Green + stats.chainWins.Yellow + stats.chainWins.Purple;

        balls.forEach(ball => {
          winRates[ball] = totalChains > 0 ? stats.chainWins[ball] / totalChains : 0;
        });
      }

      // Get completion status
      const progress = document.querySelector('#progress-text')?.textContent || '';
      const completionMatch = progress.match(/(\d+)\s*\/\s*(\d+)/);
      const completed = completionMatch ? parseInt(completionMatch[1]) : 0;
      const total = completionMatch ? parseInt(completionMatch[2]) : 0;

      return {
        completed,
        total,
        completionRate: total > 0 ? completed / total : 0,
        winRates
      };
    });

    // Click export to get detailed diagnostics
    await page.click('#btn-export');
    await new Promise(r => setTimeout(r, 500));

    // Get diagnostics from multiSim manager
    const diagnostics = await page.evaluate(() => {
      if (window.multiSim && window.multiSim.stats && window.multiSim.stats.diagnostics) {
        return window.multiSim.stats.diagnostics;
      }
      return { raceTimeouts: 0, stuckPushes: 0, outOfBoundsRespawns: 0 };
    });

    // Validate results
    console.log('');
    console.log('='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));

    const failures = [];

    // Check completion rate
    const completionPass = results.completionRate >= PASS_CRITERIA.completionRate;
    console.log(`Completion Rate: ${(results.completionRate * 100).toFixed(1)}% ${completionPass ? '✓' : '✗'}`);
    if (!completionPass) failures.push(`Completion rate ${(results.completionRate * 100).toFixed(1)}% < required ${PASS_CRITERIA.completionRate * 100}%`);

    // Check timeouts
    const timeouts = diagnostics.raceTimeouts || 0;
    const timeoutPass = timeouts <= PASS_CRITERIA.maxTimeouts;
    console.log(`Race Timeouts: ${timeouts} ${timeoutPass ? '✓' : '✗'}`);
    if (!timeoutPass) failures.push(`Race timeouts ${timeouts} > max ${PASS_CRITERIA.maxTimeouts}`);

    // Check stuck pushes
    const stuckPushes = diagnostics.stuckPushes || 0;
    const stuckPass = stuckPushes <= PASS_CRITERIA.maxStuckPushes;
    console.log(`Stuck Pushes: ${stuckPushes} ${stuckPass ? '✓' : '✗'}`);
    if (!stuckPass) failures.push(`Stuck pushes ${stuckPushes} > max ${PASS_CRITERIA.maxStuckPushes}`);

    // Check win rate balance
    console.log('');
    console.log('Win Rates:');
    let winRatePass = true;
    Object.entries(results.winRates).forEach(([ball, rate]) => {
      const pass = rate >= PASS_CRITERIA.winRateMin && rate <= PASS_CRITERIA.winRateMax;
      console.log(`  ${ball}: ${(rate * 100).toFixed(1)}% ${pass ? '✓' : '✗'}`);
      if (!pass) {
        winRatePass = false;
        failures.push(`${ball} win rate ${(rate * 100).toFixed(1)}% outside range ${PASS_CRITERIA.winRateMin * 100}-${PASS_CRITERIA.winRateMax * 100}%`);
      }
    });

    // Final verdict
    console.log('');
    console.log('='.repeat(60));

    const allPass = failures.length === 0;
    if (allPass) {
      console.log('RESULT: ✓ ALL TESTS PASSED');
      console.log('='.repeat(60));
    } else {
      console.log('RESULT: ✗ TESTS FAILED');
      console.log('');
      console.log('Failures:');
      failures.forEach(f => console.log(`  - ${f}`));
      console.log('='.repeat(60));
    }

    // Save results to file
    const resultsPath = path.join(__dirname, 'test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      config: CONFIG,
      criteria: PASS_CRITERIA,
      results: {
        completionRate: results.completionRate,
        winRates: results.winRates,
        timeouts,
        stuckPushes
      },
      passed: allPass,
      failures
    }, null, 2));
    console.log(`Results saved to: ${resultsPath}`);

    await browser.close();
    process.exit(allPass ? 0 : 1);

  } catch (error) {
    console.error('Test runner error:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests, CONFIG, PASS_CRITERIA };
