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
// Priority: angle → slideType → platform → tone
// angle param drives the new creative-format Satori templates.

export function autoSelectTemplate(
  tone:        AdTone,
  platform:    string,
  hasImage:    boolean,
  isVideoMode?: boolean,
  slideType?:  'cover' | 'problem' | 'proof' | 'feature' | 'cta' | 'hook' | string,
  angle?:      string,
): TemplateId {
  const p = platform.toLowerCase();

  if (isVideoMode) return 'bold-headline';

  // ── Angle-based routing (highest specificity) ─────────────────────────────
  // Maps marketing angle labels → creative Satori templates
  if (angle) {
    const a = angle.toLowerCase();
    if (a.match(/testimonial|review|social.proof|customer.said|verified/))
      return 'testimonial-card';
    if (a.match(/versus|comparison|vs\b|compare|alternative|switch/))
      return 'versus-slide';
    if (a.match(/transform|before.after|result|change|journey|glow.up/))
      return 'before-after-slide';
    if (a.match(/press|media|featured.in|authority|credib|as.seen/))
      return 'press-slide';
    if (a.match(/urgency|scarcity|flash|limited.time|offer|deal|discount|sale|save|promo/))
      return 'offer-drop';
    if (a.match(/chat|dm|message|conversation|native/))
      return 'chat-native';
    if (a.match(/point.out|feature|annotate|callout|showcase/))
      return 'point-out-slide';
    if (a.match(/gallery|collection|range|lookbook|grid/))
      return 'gallery-slide';
    if (a.match(/curiosity|discover|secret|reveal|what.if|hook|surprising/))
      return 'story-hook';
    if (a.match(/problem|pain|struggle|frustrat|broken|wrong|diagnos/))
      return 'problem-slide';
    if (a.match(/stat|number|proof|data|study|percent|results/))
      return 'stats-hero';
    if (a.match(/empathy|feel|understand|relat|you.re.not.alone/))
      return 'empathy-card';
    if (a.match(/manifesto|mission|believe|bold.claim|hot.take|opinion/))
      return 'hot-take';
  }

  // ── Slide-type-aware selection (carousel) ─────────────────────────────────
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
        return 'testimonial-card';

      case 'feature':
        return 'feature-list';

      case 'cta':
        return 'cta-final';
    }
  }

  // ── Platform-first heuristics ─────────────────────────────────────────────
  if (p.includes('tiktok'))                           return 'story-hook';
  if (p.includes('instagram') && tone === 'friendly') return 'ugc-style';
  if (p.includes('display')   || p.includes('google'))return 'bright-minimal';

  // ── Tone-first fallbacks ──────────────────────────────────────────────────
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
  // ── Angle-strategy batch ──────────────────────────────────────────────────────
  {
    id:            'offer-stack',
    name:          'Offer Stack',
    description:   'Bold discount reveal with percentage hero and stacked urgency layers',
    bestFor:       ['e-commerce', 'flash sales', 'limited-time promos', 'DTC brands'],
    tones:         ['urgent', 'bold', 'energetic'],
    requiresImage: false,
  },
  {
    id:            'value-math',
    name:          'Value Math',
    description:   'Side-by-side price comparison with crossed-out competitor price and savings formula',
    bestFor:       ['SaaS', 'subscriptions', 'tools', 'services competing on price'],
    tones:         ['bold', 'friendly', 'minimal'],
    requiresImage: false,
  },
  {
    id:            'case-study',
    name:          'Case Study',
    description:   'Mini case study card: company, before-state, result numbers, and timeframe',
    bestFor:       ['B2B', 'SaaS', 'agencies', 'professional services'],
    tones:         ['minimal', 'premium', 'friendly'],
    requiresImage: false,
  },
  {
    id:            'insight-frame',
    name:          'Insight Frame',
    description:   'Educational framework with numbered steps; insight-first, product as natural next step',
    bestFor:       ['coaches', 'consultants', 'SaaS', 'info products', 'thought leaders'],
    tones:         ['minimal', 'friendly', 'premium'],
    requiresImage: false,
  },
  {
    id:            'pain-diagnostic',
    name:          'Pain Diagnostic',
    description:   'Dark diagnostic aesthetic; names the exact pain with "sound familiar?" framing',
    bestFor:       ['SaaS', 'productivity tools', 'health', 'finance', 'any pain-point angle'],
    tones:         ['bold', 'urgent', 'premium'],
    requiresImage: false,
  },
  {
    id:            'mistake-alert',
    name:          'Mistake Alert',
    description:   'Warning-label aesthetic with numbered costly mistakes and avoidance framing',
    bestFor:       ['finance', 'health', 'marketing', 'any mistake-avoidance angle'],
    tones:         ['urgent', 'bold', 'energetic'],
    requiresImage: false,
  },
  {
    id:            'empathy-card',
    name:          'Empathy Card',
    description:   'Warm gradient, feeling-first statement; leads with emotion before product',
    bestFor:       ['wellness', 'mental health', 'self-improvement', 'community apps'],
    tones:         ['friendly', 'minimal', 'premium'],
    requiresImage: false,
  },
  {
    id:            'validation-card',
    name:          'Validation Card',
    description:   'Community validation: "you\'re not alone" framing with avatar stack and social proof',
    bestFor:       ['communities', 'wellness', 'coaching', 'any empathy-led campaign'],
    tones:         ['friendly', 'minimal', 'premium'],
    requiresImage: false,
  },
  {
    id:            'do-dont',
    name:          'Do & Don\'t',
    description:   'Two-column right-vs-wrong comparison; ✕ don\'t on left, ✓ do on right',
    bestFor:       ['education', 'productivity', 'marketing tools', 'any instructional angle'],
    tones:         ['minimal', 'friendly', 'bold'],
    requiresImage: false,
  },
  {
    id:            'transform-split',
    name:          'Transform Split',
    description:   'Before-state dark top half, after-state vibrant bottom half; transformation arrow center',
    bestFor:       ['fitness', 'finance', 'SaaS', 'coaching', 'any before/after campaign'],
    tones:         ['bold', 'energetic', 'friendly'],
    requiresImage: false,
  },
  {
    id:            'photo-reveal',
    name:          'Photo Reveal',
    description:   'Full-bleed real photo with bold bottom label — the @wealth carousel style. Each slide reveals one item with your own photo or Unsplash.',
    bestFor:       ['storytelling', 'brand history', 'product launches', 'educational series', 'any topic-reveal campaign'],
    tones:         ['bold', 'premium', 'minimal'],
    requiresImage: true,
  },
  // ── Batch 5: 44 new templates across 10 categories ────────────────────────
  { id: 'guarantee-badge',  name: 'Guarantee Badge',  description: 'Money-back guarantee seal — circular gold badge over dark bg.',                       bestFor: ['conversion', 'risk-reversal'],          tones: ['bold', 'premium'],          requiresImage: false },
  { id: 'free-trial',       name: 'Free Trial',       description: 'No-credit-card trial offer — large headline, calm CTA.',                              bestFor: ['SaaS', 'apps', 'subscriptions'],        tones: ['minimal', 'friendly'],      requiresImage: false },
  { id: 'limited-drop',     name: 'Limited Drop',     description: 'Drop-style scarcity with fake countdown blocks and stock count.',                     bestFor: ['ecommerce', 'streetwear', 'launches'],  tones: ['urgent', 'bold'],           requiresImage: false },
  { id: 'offer-announce',   name: 'Offer Announce',   description: 'Percent-off announcement on vivid accent background.',                                 bestFor: ['promos', 'flash sales'],                tones: ['bold', 'urgent', 'energetic'], requiresImage: false },
  { id: 'price-compare',    name: 'Price Compare',    description: 'Was/now price split with savings badge.',                                              bestFor: ['ecommerce', 'discount campaigns'],      tones: ['bold', 'minimal'],          requiresImage: false },
  { id: 'award-winner',     name: 'Award Winner',     description: 'Voted #1 award badge with year and category.',                                         bestFor: ['authority', 'social proof'],            tones: ['premium', 'bold'],          requiresImage: false },
  { id: 'founder-story',    name: 'Founder Story',    description: 'Founder avatar + italic quote on warm cream — personal trust frame.',                  bestFor: ['DTC brands', 'personal-brand'],         tones: ['friendly', 'minimal', 'premium'], requiresImage: true },
  { id: 'review-card',      name: 'Review Card',      description: '5-star verified-buyer review card with bottom accent bar.',                            bestFor: ['social proof', 'ecommerce'],            tones: ['minimal', 'friendly'],      requiresImage: false },
  { id: 'trust-bar',        name: 'Trust Bar',        description: 'Three-stat trust bar — customers, rating, retention.',                                 bestFor: ['homepages', 'top-of-funnel'],           tones: ['minimal', 'bold'],          requiresImage: false },
  { id: 'news-frame',       name: 'News Frame',       description: 'Breaking-news framed headline with dateline.',                                         bestFor: ['authority', 'PR plays'],                tones: ['bold', 'minimal'],          requiresImage: false },
  { id: 'video-thumbnail',  name: 'Video Thumbnail',  description: 'YouTube-style thumbnail with play button and title.',                                  bestFor: ['video ads', 'tutorials'],               tones: ['bold', 'friendly'],         requiresImage: true },
  { id: 'community-quote',  name: 'Community Quote',  description: 'Forum-style quote card with username and upvotes.',                                    bestFor: ['community', 'social proof'],            tones: ['friendly', 'minimal'],      requiresImage: false },
  { id: 'stat-study',       name: 'Stat Study',       description: 'Giant percent stat with study source and headline.',                                   bestFor: ['authority', 'education'],               tones: ['minimal', 'premium'],       requiresImage: false },
  { id: 'caption-style',    name: 'Caption Style',    description: 'Native caption-overlay style for IG/TikTok screenshots.',                              bestFor: ['social-native', 'creator UGC'],         tones: ['bold', 'friendly'],         requiresImage: true },
  { id: 'chat-thread',      name: 'Chat Thread',      description: 'Two-bubble messenger conversation simulating real chat.',                              bestFor: ['empathy', 'social-native'],             tones: ['friendly', 'minimal'],      requiresImage: false },
  { id: 'meme-format',      name: 'Meme Format',      description: 'Top/bottom impact-text meme layout with center image area.',                           bestFor: ['scroll-stop', 'gen-z'],                 tones: ['bold', 'friendly'],         requiresImage: false },
  { id: 'comment-reply',    name: 'Comment Reply',    description: 'Replying-to pill + dark image area + caption.',                                        bestFor: ['social-native', 'TikTok-style'],        tones: ['bold', 'friendly'],         requiresImage: false },
  { id: 'poll-card',        name: 'Poll Card',        description: 'Two-option poll with progress bars on blurred background.',                            bestFor: ['engagement', 'IG stories'],             tones: ['friendly', 'bold'],         requiresImage: false },
  { id: 'hot-take',         name: 'Hot Take',         description: 'Vivid solid-color slide with bold contrarian statement.',                              bestFor: ['scroll-stop', 'engagement'],            tones: ['bold', 'urgent'],           requiresImage: false },
  { id: 'leaderboard',      name: 'Leaderboard',      description: 'Top-picks ranked list with gold/silver/bronze indicators.',                            bestFor: ['comparison', 'authority'],              tones: ['minimal', 'bold'],          requiresImage: false },
  { id: 'checklist-viral',  name: 'Checklist Viral',  description: '"Check what applies" symptom-style viral checklist.',                                  bestFor: ['health', 'self-help', 'education'],     tones: ['friendly', 'bold'],         requiresImage: false },
  { id: 'myth-reality',     name: 'Myth vs Reality',  description: '50/50 dark/accent split contrasting myth and reality.',                                bestFor: ['education', 'reframing'],               tones: ['bold', 'minimal'],          requiresImage: false },
  { id: 'event-card',       name: 'Event Card',       description: 'Dark event card with calendar icon, date, and register CTA.',                          bestFor: ['webinars', 'workshops', 'launches'],    tones: ['bold', 'premium'],          requiresImage: false },
  { id: 'three-reasons',    name: 'Three Reasons',    description: 'Big "3" + ordered reason list with separators.',                                       bestFor: ['education', 'persuasion'],              tones: ['minimal', 'bold'],          requiresImage: false },
  { id: 'timeline-journey', name: 'Timeline Journey', description: 'Horizontal numbered-circle journey timeline.',                                         bestFor: ['onboarding', 'how-it-works'],           tones: ['minimal', 'friendly'],      requiresImage: false },
  { id: 'brutalist',        name: 'Brutalist',        description: 'Thick black border, oversized type, raw editorial feel.',                              bestFor: ['scroll-stop', 'editorial brands'],      tones: ['bold', 'minimal'],          requiresImage: false },
  { id: 'collage-cutout',   name: 'Collage Cutout',   description: 'Hand-crafted overlapping rectangles at slight angles.',                                bestFor: ['lifestyle', 'craft brands'],            tones: ['friendly', 'premium'],      requiresImage: false },
  { id: 'aurora-gradient',  name: 'Aurora Gradient',  description: 'Multi-stop aurora gradient with airy white headline.',                                 bestFor: ['scroll-stop', 'aspirational'],          tones: ['premium', 'minimal'],       requiresImage: false },
  { id: 'duotone-photo',    name: 'Duotone Photo',    description: 'Photo with strong color overlay and bold text on top.',                                bestFor: ['scroll-stop', 'editorial'],             tones: ['bold', 'premium'],          requiresImage: true },
  { id: 'mono-editorial',   name: 'Mono Editorial',   description: 'Pure black-on-white serif essay aesthetic — no color.',                                bestFor: ['premium brands', 'editorial'],          tones: ['premium', 'minimal'],       requiresImage: false },
  { id: 'risograph-print',  name: 'Risograph Print',  description: 'Offset overlapping risograph rectangles in muted print colors.',                       bestFor: ['indie brands', 'creative'],             tones: ['friendly', 'premium'],      requiresImage: false },
  { id: 'chart-reveal',     name: 'Chart Reveal',     description: 'Mini bar chart with growth result number and source.',                                 bestFor: ['B2B', 'authority', 'education'],        tones: ['minimal', 'premium'],       requiresImage: false },
  { id: 'steps-infographic',name: 'Steps Infographic',description: 'Four-step numbered circle flow with arrows and CTA.',                                  bestFor: ['onboarding', 'education'],              tones: ['minimal', 'friendly'],      requiresImage: false },
  { id: 'vs-table',         name: 'VS Table',         description: 'Three-column comparison table — Us vs Them.',                                          bestFor: ['comparison', 'positioning'],            tones: ['minimal', 'bold'],          requiresImage: false },
  { id: 'flat-lay',         name: 'Flat Lay',         description: 'Centered product flat-lay with shadow, name, and price.',                              bestFor: ['ecommerce', 'product launches'],        tones: ['minimal', 'premium'],       requiresImage: true },
  { id: 'app-mockup',       name: 'App Mockup',       description: 'Phone mockup with sample UI beside feature copy and CTA.',                             bestFor: ['SaaS', 'mobile apps'],                  tones: ['minimal', 'friendly'],      requiresImage: true },
  { id: 'photo-grid',       name: 'Photo Grid',       description: '2×2 polaroid-bordered photo grid with overlay labels.',                                bestFor: ['lookbooks', 'product range'],           tones: ['minimal', 'friendly'],      requiresImage: true },
  { id: 'brand-awareness',  name: 'Brand Awareness',  description: 'Pure-minimum brand identity slide — logo circle and tagline.',                          bestFor: ['brand', 'top-of-funnel'],               tones: ['minimal', 'premium'],       requiresImage: false },
  { id: 'tweet-screenshot', name: 'Tweet Screenshot', description: 'X/Twitter-style tweet card with likes/retweets row.',                                  bestFor: ['social proof', 'social-native'],        tones: ['friendly', 'minimal'],      requiresImage: false },
  { id: 'tiktok-native',    name: 'TikTok Native',    description: 'Vertical TikTok UI — left progress bar, right reactions, bottom caption.',             bestFor: ['social-native', 'creator content'],     tones: ['bold', 'friendly'],         requiresImage: false },
  { id: 'reddit-thread',    name: 'Reddit Thread',    description: 'Reddit post layout with upvote column and subreddit framing.',                         bestFor: ['social-native', 'community proof'],     tones: ['friendly', 'minimal'],      requiresImage: false },
  { id: 'email-mockup',     name: 'Email Mockup',     description: 'Brand email preview with header, subject, and primary CTA.',                           bestFor: ['email-style hooks', 'social-native'],   tones: ['minimal', 'friendly'],      requiresImage: false },
  { id: 'receipt-style',    name: 'Receipt Style',    description: 'Dotted-border receipt listing items and total value.',                                 bestFor: ['offers', 'value-stack'],                tones: ['minimal', 'bold'],          requiresImage: false },
  { id: 'bundle-stack',     name: 'Bundle Stack',     description: 'Cascading product stack with old/new price.',                                          bestFor: ['ecommerce', 'bundles'],                 tones: ['bold', 'minimal'],          requiresImage: false },
  // ── Creative Satori templates (angle-routed) ────────────────────────────────
  { id: 'testimonial-card',   name: 'Testimonial Card',   description: 'Stars → quote → author avatar + Trustpilot badge. Reeeads social-proof pattern.',        bestFor: ['social proof', 'reviews', 'trust-building'],           tones: ['friendly', 'minimal', 'premium'], requiresImage: false },
  { id: 'versus-slide',       name: 'Versus Slide',       description: 'Dark "Without" left vs accent "With Us" right. VS divider circle on seam.',              bestFor: ['comparison ads', 'positioning', 'switching'],          tones: ['bold', 'urgent', 'energetic'],    requiresImage: false },
  { id: 'before-after-slide', name: 'Before / After',     description: 'Dark BEFORE top half, accent AFTER bottom half with arrow circle on divider.',           bestFor: ['transformation', 'results', 'fitness', 'coaching'],    tones: ['bold', 'energetic', 'friendly'],  requiresImage: false },
  { id: 'press-slide',        name: 'Press Slide',        description: '"As seen in" Forbes/TechCrunch logo bar + pull quote + CTA.',                           bestFor: ['authority', 'PR plays', 'credibility', 'B2B'],        tones: ['minimal', 'premium', 'bold'],     requiresImage: false },
  { id: 'point-out-slide',    name: 'Point-Out Slide',    description: 'Central product placeholder + 3 annotation callouts with dash connectors.',             bestFor: ['feature highlights', 'product showcases', 'SaaS'],    tones: ['minimal', 'friendly', 'bold'],    requiresImage: false },
  { id: 'gallery-slide',      name: 'Gallery Slide',      description: '2×2 tinted colour grid simulating product shots + headline footer bar.',                 bestFor: ['product range', 'lookbooks', 'collections'],           tones: ['minimal', 'premium', 'friendly'], requiresImage: false },
  { id: 'chat-native',        name: 'Chat Native',        description: 'iMessage-style conversation. Customer asks, brand answers. Native-ad feel.',             bestFor: ['social-native', 'empathy', 'UGC-style'],               tones: ['friendly', 'minimal'],            requiresImage: false },
  { id: 'offer-drop',         name: 'Offer Drop',         description: 'Large bordered offer circle with SAVE label + eyebrow pill + CTA.',                     bestFor: ['flash sales', 'discount campaigns', 'urgency'],        tones: ['bold', 'urgent', 'energetic'],    requiresImage: false },
];
