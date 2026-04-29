// ─── Template: UGC Style ─────────────────────────────────────────────────────
// Looks like a real social post — phone-native, casual, no-ad feel.
// Simulates an Instagram/TikTok post with avatar, handle, caption.
// Best for: UGC ads, testimonials, organic-looking paid social.

import type { CompositorInput, ParsedSize, FontPairing } from '../types/compositor.types';
import type { ColorPalette } from '../design/design-system';
import { getTypographyScale, getPadding } from '../design/design-system';

export function renderUGCStyle(
  input:   CompositorInput,
  size:    ParsedSize,
  fonts:   FontPairing,
  palette: ColorPalette,
): string {
  const typo = getTypographyScale(size, input.style.tone);
  const pad  = getPadding(size);
  const { copy, imageUrl, branding, style } = input;

  const avatarSize   = Math.round(size.width * 0.1);
  const headerHeight = Math.round(avatarSize * 1.8);
  const footerHeight = Math.round(size.height * 0.14);
  const imgHeight    = size.height - headerHeight - footerHeight;

  const isInstagram = style.platform?.toLowerCase().includes('instagram');
  const isTikTok    = style.platform?.toLowerCase().includes('tiktok');

  // Platform-specific accent
  const platformColor = isTikTok
    ? '#fe2c55'
    : isInstagram
      ? '#c13584'
      : palette.cta;

  const handle = branding?.brandName
    ? `@${branding.brandName.toLowerCase().replace(/\s+/g, '_')}`
    : '@brand';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('${fonts.googleUrl}');
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: ${size.width}px;
      height: ${size.height}px;
      overflow: hidden;
      font-family: 'Inter', '${fonts.body}', sans-serif;
      background: #000;
    }

    .frame {
      position: relative;
      width: ${size.width}px;
      height: ${size.height}px;
      background: #000;
      overflow: hidden;
    }

    /* ── Full background image ─────────────────────────────────── */
    .bg-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }

    /* ── Header: avatar + handle ───────────────────────────────── */
    .header {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: ${headerHeight}px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%);
      display: flex;
      align-items: center;
      padding: ${Math.round(pad.outer * 0.7)}px;
      gap: ${Math.round(avatarSize * 0.4)}px;
      z-index: 3;
    }

    .avatar {
      width: ${avatarSize}px;
      height: ${avatarSize}px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${platformColor}, ${platformColor}88);
      border: 2px solid rgba(255,255,255,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', sans-serif;
      font-size: ${Math.round(avatarSize * 0.38)}px;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .handle-group { display: flex; flex-direction: column; gap: 2px; }

    .handle {
      font-family: 'Inter', sans-serif;
      font-size: ${Math.round(typo.body * 0.82)}px;
      font-weight: 700;
      color: #fff;
    }

    .verified {
      font-family: 'Inter', sans-serif;
      font-size: ${Math.round(typo.eyebrow * 0.85)}px;
      font-weight: 500;
      color: rgba(255,255,255,0.55);
    }

    .follow-btn {
      margin-left: auto;
      background: ${platformColor};
      color: #fff;
      font-family: 'Inter', sans-serif;
      font-size: ${Math.round(typo.eyebrow * 0.9)}px;
      font-weight: 700;
      padding: ${Math.round(typo.eyebrow * 0.35)}px ${Math.round(typo.eyebrow * 1.1)}px;
      border-radius: 6px;
      flex-shrink: 0;
    }

    /* ── Caption area at bottom ────────────────────────────────── */
    .caption-area {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 60%, transparent 100%);
      padding: ${Math.round(pad.outer * 1.2)}px ${Math.round(pad.outer * 0.8)}px ${Math.round(pad.outer * 0.9)}px;
      z-index: 3;
    }

    .caption-headline {
      font-family: '${fonts.headline}', sans-serif;
      font-size: ${Math.round(typo.headline * 0.48)}px;
      font-weight: 700;
      line-height: 1.2;
      color: #fff;
      margin-bottom: ${Math.round(pad.gap * 0.6)}px;
    }

    .caption-body {
      font-family: 'Inter', sans-serif;
      font-size: ${Math.round(typo.body * 0.72)}px;
      font-weight: 400;
      line-height: 1.45;
      color: rgba(255,255,255,0.82);
      margin-bottom: ${Math.round(pad.gap * 0.8)}px;
    }

    .caption-body .bold { font-weight: 700; color: #fff; }

    .cta-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: ${platformColor};
      color: #fff;
      font-family: 'Inter', sans-serif;
      font-size: ${Math.round(typo.eyebrow * 1.05)}px;
      font-weight: 700;
      padding: ${Math.round(typo.eyebrow * 0.45)}px ${Math.round(typo.eyebrow * 1.3)}px;
      border-radius: 99px;
    }

    /* ── Right side interactions (TikTok style) ─────────────────── */
    .interactions {
      position: absolute;
      right: ${Math.round(pad.outer * 0.65)}px;
      bottom: ${Math.round(footerHeight * 1.4)}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: ${Math.round(pad.inner * 0.9)}px;
      z-index: 3;
    }

    .interaction-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }

    .interaction-icon {
      width: ${Math.round(avatarSize * 0.9)}px;
      height: ${Math.round(avatarSize * 0.9)}px;
      background: rgba(255,255,255,0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${Math.round(avatarSize * 0.4)}px;
    }

    .interaction-count {
      font-family: 'Inter', sans-serif;
      font-size: ${Math.round(typo.eyebrow * 0.8)}px;
      font-weight: 600;
      color: rgba(255,255,255,0.85);
    }
  </style>
</head>
<body>
  <div class="frame">
    ${imageUrl ? `<img class="bg-image" src="${imageUrl}" alt="" />` : ''}

    <!-- Header -->
    <div class="header">
      <div class="avatar">${(branding?.brandName ?? 'B')[0].toUpperCase()}</div>
      <div class="handle-group">
        <div class="handle">${handle}</div>
        <div class="verified">Sponsored</div>
      </div>
      <div class="follow-btn">Follow</div>
    </div>

    <!-- TikTok-style right interactions -->
    ${isTikTok ? `
    <div class="interactions">
      <div class="interaction-item">
        <div class="interaction-icon">♥</div>
        <div class="interaction-count">24.7K</div>
      </div>
      <div class="interaction-item">
        <div class="interaction-icon">💬</div>
        <div class="interaction-count">1.2K</div>
      </div>
      <div class="interaction-item">
        <div class="interaction-icon">↗</div>
        <div class="interaction-count">Share</div>
      </div>
    </div>` : ''}

    <!-- Caption -->
    <div class="caption-area">
      <div class="caption-headline">${copy.headline}</div>
      ${copy.body ? `<div class="caption-body">${copy.body}</div>` : ''}
      ${copy.cta  ? `<div class="cta-pill">${copy.cta} →</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}
