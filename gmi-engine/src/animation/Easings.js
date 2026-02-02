/**
 * Easing Functions Library
 *
 * Standard easing functions for animation interpolation.
 * All functions take t (0-1) and return eased value (0-1).
 *
 * Naming convention follows CSS/AE standards:
 * - easeIn: Starts slow, ends fast
 * - easeOut: Starts fast, ends slow
 * - easeInOut: Slow at both ends
 */

export const Easings = {
  // ============= LINEAR =============
  linear: t => t,

  // ============= QUADRATIC =============
  easeInQuad: t => t * t,
  easeOutQuad: t => 1 - (1 - t) * (1 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

  // ============= CUBIC =============
  easeInCubic: t => t * t * t,
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  // ============= QUARTIC =============
  easeInQuart: t => t * t * t * t,
  easeOutQuart: t => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,

  // ============= SINE =============
  easeInSine: t => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: t => Math.sin((t * Math.PI) / 2),
  easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,

  // ============= EXPONENTIAL =============
  easeInExpo: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: t => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },

  // ============= CIRCULAR =============
  easeInCirc: t => 1 - Math.sqrt(1 - Math.pow(t, 2)),
  easeOutCirc: t => Math.sqrt(1 - Math.pow(t - 1, 2)),
  easeInOutCirc: t => t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,

  // ============= BACK (Overshoot) =============
  easeInBack: t => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: t => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: t => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // ============= ELASTIC =============
  easeInElastic: t => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeOutElastic: t => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutElastic: t => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c5 = (2 * Math.PI) / 4.5;
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },

  // ============= BOUNCE =============
  easeInBounce: t => 1 - Easings.easeOutBounce(1 - t),
  easeOutBounce: t => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  easeInOutBounce: t => t < 0.5
    ? (1 - Easings.easeOutBounce(1 - 2 * t)) / 2
    : (1 + Easings.easeOutBounce(2 * t - 1)) / 2,

  // ============= ALIASES (AE-friendly names) =============
  // These match common After Effects naming conventions
  ease: t => Easings.easeInOutQuad(t),        // Default "ease"
  easeIn: t => Easings.easeInQuad(t),
  easeOut: t => Easings.easeOutQuad(t),
  easeInOut: t => Easings.easeInOutQuad(t),

  /**
   * Get easing function by name
   * @param {string} name - Easing name (e.g., "easeInOut", "bounce")
   * @returns {Function} Easing function, defaults to linear
   */
  get(name) {
    return this[name] || this.linear;
  },

  /**
   * List all available easing names
   * @returns {string[]} Array of easing names
   */
  list() {
    return Object.keys(this).filter(k => typeof this[k] === 'function' && k !== 'get' && k !== 'list');
  },

  /**
   * Grouped easings for UI dropdowns
   */
  groups: {
    'Basic': ['linear', 'ease', 'easeIn', 'easeOut', 'easeInOut'],
    'Quad': ['easeInQuad', 'easeOutQuad', 'easeInOutQuad'],
    'Cubic': ['easeInCubic', 'easeOutCubic', 'easeInOutCubic'],
    'Sine': ['easeInSine', 'easeOutSine', 'easeInOutSine'],
    'Expo': ['easeInExpo', 'easeOutExpo', 'easeInOutExpo'],
    'Back': ['easeInBack', 'easeOutBack', 'easeInOutBack'],
    'Elastic': ['easeInElastic', 'easeOutElastic', 'easeInOutElastic'],
    'Bounce': ['easeInBounce', 'easeOutBounce', 'easeInOutBounce']
  }
};
