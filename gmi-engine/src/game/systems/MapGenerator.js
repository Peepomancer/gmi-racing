import { createNoise2D } from 'simplex-noise';

export class MapGenerator {
  constructor(scene, width, height) {
    this.scene = scene;
    this.width = width || 800;
    this.height = height || 600;
  }

  generate(mapConfig) {
    const { noiseScale, platformDensity, seed } = mapConfig;

    console.log('MapGenerator: generating Ball Chaos style map, seed =', seed);

    // Create seeded random
    const random = this.seededRandom(seed);

    const width = this.width;
    const height = this.height;

    const obstacles = [];

    // Define zones
    const finishY = 60;  // Finish line near top
    const spawnY = height - 80;  // Spawn near bottom
    const raceZoneTop = finishY + 50;
    const raceZoneBottom = spawnY - 30;
    const raceHeight = raceZoneBottom - raceZoneTop;

    // Number of rows of obstacles
    const numRows = Math.floor(5 + platformDensity * 5);
    const rowHeight = raceHeight / (numRows + 1);

    // Create obstacles in each row
    for (let row = 0; row < numRows; row++) {
      const y = raceZoneTop + rowHeight * (row + 0.5);

      // Alternate between different obstacle patterns
      const pattern = row % 4;

      switch (pattern) {
        case 0:
          // Side obstacles - leave middle open
          this.addSideObstacles(obstacles, y, width, random);
          break;
        case 1:
          // Center obstacle
          this.addCenterObstacle(obstacles, y, width, random);
          break;
        case 2:
          // Staggered obstacles
          this.addStaggeredObstacles(obstacles, y, width, random, row);
          break;
        case 3:
          // Multiple small obstacles
          this.addScatteredObstacles(obstacles, y, width, random);
          break;
      }
    }

    // Add some diagonal deflectors based on noise
    const noise2D = createNoise2D(() => random());
    this.addNoiseBasedObstacles(obstacles, noise2D, noiseScale, raceZoneTop, raceZoneBottom, width, random);

    // Lane dividers (thin vertical walls)
    const numLanes = 5;
    const laneWidth = (width - 20) / numLanes;
    for (let i = 1; i < numLanes; i++) {
      const x = 10 + i * laneWidth;
      // Add partial lane dividers (not full height)
      const segments = 2 + Math.floor(random() * 2);
      for (let s = 0; s < segments; s++) {
        const segY = raceZoneTop + random() * raceHeight * 0.7;
        const segHeight = 40 + random() * 60;
        obstacles.push({
          x: x - 5,
          y: segY,
          width: 10,
          height: segHeight
        });
      }
    }

    console.log('Generated', obstacles.length, 'obstacles');

    return {
      obstacles,
      finishY,
      spawnY,
      lanes: numLanes
    };
  }

  addSideObstacles(obstacles, y, width, random) {
    const obstacleWidth = 60 + random() * 40;
    const obstacleHeight = 15 + random() * 10;

    // Left side
    obstacles.push({
      x: 10,
      y: y - obstacleHeight / 2,
      width: obstacleWidth,
      height: obstacleHeight
    });

    // Right side
    obstacles.push({
      x: width - 10 - obstacleWidth,
      y: y - obstacleHeight / 2,
      width: obstacleWidth,
      height: obstacleHeight
    });
  }

  addCenterObstacle(obstacles, y, width, random) {
    const obstacleWidth = 80 + random() * 60;
    const obstacleHeight = 15 + random() * 10;

    obstacles.push({
      x: (width - obstacleWidth) / 2,
      y: y - obstacleHeight / 2,
      width: obstacleWidth,
      height: obstacleHeight
    });
  }

  addStaggeredObstacles(obstacles, y, width, random, row) {
    const numObs = 3;
    const spacing = width / (numObs + 1);
    const offset = (row % 2 === 0) ? 0 : spacing / 2;

    for (let i = 0; i < numObs; i++) {
      const x = spacing * (i + 1) + offset - 25;
      if (x > 10 && x < width - 60) {
        obstacles.push({
          x: x,
          y: y - 10,
          width: 50,
          height: 20
        });
      }
    }
  }

  addScatteredObstacles(obstacles, y, width, random) {
    const numObs = 4 + Math.floor(random() * 3);

    for (let i = 0; i < numObs; i++) {
      const x = 30 + random() * (width - 80);
      const obsWidth = 20 + random() * 30;
      const obsHeight = 15 + random() * 10;

      obstacles.push({
        x: x,
        y: y - obsHeight / 2 + (random() - 0.5) * 20,
        width: obsWidth,
        height: obsHeight
      });
    }
  }

  addNoiseBasedObstacles(obstacles, noise2D, noiseScale, top, bottom, width, random) {
    // Add some obstacles based on noise for variety
    const numExtra = 5;

    for (let i = 0; i < numExtra; i++) {
      const x = 50 + random() * (width - 100);
      const y = top + random() * (bottom - top);

      const noiseVal = noise2D(x / noiseScale, y / noiseScale);

      if (noiseVal > 0.3) {
        // Add a small diagonal-ish obstacle
        obstacles.push({
          x: x,
          y: y,
          width: 30 + Math.abs(noiseVal) * 40,
          height: 12 + Math.abs(noiseVal) * 8
        });
      }
    }
  }

  seededRandom(seed) {
    let state = seed || 12345;
    return function() {
      state |= 0;
      state = state + 0x6D2B79F5 | 0;
      let t = Math.imul(state ^ state >>> 15, 1 | state);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
}
