// ─── Design System ────────────────────────────────────────────────────────────
// Spacing, typography scale, color palettes, platform safe zones.
// Every template reads from here — never hardcodes values.

import type { AdSize, AdTone, ColorScheme, ParsedSize } from '../types/compositor.types';

// ─── Size parsing ─────────────────────────────────────────────────────────────

export function parseSize(size: AdSize): ParsedSize {
  const [w, h] = size.split('x').map(Number);
  return { width: w, height: h, label: size };
}

// ─── Typography scale (relative to canvas width) ──────────────────────────────

export interface TypographyScale {
  eyebrow:   number;  // px
  headline:  number;
  subtext:   number;
  body:      number;
  cta:       number;
}

export function getTypographyScale(size: ParsedSize, tone: AdTone): TypographyScale {
  const base = size.width / 1080;  // scale factor (1.0 for 1080px)

  const scales: Record<AdTone, TypographyScale> = {
    bold:      { eyebrow: 14, headline: 86, subtext: 22, body: 24, cta: 20 },
    urgent:    { eyebrow: 13, headline: 80, subtext: 20, body: 22, cta: 19 },
    energetic: { eyebrow: 14, headline: 92, subtext: 22, body: 24, cta: 20 },
    minimal:   { eyebrow: 12, headline: 64, subtext: 20, body: 22, cta: 18 },
    premium:   { eyebrow: 11, headline: 60, subtext: 18, body: 20, cta: 16 },
    friendly:  { eyebrow: 13, headline: 68, subtext: 20, body: 22, cta: 18 },
  };

  const s = scales[tone] ?? scales.minimal;
  return {
    eyebrow:  Math.round(s.eyebrow  * base),
    headline: Math.round(s.headline * base),
    subtext:  Math.round(s.subtext  * base),
    body:     Math.round(s.body     * base),
    cta:      Math.round(s.cta      * base),
  };
}

// ─── Padding / spacing ────────────────────────────────────────────────────────

export function getPadding(size: ParsedSize) {
  const p = Math.round(size.width * 0.065);
  return { outer: p, inner: Math.round(p * 0.6), gap: Math.round(p * 0.4) };
}

// ─── Platform safe zones (px from edge) ──────────────────────────────────────
// Keeps text away from UI chrome on each platform

export function getSafeZone(platform: string, size: ParsedSize) {
  const base = size.width * 0.05;
  const zones: Record<string, { top: number; bottom: number; side: number }> = {
    tiktok:    { top: size.height * 0.12, bottom: size.height * 0.22, side: base * 1.4 },
    instagram: { top: base,               bottom: size.height * 0.12, side: base },
    reels:     { top: size.height * 0.10, bottom: size.height * 0.20, side: base * 1.2 },
    facebook:  { top: base,               bottom: base * 1.5,         side: base },
    youtube:   { top: base * 1.5,         bottom: base * 1.5,         side: base * 2 },
    google:    { top: base,               bottom: base,               side: base },
    meta:      { top: base,               bottom: base * 1.5,         side: base },
  };
  return zones[platform.toLowerCase()] ?? zones.meta;
}

// ─── Color palettes ───────────────────────────────────────────────────────────

export interface ColorPalette {
  background:  string;
  surface:     string;
  headline:    string;
  body:        string;
  cta:         string;
  ctaText:     string;
  overlay:     string;   // gradient overlay on images
  eyebrow:     string;
}

export function getColorPalette(
  scheme: ColorScheme,
  tone: AdTone,
  primaryColor?: string,
): ColorPalette {
  const accent = primaryColor ?? toneAccent(tone);

  const palettes: Record<ColorScheme, ColorPalette> = {
    dark: {
      background: '#0a0a0a',
      surface:    '#141414',
      headline:   '#ffffff',
      body:       'rgba(255,255,255,0.82)',
      cta:        accent,
      ctaText:    '#ffffff',
      overlay:    'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.1) 100%)',
      eyebrow:    accent,
    },
    light: {
      background: '#f8f8f6',
      surface:    '#ffffff',
      headline:   '#0d0d0d',
      body:       'rgba(0,0,0,0.72)',
      cta:        accent,
      ctaText:    '#ffffff',
      overlay:    'linear-gradient(to top, rgba(248,248,246,0.95) 0%, rgba(248,248,246,0.6) 55%, rgba(248,248,246,0.05) 100%)',
      eyebrow:    accent,
    },
    brand: {
      background: accent,
      surface:    shadeColor(accent, -15),
      headline:   '#ffffff',
      body:       'rgba(255,255,255,0.88)',
      cta:        '#ffffff',
      ctaText:    accent,
      overlay:    `linear-gradient(to top, ${accent}f0 0%, ${accent}80 50%, transparent 100%)`,
      eyebrow:    'rgba(255,255,255,0.7)',
    },
    gradient: {
      background: `linear-gradient(135deg, ${shadeColor(accent, -20)} 0%, ${accent} 50%, ${shadeColor(accent, 20)} 100%)`,
      surface:    'rgba(255,255,255,0.1)',
      headline:   '#ffffff',
      body:       'rgba(255,255,255,0.85)',
      cta:        '#ffffff',
      ctaText:    accent,
      overlay:    'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
      eyebrow:    'rgba(255,255,255,0.7)',
    },
  };

  return palettes[scheme] ?? palettes.dark;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toneAccent(tone: AdTone): string {
  const map: Record<AdTone, string> = {
    bold:      '#6366f1',
    urgent:    '#ef4444',
    energetic: '#f97316',
    minimal:   '#18181b',
    premium:   '#92400e',
    friendly:  '#10b981',
  };
  return map[tone] ?? '#6366f1';
}

function shadeColor(hex: string, percent: number): string {
  const num    = parseInt(hex.replace('#', ''), 16);
  const r      = Math.min(255, Math.max(0, (num >> 16) + percent * 2.55));
  const g      = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent * 2.55));
  const b      = Math.min(255, Math.max(0, (num & 0xff) + percent * 2.55));
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

// ─── Contrast check (WCAG AA) ─────────────────────────────────────────────────

export function ensureContrast(textColor: string, bgColor: string): string {
  // If bg is dark, force white text. If light, force near-black.
  // Simple luminance heuristic.
  const bg = bgColor.startsWith('#') ? bgColor : '#1a1a1a';
  const num = parseInt(bg.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8)  & 0xff;
  const b =  num        & 0xff;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luminance > 180) return textColor === '#ffffff' ? '#0a0a0a' : textColor;
  return textColor === '#0a0a0a' ? '#ffffff' : textColor;
}
