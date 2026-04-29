// ─── Extended Templates (6–15) ────────────────────────────────────────────────
// 10 additional layouts that complete the 15-template base library.
// Specialised for carousel slide types: testimonial, stats, feature list,
// CTA finisher, gradient pop, dark luxury, story hook, product center, etc.

import type { CompositorInput, ParsedSize, FontPairing } from '../types/compositor.types';
import type { ColorPalette } from '../design/design-system';
import { getTypographyScale, getPadding } from '../design/design-system';

// ── 6: Testimonial ────────────────────────────────────────────────────────────
// Customer quote as the hero. Big quotation mark, name below.
// Best for: social proof slides, review ads, trust-building.

export function renderTestimonial(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo = getTypographyScale(size, input.style.tone);
  const pad  = getPadding(size);
  const { copy, imageUrl, branding } = input;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;font-family:'${fonts.body}',sans-serif;background:${palette.background};}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad.outer}px;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.12;filter:grayscale(60%);}` : ''}
    .quote-mark{font-family:Georgia,serif;font-size:${Math.round(size.width*0.25)}px;line-height:0.6;color:${palette.cta};opacity:0.25;align-self:flex-start;user-select:none;}
    .quote-text{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.55)}px;font-weight:600;line-height:1.3;color:${palette.headline};text-align:center;margin-bottom:${pad.inner}px;font-style:italic;position:relative;z-index:1;}
    .divider{width:${Math.round(size.width*0.12)}px;height:${Math.round(size.width*0.006)}px;background:${palette.cta};border-radius:2px;margin:0 auto ${pad.inner}px;}
    .author-row{display:flex;align-items:center;gap:${pad.gap}px;justify-content:center;}
    .avatar{width:${Math.round(size.width*0.09)}px;height:${Math.round(size.width*0.09)}px;border-radius:50%;background:${palette.cta}33;border:2px solid ${palette.cta};display:flex;align-items:center;justify-content:center;font-family:'${fonts.headline}',sans-serif;font-weight:700;font-size:${Math.round(typo.eyebrow*1.1)}px;color:${palette.cta};}
    .author-info{text-align:left;}
    .author-name{font-family:'${fonts.headline}',sans-serif;font-size:${typo.body}px;font-weight:700;color:${palette.headline};}
    .author-sub{font-size:${typo.eyebrow}px;color:${palette.body};margin-top:2px;}
    .stars{color:#f59e0b;font-size:${Math.round(typo.body*0.9)}px;margin-bottom:${pad.gap}px;text-align:center;}
    .brand{position:absolute;top:${pad.outer}px;right:${pad.outer}px;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    <div class="quote-mark">"</div>
    <div class="stars">★★★★★</div>
    <div class="quote-text">${copy.headline}</div>
    ${copy.body ? `<div style="font-size:${Math.round(typo.body*0.82)}px;color:${palette.body};text-align:center;margin-bottom:${pad.inner}px;">${copy.body}</div>` : ''}
    <div class="divider"></div>
    <div class="author-row">
      <div class="avatar">${copy.subtext ? copy.subtext[0].toUpperCase() : 'C'}</div>
      <div class="author-info">
        <div class="author-name">${copy.subtext ?? 'Happy Customer'}</div>
        <div class="author-sub">${copy.eyebrow ?? 'Verified Buyer'}</div>
      </div>
    </div>
  </div></body></html>`;
}

// ── 7: Stats Hero ─────────────────────────────────────────────────────────────
// A huge number/statistic is the visual anchor. Context below.
// Best for: proof slides, "X% of users", "Save $Y", data-driven claims.

export function renderStatsHero(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo = getTypographyScale(size, input.style.tone);
  const pad  = getPadding(size);
  const { copy, imageUrl, branding } = input;

  // Extract stat from headline (e.g. "94% of users see results")
  // First token that is number-ish becomes the hero stat
  const words     = copy.headline.trim().split(/\s+/);
  const statMatch = words.find(w => /[\d%+$xX]/.test(w));
  const stat      = statMatch ?? words[0];
  const restWords = words.filter(w => w !== statMatch).join(' ');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;font-family:'${fonts.body}',sans-serif;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${palette.background};overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad.outer}px;text-align:center;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.08;}` : ''}
    .accent-circle{position:absolute;width:${Math.round(size.width*0.9)}px;height:${Math.round(size.width*0.9)}px;border-radius:50%;border:1px solid ${palette.cta}18;top:50%;left:50%;transform:translate(-50%,-50%);}
    .stat{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(size.width*0.24)}px;font-weight:900;line-height:0.9;color:${palette.cta};letter-spacing:-0.04em;position:relative;z-index:1;}
    .stat-context{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.52)}px;font-weight:700;color:${palette.headline};line-height:1.2;margin-top:${pad.gap}px;position:relative;z-index:1;}
    .body{font-size:${Math.round(typo.body*0.85)}px;color:${palette.body};margin-top:${pad.inner}px;max-width:80%;line-height:1.5;position:relative;z-index:1;}
    .tag{background:${palette.cta}18;border:1px solid ${palette.cta}33;color:${palette.cta};font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:${Math.round(typo.eyebrow*0.35)}px ${Math.round(typo.eyebrow*1.1)}px;border-radius:99px;margin-bottom:${pad.inner}px;display:inline-block;}
    .brand{position:absolute;top:${pad.outer}px;left:50%;transform:translateX(-50%);font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="accent-circle"></div>
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    ${copy.eyebrow ? `<div class="tag">${copy.eyebrow}</div>` : ''}
    <div class="stat">${stat}</div>
    ${restWords ? `<div class="stat-context">${restWords}</div>` : ''}
    ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
  </div></body></html>`;
}

// ── 8: Feature List ───────────────────────────────────────────────────────────
// Headline + 3–4 bullet benefit points. Clean, scannable.
// Best for: value slides, solution slides, "what you get" slides.

export function renderFeatureList(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo  = getTypographyScale(size, input.style.tone);
  const pad   = getPadding(size);
  const { copy, imageUrl, branding } = input;

  // Parse body into bullet points (split by '. ' or '• ' or '\n')
  const bodyText  = copy.body ?? '';
  const rawPoints = bodyText.split(/[.•\n]/).map(s => s.trim()).filter(s => s.length > 4);
  const points    = rawPoints.length >= 2 ? rawPoints : [bodyText];

  const bulletSize = Math.round(typo.body * 0.88);
  const iconSize   = Math.round(bulletSize * 1.5);
  const rowGap     = Math.round(pad.gap * 1.2);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;font-family:'${fonts.body}',sans-serif;background:${palette.background};}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.06;}` : ''}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.58)}px;font-weight:800;color:${palette.headline};line-height:1.1;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .accent-bar{width:${Math.round(size.width*0.07)}px;height:${Math.round(size.width*0.006)}px;background:${palette.cta};border-radius:2px;margin-bottom:${pad.inner}px;}
    .points{display:flex;flex-direction:column;gap:${rowGap}px;position:relative;z-index:1;}
    .point{display:flex;align-items:flex-start;gap:${pad.gap}px;}
    .icon{width:${iconSize}px;height:${iconSize}px;border-radius:50%;background:${palette.cta}18;border:1.5px solid ${palette.cta}44;display:flex;align-items:center;justify-content:center;font-size:${Math.round(iconSize*0.52)}px;flex-shrink:0;margin-top:2px;}
    .point-text{font-size:${bulletSize}px;color:${palette.body};line-height:1.45;font-weight:400;}
    .point-text strong{color:${palette.headline};font-weight:600;}
    .cta-row{margin-top:${pad.inner}px;display:flex;align-items:center;gap:${pad.gap}px;position:relative;z-index:1;}
    .cta{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.9)}px;font-weight:700;color:${palette.ctaText};background:${palette.cta};padding:${Math.round(typo.cta*0.55)}px ${Math.round(typo.cta*1.4)}px;border-radius:${Math.round(typo.cta*0.4)}px;}
    .brand{position:absolute;top:${pad.outer}px;right:${pad.outer}px;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    <div class="accent-bar"></div>
    <div class="headline">${copy.headline}</div>
    <div class="points">
      ${points.slice(0,4).map((p, i) => `
      <div class="point">
        <div class="icon">${['✓','→','★','✦'][i % 4]}</div>
        <div class="point-text">${p}</div>
      </div>`).join('')}
    </div>
    ${copy.cta ? `<div class="cta-row"><div class="cta">${copy.cta}</div></div>` : ''}
  </div></body></html>`;
}

// ── 9: CTA Final ──────────────────────────────────────────────────────────────
// Dedicated last-slide design. Big CTA button, urgency framing, high contrast.
// Best for: final carousel slide, standalone CTA ads.

export function renderCtaFinal(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo = getTypographyScale(size, input.style.tone);
  const pad  = getPadding(size);
  const { copy, imageUrl, branding } = input;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.cta};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad.outer}px;text-align:center;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:overlay;opacity:0.2;}` : ''}
    /* Radial glow */
    .glow{position:absolute;width:${Math.round(size.width*1.2)}px;height:${Math.round(size.width*1.2)}px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.15) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.65);margin-bottom:${pad.gap}px;position:relative;z-index:1;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.68)}px;font-weight:900;line-height:1.05;color:#fff;letter-spacing:-0.025em;margin-bottom:${pad.gap}px;position:relative;z-index:1;}
    .body{font-size:${Math.round(typo.body*0.85)}px;color:rgba(255,255,255,0.8);line-height:1.5;max-width:82%;margin:0 auto ${pad.inner}px;position:relative;z-index:1;}
    .cta-btn{background:#fff;color:${palette.cta};font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*1.05)}px;font-weight:800;letter-spacing:0.03em;padding:${Math.round(typo.cta*0.7)}px ${Math.round(typo.cta*2.2)}px;border-radius:${Math.round(typo.cta*0.55)}px;position:relative;z-index:1;box-shadow:0 8px 32px rgba(0,0,0,0.2);}
    .brand{position:absolute;top:${pad.outer}px;left:50%;transform:translateX(-50%);font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:rgba(255,255,255,0.5);letter-spacing:0.18em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="glow"></div>
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
    <div class="headline">${copy.headline}</div>
    ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
    ${copy.cta  ? `<div class="cta-btn">${copy.cta} →</div>` : ''}
  </div></body></html>`;
}

// ── 10: Gradient Pop ──────────────────────────────────────────────────────────
// Vibrant gradient background, high energy. No image needed.
// Best for: hook slides, bold statements, energetic brand moments.

export function renderGradientPop(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo = getTypographyScale(size, input.style.tone);
  const pad  = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? '#6366f1';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;background:linear-gradient(135deg,${accent} 0%,${accent}bb 40%,#1a1a2e 100%);display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:soft-light;opacity:0.35;}` : ''}
    .shapes{position:absolute;inset:0;overflow:hidden;}
    .circle1{position:absolute;width:${Math.round(size.width*0.7)}px;height:${Math.round(size.width*0.7)}px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);top:-15%;right:-20%;}
    .circle2{position:absolute;width:${Math.round(size.width*0.4)}px;height:${Math.round(size.width*0.4)}px;border-radius:50%;border:1px solid rgba(255,255,255,0.08);bottom:-10%;left:-10%;}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:${pad.gap}px;position:relative;z-index:1;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.78)}px;font-weight:900;line-height:1.05;color:#fff;letter-spacing:-0.02em;margin-bottom:${pad.gap}px;position:relative;z-index:1;}
    .body{font-size:${Math.round(typo.body*0.88)}px;color:rgba(255,255,255,0.78);line-height:1.5;margin-bottom:${pad.inner}px;max-width:88%;position:relative;z-index:1;}
    .cta{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.4);color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${typo.cta}px;font-weight:700;padding:${Math.round(typo.cta*0.55)}px ${Math.round(typo.cta*1.5)}px;border-radius:${Math.round(typo.cta*0.45)}px;backdrop-filter:blur(8px);position:relative;z-index:1;}
    .brand{position:absolute;top:${pad.outer}px;left:${pad.outer}px;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:rgba(255,255,255,0.45);letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="shapes"><div class="circle1"></div><div class="circle2"></div></div>
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
    <div class="headline">${copy.headline}</div>
    ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
    ${copy.cta  ? `<div class="cta">${copy.cta} →</div>` : ''}
  </div></body></html>`;
}

// ── 11: Dark Luxury ───────────────────────────────────────────────────────────
// Deep dark background, gold/amber accents, editorial typography.
// Best for: premium products, high-ticket offers, fashion, luxury DTC.

export function renderDarkLuxury(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo  = getTypographyScale(size, input.style.tone);
  const pad   = getPadding(size);
  const gold  = '#c9a84c';
  const { copy, imageUrl, branding } = input;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:#080808;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.22;filter:grayscale(40%);}` : ''}
    .vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,0.85) 100%);}
    .top-rule{position:absolute;top:${pad.outer}px;left:${pad.outer}px;right:${pad.outer}px;height:1px;background:linear-gradient(to right,transparent,${gold}66,transparent);}
    .bottom-rule{position:absolute;bottom:${pad.outer}px;left:${pad.outer}px;right:${pad.outer}px;height:1px;background:linear-gradient(to right,transparent,${gold}66,transparent);}
    .content{position:relative;z-index:2;}
    .eyebrow{font-family:'Cormorant Garamond',serif;font-size:${Math.round(typo.eyebrow*1.1)}px;font-weight:300;letter-spacing:0.35em;text-transform:uppercase;color:${gold};margin-bottom:${pad.inner}px;font-style:italic;}
    .headline{font-family:'Cormorant Garamond',serif;font-size:${Math.round(typo.headline*0.75)}px;font-weight:300;line-height:1.15;color:#f0ead8;letter-spacing:0.02em;margin-bottom:${pad.inner}px;}
    .rule{width:${Math.round(size.width*0.1)}px;height:1px;background:${gold};margin-bottom:${pad.inner}px;}
    .body{font-family:'Cormorant Garamond',serif;font-size:${Math.round(typo.body*0.9)}px;font-weight:300;line-height:1.7;color:rgba(240,234,216,0.6);margin-bottom:${pad.inner}px;font-style:italic;}
    .cta{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*1.05)}px;font-weight:600;letter-spacing:0.25em;text-transform:uppercase;color:${gold};display:flex;align-items:center;gap:12px;}
    .cta-line{flex:1;height:1px;background:${gold}44;}
    .brand{font-family:'Cormorant Garamond',serif;font-size:${Math.round(typo.eyebrow*1.3)}px;font-weight:300;color:${gold};letter-spacing:0.3em;text-transform:uppercase;margin-bottom:${pad.inner}px;font-style:italic;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="vignette"></div>
    <div class="top-rule"></div>
    <div class="bottom-rule"></div>
    <div class="content">
      ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
      ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
      <div class="headline">${copy.headline}</div>
      <div class="rule"></div>
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      ${copy.cta  ? `<div class="cta"><span>${copy.cta}</span><div class="cta-line"></div></div>` : ''}
    </div>
  </div></body></html>`;
}

// ── 12: Bright Minimal ────────────────────────────────────────────────────────
// Pure white background, black typography, one colour accent. Very clean.
// Best for: SaaS, e-commerce, direct comparison, feature announcements.

export function renderBrightMinimal(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo = getTypographyScale(size, input.style.tone);
  const pad  = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? '#6366f1';

  const imgH = Math.round(size.height * 0.35);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:#fff;}
    .frame{width:${size.width}px;height:${size.height}px;background:#fff;display:flex;flex-direction:column;padding:${pad.outer}px;}
    .img-wrap{width:100%;height:${imgH}px;border-radius:${Math.round(size.width*0.02)}px;overflow:hidden;background:#f4f4f4;margin-bottom:${pad.inner}px;flex-shrink:0;}
    .img-wrap img{width:100%;height:100%;object-fit:cover;}
    .tag{display:inline-block;background:${accent}12;color:${accent};font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:${Math.round(typo.eyebrow*0.35)}px ${Math.round(typo.eyebrow*1.1)}px;border-radius:99px;margin-bottom:${Math.round(pad.gap*0.8)}px;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.55)}px;font-weight:800;color:#0a0a0a;line-height:1.1;letter-spacing:-0.02em;margin-bottom:${pad.gap}px;}
    .headline span{color:${accent};}
    .body{font-size:${Math.round(typo.body*0.82)}px;color:#555;line-height:1.6;flex:1;margin-bottom:${pad.gap}px;}
    .bottom{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #eee;padding-top:${pad.gap}px;margin-top:auto;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:#0a0a0a;letter-spacing:0.08em;text-transform:uppercase;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.85)}px;font-weight:700;padding:${Math.round(typo.cta*0.5)}px ${Math.round(typo.cta*1.3)}px;border-radius:${Math.round(typo.cta*0.4)}px;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<div class="img-wrap"><img src="${imageUrl}" alt=""/></div>` : ''}
    ${copy.eyebrow ? `<div class="tag">${copy.eyebrow}</div>` : ''}
    <div class="headline">${copy.headline}</div>
    ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
    <div class="bottom">
      <div class="brand">${branding?.brandName ?? ''}</div>
      ${copy.cta ? `<div class="cta">${copy.cta} →</div>` : ''}
    </div>
  </div></body></html>`;
}

// ── 13: Story Hook ────────────────────────────────────────────────────────────
// Vertical format optimised for Stories/Reels. Giant hook top, image center.
// Best for: story ads, reel hooks, vertical content.

export function renderStoryHook(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo = getTypographyScale(size, input.style.tone);
  const pad  = getPadding(size);
  const { copy, imageUrl, branding } = input;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}` : ''}
    .overlay-top{position:absolute;top:0;left:0;right:0;height:45%;background:linear-gradient(to bottom,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.5) 60%,transparent 100%);z-index:1;}
    .overlay-bot{position:absolute;bottom:0;left:0;right:0;height:35%;background:linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.4) 60%,transparent 100%);z-index:1;}
    .top-content{position:absolute;top:${Math.round(size.height*0.08)}px;left:${pad.outer}px;right:${pad.outer}px;z-index:2;}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${palette.cta};margin-bottom:${pad.gap}px;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.65)}px;font-weight:900;line-height:1.05;color:#fff;letter-spacing:-0.02em;text-shadow:0 2px 16px rgba(0,0,0,0.5);}
    .bot-content{position:absolute;bottom:${Math.round(size.height*0.06)}px;left:${pad.outer}px;right:${pad.outer}px;z-index:2;}
    .body{font-size:${Math.round(typo.body*0.8)}px;color:rgba(255,255,255,0.85);line-height:1.5;margin-bottom:${pad.inner}px;}
    .cta{display:inline-flex;align-items:center;gap:8px;background:${palette.cta};color:${palette.ctaText};font-family:'${fonts.headline}',sans-serif;font-size:${typo.cta}px;font-weight:700;padding:${Math.round(typo.cta*0.6)}px ${Math.round(typo.cta*1.5)}px;border-radius:${Math.round(typo.cta*0.5)}px;}
    .swipe-hint{font-family:'${fonts.body}',sans-serif;font-size:${Math.round(typo.eyebrow*0.9)}px;color:rgba(255,255,255,0.45);letter-spacing:0.08em;margin-bottom:${pad.gap}px;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:rgba(255,255,255,0.45);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:${pad.gap}px;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="overlay-top"></div>
    <div class="overlay-bot"></div>
    <div class="top-content">
      ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
      ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
      <div class="headline">${copy.headline}</div>
    </div>
    <div class="bot-content">
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      <div class="swipe-hint">Swipe up to learn more ↑</div>
      ${copy.cta ? `<div class="cta">${copy.cta}</div>` : ''}
    </div>
  </div></body></html>`;
}

// ── 14: Problem Slide ─────────────────────────────────────────────────────────
// Creates emotional tension. Dark, gritty, identifies the pain.
// Best for: problem slides in carousels, before-the-solution moment.

export function renderProblemSlide(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo = getTypographyScale(size, input.style.tone);
  const pad  = getPadding(size);
  const { copy, imageUrl, branding } = input;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;background:#0d0d0d;display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.2;filter:grayscale(80%);}` : ''}
    .red-bar{position:absolute;left:0;top:0;bottom:0;width:${Math.round(size.width*0.012)}px;background:#ef4444;}
    .content{position:relative;z-index:1;}
    .label{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#ef4444;margin-bottom:${pad.inner}px;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.65)}px;font-weight:900;line-height:1.05;color:#fff;letter-spacing:-0.02em;margin-bottom:${pad.inner}px;}
    .body{font-size:${Math.round(typo.body*0.85)}px;color:rgba(255,255,255,0.6);line-height:1.6;margin-bottom:${pad.inner}px;}
    .recognition{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:${Math.round(pad.gap*0.7)}px ${pad.gap}px;color:rgba(239,68,68,0.8);font-size:${Math.round(typo.eyebrow*0.95)}px;font-family:'${fonts.body}',sans-serif;}
    .brand{position:absolute;top:${pad.outer}px;right:${pad.outer}px;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:rgba(255,255,255,0.2);letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="red-bar"></div>
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    <div class="content">
      <div class="label">${copy.eyebrow ?? 'The Problem'}</div>
      <div class="headline">${copy.headline}</div>
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      <div class="recognition">😤 Sound familiar?</div>
    </div>
  </div></body></html>`;
}

// ── 15: Text Only Bold ────────────────────────────────────────────────────────
// Pure typography. No image. Statement so strong it needs nothing else.
// Best for: hook slides, bold claims, "did you know" moments.

export function renderTextOnlyBold(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo  = getTypographyScale(size, input.style.tone);
  const pad   = getPadding(size);
  const { copy, branding } = input;
  const accent = input.style.primaryColor ?? '#6366f1';

  // Word-by-word colour cycling on headline
  const words = copy.headline.trim().split(' ');
  const colored = words.map((w, i) =>
    i % 4 === 2 ? `<span style="color:${accent}">${w}</span>` : w
  ).join(' ');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad.outer}px;text-align:center;position:relative;}
    /* Grid background pattern */
    .grid{position:absolute;inset:0;background-image:linear-gradient(${accent}08 1px,transparent 1px),linear-gradient(90deg,${accent}08 1px,transparent 1px);background-size:${Math.round(size.width*0.08)}px ${Math.round(size.width*0.08)}px;}
    .eyebrow{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${accent};margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.82)}px;font-weight:900;line-height:1.05;color:${palette.headline};letter-spacing:-0.025em;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .body{font-size:${Math.round(typo.body*0.9)}px;color:${palette.body};line-height:1.55;max-width:85%;position:relative;z-index:1;margin-bottom:${pad.inner}px;}
    .cta{font-family:'${fonts.headline}',sans-serif;font-size:${typo.cta}px;font-weight:700;color:${accent};position:relative;z-index:1;display:flex;align-items:center;gap:8px;justify-content:center;}
    .cta-dot{width:6px;height:6px;border-radius:50%;background:${accent};}
    .brand{position:absolute;bottom:${pad.outer}px;left:50%;transform:translateX(-50%);font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.8)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.15em;text-transform:uppercase;opacity:0.5;}
  </style></head><body><div class="frame">
    <div class="grid"></div>
    ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
    <div class="headline">${colored}</div>
    ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
    ${copy.cta  ? `<div class="cta"><div class="cta-dot"></div>${copy.cta}<div class="cta-dot"></div></div>` : ''}
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
  </div></body></html>`;
}
