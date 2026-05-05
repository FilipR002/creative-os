// ─── Background Layer Utilities for HTML/Puppeteer Templates ─────────────────
//
// Shared helpers that inject creative backgrounds into flat-coloured templates.
// Every function returns an HTML string (an absolutely-positioned div or inline
// SVG) that can be dropped inside any `.frame` div without touching content flow.
//
// Technique map:
//   glowLayer()     — blurred radial sphere  → trust / testimonial / manifesto
//   cornerArc()     — Canva quarter-circle   → minimal / clean / SaaS
//   dotGridLayer()  — repeating dot grid     → structured / editorial / proof
//   heatRadialBg()  — CSS urgency radial     → countdown / CTA / flash sale
//   circleBleed()   — off-screen big circle  → energetic / hook / bold
//   diagonalLayer() — hard clip-path split   → split-layout / announcement
//   burstSvg()      — spiky SVG starburst    → hype / badge / launch / retro

// ── 1. Radial Glow Sphere ─────────────────────────────────────────────────────

export function glowLayer(
  accent:   string,
  position: 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left',
  w:        number,
  h:        number,
  opacity   = 0.18,
  sizeRatio = 0.75,
): string {
  const r    = Math.round(Math.max(w, h) * sizeRatio);
  const blur = Math.round(r * 0.45);

  const posMap: Record<string, string> = {
    'center':       `top:50%;left:50%;transform:translate(-50%,-50%);`,
    'top-right':    `top:-${Math.round(r * 0.3)}px;left:${Math.round(w * 0.55)}px;`,
    'top-left':     `top:-${Math.round(r * 0.3)}px;left:-${Math.round(r * 0.25)}px;`,
    'bottom-left':  `top:${Math.round(h * 0.5)}px;left:-${Math.round(r * 0.25)}px;`,
    'bottom-right': `top:${Math.round(h * 0.5)}px;left:${Math.round(w * 0.5)}px;`,
  };

  return (
    `<div style="position:absolute;width:${r}px;height:${r}px;border-radius:50%;` +
    `background:${accent};opacity:${opacity};filter:blur(${blur}px);` +
    `${posMap[position] ?? posMap['center']}pointer-events:none;z-index:0;"></div>`
  );
}

// ── 2. Corner Quarter-Circle Arc ──────────────────────────────────────────────

export function cornerArc(
  accent:  string,
  corner:  'top-right' | 'top-left' | 'bottom-right' | 'bottom-left',
  w:       number,
  h:       number,
  opacity  = 0.12,
  sizeRatio = 0.42,
): string {
  const r = Math.round(Math.min(w, h) * sizeRatio);

  // Only the OPPOSITE corner gets border-radius:100% → produces a quarter circle
  const radii: Record<string, string> = {
    'top-right':    '0 0 0 100%',
    'top-left':     '0 0 100% 0',
    'bottom-right': '100% 0 0 0',
    'bottom-left':  '0 100% 0 0',
  };
  const pos: Record<string, string> = {
    'top-right':    'top:0;right:0;',
    'top-left':     'top:0;left:0;',
    'bottom-right': 'bottom:0;right:0;',
    'bottom-left':  'bottom:0;left:0;',
  };

  return (
    `<div style="position:absolute;width:${r}px;height:${r}px;` +
    `background:${accent};border-radius:${radii[corner]};opacity:${opacity};` +
    `${pos[corner]}pointer-events:none;z-index:0;"></div>`
  );
}

// ── 3. Dot Grid Layer ─────────────────────────────────────────────────────────

export function dotGridLayer(
  accent:  string,
  w:       number,
  opacity  = 0.07,
): string {
  const spacing = Math.round(w * 0.048);
  const dotSize = Math.max(1, Math.round(spacing * 0.14));
  const hex     = Math.round(opacity * 255).toString(16).padStart(2, '0');

  return (
    `<div style="position:absolute;inset:0;` +
    `background-image:radial-gradient(circle,${accent}${hex} ${dotSize}px,transparent ${dotSize}px);` +
    `background-size:${spacing}px ${spacing}px;pointer-events:none;z-index:0;"></div>`
  );
}

// ── 4. Heat Radial Background (CSS string — inject into `background` property) ─

export function heatRadialBg(accent: string, w: number): string {
  const spread = Math.round(w * 0.65);
  return (
    `radial-gradient(ellipse ${spread}px ${Math.round(spread * 0.6)}px at 50% 28%,` +
    `${accent}30 0%,transparent 70%)`
  );
}

// ── 5. Off-Screen Circle Bleed ────────────────────────────────────────────────

export function circleBleed(
  accent:    string,
  anchor:    'top-right' | 'top-left' | 'bottom-right' | 'bottom-left',
  w:         number,
  h:         number,
  opacity    = 0.13,
  sizeRatio  = 0.80,
): string {
  const r   = Math.round(Math.max(w, h) * sizeRatio);
  const off = Math.round(r * 0.45);

  const pos: Record<string, string> = {
    'top-right':    `top:-${off}px;right:-${off}px;`,
    'top-left':     `top:-${off}px;left:-${off}px;`,
    'bottom-right': `bottom:-${off}px;right:-${off}px;`,
    'bottom-left':  `bottom:-${off}px;left:-${off}px;`,
  };

  return (
    `<div style="position:absolute;width:${r}px;height:${r}px;border-radius:50%;` +
    `background:${accent};opacity:${opacity};${pos[anchor]}pointer-events:none;z-index:0;"></div>`
  );
}

// ── 6. Diagonal Hard-Colour Split ─────────────────────────────────────────────

export function diagonalLayer(
  color:     string,
  w:         number,
  h:         number,
  direction: 'tl-br' | 'tr-bl' = 'tl-br',
  splitRatio = 0.52,
): string {
  const sh = Math.round(h * splitRatio);
  const sw = Math.round(sh * 0.72);  // shear offset on the short axis
  const clip = direction === 'tl-br'
    ? `polygon(0 0,${w}px 0,${w}px ${sw}px,0 ${sh}px)`
    : `polygon(0 0,${w}px 0,${w}px ${sh}px,0 ${sw}px)`;

  return (
    `<div style="position:absolute;inset:0;background:${color};` +
    `clip-path:${clip};pointer-events:none;z-index:0;"></div>`
  );
}

// ── 7. SVG Starburst ─────────────────────────────────────────────────────────

export function burstSvg(
  accent:  string,
  anchor:  'top-right' | 'top-left' | 'bottom-right' | 'bottom-left',
  w:       number,
  h:       number,
  opacity  = 0.11,
  spikes   = 10,
  sizeRatio = 0.30,
): string {
  const size    = Math.round(Math.min(w, h) * sizeRatio);
  const cx      = size / 2;
  const outerR  = cx;
  const innerR  = cx * 0.52;
  const off     = Math.round(size * 0.22);

  let pts = '';
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    const r     = i % 2 === 0 ? outerR : innerR;
    const x     = cx + r * Math.cos(angle);
    const y     = cx + r * Math.sin(angle);
    pts += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  }
  pts += 'Z';

  const pos: Record<string, string> = {
    'top-right':    `top:-${off}px;right:-${off}px;`,
    'top-left':     `top:-${off}px;left:-${off}px;`,
    'bottom-right': `bottom:-${off}px;right:-${off}px;`,
    'bottom-left':  `bottom:-${off}px;left:-${off}px;`,
  };

  return (
    `<div style="position:absolute;${pos[anchor]}pointer-events:none;z-index:0;opacity:${opacity};">` +
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="${pts}" fill="${accent}"/>` +
    `</svg></div>`
  );
}
