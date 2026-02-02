/**
 * Animation Presets
 *
 * Pre-built animation templates that can be applied to obstacles.
 * Values are RELATIVE to the obstacle's base position.
 *
 * Categories:
 * - Movement: Slide, circle, figure-8
 * - Rotation: Spin, pendulum, wobble
 * - Scale: Pulse, bounce, squeeze
 * - Combined: Complex multi-property animations
 */

export const Presets = {
  // ============= MOVEMENT =============

  slideLeftRight: {
    name: 'Slide Left-Right',
    category: 'Movement',
    duration: 2000,
    loop: 'pingpong',
    tracks: {
      x: {
        keyframes: [
          { time: 0, value: -50, easing: 'easeInOutQuad' },
          { time: 2000, value: 50, easing: 'easeInOutQuad' }
        ]
      }
    }
  },

  slideUpDown: {
    name: 'Slide Up-Down',
    category: 'Movement',
    duration: 2000,
    loop: 'pingpong',
    tracks: {
      y: {
        keyframes: [
          { time: 0, value: -50, easing: 'easeInOutQuad' },
          { time: 2000, value: 50, easing: 'easeInOutQuad' }
        ]
      }
    }
  },

  slideDiagonal: {
    name: 'Slide Diagonal',
    category: 'Movement',
    duration: 2000,
    loop: 'pingpong',
    tracks: {
      x: {
        keyframes: [
          { time: 0, value: -40, easing: 'easeInOutQuad' },
          { time: 2000, value: 40, easing: 'easeInOutQuad' }
        ]
      },
      y: {
        keyframes: [
          { time: 0, value: -40, easing: 'easeInOutQuad' },
          { time: 2000, value: 40, easing: 'easeInOutQuad' }
        ]
      }
    }
  },

  circlePath: {
    name: 'Circle Path',
    category: 'Movement',
    duration: 3000,
    loop: 'loop',
    tracks: {
      // Circular motion using sin/cos approximation with keyframes
      x: {
        keyframes: [
          { time: 0, value: 50, easing: 'easeInOutSine' },
          { time: 750, value: 0, easing: 'easeInOutSine' },
          { time: 1500, value: -50, easing: 'easeInOutSine' },
          { time: 2250, value: 0, easing: 'easeInOutSine' },
          { time: 3000, value: 50, easing: 'easeInOutSine' }
        ]
      },
      y: {
        keyframes: [
          { time: 0, value: 0, easing: 'easeInOutSine' },
          { time: 750, value: -50, easing: 'easeInOutSine' },
          { time: 1500, value: 0, easing: 'easeInOutSine' },
          { time: 2250, value: 50, easing: 'easeInOutSine' },
          { time: 3000, value: 0, easing: 'easeInOutSine' }
        ]
      }
    }
  },

  figure8: {
    name: 'Figure-8 Path',
    category: 'Movement',
    duration: 4000,
    loop: 'loop',
    tracks: {
      x: {
        keyframes: [
          { time: 0, value: 0, easing: 'easeInOutSine' },
          { time: 1000, value: 40, easing: 'easeInOutSine' },
          { time: 2000, value: 0, easing: 'easeInOutSine' },
          { time: 3000, value: -40, easing: 'easeInOutSine' },
          { time: 4000, value: 0, easing: 'easeInOutSine' }
        ]
      },
      y: {
        keyframes: [
          { time: 0, value: -30, easing: 'easeInOutSine' },
          { time: 1000, value: 0, easing: 'easeInOutSine' },
          { time: 2000, value: 30, easing: 'easeInOutSine' },
          { time: 3000, value: 0, easing: 'easeInOutSine' },
          { time: 4000, value: -30, easing: 'easeInOutSine' }
        ]
      }
    }
  },

  // ============= ROTATION =============

  spinCW: {
    name: 'Spin Clockwise',
    category: 'Rotation',
    duration: 2000,
    loop: 'loop',
    tracks: {
      rotation: {
        keyframes: [
          { time: 0, value: 0, easing: 'linear' },
          { time: 2000, value: 360, easing: 'linear' }
        ]
      }
    }
  },

  spinCCW: {
    name: 'Spin Counter-Clockwise',
    category: 'Rotation',
    duration: 2000,
    loop: 'loop',
    tracks: {
      rotation: {
        keyframes: [
          { time: 0, value: 0, easing: 'linear' },
          { time: 2000, value: -360, easing: 'linear' }
        ]
      }
    }
  },

  spinFast: {
    name: 'Spin Fast',
    category: 'Rotation',
    duration: 500,
    loop: 'loop',
    tracks: {
      rotation: {
        keyframes: [
          { time: 0, value: 0, easing: 'linear' },
          { time: 500, value: 360, easing: 'linear' }
        ]
      }
    }
  },

  pendulum: {
    name: 'Pendulum Swing',
    category: 'Rotation',
    duration: 1500,
    loop: 'pingpong',
    tracks: {
      rotation: {
        keyframes: [
          { time: 0, value: -45, easing: 'easeInOutSine' },
          { time: 1500, value: 45, easing: 'easeInOutSine' }
        ]
      }
    }
  },

  wobble: {
    name: 'Wobble',
    category: 'Rotation',
    duration: 500,
    loop: 'loop',
    tracks: {
      rotation: {
        keyframes: [
          { time: 0, value: 0, easing: 'easeInOutQuad' },
          { time: 125, value: 10, easing: 'easeInOutQuad' },
          { time: 250, value: 0, easing: 'easeInOutQuad' },
          { time: 375, value: -10, easing: 'easeInOutQuad' },
          { time: 500, value: 0, easing: 'easeInOutQuad' }
        ]
      }
    }
  },

  // ============= SCALE =============

  pulse: {
    name: 'Pulse',
    category: 'Scale',
    duration: 1000,
    loop: 'loop',
    tracks: {
      scaleX: {
        keyframes: [
          { time: 0, value: 1, easing: 'easeInOutSine' },
          { time: 500, value: 1.2, easing: 'easeInOutSine' },
          { time: 1000, value: 1, easing: 'easeInOutSine' }
        ]
      },
      scaleY: {
        keyframes: [
          { time: 0, value: 1, easing: 'easeInOutSine' },
          { time: 500, value: 1.2, easing: 'easeInOutSine' },
          { time: 1000, value: 1, easing: 'easeInOutSine' }
        ]
      }
    }
  },

  heartbeat: {
    name: 'Heartbeat',
    category: 'Scale',
    duration: 1000,
    loop: 'loop',
    tracks: {
      scaleX: {
        keyframes: [
          { time: 0, value: 1, easing: 'easeOutQuad' },
          { time: 150, value: 1.15, easing: 'easeInQuad' },
          { time: 300, value: 1, easing: 'easeOutQuad' },
          { time: 450, value: 1.1, easing: 'easeInQuad' },
          { time: 600, value: 1, easing: 'linear' },
          { time: 1000, value: 1, easing: 'linear' }
        ]
      },
      scaleY: {
        keyframes: [
          { time: 0, value: 1, easing: 'easeOutQuad' },
          { time: 150, value: 1.15, easing: 'easeInQuad' },
          { time: 300, value: 1, easing: 'easeOutQuad' },
          { time: 450, value: 1.1, easing: 'easeInQuad' },
          { time: 600, value: 1, easing: 'linear' },
          { time: 1000, value: 1, easing: 'linear' }
        ]
      }
    }
  },

  bounceIn: {
    name: 'Bounce In',
    category: 'Scale',
    duration: 1000,
    loop: 'none',
    tracks: {
      scaleX: {
        keyframes: [
          { time: 0, value: 0, easing: 'easeOutBounce' },
          { time: 1000, value: 1, easing: 'linear' }
        ]
      },
      scaleY: {
        keyframes: [
          { time: 0, value: 0, easing: 'easeOutBounce' },
          { time: 1000, value: 1, easing: 'linear' }
        ]
      }
    }
  },

  squeeze: {
    name: 'Squeeze (Squash & Stretch)',
    category: 'Scale',
    duration: 800,
    loop: 'pingpong',
    tracks: {
      scaleX: {
        keyframes: [
          { time: 0, value: 1, easing: 'easeInOutQuad' },
          { time: 400, value: 1.3, easing: 'easeInOutQuad' },
          { time: 800, value: 1, easing: 'easeInOutQuad' }
        ]
      },
      scaleY: {
        keyframes: [
          { time: 0, value: 1, easing: 'easeInOutQuad' },
          { time: 400, value: 0.7, easing: 'easeInOutQuad' },
          { time: 800, value: 1, easing: 'easeInOutQuad' }
        ]
      }
    }
  },

  breathe: {
    name: 'Breathe',
    category: 'Scale',
    duration: 3000,
    loop: 'loop',
    tracks: {
      scaleX: {
        keyframes: [
          { time: 0, value: 1, easing: 'easeInOutSine' },
          { time: 1500, value: 1.1, easing: 'easeInOutSine' },
          { time: 3000, value: 1, easing: 'easeInOutSine' }
        ]
      },
      scaleY: {
        keyframes: [
          { time: 0, value: 1, easing: 'easeInOutSine' },
          { time: 1500, value: 1.1, easing: 'easeInOutSine' },
          { time: 3000, value: 1, easing: 'easeInOutSine' }
        ]
      }
    }
  },

  // ============= COMBINED =============

  floating: {
    name: 'Floating',
    category: 'Combined',
    duration: 3000,
    loop: 'loop',
    tracks: {
      y: {
        keyframes: [
          { time: 0, value: 0, easing: 'easeInOutSine' },
          { time: 1500, value: -20, easing: 'easeInOutSine' },
          { time: 3000, value: 0, easing: 'easeInOutSine' }
        ]
      },
      rotation: {
        keyframes: [
          { time: 0, value: -3, easing: 'easeInOutSine' },
          { time: 1500, value: 3, easing: 'easeInOutSine' },
          { time: 3000, value: -3, easing: 'easeInOutSine' }
        ]
      }
    }
  },

  orbiting: {
    name: 'Orbiting',
    category: 'Combined',
    duration: 4000,
    loop: 'loop',
    tracks: {
      x: {
        keyframes: [
          { time: 0, value: 60, easing: 'linear' },
          { time: 1000, value: 0, easing: 'linear' },
          { time: 2000, value: -60, easing: 'linear' },
          { time: 3000, value: 0, easing: 'linear' },
          { time: 4000, value: 60, easing: 'linear' }
        ]
      },
      y: {
        keyframes: [
          { time: 0, value: 0, easing: 'linear' },
          { time: 1000, value: -60, easing: 'linear' },
          { time: 2000, value: 0, easing: 'linear' },
          { time: 3000, value: 60, easing: 'linear' },
          { time: 4000, value: 0, easing: 'linear' }
        ]
      },
      rotation: {
        keyframes: [
          { time: 0, value: 0, easing: 'linear' },
          { time: 4000, value: 360, easing: 'linear' }
        ]
      }
    }
  },

  bouncing: {
    name: 'Bouncing Ball',
    category: 'Combined',
    duration: 1000,
    loop: 'loop',
    tracks: {
      y: {
        keyframes: [
          { time: 0, value: 0, easing: 'easeInQuad' },
          { time: 500, value: 50, easing: 'easeOutQuad' },
          { time: 1000, value: 0, easing: 'easeInQuad' }
        ]
      },
      scaleX: {
        keyframes: [
          { time: 0, value: 1, easing: 'linear' },
          { time: 450, value: 1, easing: 'linear' },
          { time: 500, value: 1.2, easing: 'easeOutQuad' },
          { time: 550, value: 1, easing: 'linear' },
          { time: 1000, value: 1, easing: 'linear' }
        ]
      },
      scaleY: {
        keyframes: [
          { time: 0, value: 1, easing: 'linear' },
          { time: 450, value: 1, easing: 'linear' },
          { time: 500, value: 0.8, easing: 'easeOutQuad' },
          { time: 550, value: 1, easing: 'linear' },
          { time: 1000, value: 1, easing: 'linear' }
        ]
      }
    }
  },

  jitter: {
    name: 'Jitter/Shake',
    category: 'Combined',
    duration: 500,
    loop: 'loop',
    tracks: {
      x: {
        keyframes: [
          { time: 0, value: 0, easing: 'linear' },
          { time: 50, value: 3, easing: 'linear' },
          { time: 100, value: -3, easing: 'linear' },
          { time: 150, value: 2, easing: 'linear' },
          { time: 200, value: -2, easing: 'linear' },
          { time: 250, value: 3, easing: 'linear' },
          { time: 300, value: -3, easing: 'linear' },
          { time: 350, value: 1, easing: 'linear' },
          { time: 400, value: -1, easing: 'linear' },
          { time: 500, value: 0, easing: 'linear' }
        ]
      },
      y: {
        keyframes: [
          { time: 0, value: 0, easing: 'linear' },
          { time: 50, value: -2, easing: 'linear' },
          { time: 100, value: 2, easing: 'linear' },
          { time: 150, value: -3, easing: 'linear' },
          { time: 200, value: 1, easing: 'linear' },
          { time: 250, value: -1, easing: 'linear' },
          { time: 300, value: 2, easing: 'linear' },
          { time: 350, value: -2, easing: 'linear' },
          { time: 400, value: 1, easing: 'linear' },
          { time: 500, value: 0, easing: 'linear' }
        ]
      }
    }
  }
};

/**
 * Get preset by key
 * @param {string} key - Preset key
 * @returns {Object|null} Preset data or null
 */
export function getPreset(key) {
  return Presets[key] ? { ...Presets[key] } : null;
}

/**
 * Apply a preset to an obstacle (creates animation data)
 * @param {string} presetKey - Preset key
 * @param {string} obstacleId - Obstacle ID
 * @param {Object} options - Override options { duration, loop }
 * @returns {Object|null} Animation data for this obstacle
 */
export function applyPreset(presetKey, obstacleId, options = {}) {
  const preset = getPreset(presetKey);
  if (!preset) return null;

  return {
    obstacleId,
    duration: options.duration || preset.duration,
    loop: options.loop || preset.loop,
    loopCount: options.loopCount || 0,
    tracks: JSON.parse(JSON.stringify(preset.tracks)) // Deep copy tracks
  };
}

/**
 * List all presets grouped by category
 * @returns {Object} { category: [{ key, name }] }
 */
export function listPresetsByCategory() {
  const groups = {};

  for (const [key, preset] of Object.entries(Presets)) {
    const category = preset.category || 'Other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push({
      key,
      name: preset.name,
      duration: preset.duration,
      loop: preset.loop
    });
  }

  return groups;
}

/**
 * List all preset keys
 * @returns {string[]}
 */
export function listPresetKeys() {
  return Object.keys(Presets);
}
