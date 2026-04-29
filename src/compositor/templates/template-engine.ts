// ─── Template Engine ──────────────────────────────────────────────────────────
// Routes a CompositorInput to the correct template renderer.
// Also handles auto-template selection based on tone + format + slide type.

import type { CompositorInput, TemplateId, ParsedSize, AdTone, FontPairing } from '../types/compositor.types';
import type { ColorPalette } from '../design/design-system';
import { renderFullBleed }    from './full-bleed.template';
import { renderSplitPanel }   from './split-panel.template';
import { renderBoldHeadline } from './bold-headline.template';
import { renderMinimal }      from './minimal.template';
import { renderUGCStyle }     from './ugc-style.template';
import {
  renderTestimonial,
  renderStatsHero,
  renderFeatureList,
  renderCtaFinal,
  renderGradientPop,
  renderDarkLuxury,
  renderBrightMinimal,
  renderStoryHook,
  renderProblemSlide,
  renderTextOnlyBold,
} from './extended-templates';
import {
  renderProductCenter,
  renderNeonDark,
  renderMagazineEditorial,
  renderColorBlock,
  renderFloatingCard,
  renderCountdownUrgency,
  renderSocialProofGrid,
  renderHeadlineBadge,
  renderSideBySide,
  renderDiagonalSplit,
  renderOverlayCard,
  renderNumberList,
  renderBrandManifesto,
  renderProductDemo,
  renderRetroBold,
} from './extended-templates-2';

// ─── Route to template renderer ───────────────────────────────────────────────

export function renderTemplate(
  input:   CompositorInput,
  size:    ParsedSize,
  fonts:   FontPairing,
  palette: ColorPalette,
): string {
  switch (input.templateId) {
    // ── Base 5 ────────────────────────────────────────────────────────────────
    case 'full-bleed':      return renderFullBleed(input, size, fonts, palette);
    case 'split-panel':     return renderSplitPanel(input, size, fonts, palette);
    case 'bold-headline':   return renderBoldHeadline(input, size, fonts, palette);
    case 'minimal':         return renderMinimal(input, size, fonts, palette);
    case 'ugc-style':       return renderUGCStyle(input, size, fonts, palette);
    // ── Extended 10 ───────────────────────────────────────────────────────────
    case 'testimonial':     return renderTestimonial(input, size, fonts, palette);
    case 'stats-hero':      return renderStatsHero(input, size, fonts, palette);
    case 'feature-list':    return renderFeatureList(input, size, fonts, palette);
    case 'cta-final':       return renderCtaFinal(input, size, fonts, palette);
    case 'gradient-pop':    return renderGradientPop(input, size, fonts, palette);
    case 'dark-luxury':     return renderDarkLuxury(input, size, fonts, palette);
    case 'bright-minimal':  return renderBrightMinimal(input, size, fonts, palette);
    case 'story-hook':      return renderStoryHook(input, size, fonts, palette);
    case 'problem-slide':   return renderProblemSlide(input, size, fonts, palette);
    case 'text-only-bold':  return renderTextOnlyBold(input, size, fonts, palette);
    // ── Extended Batch 2 (16–30) ─────────────────────────────────────────────
    case 'product-center':     return renderProductCenter(input, size, fonts, palette);
    case 'neon-dark':          return renderNeonDark(input, size, fonts, palette);
    case 'magazine-editorial': return renderMagazineEditorial(input, size, fonts, palette);
    case 'color-block':        return renderColorBlock(input, size, fonts, palette);
    case 'floating-card':      return renderFloatingCard(input, size, fonts, palette);
    case 'countdown-urgency':  return renderCountdownUrgency(input, size, fonts, palette);
    case 'social-proof-grid':  return renderSocialProofGrid(input, size, fonts, palette);
    case 'headline-badge':     return renderHeadlineBadge(input, size, fonts, palette);
    case 'side-by-side':       return renderSideBySide(input, size, fonts, palette);
    case 'diagonal-split':     return renderDiagonalSplit(input, size, fonts, palette);
    case 'overlay-card':       return renderOverlayCard(input, size, fonts, palette);
    case 'number-list':        return renderNumberList(input, size, fonts, palette);
    case 'brand-manifesto':    return renderBrandManifesto(input, size, fonts, palette);
    case 'product-demo':       return renderProductDemo(input, size, fonts, palette);
    case 'retro-bold':         return renderRetroBold(input, size, fonts, palette);
    default:                   return renderFullBleed(input, size, fonts, palette);
  }
}

// ─── Auto-select best template based on context ───────────────────────────────
// slideType mirrors carousel slide roles: cover | problem | proof | feature | cta
// For banners, platform + tone drive selection.

export function autoSelectTemplate(
  tone:        AdTone,
  platform:    string,
  hasImage:    boolean,
  isVideoMode?: boolean,
  slideType?:  'cover' | 'problem' | 'proof' | 'feature' | 'cta' | 'hook' | string,
): TemplateId {
  const p = platform.toLowerCase();

  if (isVideoMode) return 'bold-headline';

  // ── Slide-type-aware selection (carousel) ──────────────────────────────────
  if (slideType) {
    switch (slideType) {
      case 'cover':
      case 'hook':
        return p.includes('tiktok') ? 'story-hook'
             : tone === 'premium'   ? 'dark-luxury'
             : tone === 'minimal'   ? 'bright-minimal'
             : hasImage             ? 'full-bleed'
             :                        'bold-headline';

      case 'problem':
        return 'problem-slide';

      case 'proof':
        // Stats or testimonial — pick based on whether headline looks like a number
        return 'testimonial'; // can be overridden by service logic

      case 'feature':
        return 'feature-list';

      case 'cta':
        return 'cta-final';
    }
  }

  // ── Platform-first heuristics ──────────────────────────────────────────────
  if (p.includes('tiktok')) return 'story-hook';
  if (p.includes('instagram') && tone === 'friendly') return 'ugc-style';
  if (p.includes('display') || p.includes('google')) return 'bright-minimal';

  // ── Tone-first fallbacks ───────────────────────────────────────────────────
  switch (tone) {
    case 'bold':
    case 'urgent':
    case 'energetic':
      return hasImage ? 'bold-headline' : 'gradient-pop';

    case 'premium':
      return hasImage ? 'dark-luxury' : 'split-panel';

    case 'minimal':
      return hasImage ? 'bright-minimal' : 'minimal';

    case 'friendly':
      return hasImage ? 'full-bleed' : 'ugc-style';
  }

  // Default
  return hasImage ? 'full-bleed' : 'minimal';
}

// ─── Template metadata (for UI picker in Phase 6) ─────────────────────────────

export interface TemplateMetadata {
  id:            TemplateId;
  name:          string;
  description:   string;
  bestFor:       string[];
  tones:         AdTone[];
  requiresImage: boolean;
}

export const TEMPLATE_CATALOG: TemplateMetadata[] = [
  // ── Base 5 ──────────────────────────────────────────────────────────────────
  {
    id:            'full-bleed',
    name:          'Full Bleed',
    description:   'Image fills frame with gradient overlay and text at bottom',
    bestFor:       ['lifestyle', 'emotional hooks', 'single strong visual'],
    tones:         ['bold', 'friendly', 'energetic', 'urgent'],
    requiresImage: true,
  },
  {
    id:            'split-panel',
    name:          'Split Panel',
    description:   'Image on one half, copy on the other — clean and readable',
    bestFor:       ['product shots', 'before/after', 'comparison', 'DTC'],
    tones:         ['minimal', 'premium', 'bold'],
    requiresImage: true,
  },
  {
    id:            'bold-headline',
    name:          'Bold Headline',
    description:   'Massive typography over dimmed background — impossible to miss',
    bestFor:       ['direct response', 'hooks', 'bold claims', 'urgency'],
    tones:         ['bold', 'urgent', 'energetic'],
    requiresImage: false,
  },
  {
    id:            'minimal',
    name:          'Minimal',
    description:   'Clean layout with lots of whitespace — typography-led design',
    bestFor:       ['SaaS', 'premium', 'high-trust', 'thought leadership'],
    tones:         ['minimal', 'premium', 'friendly'],
    requiresImage: false,
  },
  {
    id:            'ugc-style',
    name:          'UGC Style',
    description:   'Looks like a real social post — organic, casual, native feel',
    bestFor:       ['UGC ads', 'testimonials', 'social-native', 'TikTok'],
    tones:         ['friendly', 'energetic'],
    requiresImage: true,
  },
  // ── Extended 10 ─────────────────────────────────────────────────────────────
  {
    id:            'testimonial',
    name:          'Testimonial',
    description:   'Customer quote as hero — stars, name, avatar, brand top-right',
    bestFor:       ['social proof', 'review ads', 'trust-building', 'e-com'],
    tones:         ['friendly', 'minimal', 'premium'],
    requiresImage: false,
  },
  {
    id:            'stats-hero',
    name:          'Stats Hero',
    description:   'Giant statistic as visual anchor — great for data-driven claims',
    bestFor:       ['proof slides', 'data claims', 'SaaS metrics', 'before/after'],
    tones:         ['bold', 'minimal', 'energetic'],
    requiresImage: false,
  },
  {
    id:            'feature-list',
    name:          'Feature List',
    description:   'Icon + text rows — clear checklist-style benefit communication',
    bestFor:       ['feature slides', 'comparison', 'app benefits', 'SaaS'],
    tones:         ['minimal', 'friendly', 'premium'],
    requiresImage: false,
  },
  {
    id:            'cta-final',
    name:          'CTA Final',
    description:   'Closing slide built around one action — offer, urgency, button',
    bestFor:       ['carousel finisher', 'offer slide', 'direct response'],
    tones:         ['bold', 'urgent', 'energetic', 'friendly'],
    requiresImage: false,
  },
  {
    id:            'gradient-pop',
    name:          'Gradient Pop',
    description:   'Vivid brand gradient background — eye-catching, scroll-stopping',
    bestFor:       ['product launch', 'sale announcement', 'app promo'],
    tones:         ['bold', 'energetic', 'friendly'],
    requiresImage: false,
  },
  {
    id:            'dark-luxury',
    name:          'Dark Luxury',
    description:   'Deep dark tones with gold/platinum accents — premium positioning',
    bestFor:       ['luxury brands', 'high-ticket', 'premium offers', 'fashion'],
    tones:         ['premium'],
    requiresImage: true,
  },
  {
    id:            'bright-minimal',
    name:          'Bright Minimal',
    description:   'Pure white canvas with one brand-color accent — clean and sharp',
    bestFor:       ['SaaS', 'fintech', 'display banners', 'Google Ads'],
    tones:         ['minimal', 'premium'],
    requiresImage: false,
  },
  {
    id:            'story-hook',
    name:          'Story Hook',
    description:   'Pattern interrupt for story format — big question, bold hook',
    bestFor:       ['TikTok', 'Reels', 'story ads', 'pattern interrupt'],
    tones:         ['bold', 'urgent', 'energetic', 'friendly'],
    requiresImage: true,
  },
  {
    id:            'problem-slide',
    name:          'Problem Slide',
    description:   'Pain-point lead — agitation-first, builds urgency for solution',
    bestFor:       ['carousel slide 2', 'pain agitation', 'before state'],
    tones:         ['bold', 'urgent', 'friendly'],
    requiresImage: false,
  },
  {
    id:            'text-only-bold',
    name:          'Text Only Bold',
    description:   'Pure typography — no image, all editorial attitude',
    bestFor:       ['quotes', 'manifestos', 'brand statements', 'editorial'],
    tones:         ['bold', 'premium', 'minimal', 'energetic'],
    requiresImage: false,
  },
  // ── Extended Batch 2 (16–30) ─────────────────────────────────────────────────
  {
    id:            'product-center',
    name:          'Product Center',
    description:   'Product image is the hero — large, centered, clean surrounding copy',
    bestFor:       ['e-commerce', 'DTC product shots', 'app screenshots', 'launch'],
    tones:         ['minimal', 'friendly', 'premium', 'bold'],
    requiresImage: true,
  },
  {
    id:            'neon-dark',
    name:          'Neon Dark',
    description:   'Cyberpunk/gaming aesthetic — dark bg with vivid neon glow accents',
    bestFor:       ['gaming', 'tech', 'GenZ', 'high-energy events', 'streetwear'],
    tones:         ['bold', 'energetic', 'urgent'],
    requiresImage: false,
  },
  {
    id:            'magazine-editorial',
    name:          'Magazine Editorial',
    description:   'Serif editorial layout — image bleed column, refined typography',
    bestFor:       ['lifestyle', 'premium fashion', 'beauty', 'editorial DTC'],
    tones:         ['premium', 'minimal'],
    requiresImage: true,
  },
  {
    id:            'color-block',
    name:          'Color Block',
    description:   'Two-tone horizontal split — bold color zone on top, neutral below',
    bestFor:       ['announcements', 'seasonal campaigns', 'bold brand moments'],
    tones:         ['bold', 'energetic', 'friendly'],
    requiresImage: false,
  },
  {
    id:            'floating-card',
    name:          'Floating Card',
    description:   'Raised white card floating over a tinted or image background',
    bestFor:       ['SaaS', 'app features', 'elegant promotions', 'DTC'],
    tones:         ['minimal', 'premium', 'friendly'],
    requiresImage: false,
  },
  {
    id:            'countdown-urgency',
    name:          'Countdown Urgency',
    description:   'Bold deadline/scarcity styling — timer visual, FOMO framing',
    bestFor:       ['flash sales', 'limited offers', 'event countdowns', 'direct response'],
    tones:         ['urgent', 'bold', 'energetic'],
    requiresImage: false,
  },
  {
    id:            'social-proof-grid',
    name:          'Social Proof Grid',
    description:   '2×2 grid of mini testimonial cards — high-density social proof',
    bestFor:       ['review aggregation', 'trust slides', 'proof carousels', 'e-com'],
    tones:         ['friendly', 'minimal', 'premium'],
    requiresImage: false,
  },
  {
    id:            'headline-badge',
    name:          'Headline Badge',
    description:   'Oversized badge chip + massive headline — hype and launch energy',
    bestFor:       ['promotions', 'limited drops', 'product launches', 'hype'],
    tones:         ['bold', 'energetic', 'urgent'],
    requiresImage: false,
  },
  {
    id:            'side-by-side',
    name:          'Side by Side',
    description:   'Two-column comparison layout — great for before/after or dual benefits',
    bestFor:       ['comparison ads', 'before/after', 'dual benefits', 'feature pairs'],
    tones:         ['minimal', 'bold', 'friendly'],
    requiresImage: false,
  },
  {
    id:            'diagonal-split',
    name:          'Diagonal Split',
    description:   'Dynamic diagonal divider between image zone and copy zone',
    bestFor:       ['sports', 'food', 'action products', 'energetic brands'],
    tones:         ['bold', 'energetic', 'urgent', 'friendly'],
    requiresImage: true,
  },
  {
    id:            'overlay-card',
    name:          'Overlay Card',
    description:   'Frosted-glass card over a full-bleed background — image-first design',
    bestFor:       ['travel', 'food', 'real estate', 'lifestyle', 'image-led brands'],
    tones:         ['premium', 'minimal', 'friendly'],
    requiresImage: true,
  },
  {
    id:            'number-list',
    name:          'Number List',
    description:   'Ordered 01 / 02 / 03 editorial benefit list with large numerals',
    bestFor:       ['step-by-step flows', '"3 reasons why"', 'structured benefits'],
    tones:         ['minimal', 'bold', 'premium'],
    requiresImage: false,
  },
  {
    id:            'brand-manifesto',
    name:          'Brand Manifesto',
    description:   'Full-frame centered typographic statement — editorial, high emotional impact',
    bestFor:       ['brand values', 'mission statements', 'bold opinions', 'awareness'],
    tones:         ['bold', 'premium', 'minimal', 'energetic'],
    requiresImage: false,
  },
  {
    id:            'product-demo',
    name:          'Product Demo',
    description:   'App or product screenshot framed in a minimal browser bezel',
    bestFor:       ['SaaS', 'app products', 'dashboard previews', 'UI showcases'],
    tones:         ['minimal', 'friendly', 'premium'],
    requiresImage: true,
  },
  {
    id:            'retro-bold',
    name:          'Retro Bold',
    description:   'Chunky vintage typography, halftone dots, high-contrast retro palette',
    bestFor:       ['food', 'beverage', 'fitness', 'streetwear', 'nostalgia brands'],
    tones:         ['bold', 'energetic', 'urgent'],
    requiresImage: false,
  },
];
