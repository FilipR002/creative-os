// ─── Template: Bold Headline ──────────────────────────────────────────────────
// Massive typography is the hero. Image sits behind a heavy overlay.
// Text is BIG, centered, impossible to miss.
// Best for: direct response, hooks, bold claims, urgency ads.

import type { CompositorInput, ParsedSize, FontPairing } from '../types/compositor.types';
import type { ColorPalette } from '../design/design-system';
import { getTypographyScale, getPadding } from '../design/design-system';

export function renderBoldHeadline(
  input:   CompositorInput,
  size:    ParsedSize,
  fonts:   FontPairing,
  palette: ColorPalette,
): string {
  const typo = getTypographyScale(size, input.style.tone);
  const pad  = getPadding(size);
  const { copy, imageUrl, branding } = input;

  // Bold headline gets even bigger type
  const heroSize = Math.round(typo.headline * 1.15);

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
      background: ${palette.background};
    }

    .bg-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
      filter: brightness(0.28) saturate(0.8);
    }

    /* Noise texture overlay for texture */
    .noise {
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
      z-index: 1;
      opacity: 0.06;
    }

    .content {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: ${pad.outer}px;
    }

    .eyebrow {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${typo.eyebrow}px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${palette.cta};
      margin-bottom: ${pad.inner}px;
      background: ${palette.cta}22;
      border: 1px solid ${palette.cta}55;
      padding: ${Math.round(typo.eyebrow * 0.4)}px ${Math.round(typo.eyebrow * 1.1)}px;
      border-radius: 99px;
    }

    .headline {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${heroSize}px;
      font-weight: 900;
      line-height: 0.96;
      letter-spacing: -0.035em;
      color: #ffffff;
      text-transform: uppercase;
      margin-bottom: ${pad.inner}px;
      /* Multi-line text: each word can be on its own line */
      word-break: break-word;
    }

    /* Accent colour on last word of headline */
    .headline .accent { color: ${palette.cta}; }

    .divider {
      width: ${Math.round(size.width * 0.08)}px;
      height: ${Math.round(size.width * 0.005)}px;
      background: ${palette.cta};
      border-radius: 2px;
      margin: ${pad.gap}px auto;
    }

    .body {
      font-size: ${typo.body}px;
      font-weight: 400;
      line-height: 1.5;
      color: rgba(255,255,255,0.78);
      max-width: 78%;
      margin-bottom: ${pad.inner}px;
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
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: ${Math.round(typo.cta * 0.7)}px ${Math.round(typo.cta * 1.8)}px;
      border-radius: ${Math.round(typo.cta * 0.5)}px;
      margin-top: ${pad.gap}px;
    }

    .brand-name {
      position: absolute;
      top: ${pad.outer}px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 3;
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${Math.round(typo.eyebrow * 0.9)}px;
      font-weight: 800;
      color: rgba(255,255,255,0.5);
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="frame">
    ${imageUrl ? `<img class="bg-image" src="${imageUrl}" alt="" />` : ''}
    <div class="noise"></div>

    ${branding?.brandName ? `<div class="brand-name">${branding.brandName}</div>` : ''}

    <div class="content">
      ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
      <div class="headline">${formatHeadlineAccent(copy.headline)}</div>
      <div class="divider"></div>
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      ${copy.cta  ? `<div class="cta-btn">${copy.cta} ↗</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

// Accent the last word of the headline in the CTA colour
function formatHeadlineAccent(headline: string): string {
  const words = headline.trim().split(' ');
  if (words.length <= 1) return headline;
  const last    = words.pop();
  const rest    = words.join(' ');
  return `${rest} <span class="accent">${last}</span>`;
}
