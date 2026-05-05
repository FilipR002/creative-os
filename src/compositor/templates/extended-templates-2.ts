// ─── Extended Templates — Batch 2 (16–30) ─────────────────────────────────────
// 15 additional layouts expanding the library to 30 total.
// Covers: product-center, neon-dark, magazine-editorial, color-block,
// floating-card, countdown-urgency, social-proof-grid, headline-badge,
// side-by-side, diagonal-split, overlay-card, number-list, brand-manifesto,
// product-demo, retro-bold.

import type { CompositorInput, ParsedSize, FontPairing } from '../types/compositor.types';
import type { ColorPalette } from '../design/design-system';
import { getTypographyScale, getPadding } from '../design/design-system';
import { glowLayer, cornerArc, dotGridLayer, heatRadialBg, circleBleed, diagonalLayer, burstSvg } from './bg-layers';

// ── 16: Product Center ────────────────────────────────────────────────────────
// Product image is the hero — large, centered, clean surround.
// Best for: e-commerce, DTC product shots, app UI screenshots.

export function renderProductCenter(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo  = getTypographyScale(size, input.style.tone);
  const pad   = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;
  const imgH   = Math.round(size.height * 0.45);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:${pad.outer}px;}
    .top{width:100%;display:flex;align-items:center;justify-content:space-between;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
    .tag{background:${accent}18;color:${accent};font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:${Math.round(typo.eyebrow*0.3)}px ${Math.round(typo.eyebrow*0.9)}px;border-radius:99px;}
    .img-ring{width:${imgH}px;height:${imgH}px;border-radius:${Math.round(imgH*0.06)}px;background:#f0f0f0;overflow:hidden;box-shadow:0 ${Math.round(size.width*0.03)}px ${Math.round(size.width*0.08)}px rgba(0,0,0,0.12);flex-shrink:0;}
    .img-ring img{width:100%;height:100%;object-fit:cover;}
    .copy{width:100%;text-align:center;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.52)}px;font-weight:800;color:${palette.headline};line-height:1.1;letter-spacing:-0.02em;margin-bottom:${pad.gap}px;}
    .body{font-size:${Math.round(typo.body*0.8)}px;color:${palette.body};line-height:1.5;margin-bottom:${pad.gap}px;}
    .cta-row{display:flex;gap:${pad.gap}px;justify-content:center;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.88)}px;font-weight:700;padding:${Math.round(typo.cta*0.5)}px ${Math.round(typo.cta*1.6)}px;border-radius:${Math.round(typo.cta*0.45)}px;}
  </style></head><body><div class="frame">
    ${dotGridLayer(accent, size.width, 0.06)}
    ${glowLayer(accent, 'top-right', size.width, size.height, 0.12)}
    <div class="top">
      ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : '<div></div>'}
      ${copy.eyebrow ? `<div class="tag">${copy.eyebrow}</div>` : '<div></div>'}
    </div>
    ${imageUrl ? `<div class="img-ring"><img src="${imageUrl}" alt=""/></div>` : `<div class="img-ring" style="background:${accent}18;display:flex;align-items:center;justify-content:center;"><span style="font-size:${Math.round(imgH*0.3)}px;">📦</span></div>`}
    <div class="copy">
      <div class="headline">${copy.headline}</div>
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      ${copy.cta  ? `<div class="cta-row"><div class="cta">${copy.cta}</div></div>` : ''}
    </div>
  </div></body></html>`;
}

// ── 17: Neon Dark ─────────────────────────────────────────────────────────────
// Dark background with vivid neon glow accents. Gaming/tech/cyberpunk aesthetic.
// Best for: gaming brands, tech products, GenZ audience, high-energy events.

export function renderNeonDark(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo  = getTypographyScale(size, input.style.tone);
  const pad   = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const neon  = input.style.primaryColor ?? '#00f5d4';
  const neon2 = input.style.accentColor  ?? '#f72585';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:#050510;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.18;mix-blend-mode:screen;}` : ''}
    .scanlines{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.05) 2px,rgba(0,0,0,0.05) 4px);}
    .glow-top{position:absolute;top:-${Math.round(size.width*0.3)}px;left:50%;transform:translateX(-50%);width:${Math.round(size.width*0.8)}px;height:${Math.round(size.width*0.4)}px;border-radius:50%;background:${neon};opacity:0.12;filter:blur(${Math.round(size.width*0.06)}px);}
    .glow-bottom{position:absolute;bottom:-${Math.round(size.width*0.2)}px;left:20%;width:${Math.round(size.width*0.5)}px;height:${Math.round(size.width*0.3)}px;border-radius:50%;background:${neon2};opacity:0.1;filter:blur(${Math.round(size.width*0.05)}px);}
    .border-top{position:absolute;top:0;left:0;right:0;height:${Math.round(size.width*0.003)}px;background:linear-gradient(to right,transparent,${neon},transparent);}
    .border-bottom{position:absolute;bottom:0;left:0;right:0;height:${Math.round(size.width*0.003)}px;background:linear-gradient(to right,transparent,${neon2},transparent);}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:${neon};text-shadow:0 0 ${Math.round(typo.eyebrow*0.8)}px ${neon}88;margin-bottom:${pad.gap}px;position:relative;z-index:1;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.72)}px;font-weight:900;line-height:1.0;color:#fff;letter-spacing:-0.02em;margin-bottom:${pad.gap}px;position:relative;z-index:1;text-shadow:0 0 ${Math.round(typo.headline*0.5)}px rgba(255,255,255,0.15);}
    .headline em{color:${neon};font-style:normal;text-shadow:0 0 ${Math.round(typo.headline*0.4)}px ${neon}66;}
    .body{font-size:${Math.round(typo.body*0.85)}px;color:rgba(255,255,255,0.5);line-height:1.55;margin-bottom:${pad.inner}px;max-width:88%;position:relative;z-index:1;}
    .cta{display:inline-flex;align-items:center;gap:8px;border:1.5px solid ${neon};color:${neon};font-family:'${fonts.headline}',sans-serif;font-size:${typo.cta}px;font-weight:700;letter-spacing:0.08em;padding:${Math.round(typo.cta*0.55)}px ${Math.round(typo.cta*1.6)}px;border-radius:${Math.round(typo.cta*0.3)}px;text-shadow:0 0 8px ${neon}55;box-shadow:0 0 ${Math.round(typo.cta*0.8)}px ${neon}22;position:relative;z-index:1;}
    .brand{position:absolute;top:${pad.outer}px;right:${pad.outer}px;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${neon2};letter-spacing:0.1em;text-transform:uppercase;text-shadow:0 0 8px ${neon2}55;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="scanlines"></div>
    <div class="glow-top"></div>
    <div class="glow-bottom"></div>
    <div class="border-top"></div>
    <div class="border-bottom"></div>
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    ${copy.eyebrow ? `<div class="eyebrow">// ${copy.eyebrow}</div>` : ''}
    <div class="headline">${copy.headline}</div>
    ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
    ${copy.cta  ? `<div class="cta">${copy.cta} ▶</div>` : ''}
  </div></body></html>`;
}

// ── 18: Magazine Editorial ─────────────────────────────────────────────────────
// Serif typography, image bleed on left or right, refined column layout.
// Best for: lifestyle brands, premium fashion, editorial DTC, beauty.

export function renderMagazineEditorial(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const imgW   = Math.round(size.width * 0.44);
  const accent = input.style.primaryColor ?? palette.cta;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{width:${size.width}px;height:${size.height}px;display:flex;background:${palette.background};}
    .img-col{width:${imgW}px;height:100%;flex-shrink:0;overflow:hidden;}
    .img-col img{width:100%;height:100%;object-fit:cover;}
    .img-placeholder{width:100%;height:100%;background:${accent}18;display:flex;align-items:center;justify-content:center;font-size:${Math.round(imgW*0.2)}px;}
    .copy-col{flex:1;display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px ${pad.outer}px ${pad.outer}px ${Math.round(pad.outer*0.8)}px;}
    .issue-line{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.8)}px;font-weight:400;letter-spacing:0.2em;text-transform:uppercase;color:${palette.eyebrow};margin-bottom:${pad.gap}px;}
    .rule-top{width:100%;height:1px;background:${palette.headline};margin-bottom:${Math.round(pad.inner*0.7)}px;}
    .headline{font-family:'Playfair Display',serif;font-size:${Math.round(typo.headline*0.6)}px;font-weight:700;line-height:1.1;color:${palette.headline};margin-bottom:${Math.round(pad.inner*0.6)}px;}
    .headline em{color:${accent};font-style:italic;}
    .rule-mid{width:${Math.round(size.width*0.06)}px;height:${Math.round(size.width*0.004)}px;background:${accent};margin-bottom:${Math.round(pad.inner*0.6)}px;}
    .body{font-family:'Playfair Display',serif;font-size:${Math.round(typo.body*0.78)}px;font-weight:400;font-style:italic;line-height:1.65;color:${palette.body};margin-bottom:${pad.inner}px;}
    .cta{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*1.05)}px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${accent};display:flex;align-items:center;gap:8px;}
    .cta::after{content:'';display:block;flex:1;height:1px;background:${accent}55;}
    .brand{margin-top:auto;font-family:'Playfair Display',serif;font-size:${Math.round(typo.eyebrow*1.2)}px;font-weight:400;color:${palette.eyebrow};letter-spacing:0.2em;text-transform:uppercase;font-style:italic;}
  </style></head><body><div class="frame">
    ${dotGridLayer(accent, size.width, 0.05)}
    ${cornerArc(accent, 'bottom-right', size.width, size.height, 0.08, 0.35)}
    <div class="img-col">
      ${imageUrl ? `<img src="${imageUrl}" alt=""/>` : `<div class="img-placeholder">✦</div>`}
    </div>
    <div class="copy-col">
      ${copy.eyebrow ? `<div class="issue-line">${copy.eyebrow}</div>` : ''}
      <div class="rule-top"></div>
      <div class="headline">${copy.headline}</div>
      <div class="rule-mid"></div>
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      ${copy.cta  ? `<div class="cta">${copy.cta}</div>` : ''}
      ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    </div>
  </div></body></html>`;
}

// ── 19: Color Block ───────────────────────────────────────────────────────────
// Two-tone horizontal split — bold color on top, neutral on bottom.
// Best for: announcements, seasonal campaigns, bold brand moments.

export function renderColorBlock(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;
  const split  = Math.round(size.height * 0.45);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .top-block{position:absolute;top:0;left:0;right:0;height:${split}px;background:${accent};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad.outer}px;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:${split}px;object-fit:cover;opacity:0.25;mix-blend-mode:overlay;}` : ''}
    .bottom-block{position:absolute;bottom:0;left:0;right:0;height:${size.height - split}px;background:${palette.background};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad.outer}px;}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:${pad.gap}px;}
    .headline-top{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.65)}px;font-weight:900;line-height:1.0;color:#fff;text-align:center;letter-spacing:-0.02em;}
    .body{font-size:${Math.round(typo.body*0.85)}px;color:${palette.body};line-height:1.5;text-align:center;margin-bottom:${pad.inner}px;max-width:85%;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.9)}px;font-weight:700;padding:${Math.round(typo.cta*0.55)}px ${Math.round(typo.cta*1.7)}px;border-radius:${Math.round(typo.cta*0.45)}px;}
    .brand-bar{position:absolute;top:${pad.outer}px;left:50%;transform:translateX(-50%);font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.75)}px;font-weight:800;color:rgba(255,255,255,0.4);letter-spacing:0.15em;text-transform:uppercase;}
    .divider-label{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.4)}px;font-weight:900;color:${accent};text-align:center;margin-bottom:${pad.gap}px;letter-spacing:-0.01em;}
  </style></head><body><div class="frame">
    ${diagonalLayer(`${accent}cc`, size.width, size.height, 'tr-bl', 0.50)}
    <div class="top-block">
      ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
      ${circleBleed('#fff', 'top-right', size.width, size.height, 0.07, 0.60)}
      ${branding?.brandName ? `<div class="brand-bar">${branding.brandName}</div>` : ''}
      ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
      <div class="headline-top">${copy.headline}</div>
    </div>
    <div class="bottom-block">
      ${copy.subtext ? `<div class="divider-label">${copy.subtext}</div>` : ''}
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      ${copy.cta  ? `<div class="cta">${copy.cta}</div>` : ''}
    </div>
  </div></body></html>`;
}

// ── 20: Floating Card ─────────────────────────────────────────────────────────
// Copy lives in a raised white card floating over a tinted/image background.
// Best for: SaaS, app features, elegant promotions, DTC.

export function renderFloatingCard(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;
  const isDark = palette.background.startsWith('#0') || palette.background === '#000';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .bg-layer{position:absolute;inset:0;background:${isDark ? '#1a1a2e' : accent + '18'};overflow:hidden;}
    ${imageUrl ? `.bg-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${isDark ? '0.35' : '0.25'};}` : ''}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;display:flex;align-items:center;justify-content:center;padding:${pad.outer}px;}
    .card{background:#fff;border-radius:${Math.round(size.width*0.04)}px;padding:${Math.round(pad.outer*1.1)}px;box-shadow:0 ${Math.round(size.width*0.04)}px ${Math.round(size.width*0.1)}px rgba(0,0,0,0.18);width:100%;position:relative;z-index:1;}
    .card-eyebrow{display:inline-block;background:${accent}12;color:${accent};font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:${Math.round(typo.eyebrow*0.32)}px ${Math.round(typo.eyebrow*0.9)}px;border-radius:99px;margin-bottom:${pad.gap}px;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.52)}px;font-weight:800;color:#0a0a0a;line-height:1.1;letter-spacing:-0.02em;margin-bottom:${pad.gap}px;}
    .body{font-size:${Math.round(typo.body*0.82)}px;color:#555;line-height:1.6;margin-bottom:${pad.inner}px;}
    .card-footer{display:flex;align-items:center;justify-content:space-between;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:#0a0a0a;letter-spacing:0.08em;text-transform:uppercase;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.85)}px;font-weight:700;padding:${Math.round(typo.cta*0.48)}px ${Math.round(typo.cta*1.3)}px;border-radius:${Math.round(typo.cta*0.4)}px;}
  </style></head><body>
    <div class="bg-layer">
      ${imageUrl ? `<img class="bg-img" src="${imageUrl}" alt=""/>` : ''}
      ${glowLayer(accent, 'top-right', size.width, size.height, 0.18)}
      ${cornerArc(accent, 'bottom-left', size.width, size.height, 0.14, 0.45)}
    </div>
    <div class="frame">
      <div class="card">
        ${copy.eyebrow ? `<div class="card-eyebrow">${copy.eyebrow}</div>` : ''}
        <div class="headline">${copy.headline}</div>
        ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
        <div class="card-footer">
          ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : '<div></div>'}
          ${copy.cta ? `<div class="cta">${copy.cta}</div>` : ''}
        </div>
      </div>
    </div>
  </body></html>`;
}

// ── 21: Countdown Urgency ─────────────────────────────────────────────────────
// Bold deadline/scarcity visual — countdown-style numbers, FOMO framing.
// Best for: flash sales, limited offers, event countdowns, direct response.

export function renderCountdownUrgency(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const red    = '#ef4444';
  const accent = input.style.primaryColor ?? red;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:radial-gradient(ellipse at 50% 0%,${accent}22 0%,#0a0a0a 55%),#0a0a0a;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad.outer}px;text-align:center;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.15;}` : ''}
    .top-stripe{position:absolute;top:0;left:0;right:0;height:${Math.round(size.width*0.018)}px;background:${accent};}
    .brand{position:absolute;top:${Math.round(pad.outer*1.6)}px;left:50%;transform:translateX(-50%);font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:rgba(255,255,255,0.35);letter-spacing:0.15em;text-transform:uppercase;}
    .alert-badge{display:inline-block;background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;padding:${Math.round(typo.eyebrow*0.3)}px ${Math.round(typo.eyebrow*1.1)}px;border-radius:4px;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.68)}px;font-weight:900;line-height:1.0;color:#fff;letter-spacing:-0.025em;margin-bottom:${pad.gap}px;position:relative;z-index:1;}
    .timer-row{display:flex;gap:${pad.gap}px;justify-content:center;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .time-cell{display:flex;flex-direction:column;align-items:center;}
    .time-num{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(size.width*0.12)}px;font-weight:900;line-height:1;color:${accent};letter-spacing:-0.04em;}
    .time-label{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.7)}px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-top:${Math.round(pad.gap*0.3)}px;}
    .time-sep{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(size.width*0.1)}px;font-weight:900;color:${accent};opacity:0.5;align-self:flex-start;margin-top:${Math.round(size.width*0.005)}px;}
    .body{font-size:${Math.round(typo.body*0.82)}px;color:rgba(255,255,255,0.55);margin-bottom:${pad.inner}px;max-width:85%;position:relative;z-index:1;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*1.05)}px;font-weight:800;padding:${Math.round(typo.cta*0.6)}px ${Math.round(typo.cta*2)}px;border-radius:${Math.round(typo.cta*0.4)}px;position:relative;z-index:1;box-shadow:0 0 ${Math.round(size.width*0.04)}px ${accent}66;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    ${glowLayer(accent, 'center', size.width, size.height, 0.12, 0.60)}
    ${circleBleed(accent, 'bottom-left', size.width, size.height, 0.06, 0.55)}
    <div class="top-stripe"></div>
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    ${copy.eyebrow ? `<div class="alert-badge">⚡ ${copy.eyebrow}</div>` : '<div class="alert-badge">⚡ LIMITED TIME</div>'}
    <div class="headline">${copy.headline}</div>
    <div class="timer-row">
      <div class="time-cell"><div class="time-num">24</div><div class="time-label">Hours</div></div>
      <div class="time-sep">:</div>
      <div class="time-cell"><div class="time-num">00</div><div class="time-label">Mins</div></div>
      <div class="time-sep">:</div>
      <div class="time-cell"><div class="time-num">00</div><div class="time-label">Secs</div></div>
    </div>
    ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
    ${copy.cta  ? `<div class="cta">${copy.cta} →</div>` : ''}
  </div></body></html>`;
}

// ── 22: Social Proof Grid ─────────────────────────────────────────────────────
// 4 mini testimonial cards arranged in a 2×2 grid. High density social proof.
// Best for: review aggregation ads, trust slides, proof carousels.

export function renderSocialProofGrid(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  // Parse body into 4 testimonials (split by '|' or '\n' or '. ')
  const raw    = (copy.body ?? copy.headline).split(/[|\n]/).map(s => s.trim()).filter(Boolean);
  const quotes = raw.length >= 4 ? raw.slice(0, 4)
               : ['Great product!', 'Highly recommend.', 'Changed my life.', 'Worth every penny.'];

  const gap    = Math.round(pad.gap * 0.7);
  const cardR  = Math.round(size.width * 0.02);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;padding:${pad.outer}px;gap:${pad.gap}px;}
    .header{text-align:center;}
    .stars{color:#f59e0b;font-size:${Math.round(typo.body*0.9)}px;margin-bottom:${Math.round(pad.gap*0.4)}px;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.42)}px;font-weight:800;color:${palette.headline};line-height:1.1;letter-spacing:-0.01em;}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:${gap}px;flex:1;}
    .card{background:${palette.headline === '#fff' || palette.headline === '#ffffff' ? 'rgba(255,255,255,0.08)' : '#fff'};border-radius:${cardR}px;padding:${Math.round(pad.inner*0.65)}px;border:1px solid ${accent}22;display:flex;flex-direction:column;gap:${Math.round(gap*0.5)}px;}
    .q-mark{color:${accent};font-family:Georgia,serif;font-size:${Math.round(typo.headline*0.5)}px;line-height:0.8;opacity:0.4;}
    .q-text{font-size:${Math.round(typo.body*0.72)}px;color:${palette.body};line-height:1.4;flex:1;}
    .q-author{display:flex;align-items:center;gap:${Math.round(gap*0.4)}px;}
    .q-avatar{width:${Math.round(typo.body*1.5)}px;height:${Math.round(typo.body*1.5)}px;border-radius:50%;background:${accent}22;border:1px solid ${accent}44;display:flex;align-items:center;justify-content:center;font-family:'${fonts.headline}',sans-serif;font-weight:700;font-size:${Math.round(typo.eyebrow*0.85)}px;color:${accent};}
    .q-name{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.78)}px;font-weight:700;color:${palette.headline};}
    .q-stars{color:#f59e0b;font-size:${Math.round(typo.eyebrow*0.75)}px;}
    .brand{text-align:center;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.75)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${dotGridLayer(accent, size.width, 0.05)}
    ${cornerArc(accent, 'top-right', size.width, size.height, 0.07, 0.35)}
    <div class="header">
      <div class="stars">★★★★★</div>
      <div class="headline">${copy.headline}</div>
    </div>
    <div class="grid">
      ${quotes.map((q, i) => `
      <div class="card">
        <div class="q-mark">"</div>
        <div class="q-text">${q}</div>
        <div class="q-author">
          <div class="q-avatar">${String.fromCharCode(65 + i)}</div>
          <div>
            <div class="q-name">${copy.subtext ?? 'Customer'} ${i + 1}</div>
            <div class="q-stars">★★★★★</div>
          </div>
        </div>
      </div>`).join('')}
    </div>
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
  </div></body></html>`;
}

// ── 23: Headline Badge ────────────────────────────────────────────────────────
// Oversized badge/label chip dominates top, massive headline below.
// Best for: promotions, limited drops, product launches, hype moments.

export function renderHeadlineBadge(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.1;}` : ''}
    .badge-wrap{margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .badge{display:inline-block;background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.28)}px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;padding:${Math.round(typo.headline*0.1)}px ${Math.round(typo.headline*0.22)}px;border-radius:${Math.round(size.width*0.015)}px;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.88)}px;font-weight:900;line-height:0.95;color:${palette.headline};letter-spacing:-0.04em;position:relative;z-index:1;margin-bottom:${pad.inner}px;}
    .headline span{color:${accent};}
    .body-row{display:flex;align-items:center;gap:${pad.gap}px;position:relative;z-index:1;}
    .accent-line{width:${Math.round(size.width*0.06)}px;height:${Math.round(size.width*0.005)}px;background:${accent};border-radius:2px;flex-shrink:0;}
    .body{font-size:${Math.round(typo.body*0.85)}px;color:${palette.body};line-height:1.5;}
    .cta{margin-top:${pad.inner}px;display:inline-flex;align-items:center;gap:8px;background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${typo.cta}px;font-weight:700;padding:${Math.round(typo.cta*0.55)}px ${Math.round(typo.cta*1.7)}px;border-radius:${Math.round(typo.cta*0.4)}px;position:relative;z-index:1;}
    .brand{position:absolute;top:${pad.outer}px;right:${pad.outer}px;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    ${burstSvg(accent, 'top-right', size.width, size.height, 0.12)}
    ${cornerArc(accent, 'bottom-left', size.width, size.height, 0.09, 0.40)}
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    <div class="badge-wrap">
      <div class="badge">${copy.eyebrow ?? copy.cta ?? 'NEW'}</div>
    </div>
    <div class="headline">${copy.headline}</div>
    ${copy.body ? `<div class="body-row"><div class="accent-line"></div><div class="body">${copy.body}</div></div>` : ''}
    ${copy.cta && !copy.eyebrow ? '' : copy.cta ? `<div class="cta">${copy.cta} →</div>` : ''}
  </div></body></html>`;
}

// ── 24: Side By Side ──────────────────────────────────────────────────────────
// Two equal columns — structured comparison or feature/benefit layout.
// Best for: comparison ads, before/after, dual benefits, feature pairs.

export function renderSideBySide(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  // Parse body into two halves (split by '|' or '\n\n' or '—')
  const halves = (copy.body ?? '').split(/[|—]/).map(s => s.trim()).filter(Boolean);
  const left   = halves[0] ?? copy.body ?? '';
  const right  = halves[1] ?? copy.subtext ?? '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;padding:${pad.outer}px;gap:${pad.inner}px;}
    .header{text-align:center;}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${accent};margin-bottom:${Math.round(pad.gap*0.5)}px;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.48)}px;font-weight:800;color:${palette.headline};line-height:1.1;letter-spacing:-0.02em;}
    .cols{display:flex;gap:${Math.round(pad.inner*0.6)}px;flex:1;}
    .col{flex:1;display:flex;flex-direction:column;gap:${Math.round(pad.gap*0.6)}px;}
    .col-header{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.body*0.85)}px;font-weight:800;color:${palette.headline};padding-bottom:${Math.round(pad.gap*0.4)}px;border-bottom:2px solid ${accent};}
    .col-left .col-header{border-bottom-color:${accent};}
    .col-right .col-header{border-bottom-color:${palette.body}55;}
    .col-body{font-size:${Math.round(typo.body*0.78)}px;color:${palette.body};line-height:1.55;}
    .divider{width:1px;background:${palette.headline}18;flex-shrink:0;}
    .img-wrap{height:${Math.round(size.height*0.25)}px;border-radius:${Math.round(size.width*0.02)}px;overflow:hidden;background:${accent}10;}
    .img-wrap img{width:100%;height:100%;object-fit:cover;}
    .bottom{display:flex;align-items:center;justify-content:space-between;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.08em;text-transform:uppercase;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.85)}px;font-weight:700;padding:${Math.round(typo.cta*0.45)}px ${Math.round(typo.cta*1.3)}px;border-radius:${Math.round(typo.cta*0.4)}px;}
  </style></head><body><div class="frame">
    ${dotGridLayer(accent, size.width, 0.05)}
    ${cornerArc(accent, 'top-right', size.width, size.height, 0.10, 0.38)}
    <div class="header">
      ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
      <div class="headline">${copy.headline}</div>
    </div>
    ${imageUrl ? `<div class="img-wrap"><img src="${imageUrl}" alt=""/></div>` : ''}
    <div class="cols">
      <div class="col col-left">
        <div class="col-header">✓ With Us</div>
        <div class="col-body">${left}</div>
      </div>
      <div class="divider"></div>
      <div class="col col-right">
        <div class="col-header" style="color:${palette.body}88;">✗ Without</div>
        <div class="col-body" style="opacity:0.6;">${right || 'Struggling with the same problems'}</div>
      </div>
    </div>
    <div class="bottom">
      ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : '<div></div>'}
      ${copy.cta ? `<div class="cta">${copy.cta}</div>` : ''}
    </div>
  </div></body></html>`;
}

// ── 25: Diagonal Split ────────────────────────────────────────────────────────
// Dynamic diagonal SVG divider separates image from copy zone.
// Best for: bold, energetic brands, sportswear, food, action products.

export function renderDiagonalSplit(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;
  const imgW   = Math.round(size.width * 0.52);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .img-zone{position:absolute;top:0;left:0;width:${imgW}px;height:100%;overflow:hidden;}
    .img-zone img{width:100%;height:100%;object-fit:cover;}
    .img-placeholder{width:100%;height:100%;background:${accent}22;}
    .diagonal{position:absolute;top:0;left:${Math.round(imgW*0.72)}px;width:${Math.round(size.width*0.15)}px;height:100%;background:${palette.background};transform:skewX(-8deg);transform-origin:top left;}
    .copy-zone{position:absolute;top:0;right:0;width:${Math.round(size.width*0.52)}px;height:100%;display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px ${pad.outer}px ${pad.outer}px ${Math.round(pad.outer*0.4)}px;}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${accent};margin-bottom:${pad.gap}px;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.55)}px;font-weight:900;line-height:1.05;color:${palette.headline};letter-spacing:-0.02em;margin-bottom:${pad.gap}px;}
    .bar{width:${Math.round(size.width*0.07)}px;height:${Math.round(size.width*0.005)}px;background:${accent};border-radius:2px;margin-bottom:${pad.gap}px;}
    .body{font-size:${Math.round(typo.body*0.82)}px;color:${palette.body};line-height:1.55;margin-bottom:${pad.inner}px;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.88)}px;font-weight:700;padding:${Math.round(typo.cta*0.52)}px ${Math.round(typo.cta*1.5)}px;border-radius:${Math.round(typo.cta*0.4)}px;display:inline-block;}
    .brand{position:absolute;bottom:${pad.outer}px;right:${pad.outer}px;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.75)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    <div class="img-zone">
      ${imageUrl ? `<img src="${imageUrl}" alt=""/>` : `<div class="img-placeholder"></div>`}
    </div>
    <div class="diagonal"></div>
    <div class="copy-zone">
      ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
      <div class="headline">${copy.headline}</div>
      <div class="bar"></div>
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      ${copy.cta  ? `<div class="cta">${copy.cta} →</div>` : ''}
    </div>
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
  </div></body></html>`;
}

// ── 26: Overlay Card ──────────────────────────────────────────────────────────
// Semi-transparent frosted-glass card over a full-bleed background image.
// Best for: travel, food, real estate, lifestyle — image-first brands.

export function renderOverlayCard(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
    .bg-fallback{position:absolute;inset:0;background:linear-gradient(135deg,${accent} 0%,${accent}88 100%);}
    .scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.1) 60%,transparent 100%);}
    .card{position:absolute;bottom:${pad.outer}px;left:${pad.outer}px;right:${pad.outer}px;background:rgba(255,255,255,0.12);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.2);border-radius:${Math.round(size.width*0.03)}px;padding:${pad.inner}px;}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:${Math.round(pad.gap*0.6)}px;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.52)}px;font-weight:800;line-height:1.1;color:#fff;letter-spacing:-0.02em;margin-bottom:${Math.round(pad.gap*0.6)}px;}
    .body{font-size:${Math.round(typo.body*0.8)}px;color:rgba(255,255,255,0.72);line-height:1.5;margin-bottom:${pad.gap}px;}
    .footer{display:flex;align-items:center;justify-content:space-between;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:rgba(255,255,255,0.5);letter-spacing:0.1em;text-transform:uppercase;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.85)}px;font-weight:700;padding:${Math.round(typo.cta*0.45)}px ${Math.round(typo.cta*1.3)}px;border-radius:${Math.round(typo.cta*0.4)}px;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : `<div class="bg-fallback"></div>`}
    <div class="scrim"></div>
    <div class="card">
      ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
      <div class="headline">${copy.headline}</div>
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      <div class="footer">
        ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : '<div></div>'}
        ${copy.cta ? `<div class="cta">${copy.cta}</div>` : ''}
      </div>
    </div>
  </div></body></html>`;
}

// ── 27: Number List ───────────────────────────────────────────────────────────
// Ordered benefit list with large editorial numerals (01, 02, 03).
// Best for: step-by-step flows, "3 reasons why", structured benefit lists.

export function renderNumberList(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  const bodyText = copy.body ?? '';
  const rawItems = bodyText.split(/[.•|\n]/).map(s => s.trim()).filter(s => s.length > 3);
  const items    = rawItems.length >= 2 ? rawItems.slice(0, 4)
                 : [bodyText || 'Benefit one', 'Benefit two', 'Benefit three'];

  const numSz  = Math.round(typo.headline * 0.55);
  const textSz = Math.round(typo.body * 0.82);
  const rowGap = Math.round(pad.inner * 0.75);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;padding:${pad.outer}px;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.05;}` : ''}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${accent};margin-bottom:${Math.round(pad.gap*0.6)}px;position:relative;z-index:1;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.48)}px;font-weight:800;color:${palette.headline};line-height:1.1;letter-spacing:-0.02em;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .list{display:flex;flex-direction:column;gap:${rowGap}px;flex:1;position:relative;z-index:1;}
    .item{display:flex;align-items:flex-start;gap:${Math.round(pad.gap*0.8)}px;}
    .num{font-family:'${fonts.headline}',sans-serif;font-size:${numSz}px;font-weight:900;color:${accent};opacity:0.22;line-height:1;letter-spacing:-0.05em;flex-shrink:0;width:${Math.round(numSz*1.2)}px;}
    .item-body{padding-top:${Math.round(numSz*0.08)}px;}
    .item-title{font-family:'${fonts.headline}',sans-serif;font-size:${textSz}px;font-weight:700;color:${palette.headline};margin-bottom:${Math.round(pad.gap*0.2)}px;}
    .item-sub{font-size:${Math.round(textSz*0.82)}px;color:${palette.body};line-height:1.45;}
    .bottom{display:flex;align-items:center;justify-content:space-between;margin-top:${pad.gap}px;border-top:1px solid ${palette.headline}14;padding-top:${pad.gap}px;position:relative;z-index:1;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.08em;text-transform:uppercase;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.82)}px;font-weight:700;padding:${Math.round(typo.cta*0.45)}px ${Math.round(typo.cta*1.2)}px;border-radius:${Math.round(typo.cta*0.4)}px;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    ${dotGridLayer(accent, size.width, 0.05)}
    ${cornerArc(accent, 'top-right', size.width, size.height, 0.10, 0.38)}
    ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
    <div class="headline">${copy.headline}</div>
    <div class="list">
      ${items.map((item, i) => {
        const [title, ...rest] = item.split(/ — | – |: /, 2);
        const sub = rest.join(': ');
        return `<div class="item">
          <div class="num">0${i+1}</div>
          <div class="item-body">
            <div class="item-title">${title}</div>
            ${sub ? `<div class="item-sub">${sub}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="bottom">
      ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : '<div></div>'}
      ${copy.cta ? `<div class="cta">${copy.cta}</div>` : ''}
    </div>
  </div></body></html>`;
}

// ── 28: Brand Manifesto ───────────────────────────────────────────────────────
// Full-frame typographic statement — editorial, centered, high emotional impact.
// Best for: brand values, mission statements, bold opinionated content.

export function renderBrandManifesto(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad.outer}px;text-align:center;overflow:hidden;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.08;}` : ''}
    .bg-text{position:absolute;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(size.width*0.5)}px;font-weight:900;color:${palette.headline};opacity:0.035;user-select:none;white-space:nowrap;letter-spacing:-0.05em;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-15deg);}
    .top-rule{width:${Math.round(size.width*0.12)}px;height:${Math.round(size.width*0.003)}px;background:${accent};margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:${accent};margin-bottom:${pad.gap}px;position:relative;z-index:1;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.72)}px;font-weight:900;line-height:1.05;color:${palette.headline};letter-spacing:-0.025em;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .headline em{color:${accent};font-style:normal;}
    .body{font-size:${Math.round(typo.body*0.88)}px;color:${palette.body};line-height:1.65;max-width:82%;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .bottom-rule{width:${Math.round(size.width*0.12)}px;height:${Math.round(size.width*0.003)}px;background:${accent};margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.15em;text-transform:uppercase;position:relative;z-index:1;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    ${glowLayer(accent, 'top-right', size.width, size.height, 0.12, 0.80)}
    ${circleBleed(accent, 'bottom-left', size.width, size.height, 0.07, 0.65)}
    <div class="bg-text">${(branding?.brandName ?? copy.headline.split(' ')[0]).toUpperCase()}</div>
    <div class="top-rule"></div>
    ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
    <div class="headline">${copy.headline}</div>
    ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
    <div class="bottom-rule"></div>
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
  </div></body></html>`;
}

// ── 29: Product Demo ──────────────────────────────────────────────────────────
// App/product screenshot framed in a minimal browser or phone bezel.
// Best for: SaaS, app products, dashboard previews, UI showcases.

export function renderProductDemo(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;
  const bezelH = Math.round(size.height * 0.42);
  const bezelW = Math.round(bezelH * 1.72); // 16:9-ish
  const bezelW2= Math.min(bezelW, size.width - pad.outer * 2);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;align-items:center;padding:${pad.outer}px;gap:${pad.inner}px;}
    .header{width:100%;display:flex;align-items:center;justify-content:space-between;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
    .tag{background:${accent}12;color:${accent};font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:${Math.round(typo.eyebrow*0.3)}px ${Math.round(typo.eyebrow*0.9)}px;border-radius:99px;}
    .browser{width:${bezelW2}px;border-radius:${Math.round(size.width*0.025)}px;overflow:hidden;box-shadow:0 ${Math.round(size.width*0.03)}px ${Math.round(size.width*0.08)}px rgba(0,0,0,0.16);border:1px solid ${palette.headline}14;background:#f8f8f8;}
    .browser-bar{background:#f0f0f0;height:${Math.round(size.width*0.035)}px;display:flex;align-items:center;padding:0 ${Math.round(size.width*0.015)}px;gap:${Math.round(size.width*0.008)}px;}
    .dot{width:${Math.round(size.width*0.012)}px;height:${Math.round(size.width*0.012)}px;border-radius:50%;}
    .url-bar{flex:1;background:white;border-radius:${Math.round(size.width*0.005)}px;height:60%;margin:0 ${Math.round(size.width*0.01)}px;}
    .screenshot{width:100%;height:${Math.round(bezelH*0.85)}px;overflow:hidden;}
    .screenshot img{width:100%;height:100%;object-fit:cover;object-position:top;}
    .screenshot-placeholder{width:100%;height:100%;background:linear-gradient(135deg,${accent}08,${accent}18);display:flex;align-items:center;justify-content:center;font-size:${Math.round(bezelH*0.15)}px;}
    .copy{width:100%;text-align:center;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.45)}px;font-weight:800;color:${palette.headline};line-height:1.1;letter-spacing:-0.02em;margin-bottom:${Math.round(pad.gap*0.6)}px;}
    .body{font-size:${Math.round(typo.body*0.78)}px;color:${palette.body};line-height:1.5;margin-bottom:${pad.gap}px;}
    .cta{display:inline-block;background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.85)}px;font-weight:700;padding:${Math.round(typo.cta*0.48)}px ${Math.round(typo.cta*1.4)}px;border-radius:${Math.round(typo.cta*0.4)}px;}
  </style></head><body><div class="frame">
    ${dotGridLayer(accent, size.width, 0.05)}
    ${cornerArc(accent, 'bottom-right', size.width, size.height, 0.08, 0.35)}
    <div class="header">
      ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : '<div></div>'}
      ${copy.eyebrow ? `<div class="tag">${copy.eyebrow}</div>` : '<div></div>'}
    </div>
    <div class="browser">
      <div class="browser-bar">
        <div class="dot" style="background:#ff5f57;"></div>
        <div class="dot" style="background:#febc2e;"></div>
        <div class="dot" style="background:#28c840;"></div>
        <div class="url-bar"></div>
      </div>
      <div class="screenshot">
        ${imageUrl ? `<img src="${imageUrl}" alt=""/>` : `<div class="screenshot-placeholder">🖥</div>`}
      </div>
    </div>
    <div class="copy">
      <div class="headline">${copy.headline}</div>
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      ${copy.cta  ? `<div class="cta">${copy.cta} →</div>` : ''}
    </div>
  </div></body></html>`;
}

// ── 30: Retro Bold ────────────────────────────────────────────────────────────
// Chunky vintage-inspired typography, high contrast, retro halftone texture.
// Best for: food, beverage, fitness, streetwear, nostalgia brands.

export function renderRetroBold(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? '#f97316';
  const dark   = '#1a0a00';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${accent};overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.2;mix-blend-mode:multiply;}` : ''}
    /* halftone dots via radial-gradient */
    .dots{position:absolute;inset:0;background-image:radial-gradient(circle,${dark}22 1px,transparent 1px);background-size:${Math.round(size.width*0.025)}px ${Math.round(size.width*0.025)}px;}
    .border-frame{position:absolute;inset:${Math.round(pad.outer*0.4)}px;border:${Math.round(size.width*0.005)}px solid ${dark};border-radius:${Math.round(size.width*0.01)}px;}
    .eyebrow-wrap{margin-bottom:${Math.round(pad.gap*0.6)}px;position:relative;z-index:1;}
    .eyebrow{display:inline-block;background:${dark};color:${accent};font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:900;letter-spacing:0.22em;text-transform:uppercase;padding:${Math.round(typo.eyebrow*0.25)}px ${Math.round(typo.eyebrow*0.9)}px;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.78)}px;font-weight:900;line-height:0.95;color:${dark};letter-spacing:-0.03em;text-transform:uppercase;position:relative;z-index:1;margin-bottom:${Math.round(pad.gap*0.6)}px;}
    .rule{width:100%;height:${Math.round(size.width*0.007)}px;background:${dark};margin-bottom:${Math.round(pad.gap*0.6)}px;position:relative;z-index:1;}
    .body{font-size:${Math.round(typo.body*0.85)}px;color:${dark};line-height:1.5;font-weight:600;max-width:88%;position:relative;z-index:1;margin-bottom:${pad.inner}px;}
    .cta-stamp{display:inline-block;background:${dark};color:${accent};font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.95)}px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;padding:${Math.round(typo.cta*0.5)}px ${Math.round(typo.cta*1.6)}px;position:relative;z-index:1;}
    .brand-bottom{position:absolute;bottom:${Math.round(pad.outer*0.8)}px;right:${Math.round(pad.outer*0.8)}px;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.75)}px;font-weight:900;color:${dark};letter-spacing:0.18em;text-transform:uppercase;opacity:0.45;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="dots"></div>
    <div class="border-frame"></div>
    ${burstSvg(dark, 'top-right', size.width, size.height, 0.18, 10, 0.28)}
    ${burstSvg(dark, 'bottom-left', size.width, size.height, 0.12, 8, 0.22)}
    ${copy.eyebrow ? `<div class="eyebrow-wrap"><div class="eyebrow">★ ${copy.eyebrow} ★</div></div>` : ''}
    <div class="headline">${copy.headline}</div>
    <div class="rule"></div>
    ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
    ${copy.cta  ? `<div class="cta-stamp">${copy.cta}</div>` : ''}
    ${branding?.brandName ? `<div class="brand-bottom">${branding.brandName}</div>` : ''}
  </div></body></html>`;
}
