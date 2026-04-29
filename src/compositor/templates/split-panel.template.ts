// ─── Template: Split Panel ────────────────────────────────────────────────────
// Image on one half, copy on the other. Clean, readable, high contrast.
// For square: left image / right copy. For landscape: same. For story: top/bottom.
// Best for: product shots, before/after, comparison ads, DTC.

import type { CompositorInput, ParsedSize } from '../types/compositor.types';
import type { FontPairing }  from '../types/compositor.types';
import type { ColorPalette } from '../design/design-system';
import { getTypographyScale, getPadding } from '../design/design-system';

export function renderSplitPanel(
  input:   CompositorInput,
  size:    ParsedSize,
  fonts:   FontPairing,
  palette: ColorPalette,
): string {
  const typo      = getTypographyScale(size, input.style.tone);
  const pad       = getPadding(size);
  const { copy, imageUrl, branding } = input;

  const isStory   = size.height > size.width;
  const textBg    = palette.background;
  const hasImage  = !!imageUrl;

  const imageStyle = isStory
    ? `width: 100%; height: 50%;`
    : `width: 50%; height: 100%;`;

  const textStyle = isStory
    ? `width: 100%; height: 50%;`
    : `width: 50%; height: 100%;`;

  const flexDir = isStory ? 'column' : 'row';

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
      display: flex;
      flex-direction: ${flexDir};
      width: ${size.width}px;
      height: ${size.height}px;
      overflow: hidden;
    }

    .image-pane {
      position: relative;
      ${imageStyle}
      overflow: hidden;
      background: #1a1a1a;
      flex-shrink: 0;
    }

    .image-pane img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }

    /* Subtle edge fade toward the text pane */
    .image-pane::after {
      content: '';
      position: absolute;
      inset: 0;
      background: ${isStory
        ? 'linear-gradient(to bottom, transparent 70%, ' + textBg + ' 100%)'
        : 'linear-gradient(to right, transparent 70%, ' + textBg + ' 100%)'};
    }

    .text-pane {
      ${textStyle}
      background: ${textBg};
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: ${pad.outer}px;
      flex-shrink: 0;
    }

    .eyebrow {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${typo.eyebrow}px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${palette.eyebrow};
      margin-bottom: ${pad.gap}px;
    }

    .accent-bar {
      width: ${Math.round(size.width * 0.045)}px;
      height: ${Math.round(size.width * 0.006)}px;
      background: ${palette.cta};
      border-radius: 2px;
      margin-bottom: ${pad.inner}px;
    }

    .headline {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${Math.round(typo.headline * 0.72)}px;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.02em;
      color: ${palette.headline};
      margin-bottom: ${pad.inner}px;
    }

    .body {
      font-size: ${Math.round(typo.body * 0.88)}px;
      font-weight: 400;
      line-height: 1.6;
      color: ${palette.body};
      margin-bottom: ${pad.inner}px;
    }

    .cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: ${palette.cta};
      color: ${palette.ctaText};
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${Math.round(typo.cta * 0.9)}px;
      font-weight: 700;
      letter-spacing: 0.03em;
      padding: ${Math.round(typo.cta * 0.55)}px ${Math.round(typo.cta * 1.4)}px;
      border-radius: ${Math.round(typo.cta * 0.45)}px;
      width: fit-content;
      margin-top: ${pad.gap}px;
    }

    .brand-name {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${Math.round(typo.eyebrow * 0.9)}px;
      font-weight: 800;
      color: ${palette.eyebrow};
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: ${pad.inner}px;
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="image-pane">
      ${hasImage ? `<img src="${imageUrl}" alt="" />` : ''}
    </div>
    <div class="text-pane">
      ${branding?.brandName ? `<div class="brand-name">${branding.brandName}</div>` : ''}
      <div class="accent-bar"></div>
      ${copy.eyebrow ? `<div class="eyebrow">${copy.eyebrow}</div>` : ''}
      <div class="headline">${copy.headline}</div>
      ${copy.body ? `<div class="body">${copy.body}</div>` : ''}
      ${copy.cta  ? `<div class="cta-btn">${copy.cta} →</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}
