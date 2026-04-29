// ─── Template: Minimal ────────────────────────────────────────────────────────
// Clean background. Image as a contained card/frame (not full-bleed).
// Lots of whitespace. Typography carries the design.
// Best for: SaaS, premium products, high-trust brands, thought leadership.

import type { CompositorInput, ParsedSize, FontPairing } from '../types/compositor.types';
import type { ColorPalette } from '../design/design-system';
import { getTypographyScale, getPadding } from '../design/design-system';

export function renderMinimal(
  input:   CompositorInput,
  size:    ParsedSize,
  fonts:   FontPairing,
  palette: ColorPalette,
): string {
  const typo = getTypographyScale(size, input.style.tone);
  const pad  = getPadding(size);
  const { copy, imageUrl, branding } = input;

  const isLight    = palette.background === '#f8f8f6' || palette.background.startsWith('#f');
  const borderCol  = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)';
  const imgRadius  = Math.round(size.width * 0.025);
  const imgHeight  = Math.round(size.height * 0.38);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('${fonts.googleUrl}');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: ${size.width}px;
      height: ${size.height}px;
      overflow: hidden;
      font-family: '${fonts.body}', sans-serif;
      background: ${palette.background};
    }

    .frame {
      width: ${size.width}px;
      height: ${size.height}px;
      background: ${palette.background};
      display: flex;
      flex-direction: column;
      padding: ${pad.outer}px;
      position: relative;
    }

    /* Top bar: brand name + eyebrow */
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: ${pad.inner}px;
    }

    .brand-name {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${Math.round(typo.eyebrow * 0.85)}px;
      font-weight: 800;
      color: ${palette.eyebrow};
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .eyebrow-tag {
      font-family: '${fonts.body}', sans-serif;
      font-size: ${Math.round(typo.eyebrow * 0.78)}px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${palette.cta};
      background: ${palette.cta}18;
      border: 1px solid ${palette.cta}33;
      padding: ${Math.round(typo.eyebrow * 0.3)}px ${Math.round(typo.eyebrow * 0.9)}px;
      border-radius: 99px;
    }

    /* Image card */
    .image-card {
      width: 100%;
      height: ${imgHeight}px;
      border-radius: ${imgRadius}px;
      overflow: hidden;
      background: ${isLight ? '#e5e5e5' : '#1f1f1f'};
      border: 1px solid ${borderCol};
      margin-bottom: ${pad.inner}px;
      flex-shrink: 0;
    }

    .image-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }

    /* Text section */
    .text-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .headline {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${Math.round(typo.headline * 0.62)}px;
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.02em;
      color: ${palette.headline};
      margin-bottom: ${pad.gap}px;
    }

    .body {
      font-size: ${Math.round(typo.body * 0.85)}px;
      font-weight: 400;
      line-height: 1.6;
      color: ${palette.body};
      margin-bottom: ${pad.inner}px;
    }

    /* Bottom bar: CTA */
    .bottom-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: auto;
      padding-top: ${pad.gap}px;
      border-top: 1px solid ${borderCol};
    }

    .cta-link {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${typo.cta}px;
      font-weight: 700;
      color: ${palette.cta};
      letter-spacing: 0.02em;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .cta-arrow {
      width: ${Math.round(typo.cta * 1.8)}px;
      height: ${Math.round(typo.cta * 1.8)}px;
      background: ${palette.cta};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${palette.ctaText};
      font-size: ${Math.round(typo.cta * 0.85)}px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="top-bar">
      ${branding?.brandName ? `<div class="brand-name">${branding.brandName}</div>` : '<div></div>'}
      ${copy.eyebrow ? `<div class="eyebrow-tag">${copy.eyebrow}</div>` : ''}
    </div>

    ${imageUrl ? `
    <div class="image-card">
      <img src="${imageUrl}" alt="" />
    </div>` : ''}

    <div class="text-section">
      <div class="headline">${copy.headline}</div>
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
    </div>

    ${copy.cta ? `
    <div class="bottom-bar">
      <div class="cta-link">${copy.cta}</div>
      <div class="cta-arrow">→</div>
    </div>` : ''}
  </div>
</body>
</html>`;
}
