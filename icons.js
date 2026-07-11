/**
 * Lightweight SVG icon helper — references symbols in #icon-sprite.
 * @param {string} name - Symbol id suffix (e.g. "wallet" → #icon-wallet)
 * @param {{ size?: number, className?: string }} [opts]
 * @returns {string}
 */
function icon(name, { size = 18, className = 'icon' } = {}) {
  const classes = className ? ` class="${className}"` : '';
  return `<svg${classes} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
}

/**
 * @param {string} name
 * @param {'purple'|'teal'} [tint]
 * @returns {string}
 */
function iconChip(name, tint = 'purple') {
  return `<span class="icon-chip icon-chip--${tint}" aria-hidden="true">${icon(name)}</span>`;
}
