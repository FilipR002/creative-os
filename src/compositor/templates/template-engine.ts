// ─── Template Engine ──────────────────────────────────────────────────────────
// Routes a CompositorInput to the correct template renderer.
// Also handles auto-template selection based on tone + format.

import type { CompositorInput, TemplateId, ParsedSize, AdTone, FontPairing } from '../types/compositor.types';
import type { ColorPalette } from '../design/design-system';
import { renderFullBleed }    from './full-bleed.template';
import { renderSplitPanel }   from './split-panel.template';
import { renderBoldHeadline } from './bold-headline.template';
import { renderMinimal }      from './minimal.template';
import { renderUGCStyle }     from './ugc-style.template';

// ─── Route to template renderer ───────────────────────────────────────────────

export function renderTemplate(
  input:   CompositorInput,
  size:    ParsedSize,
  fonts:   FontPairing,
  palette: ColorPalette,
): string {
  switch (input.templateId) {
    case 'full-bleed':    return renderFullBleed(input, size, fonts, palette);
    case 'split-panel':   return renderSplitPanel(input, size, fonts, palette);
    case 'bold-headline': return renderBoldHeadline(input, size, fonts, palette);
    case 'minimal':       return renderMinimal(input, size, fonts, palette);
    case 'ugc-style':     return renderUGCStyle(input, size, fonts, palette);
    default:              return renderFullBleed(input, size, fonts, palette);
  }
}

// ─── Auto-select best template based on context ───────────────────────────────

export function autoSelectTemplate(
  tone:        AdTone,
  platform:    string,
  hasImage:    boolean,
  isVideoMode?: boolean,
): TemplateId {
  const p = platform.toLowerCase();

  if (isVideoMode) return 'bold-headline';

  // UGC style for social-native platforms
  if (p.includes('tiktok') || (p.includes('instagram') && tone === 'friendly')) {
    return 'ugc-style';
  }

  // Bold/urgent tones → bold headline
  if (tone === 'bold' || tone === 'urgent' || tone === 'energetic') {
    return hasImage ? 'bold-headline' : 'bold-headline';
  }

  // Premium → minimal or split panel
  if (tone === 'premium') {
    return hasImage ? 'split-panel' : 'minimal';
  }

  // Minimal/SaaS → minimal
  if (tone === 'minimal') {
    return 'minimal';
  }

  // Friendly with image → full bleed (lifestyle feel)
  if (tone === 'friendly' && hasImage) {
    return 'full-bleed';
  }

  // Default: full bleed with image, minimal without
  return hasImage ? 'full-bleed' : 'minimal';
}

// ─── Template metadata (for UI picker in Phase 6) ─────────────────────────────

export interface TemplateMetadata {
  id:          TemplateId;
  name:        string;
  description: string;
  bestFor:     string[];
  tones:       AdTone[];
  requiresImage: boolean;
}

export const TEMPLATE_CATALOG: TemplateMetadata[] = [
  {
    id:          'full-bleed',
    name:        'Full Bleed',
    description: 'Image fills frame with gradient overlay and text at bottom',
    bestFor:     ['lifestyle', 'emotional hooks', 'single strong visual'],
    tones:       ['bold', 'friendly', 'energetic', 'urgent'],
    requiresImage: true,
  },
  {
    id:          'split-panel',
    name:        'Split Panel',
    description: 'Image on one half, copy on the other — clean and readable',
    bestFor:     ['product shots', 'before/after', 'comparison', 'DTC'],
    tones:       ['minimal', 'premium', 'bold'],
    requiresImage: true,
  },
  {
    id:          'bold-headline',
    name:        'Bold Headline',
    description: 'Massive typography over dimmed background — impossible to miss',
    bestFor:     ['direct response', 'hooks', 'bold claims', 'urgency'],
    tones:       ['bold', 'urgent', 'energetic'],
    requiresImage: false,
  },
  {
    id:          'minimal',
    name:        'Minimal',
    description: 'Clean layout with lots of whitespace — typography-led design',
    bestFor:     ['SaaS', 'premium', 'high-trust', 'thought leadership'],
    tones:       ['minimal', 'premium', 'friendly'],
    requiresImage: false,
  },
  {
    id:          'ugc-style',
    name:        'UGC Style',
    description: 'Looks like a real social post — organic, casual, native feel',
    bestFor:     ['UGC ads', 'testimonials', 'social-native', 'TikTok'],
    tones:       ['friendly', 'energetic'],
    requiresImage: true,
  },
];
