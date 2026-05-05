// ─── Compositor Types ─────────────────────────────────────────────────────────

export type AdTone =
  | 'bold'       // aggressive, high-contrast, sales-driven
  | 'minimal'    // clean, whitespace, DTC
  | 'premium'    // luxury, editorial, high-ticket
  | 'friendly'   // lifestyle, health, apps
  | 'urgent'     // limited time, performance, direct-response
  | 'energetic'; // sports, fitness, action

export type TemplateId =
  | 'full-bleed'      // image fills frame, gradient overlay, text at bottom
  | 'split-panel'     // image left, copy right
  | 'bold-headline'   // giant typography over dim background image
  | 'minimal'         // clean background, centered content, no clutter
  | 'ugc-style'       // social-native, casual, phone-screenshot feel
  // ── Extended (6–15) ──────────────────────────────────────────────────────────
  | 'testimonial'     // customer quote hero with stars + author row
  | 'stats-hero'      // big stat/number as visual anchor
  | 'feature-list'    // icon + feature rows, checklist style
  | 'cta-final'       // closing slide: large CTA, urgency, offer
  | 'gradient-pop'    // vivid gradient background, minimal text
  | 'dark-luxury'     // deep dark tones, gold accents, premium feel
  | 'bright-minimal'  // pure white + one brand-color accent
  | 'story-hook'      // story-format hook: big question / pattern interrupt
  | 'problem-slide'   // pain-point lead: problem statement, agitation
  | 'text-only-bold'  // typographic only, no image — bold editorial
  // ── Extended Batch 2 (16–30) ─────────────────────────────────────────────────
  | 'product-center'      // large product image hero, copy below
  | 'neon-dark'           // cyberpunk/gaming dark bg with neon glow accents
  | 'magazine-editorial'  // serif editorial, image bleed column
  | 'color-block'         // two-tone horizontal color split
  | 'floating-card'       // raised white card over tinted/image background
  | 'countdown-urgency'   // deadline/scarcity styling with timer visual
  | 'social-proof-grid'   // 2×2 grid of mini testimonial cards
  | 'headline-badge'      // oversized badge chip + giant headline
  | 'side-by-side'        // two columns comparison / before-after
  | 'diagonal-split'      // dynamic diagonal divider, image + copy zones
  | 'overlay-card'        // frosted-glass card over full-bleed image
  | 'number-list'         // ordered 01/02/03 benefit list, editorial numerals
  | 'brand-manifesto'     // full-frame centered typographic statement
  | 'product-demo'        // browser/app screenshot in bezel frame
  | 'retro-bold'          // chunky vintage typography, halftone dots, retro palette
  // ── Angle-strategy batch (31–40) ─────────────────────────────────────────────
  | 'offer-stack'         // conversion: stacked discount offer, big % number
  | 'value-math'          // conversion: price comparison formula, savings math
  | 'case-study'          // trust: mini case study, before/after result numbers
  | 'insight-frame'       // trust: educational framework, numbered insight steps
  | 'pain-diagnostic'     // empathy: dark diagnostic, "sound familiar?" pattern
  | 'mistake-alert'       // empathy: warning-label aesthetic, numbered mistakes
  | 'empathy-card'        // empathy: warm gradient, feeling-first statement
  | 'validation-card'     // empathy: "you're not alone", community validation
  | 'do-dont'             // engagement: two-column right-vs-wrong comparison
  | 'transform-split'     // engagement: top=before / bottom=after transformation
  // ── Photo-reveal (user-photo carousel) ───────────────────────────────────────
  | 'photo-reveal'       // full-bleed real photo + bold bottom label — @wealth style
  // ── Batch 5: 44 new templates (10 categories) ────────────────────────────────
  | 'guarantee-badge'
  | 'free-trial'
  | 'limited-drop'
  | 'offer-announce'
  | 'price-compare'
  | 'award-winner'
  | 'founder-story'
  | 'review-card'
  | 'trust-bar'
  | 'news-frame'
  | 'video-thumbnail'
  | 'community-quote'
  | 'stat-study'
  | 'caption-style'
  | 'chat-thread'
  | 'meme-format'
  | 'comment-reply'
  | 'poll-card'
  | 'hot-take'
  | 'leaderboard'
  | 'checklist-viral'
  | 'myth-reality'
  | 'event-card'
  | 'three-reasons'
  | 'timeline-journey'
  | 'brutalist'
  | 'collage-cutout'
  | 'aurora-gradient'
  | 'duotone-photo'
  | 'mono-editorial'
  | 'risograph-print'
  | 'chart-reveal'
  | 'steps-infographic'
  | 'vs-table'
  | 'flat-lay'
  | 'app-mockup'
  | 'photo-grid'
  | 'brand-awareness'
  | 'tweet-screenshot'
  | 'tiktok-native'
  | 'reddit-thread'
  | 'email-mockup'
  | 'receipt-style'
  | 'bundle-stack';

export type AdSize =
  | '1080x1080'   // square — Instagram, Facebook
  | '1080x1920'   // story/reel — Instagram, TikTok
  | '1200x628'    // landscape — Facebook feed, Google
  | '1080x1350'   // portrait — Instagram feed
  | '300x250';    // display banner

export type ColorScheme = 'dark' | 'light' | 'brand' | 'gradient';

// ─── Font pairing ─────────────────────────────────────────────────────────────

export interface FontPairing {
  id:         string;
  headline:   string;   // font-family name
  body:       string;
  googleUrl:  string;   // Google Fonts @import URL
  tones:      AdTone[];
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CompositorInput {
  // Identity
  templateId:   TemplateId;
  size:         AdSize;

  // Content
  copy: {
    headline:   string;
    body?:      string;
    cta?:       string;
    subtext?:   string;
    eyebrow?:   string;   // small label above headline (e.g. "LIMITED TIME")
  };

  // Visuals
  imageUrl?:    string;   // base64 data URL or https URL (background image)

  // Style
  style: {
    tone:          AdTone;
    platform:      string;
    colorScheme?:  ColorScheme;
    fontPairingId?: string;         // override auto-selection
    primaryColor?:  string;         // brand hex color
    accentColor?:   string;
  };

  // Branding
  branding?: {
    logoUrl?:       string;   // base64 or URL
    brandName?:     string;
  };
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CompositorOutput {
  imageDataUrl:   string;   // data:image/png;base64,...
  templateId:     TemplateId;
  fontPairing:    FontPairing;
  renderTimeMs:   number;
  size:           AdSize;
  // Visual critic score — present when critic runs, absent on error / batch skips
  critique?: import('../critic/visual-critic.service').CritiqueResult | null;
}

// ─── Render request ───────────────────────────────────────────────────────────

export interface RenderRequest {
  input:   CompositorInput;
  userId?: string;
}

// ─── Parsed size ──────────────────────────────────────────────────────────────

export interface ParsedSize {
  width:  number;
  height: number;
  label:  AdSize;
}
