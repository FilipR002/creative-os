// ─── Font Library ─────────────────────────────────────────────────────────────
// Curated ad-proven font pairings. Each pairing has a personality, maps to
// one or more ad tones, and loads exclusively from Google Fonts.

import type { FontPairing, AdTone } from '../types/compositor.types';

export const FONT_PAIRINGS: FontPairing[] = [
  // ── High Impact ───────────────────────────────────────────────────────────
  {
    id:        'impact-modern',
    headline:  'Bebas Neue',
    body:      'Inter',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap',
    tones:     ['bold', 'urgent', 'energetic'],
  },
  {
    id:        'heavy-condensed',
    headline:  'Oswald',
    body:      'Open Sans',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Open+Sans:wght@400;600&display=swap',
    tones:     ['bold', 'urgent'],
  },
  {
    id:        'punchy',
    headline:  'Anton',
    body:      'Roboto',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Anton&family=Roboto:wght@400;500&display=swap',
    tones:     ['energetic', 'bold'],
  },
  {
    id:        'black-grotesque',
    headline:  'Barlow Condensed',
    body:      'Barlow',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500&display=swap',
    tones:     ['bold', 'urgent', 'energetic'],
  },

  // ── Modern / Clean ────────────────────────────────────────────────────────
  {
    id:        'modern-clean',
    headline:  'DM Sans',
    body:      'DM Sans',
    googleUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap',
    tones:     ['minimal', 'friendly'],
  },
  {
    id:        'tech-saas',
    headline:  'Space Grotesk',
    body:      'Inter',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500&display=swap',
    tones:     ['minimal', 'bold'],
  },
  {
    id:        'clean-geometric',
    headline:  'Outfit',
    body:      'Outfit',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap',
    tones:     ['minimal', 'friendly'],
  },
  {
    id:        'sharp-modern',
    headline:  'Plus Jakarta Sans',
    body:      'Plus Jakarta Sans',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
    tones:     ['minimal', 'premium'],
  },

  // ── Premium / Editorial ───────────────────────────────────────────────────
  {
    id:        'editorial-serif',
    headline:  'Playfair Display',
    body:      'Lato',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Lato:wght@300;400&display=swap',
    tones:     ['premium'],
  },
  {
    id:        'luxury-editorial',
    headline:  'Cormorant Garamond',
    body:      'Montserrat',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Montserrat:wght@300;400;500&display=swap',
    tones:     ['premium'],
  },
  {
    id:        'elegant-modern',
    headline:  'Libre Baskerville',
    body:      'Source Sans 3',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@300;400;600&display=swap',
    tones:     ['premium'],
  },

  // ── Friendly / Lifestyle ──────────────────────────────────────────────────
  {
    id:        'friendly-rounded',
    headline:  'Poppins',
    body:      'Poppins',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap',
    tones:     ['friendly'],
  },
  {
    id:        'warm-soft',
    headline:  'Nunito',
    body:      'Nunito',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap',
    tones:     ['friendly'],
  },
  {
    id:        'lifestyle',
    headline:  'Raleway',
    body:      'Open Sans',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Raleway:wght@500;600;700;800&family=Open+Sans:wght@400;500&display=swap',
    tones:     ['friendly', 'premium'],
  },
];

// ─── Auto-select pairing based on tone ────────────────────────────────────────

export function selectFontPairing(tone: AdTone, overrideId?: string): FontPairing {
  if (overrideId) {
    const found = FONT_PAIRINGS.find(p => p.id === overrideId);
    if (found) return found;
  }

  const matches = FONT_PAIRINGS.filter(p => p.tones.includes(tone));
  if (!matches.length) return FONT_PAIRINGS[0];

  // Rotate selection deterministically (avoids always picking first)
  const idx = Math.floor(Date.now() / 1000) % matches.length;
  return matches[idx];
}

export function getFontPairingById(id: string): FontPairing | undefined {
  return FONT_PAIRINGS.find(p => p.id === id);
}
