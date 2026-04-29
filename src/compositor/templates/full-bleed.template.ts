// ─── Template: Full Bleed ─────────────────────────────────────────────────────
// Image fills the entire frame. Heavy gradient overlay darkens the bottom third.
// Headline + body sit on the gradient. CTA button floats above safe zone.
// Best for: single strong visual, emotional hooks, lifestyle products.

import type { CompositorInput, ParsedSize } from '../types/compositor.types';
import type { ColorPalette } from '../design/design-system';
import type { FontPairing } from '../types/compositor.types';
import { getTypographyScale, getPadding } from '../design/design-system';

export function renderFullBleed(
  input:   CompositorInput,
  size:    ParsedSize,
  fonts:   FontPairing,
  palette: ColorPalette,
): string {
  const typo    = getTypographyScale(size, input.style.tone);
  const pad     = getPadding(size);
  const { copy, imageUrl, branding } = input;

  const hasImage = !!imageUrl;

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
    }

    .frame {
      position: relative;
      width: ${size.width}px;
      height: ${size.height}px;
      overflow: hidden;
      background: ${hasImage ? '#111' : palette.background};
    }

    .bg-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }

    .overlay {
      position: absolute;
      inset: 0;
      background: ${palette.overlay};
      z-index: 1;
    }

    .content {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: ${pad.outer}px;
      padding-bottom: ${Math.round(pad.outer * 1.4)}px;
    }

    .eyebrow {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${typo.eyebrow}px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${palette.eyebrow};
      margin-bottom: ${pad.gap}px;
    }

    .headline {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${typo.headline}px;
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.02em;
      color: ${palette.headline};
      margin-bottom: ${pad.gap}px;
      text-shadow: 0 2px 20px rgba(0,0,0,0.5);
    }

    .body {
      font-size: ${typo.body}px;
      font-weight: 400;
      line-height: 1.5;
      color: ${palette.body};
      margin-bottom: ${pad.inner}px;
      max-width: 85%;
      text-shadow: 0 1px 8px rgba(0,0,0,0.4);
    }

    .cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: ${palette.cta};
      color: ${palette.ctaText};
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${typo.cta}px;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: ${Math.round(typo.cta * 0.65)}px ${Math.round(typo.cta * 1.6)}px;
      border-radius: ${Math.round(typo.cta * 0.5)}px;
      width: fit-content;
    }

    .logo {
      position: absolute;
      top: ${pad.outer}px;
      left: ${pad.outer}px;
      z-index: 3;
    }

    .logo img {
      height: ${Math.round(size.height * 0.045)}px;
      object-fit: contain;
    }

    .brand-name {
      position: absolute;
      top: ${pad.outer}px;
      left: ${pad.outer}px;
      z-index: 3;
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${Math.round(typo.eyebrow * 1.1)}px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-shadow: 0 1px 8px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <div class="frame">
    ${hasImage ? `<img class="bg-image" src="${imageUrl}" alt="" />` : ''}
    ${hasImage ? '<div class="overlay"></div>' : ''}

    ${branding?.logoUrl
      ? `<div class="logo"><img src="${branding.logoUrl}" alt="" /></div>`
      : branding?.brandName
        ? `<div class="brand-name">${branding.brandName}</div>`
        : ''}

    <div class="content">
      ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
      <div class="headline">${copy.headline}</div>
      ${copy.body    ? `<div class="body">${copy.body}</div>` : ''}
      ${copy.cta     ? `<div class="cta-btn">${copy.cta} →</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}
