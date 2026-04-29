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
  | 'ugc-style';      // social-native, casual, phone-screenshot feel

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
