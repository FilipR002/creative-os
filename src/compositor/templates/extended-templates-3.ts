// ─── Extended Templates — Batch 3 (angle-routed creative 8) ──────────────────
// HTML/Puppeteer implementations of the 8 angle-routed creative templates.
// These mirror the Satori versions but run through Puppeteer so they work
// when an imageUrl is present (Satori can't load external images).
//
// Templates: testimonial-card, versus-slide, before-after-slide, press-slide,
//            point-out-slide, gallery-slide, chat-native, offer-drop

import type { CompositorInput, ParsedSize, FontPairing } from '../types/compositor.types';
import type { ColorPalette } from '../design/design-system';
import { getTypographyScale, getPadding } from '../design/design-system';
import { glowLayer, cornerArc, dotGridLayer, circleBleed, burstSvg } from './bg-layers';

// ── Testimonial Card ──────────────────────────────────────────────────────────
// Stars → big quote → author avatar + name + Trustpilot badge.

export function renderTestimonialCard(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;
  const avaW   = Math.round(typo.body * 2.2);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;justify-content:space-between;padding:${pad.outer}px;overflow:hidden;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.08;}` : ''}
    .big-quote{position:absolute;top:${pad.outer}px;left:${pad.outer}px;font-family:Georgia,serif;font-size:${Math.round(size.width*0.35)}px;color:${accent}0d;line-height:0.75;user-select:none;z-index:0;}
    .stars{font-size:${Math.round(typo.body*0.9)}px;color:#FBBF24;letter-spacing:3px;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .quote{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.72)}px;font-weight:700;color:${palette.headline};line-height:1.25;flex:1;position:relative;z-index:1;margin-bottom:${pad.inner}px;}
    .author-row{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;}
    .author-left{display:flex;align-items:center;gap:${pad.gap}px;}
    .avatar{width:${avaW}px;height:${avaW}px;border-radius:50%;background:${accent}33;border:2px solid ${accent}44;display:flex;align-items:center;justify-content:center;font-family:'${fonts.headline}',sans-serif;font-weight:700;font-size:${Math.round(avaW*0.45)}px;color:${accent};}
    .name{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.body*0.85)}px;font-weight:700;color:${palette.headline};}
    .role{font-size:${typo.eyebrow}px;color:${accent};font-weight:700;letter-spacing:0.5px;margin-top:2px;}
    .trustpilot{background:#00B67A;border-radius:5px;padding:${Math.round(typo.eyebrow*0.4)}px ${Math.round(typo.eyebrow*0.9)}px;display:flex;flex-direction:column;align-items:center;}
    .tp-stars{color:#fff;font-size:${Math.round(typo.eyebrow*0.88)}px;letter-spacing:1px;margin-bottom:2px;}
    .tp-label{color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.75)}px;font-weight:700;letter-spacing:0.4px;}
    .brand{position:absolute;top:${pad.outer}px;right:${pad.outer}px;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.8)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    ${glowLayer(accent, 'top-right', size.width, size.height, 0.13)}
    ${cornerArc(accent, 'bottom-left', size.width, size.height, 0.09)}
    <div class="big-quote">"</div>
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    <div class="stars">★★★★★</div>
    <div class="quote">${copy.headline}</div>
    <div class="author-row">
      <div class="author-left">
        <div class="avatar">★</div>
        <div>
          <div class="name">${copy.body ?? 'Verified Customer'}</div>
          <div class="role">Verified Buyer</div>
        </div>
      </div>
      <div class="trustpilot">
        <div class="tp-stars">★★★★★</div>
        <div class="tp-label">Trustpilot</div>
      </div>
    </div>
  </div></body></html>`;
}

// ── Versus Slide ──────────────────────────────────────────────────────────────
// Dark "WITHOUT" left / accent "WITH US" right. VS circle on the seam.

export function renderVersusSlide(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  const halfW  = Math.round(size.width / 2);
  const vsSz   = Math.round(size.width * 0.10);
  const rawItems  = (copy.body || '').split(/\||\n/).map((s: string) => s.trim()).filter(Boolean);
  const leftItems = rawItems.filter((_: string, i: number) => i % 2 === 0).slice(0, 3);
  const rightItems= rawItems.filter((_: string, i: number) => i % 2 === 1).slice(0, 3);
  const circSz = Math.round(typo.body * 1.4);

  const itemHtml = (items: string[], col: 'left' | 'right') =>
    items.map(item => `
      <div style="display:flex;align-items:center;gap:${Math.round(pad.gap*0.8)}px;margin-bottom:${pad.gap}px;">
        <div style="width:${circSz}px;height:${circSz}px;border-radius:50%;background:${col === 'left' ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.25)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:${Math.round(circSz*0.5)}px;font-weight:700;color:${col === 'left' ? '#EF4444' : '#fff'};">${col === 'left' ? '✗' : '✓'}</div>
        <div style="font-size:${Math.round(typo.body*0.88)}px;color:${col === 'left' ? 'rgba(255,255,255,0.6)' : '#fff'};line-height:1.35;">${item}</div>
      </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;display:flex;flex-direction:row;overflow:hidden;}
    .left{width:${halfW}px;height:${size.height}px;background:#111111;display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px ${Math.round(pad.outer*0.75)}px ${pad.outer}px ${pad.outer}px;}
    .right{flex:1;height:${size.height}px;background:${accent};display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px ${pad.outer}px ${pad.outer}px ${Math.round(pad.outer*0.75)}px;}
    .col-label{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:2px;margin-bottom:${pad.inner}px;}
    .sub{font-size:${Math.round(typo.body*0.82)}px;line-height:1.3;margin-top:${pad.gap}px;}
    .vs-circle{position:absolute;top:50%;left:${halfW}px;transform:translate(-50%,-50%);width:${vsSz}px;height:${vsSz}px;border-radius:50%;background:#ffffff;display:flex;align-items:center;justify-content:center;font-family:'${fonts.headline}',sans-serif;font-weight:700;font-size:${Math.round(vsSz*0.32)}px;color:${accent};letter-spacing:1px;z-index:2;}
    .cta-wrap{margin-top:${pad.inner}px;}
    .cta{display:inline-block;background:#fff;color:${accent};font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.9)}px;font-weight:700;padding:${Math.round(typo.cta*0.5)}px ${Math.round(typo.cta*1.4)}px;border-radius:${Math.round(typo.cta*0.4)}px;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<div style="position:absolute;inset:0;"><img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;opacity:0.06;"/></div>` : ''}
    <div class="left">
      <div class="col-label" style="color:rgba(255,255,255,0.38);">WITHOUT</div>
      ${itemHtml(leftItems, 'left')}
      ${copy.headline ? `<div class="sub" style="color:rgba(255,255,255,0.35);">${copy.headline}</div>` : ''}
    </div>
    <div class="right">
      <div class="col-label" style="color:rgba(255,255,255,0.72);">WITH US</div>
      ${itemHtml(rightItems, 'right')}
      ${copy.cta ? `<div class="cta-wrap"><div class="cta">${copy.cta} →</div></div>` : ''}
    </div>
    <div class="vs-circle">VS</div>
  </div></body></html>`;
}

// ── Before / After Slide ──────────────────────────────────────────────────────
// Dark BEFORE top half / accent AFTER bottom half. Arrow circle on seam.

export function renderBeforeAfterSlide(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  const halfH    = Math.round(size.height / 2);
  const arrowSz  = Math.round(size.width * 0.11);
  const parts    = (copy.body || '').split(/\||\n/).map((s: string) => s.trim()).filter(Boolean);
  const beforeTxt= parts[0] || copy.headline;
  const afterTxt = parts[1] || copy.headline;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.07;}` : ''}
    .before{position:absolute;top:0;left:0;right:0;height:${halfH}px;background:#111111;display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px;}
    .after{position:absolute;bottom:0;left:0;right:0;height:${halfH}px;background:${accent};display:flex;flex-direction:column;justify-content:center;padding:${pad.outer}px;padding-top:${Math.round(halfH*0.22)}px;}
    .zone-label{display:inline-block;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.65);font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.1em;padding:${Math.round(typo.eyebrow*0.3)}px ${Math.round(typo.eyebrow*0.75)}px;border-radius:4px;margin-bottom:${pad.gap}px;}
    .zone-text{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.65)}px;font-weight:700;line-height:1.2;max-width:85%;}
    .arrow-circle{position:absolute;top:${halfH}px;left:50%;transform:translate(-50%,-50%);width:${arrowSz}px;height:${arrowSz}px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-family:'${fonts.headline}',sans-serif;font-weight:700;font-size:${Math.round(arrowSz*0.42)}px;color:${accent};z-index:2;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="before">
      <div class="zone-label" style="background:rgba(255,255,255,0.15);">BEFORE</div>
      <div class="zone-text" style="color:rgba(255,255,255,0.72);">${beforeTxt}</div>
    </div>
    <div class="after">
      <div class="zone-label" style="background:rgba(255,255,255,0.25);color:#fff;">AFTER</div>
      <div class="zone-text" style="color:#fff;">${afterTxt}</div>
    </div>
    <div class="arrow-circle">↓</div>
  </div></body></html>`;
}

// ── Press Slide ───────────────────────────────────────────────────────────────
// "AS SEEN IN" media bar → pull quote → CTA.

export function renderPressSlide(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;
  const mediaFs = Math.round(typo.body * 0.82);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:${pad.outer}px;overflow:hidden;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.06;}` : ''}
    .top{width:100%;display:flex;flex-direction:column;align-items:center;}
    .as-seen{font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;color:${palette.body};letter-spacing:3px;text-transform:uppercase;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .media-row{display:flex;align-items:center;justify-content:center;gap:${Math.round(mediaFs*2.2)}px;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .media-name{font-family:'${fonts.headline}',sans-serif;font-size:${mediaFs}px;font-weight:700;color:${palette.headline};letter-spacing:1.5px;opacity:0.65;}
    .divider{width:${Math.round(size.width*0.78)}px;height:1px;background:${palette.body}22;position:relative;z-index:1;}
    .middle{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;z-index:1;}
    .big-quote{font-family:Georgia,serif;font-size:${Math.round(size.width*0.17)}px;color:${accent}33;line-height:0.7;margin-bottom:${Math.round(pad.gap*0.5)}px;}
    .quote{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.62)}px;font-weight:700;color:${palette.headline};text-align:center;line-height:1.25;max-width:88%;}
    .bottom{width:100%;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.85)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.88)}px;font-weight:700;padding:${Math.round(typo.cta*0.5)}px ${Math.round(typo.cta*1.4)}px;border-radius:${Math.round(typo.cta*0.4)}px;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    ${dotGridLayer(palette.headline, size.width, 0.04)}
    <div class="top">
      <div class="as-seen">As Seen In</div>
      <div class="media-row">
        ${['Forbes', 'Inc', 'TechCrunch', 'Bloomberg'].map(n => `<div class="media-name">${n}</div>`).join('')}
      </div>
      <div class="divider"></div>
    </div>
    <div class="middle">
      <div class="big-quote">"</div>
      <div class="quote">${copy.headline}</div>
    </div>
    <div class="bottom">
      <div class="brand">${branding?.brandName ?? ''}</div>
      ${copy.cta ? `<div class="cta">${copy.cta} →</div>` : ''}
    </div>
  </div></body></html>`;
}

// ── Point-Out Slide ───────────────────────────────────────────────────────────
// Central product placeholder + dash callout annotations on the right.

export function renderPointOutSlide(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  const prodW  = Math.round(size.width * 0.44);
  const prodH  = Math.round(size.height * 0.44);
  const dotSz  = Math.round(size.width * 0.028);
  const items  = (copy.body || '').split(/\||\n/).map((s: string) => s.trim()).filter(Boolean).slice(0, 3);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;padding:${pad.outer}px;overflow:hidden;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.06;}` : ''}
    .headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.62)}px;font-weight:700;color:${palette.headline};line-height:1.15;max-width:85%;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .product-zone{display:flex;flex-direction:row;flex:1;align-items:center;position:relative;z-index:1;}
    .product-box{width:${prodW}px;height:${prodH}px;background:${accent}16;border-radius:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;font-size:${Math.round(prodW*0.28)}px;color:${accent}55;}
    .dot{position:absolute;right:-${Math.round(dotSz/2)}px;width:${dotSz}px;height:${dotSz}px;border-radius:50%;background:${accent};}
    .callouts{flex:1;display:flex;flex-direction:column;justify-content:center;padding-left:${pad.inner}px;}
    .callout{display:flex;align-items:center;gap:${pad.gap}px;margin-bottom:${Math.round(prodH/(items.length+1))}px;}
    .dash{width:${Math.round(size.width*0.06)}px;height:2px;background:${accent};flex-shrink:0;}
    .callout-text{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.body*0.9)}px;color:${palette.body};line-height:1.35;}
    .brand{position:absolute;top:${pad.outer}px;right:${pad.outer}px;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.8)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    ${dotGridLayer(accent, size.width, 0.05)}
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    <div class="headline">${copy.headline}</div>
    <div class="product-zone">
      <div class="product-box">
        ✦
        ${items.map((_, i) => {
          const positions = [0.22, 0.50, 0.78];
          return `<div class="dot" style="top:${Math.round(prodH*positions[i])-Math.round(dotSz/2)}px;"></div>`;
        }).join('')}
      </div>
      <div class="callouts">
        ${items.map(item => `<div class="callout"><div class="dash"></div><div class="callout-text">${item}</div></div>`).join('')}
      </div>
    </div>
    ${copy.cta ? `<div style="margin-top:${pad.gap}px;position:relative;z-index:1;"><div style="display:inline-block;background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.88)}px;font-weight:700;padding:${Math.round(typo.cta*0.5)}px ${Math.round(typo.cta*1.4)}px;border-radius:${Math.round(typo.cta*0.4)}px;">${copy.cta} →</div></div>` : ''}
  </div></body></html>`;
}

// ── Gallery Slide ─────────────────────────────────────────────────────────────
// 2×2 tinted colour grid + footer bar with headline and CTA.

export function renderGallerySlide(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  const footerH = Math.round(size.height * 0.19);
  const gridH   = size.height - footerH;
  const gap     = 2;
  const opacities = ['cc', '99', '77', '55'];
  const labels  = (copy.body || '').split(/\||\n/).map((s: string) => s.trim()).filter(Boolean);

  const cell = (i: number, row: number, col: number) => {
    const w = Math.round(size.width / 2) - (col === 0 ? gap : 0);
    const h = Math.round(gridH / 2) - gap;
    const label = labels[i] ? `<div style="position:absolute;bottom:${Math.round(h*0.08)}px;left:${Math.round(pad.gap*0.8)}px;background:rgba(0,0,0,0.52);border-radius:5px;padding:${Math.round(typo.eyebrow*0.35)}px ${Math.round(typo.eyebrow*0.75)}px;font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;color:#fff;font-weight:700;">${labels[i]}</div>` : '';
    return `<div style="width:${w}px;height:${h}px;background:${accent}${opacities[i]};${col === 0 ? `margin-right:${gap}px;` : ''}position:relative;display:flex;align-items:center;justify-content:center;">${label}</div>`;
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;display:flex;flex-direction:column;overflow:hidden;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.08;z-index:0;}` : ''}
    .grid{width:${size.width}px;height:${gridH}px;display:flex;flex-direction:column;position:relative;z-index:1;}
    .row{display:flex;flex-direction:row;}
    .footer{width:${size.width}px;height:${footerH}px;background:${palette.background};display:flex;align-items:center;justify-content:space-between;padding:0 ${pad.outer}px;position:relative;z-index:1;}
    .footer-headline{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.headline*0.46)}px;font-weight:700;color:${palette.headline};line-height:1.15;max-width:62%;}
    .cta{background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.88)}px;font-weight:700;padding:${Math.round(typo.cta*0.5)}px ${Math.round(typo.cta*1.3)}px;border-radius:${Math.round(typo.cta*0.4)}px;}
    .brand{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.8)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="grid">
      <div class="row" style="margin-bottom:${gap}px;">
        ${cell(0, 0, 0)}${cell(1, 0, 1)}
      </div>
      <div class="row">
        ${cell(2, 1, 0)}${cell(3, 1, 1)}
      </div>
    </div>
    <div class="footer">
      <div class="footer-headline">${copy.headline}</div>
      ${copy.cta ? `<div class="cta">${copy.cta} →</div>` : branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    </div>
  </div></body></html>`;
}

// ── Chat Native ───────────────────────────────────────────────────────────────
// iMessage-style conversation — native ad feel.

export function renderChatNative(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  const headerH = Math.round(size.height * 0.12);
  const inputH  = Math.round(size.height * 0.10);
  const avaW    = Math.round(typo.body * 1.8);
  const bubbleW = Math.round(size.width * 0.72);
  const bubbleFs= Math.round(typo.body * 0.9);
  const bPad    = `${Math.round(bubbleFs*0.65)}px ${Math.round(bubbleFs*1.05)}px`;

  const parts = (copy.body || '').split(/\|/).map((s: string) => s.trim()).filter(Boolean);
  const msg1  = parts[0] || copy.headline;
  const msg2  = parts[1] || copy.cta || 'Yes, here is how we help...';
  const msg3  = parts[2] || '';

  const leftBubble = (msg: string) => `
    <div style="display:flex;justify-content:flex-start;margin-bottom:${Math.round(typo.body*0.7)}px;">
      <div style="background:#E9E9EB;color:#111111;font-family:'${fonts.body}',sans-serif;font-size:${bubbleFs}px;line-height:1.4;padding:${bPad};border-radius:18px 18px 18px 4px;max-width:${bubbleW}px;">${msg}</div>
    </div>`;

  const rightBubble = (msg: string) => `
    <div style="display:flex;justify-content:flex-end;margin-bottom:${Math.round(typo.body*0.7)}px;">
      <div style="background:${accent};color:#fff;font-family:'${fonts.body}',sans-serif;font-size:${bubbleFs}px;line-height:1.4;padding:${bPad};border-radius:18px 18px 4px 18px;max-width:${bubbleW}px;">${msg}</div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:#F2F2F7;}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;display:flex;flex-direction:column;background:#F2F2F7;overflow:hidden;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.05;}` : ''}
    .header{width:100%;height:${headerH}px;background:#fff;display:flex;align-items:center;padding:0 ${pad.outer}px;flex-shrink:0;}
    .avatar{width:${avaW}px;height:${avaW}px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:${Math.round(avaW*0.44)}px;color:#fff;margin-right:${Math.round(pad.gap*0.8)}px;flex-shrink:0;}
    .name{font-family:'${fonts.headline}',sans-serif;font-size:${typo.body}px;font-weight:700;color:#111;}
    .status{font-size:${typo.eyebrow}px;color:#34C759;margin-top:2px;}
    .messages{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:${pad.inner}px ${pad.outer}px;}
    .input-bar{width:100%;height:${inputH}px;background:#fff;display:flex;align-items:center;padding:0 ${pad.outer}px;flex-shrink:0;}
    .input-field{flex:1;height:${Math.round(typo.body*2.1)}px;background:#F2F2F7;border-radius:${Math.round(typo.body*1.05)}px;padding:0 ${pad.inner}px;display:flex;align-items:center;margin-right:${pad.gap}px;font-family:'${fonts.body}',sans-serif;font-size:${Math.round(typo.body*0.85)}px;color:#999;}
    .send-btn{width:${Math.round(typo.body*2.1)}px;height:${Math.round(typo.body*2.1)}px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:${typo.body}px;color:#fff;font-weight:700;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="header">
      <div class="avatar">★</div>
      <div>
        <div class="name">${branding?.brandName || 'Support'}</div>
        <div class="status">Usually replies instantly</div>
      </div>
    </div>
    <div class="messages">
      ${leftBubble(msg1)}
      ${rightBubble(msg2)}
      ${msg3 ? leftBubble(msg3) : ''}
    </div>
    <div class="input-bar">
      <div class="input-field">iMessage</div>
      <div class="send-btn">^</div>
    </div>
  </div></body></html>`;
}

// ── Offer Drop ────────────────────────────────────────────────────────────────
// Large circular offer badge with SAVE label + CTA.

export function renderOfferDrop(
  input: CompositorInput, size: ParsedSize, fonts: FontPairing, palette: ColorPalette,
): string {
  const typo   = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const { copy, imageUrl, branding } = input;
  const accent = input.style.primaryColor ?? palette.cta;

  const badgeSz = Math.round(Math.min(size.width, size.height) * 0.42);
  const border  = Math.round(size.width * 0.007);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('${fonts.googleUrl}');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:${palette.background};}
    .frame{position:relative;width:${size.width}px;height:${size.height}px;background:${palette.background};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad.outer}px;text-align:center;overflow:hidden;}
    ${imageUrl ? `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.07;}` : ''}
    .glow{position:absolute;width:${badgeSz*2}px;height:${badgeSz*2}px;border-radius:50%;background:${accent}10;top:50%;left:50%;transform:translate(-50%,-50%);}
    .eyebrow{display:inline-block;background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${typo.eyebrow}px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:${Math.round(typo.eyebrow*0.3)}px ${Math.round(typo.eyebrow*1.1)}px;border-radius:99px;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .offer-circle{width:${badgeSz}px;height:${badgeSz}px;border-radius:50%;background:${accent}14;border:${border}px solid ${accent};display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .save-label{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.92)}px;font-weight:700;color:${accent};letter-spacing:3px;margin-bottom:${Math.round(typo.eyebrow*0.3)}px;}
    .offer-amount{font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(badgeSz*0.37)}px;font-weight:700;color:${accent};line-height:0.95;letter-spacing:-2px;}
    .body{font-size:${typo.body}px;color:${palette.body};line-height:1.5;max-width:72%;margin-bottom:${pad.inner}px;position:relative;z-index:1;}
    .cta{display:inline-block;background:${accent};color:#fff;font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.cta*0.95)}px;font-weight:700;padding:${Math.round(typo.cta*0.55)}px ${Math.round(typo.cta*1.8)}px;border-radius:99px;position:relative;z-index:1;box-shadow:0 8px 24px ${accent}44;}
    .brand{position:absolute;top:${pad.outer}px;left:50%;transform:translateX(-50%);font-family:'${fonts.headline}',sans-serif;font-size:${Math.round(typo.eyebrow*0.8)}px;font-weight:800;color:${palette.eyebrow};letter-spacing:0.1em;text-transform:uppercase;}
  </style></head><body><div class="frame">
    ${imageUrl ? `<img class="bg" src="${imageUrl}" alt=""/>` : ''}
    <div class="glow"></div>
    ${burstSvg(accent, 'top-right', size.width, size.height, 0.10)}
    ${burstSvg(accent, 'bottom-left', size.width, size.height, 0.07, 8, 0.24)}
    ${branding?.brandName ? `<div class="brand">${branding.brandName}</div>` : ''}
    ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
    <div class="offer-circle">
      <div class="save-label">SAVE</div>
      <div class="offer-amount">${copy.headline}</div>
    </div>
    ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
    ${copy.cta  ? `<div class="cta">${copy.cta} →</div>` : ''}
  </div></body></html>`;
}
