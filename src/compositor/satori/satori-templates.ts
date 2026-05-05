// ─── Satori Template Library ──────────────────────────────────────────────────
//
// Each template is a pure function:
//   (input: CompositorInput, size: ParsedSize, palette: ColorPalette) → SatoriNode
//
// Satori constraints:
//  - All elements must have display: flex (block / inline not supported)
//  - backgroundImage: 'linear-gradient(...)' works
//  - position: 'absolute' works inside position: 'relative' parents
//  - Fonts: only Inter 400/700 (no italic, no emoji)
//  - No CSS variables, no @keyframes, no pseudo-elements, no transforms
//  - Use margins not gap (compatibility)

import type { CompositorInput, ParsedSize } from '../types/compositor.types';
import type { ColorPalette }                from '../design/design-system';
import { getTypographyScale, getPadding }   from '../design/design-system';

// ─── Core types ───────────────────────────────────────────────────────────────

type Child = SatoriNode | string | false | null | undefined;

export interface SatoriNode {
  type:  string;
  props: {
    style?:    Record<string, any>;
    children?: SatoriNode | SatoriNode[] | string | Child[];
    [k: string]: any;
  };
}

// ─── Core builder ─────────────────────────────────────────────────────────────

function el(
  type:     string,
  style:    Record<string, any>,
  ...children: Child[]
): SatoriNode {
  const valid = children.filter(
    (c): c is SatoriNode | string => c !== false && c !== null && c !== undefined,
  );
  return {
    type,
    props: {
      style:    { display: 'flex', ...style },
      children: valid.length === 1 ? valid[0] : valid,
    },
  };
}

function text(content: string, style: Record<string, any>): SatoriNode {
  return { type: 'span', props: { style: { display: 'flex', ...style }, children: content } };
}

// ─── Component Library ────────────────────────────────────────────────────────

/** Pill / rounded badge */
function badge(
  label:   string,
  bg:      string,
  fg:      string,
  radius = 99,
  fs     = 14,
  px     = 16,
  py     = 7,
): SatoriNode {
  return el('div', {
    backgroundColor: bg,
    color:           fg,
    fontSize:        fs,
    fontWeight:      700,
    letterSpacing:   0.6,
    padding:         `${py}px ${px}px`,
    borderRadius:    radius,
  }, label.toUpperCase());
}

/** CTA button pill */
function ctaButton(label: string, bg: string, fg: string, fs: number, radius = 12): SatoriNode {
  return el('div', {
    backgroundColor: bg,
    color:           fg,
    padding:         `${Math.round(fs * 0.55)}px ${Math.round(fs * 1.4)}px`,
    borderRadius:    radius,
    fontSize:        fs,
    fontWeight:      700,
    letterSpacing:   0.3,
  }, label);
}

/** Small uppercase eyebrow tag */
function eyebrowTag(label: string, color: string, fs: number, accent: string): SatoriNode {
  return el('div', {
    backgroundColor: `${accent}22`,
    color,
    fontSize:        fs,
    fontWeight:      700,
    letterSpacing:   2,
    padding:         `${Math.round(fs * 0.4)}px ${Math.round(fs * 0.9)}px`,
    borderRadius:    6,
    marginBottom:    Math.round(fs * 1.2),
  }, label.toUpperCase());
}

/** 5-star rating row */
function starRating(count: number, color: string, fs: number): SatoriNode {
  const filled = Math.min(5, Math.max(1, Math.round(count)));
  const empty  = 5 - filled;
  return el('div', { flexDirection: 'row', alignItems: 'center' },
    text('★'.repeat(filled), { fontSize: fs, color,            letterSpacing: 3 }),
    empty > 0 && text('★'.repeat(empty), { fontSize: fs, color: `${color}33`, letterSpacing: 3 }),
  );
}

/** Numbered circle */
function numCircle(n: number | string, bg: string, fg: string, size: number): SatoriNode {
  return el('div', {
    width:           size,
    height:          size,
    borderRadius:    99,
    backgroundColor: bg,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  }, text(String(n), { fontSize: Math.round(size * 0.44), fontWeight: 700, color: fg, lineHeight: 1 }));
}

/** Check / X icon circle */
function iconCircle(icon: string, bg: string, fg: string, size: number): SatoriNode {
  return el('div', {
    width:           size,
    height:          size,
    borderRadius:    99,
    backgroundColor: bg,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  }, text(icon, { fontSize: Math.round(size * 0.48), color: fg, fontWeight: 700 }));
}

/** Horizontal text media logo row */
function mediaRow(names: string[], color: string, fs: number): SatoriNode {
  return el('div', { flexDirection: 'row', alignItems: 'center' },
    ...names.map((n, i) =>
      text(n.toUpperCase(), {
        fontSize:    fs,
        fontWeight:  700,
        color,
        letterSpacing: 1.5,
        marginRight: i < names.length - 1 ? Math.round(fs * 2.2) : 0,
        opacity:     0.65,
      }),
    ),
  );
}

/** Thin horizontal divider */
function dividerLine(color: string, w: number, mt = 0, mb = 0): SatoriNode {
  return el('div', {
    width:           w,
    height:          1,
    backgroundColor: color,
    marginTop:       mt,
    marginBottom:    mb,
  });
}

/** iMessage-style chat bubble */
function chatBubble(
  msg:    string,
  side:   'left' | 'right',
  bg:     string,
  fg:     string,
  fs:     number,
  maxW:   number,
  mb:     number,
): SatoriNode {
  return el('div', {
    flexDirection:  'row',
    justifyContent: side === 'right' ? 'flex-end' : 'flex-start',
    marginBottom:   mb,
  },
    el('div', {
      backgroundColor: bg,
      color:           fg,
      fontSize:        fs,
      lineHeight:      1.4,
      padding:         `${Math.round(fs * 0.65)}px ${Math.round(fs * 1.05)}px`,
      borderRadius:    side === 'right' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
      maxWidth:        maxW,
      fontWeight:      400,
    }, msg),
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function buildSatoriElement(
  input:   CompositorInput,
  size:    ParsedSize,
  palette: ColorPalette,
): SatoriNode {
  switch (input.templateId) {
    // Redesigned 15
    case 'minimal':           return templateMinimal(input, size, palette);
    case 'text-only-bold':    return templateTextOnlyBold(input, size, palette);
    case 'gradient-pop':      return templateGradientPop(input, size, palette);
    case 'feature-list':      return templateFeatureList(input, size, palette);
    case 'bright-minimal':    return templateBrightMinimal(input, size, palette);
    case 'cta-final':         return templateCtaFinal(input, size, palette);
    case 'stats-hero':        return templateStatsHero(input, size, palette);
    case 'bold-headline':     return templateBoldHeadline(input, size, palette);
    case 'problem-slide':     return templateProblemSlide(input, size, palette);
    case 'story-hook':        return templateStoryHook(input, size, palette);
    case 'color-block':       return templateColorBlock(input, size, palette);
    case 'number-list':       return templateNumberList(input, size, palette);
    case 'brand-manifesto':   return templateBrandManifesto(input, size, palette);
    case 'empathy-card':      return templateEmpathyCard(input, size, palette);
    case 'hot-take':          return templateHotTake(input, size, palette);
    // New 8
    case 'testimonial-card':  return templateTestimonialCard(input, size, palette);
    case 'versus-slide':      return templateVersusSlide(input, size, palette);
    case 'before-after-slide':return templateBeforeAfterSlide(input, size, palette);
    case 'press-slide':       return templatePressSlide(input, size, palette);
    case 'point-out-slide':   return templatePointOutSlide(input, size, palette);
    case 'gallery-slide':     return templateGallerySlide(input, size, palette);
    case 'chat-native':       return templateChatNative(input, size, palette);
    case 'offer-drop':        return templateOfferDrop(input, size, palette);
    default:                  return templateMinimal(input, size, palette);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// REDESIGNED EXISTING 15
// ══════════════════════════════════════════════════════════════════════════════

// ─── 1. Minimal ───────────────────────────────────────────────────────────────
// Two-tone horizontal split: accent top band → eyebrow, neutral bottom → content.
// Decorative quarter-circle arc top-right (Canva signature move).

function templateMinimal(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;
  const topH   = Math.round(size.height * 0.36);
  const arcSz  = Math.round(size.width * 0.32);

  return el('div', {
    width: size.width, height: size.height,
    flexDirection: 'column',
    position: 'relative',
  },
    // Top accent band
    el('div', {
      width:           size.width,
      height:          topH,
      backgroundColor: accent,
      flexDirection:   'column',
      justifyContent:  'flex-end',
      padding:         pad.outer,
      paddingBottom:   pad.inner,
    },
      copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
        fontSize:    ty.eyebrow,
        fontWeight:  700,
        color:       'rgba(255,255,255,0.75)',
        letterSpacing: 3,
        marginBottom: pad.gap,
      }),
    ),

    // Bottom neutral content
    el('div', {
      width:          size.width,
      flex:           1,
      backgroundColor: p.background,
      flexDirection:  'column',
      justifyContent: 'center',
      padding:        pad.outer,
    },
      text(copy.headline, {
        fontSize:    ty.headline,
        fontWeight:  700,
        color:       p.headline,
        lineHeight:  1.08,
        letterSpacing: -1,
        maxWidth:    size.width * 0.88,
        marginBottom: copy.body ? pad.inner : 0,
      }),

      copy.body && text(copy.body, {
        fontSize:  ty.body,
        color:     p.body,
        lineHeight: 1.55,
        maxWidth:  size.width * 0.82,
        marginBottom: copy.cta ? pad.inner : 0,
      }),

      copy.cta && ctaButton(copy.cta, accent, '#ffffff', ty.cta, 99),
    ),

    // Decorative quarter-circle arc (top-right corner)
    el('div', {
      position:        'absolute',
      top:             0,
      right:           0,
      width:           arcSz,
      height:          arcSz,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius:    '0 0 0 100%',
    }),
  );
}

// ─── 2. Text-Only Bold ────────────────────────────────────────────────────────
// Giant headline left-aligned. Eyebrow in accent. Three trailing accent bars
// bottom-right (editorial energy).

function templateTextOnlyBold(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;
  const bigFont = Math.round(ty.headline * 1.12);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection:   'column',
    justifyContent:  'center',
    padding:         pad.outer,
    position:        'relative',
  },
    // Eyebrow in accent (acts as the "highlighted keyword")
    copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
      fontSize:    Math.round(ty.eyebrow * 1.2),
      fontWeight:  700,
      color:       accent,
      letterSpacing: 3,
      marginBottom: Math.round(pad.gap * 0.8),
    }),

    // Oversized headline
    text(copy.headline, {
      fontSize:    bigFont,
      fontWeight:  700,
      color:       p.headline,
      lineHeight:  1.04,
      letterSpacing: -1.5,
      maxWidth:    size.width * 0.92,
      marginBottom: copy.body ? pad.inner : 0,
    }),

    copy.body && text(copy.body, {
      fontSize:  ty.body,
      color:     p.body,
      lineHeight: 1.6,
      maxWidth:  size.width * 0.7,
    }),

    // Trailing accent bars (bottom-right — editorial tick marks)
    el('div', {
      position:      'absolute',
      bottom:        pad.outer,
      right:         pad.outer,
      flexDirection: 'column',
      alignItems:    'flex-end',
    },
      el('div', { width: Math.round(size.width * 0.13), height: 4, backgroundColor: accent,           borderRadius: 2, marginBottom: 6 }),
      el('div', { width: Math.round(size.width * 0.08), height: 4, backgroundColor: `${accent}66`,   borderRadius: 2, marginBottom: 6 }),
      el('div', { width: Math.round(size.width * 0.04), height: 4, backgroundColor: `${accent}33`,   borderRadius: 2 }),
    ),
  );
}

// ─── 3. Gradient Pop ─────────────────────────────────────────────────────────
// Vivid gradient with a large semi-transparent circle bleed top-right.
// Badge eyebrow, big headline, white CTA.

function templateGradientPop(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;
  const circR  = Math.round(size.width * 0.65);

  return el('div', {
    width: size.width, height: size.height,
    backgroundImage: `linear-gradient(145deg, ${accent} 0%, ${accent}cc 40%, ${p.background} 75%)`,
    flexDirection: 'column',
    justifyContent: 'center',
    padding: pad.outer,
    position: 'relative',
  },
    // Decorative bleed circle (top-right)
    el('div', {
      position:        'absolute',
      top:             -Math.round(circR * 0.3),
      right:           -Math.round(circR * 0.3),
      width:           circR,
      height:          circR,
      borderRadius:    99999,
      backgroundColor: 'rgba(255,255,255,0.07)',
    }),

    // Small inner circle
    el('div', {
      position:        'absolute',
      bottom:          -Math.round(circR * 0.15),
      left:            -Math.round(circR * 0.15),
      width:           Math.round(circR * 0.45),
      height:          Math.round(circR * 0.45),
      borderRadius:    99999,
      backgroundColor: 'rgba(255,255,255,0.05)',
    }),

    copy.eyebrow && el('div', { marginBottom: pad.inner },
      badge(copy.eyebrow, 'rgba(255,255,255,0.22)', '#ffffff', 99, ty.eyebrow),
    ),

    text(copy.headline, {
      fontSize:  ty.headline,
      fontWeight: 700,
      color:      '#ffffff',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.86,
      marginBottom: copy.body ? pad.inner : (copy.cta ? pad.inner : 0),
    }),

    copy.body && text(copy.body, {
      fontSize:  ty.body,
      color:     'rgba(255,255,255,0.85)',
      lineHeight: 1.55,
      maxWidth:   size.width * 0.74,
      marginBottom: copy.cta ? pad.inner : 0,
    }),

    copy.cta && ctaButton(copy.cta, '#ffffff', accent, ty.cta, 99),
  );
}

// ─── 4. Feature List ─────────────────────────────────────────────────────────
// Numbered accent circles (Reeeads style) replace flat dots.

function templateFeatureList(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy } = input;
  const ty     = getTypographyScale(size, input.style.tone);
  const pad    = getPadding(size);
  const accent = input.style.primaryColor || p.cta;

  const items = (copy.body || '')
    .split(/\||\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  const circleSize = Math.round(ty.body * 1.55);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection: 'column',
    justifyContent: 'center',
    padding: pad.outer,
  },
    copy.eyebrow && eyebrowTag(copy.eyebrow, p.eyebrow, ty.eyebrow, accent),

    text(copy.headline, {
      fontSize:  Math.round(ty.headline * 0.7),
      fontWeight: 700,
      color:     p.headline,
      lineHeight: 1.15,
      marginBottom: pad.inner,
      maxWidth:  size.width * 0.9,
    }),

    ...items.map((item, i) =>
      el('div', {
        flexDirection: 'row',
        alignItems:    'center',
        marginTop:     i === 0 ? 0 : pad.gap,
      },
        numCircle(i + 1, accent, '#ffffff', circleSize),
        text(item, {
          fontSize:  ty.body,
          color:     p.body,
          lineHeight: 1.45,
          flex:      1,
          marginLeft: Math.round(pad.gap * 0.9),
        }),
      )
    ),

    copy.cta && el('div', { marginTop: pad.inner },
      ctaButton(copy.cta, accent, '#ffffff', ty.cta),
    ),
  );
}

// ─── 5. Bright Minimal ───────────────────────────────────────────────────────
// White canvas. Decorative quarter-circle arcs in corners (top-right + bottom-left).

function templateBrightMinimal(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;
  const arcBig = Math.round(size.width * 0.3);
  const arcSml = Math.round(size.width * 0.15);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: '#F8F8F6',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         pad.outer,
    position:        'relative',
  },
    // Top-right corner arc
    el('div', {
      position:        'absolute',
      top:             0,
      right:           0,
      width:           arcBig,
      height:          arcBig,
      backgroundColor: accent,
      borderRadius:    '0 0 0 100%',
      opacity:         0.14,
    }),

    // Bottom-left small arc
    el('div', {
      position:        'absolute',
      bottom:          0,
      left:            0,
      width:           arcSml,
      height:          arcSml,
      backgroundColor: accent,
      borderRadius:    '0 100% 0 0',
      opacity:         0.09,
    }),

    copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
      fontSize:    ty.eyebrow,
      color:       accent,
      letterSpacing: 3,
      fontWeight:  700,
      marginBottom: pad.gap,
    }),

    text(copy.headline, {
      fontSize:  ty.headline,
      fontWeight: 700,
      color:      '#111111',
      textAlign:  'center',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.84,
      marginBottom: pad.inner,
    }),

    copy.body && text(copy.body, {
      fontSize:  ty.body,
      color:     '#555555',
      textAlign: 'center',
      lineHeight: 1.6,
      maxWidth:   size.width * 0.72,
      marginBottom: copy.cta ? pad.inner : 0,
    }),

    copy.cta && ctaButton(copy.cta, accent, '#ffffff', ty.cta, 99),
  );
}

// ─── 6. CTA Final ────────────────────────────────────────────────────────────
// Three zones: social-proof quote top → headline center → big CTA bottom.

function templateCtaFinal(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection:   'column',
    justifyContent:  'space-between',
    padding:         pad.outer,
  },
    // Social proof zone (top)
    el('div', {
      backgroundColor: `${accent}14`,
      borderRadius:    12,
      padding:         `${pad.gap}px ${pad.inner}px`,
      flexDirection:   'column',
    },
      starRating(5, '#FBBF24', Math.round(ty.body * 0.9)),
      copy.eyebrow && el('div', { marginTop: Math.round(pad.gap * 0.6) },
        text(`"${copy.eyebrow}"`, {
          fontSize:  Math.round(ty.body * 0.9),
          color:     p.body,
          lineHeight: 1.4,
          maxWidth:  size.width * 0.84,
        }),
      ),
    ),

    // Headline center
    text(copy.headline, {
      fontSize:  ty.headline,
      fontWeight: 700,
      color:     p.headline,
      lineHeight: 1.1,
      maxWidth:   size.width * 0.9,
      textAlign:  'center',
    }),

    // CTA zone (bottom)
    el('div', {
      flexDirection: 'column',
      alignItems:    'center',
    },
      el('div', {
        backgroundColor: accent,
        color:           '#ffffff',
        fontSize:        Math.round(ty.cta * 1.3),
        fontWeight:      700,
        padding:         `${Math.round(ty.cta * 0.85)}px ${Math.round(ty.cta * 2.2)}px`,
        borderRadius:    16,
        letterSpacing:   0.3,
      }, copy.cta || 'Get Started'),

      copy.body && el('div', { marginTop: Math.round(pad.gap * 0.8) },
        text(copy.body, {
          fontSize:  Math.round(ty.body * 0.82),
          color:     `${p.body}99`,
          textAlign: 'center',
        }),
      ),
    ),
  );
}

// ─── 7. Stats Hero ───────────────────────────────────────────────────────────
// Giant stat on a background glow circle. Mini bar chart below.

function templateStatsHero(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  const numMatch   = copy.headline.match(/[\d,.%+x×]+/);
  const statNumber = numMatch ? numMatch[0] : copy.headline.slice(0, 4);
  const statLabel  = numMatch ? copy.headline.replace(numMatch[0], '').trim() : '';
  const glowR      = Math.round(size.width * 0.68);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         pad.outer,
    position:        'relative',
  },
    // Background glow circle
    el('div', {
      position:        'absolute',
      top:             Math.round(size.height / 2) - Math.round(glowR / 2),
      left:            Math.round(size.width  / 2) - Math.round(glowR / 2),
      width:           glowR,
      height:          glowR,
      borderRadius:    99999,
      backgroundColor: `${accent}0d`,
    }),

    // Giant stat
    text(statNumber, {
      fontSize:    Math.round(size.width * 0.28),
      fontWeight:  700,
      color:       accent,
      lineHeight:  1.0,
      letterSpacing: -4,
    }),

    statLabel && el('div', { marginTop: Math.round(pad.gap * 0.4) },
      text(statLabel, {
        fontSize:  Math.round(ty.headline * 0.52),
        fontWeight: 600,
        color:     p.headline,
        textAlign: 'center',
        maxWidth:  size.width * 0.8,
      }),
    ),

    // Mini bar chart (decorative — Reeeads "proof" energy)
    el('div', {
      flexDirection: 'row',
      alignItems:    'flex-end',
      marginTop:     pad.inner,
      marginBottom:  pad.inner,
    },
      ...[0.35, 0.55, 0.72, 0.5, 0.88, 0.78, 1.0].map((h, i) =>
        el('div', {
          width:           Math.round(size.width * 0.028),
          height:          Math.round(size.width * 0.11 * h),
          backgroundColor: i === 6 ? accent : `${accent}44`,
          borderRadius:    3,
          marginRight:     i < 6 ? Math.round(size.width * 0.014) : 0,
        }),
      ),
    ),

    copy.body && text(copy.body, {
      fontSize:  ty.body,
      color:     p.body,
      textAlign: 'center',
      lineHeight: 1.55,
      maxWidth:   size.width * 0.74,
    }),
  );
}

// ─── 8. Bold Headline ────────────────────────────────────────────────────────
// Dark gradient bg. Headline bottom-aligned. Badge sticker top-right.

function templateBoldHeadline(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  return el('div', {
    width: size.width, height: size.height,
    backgroundImage: `linear-gradient(160deg, ${p.background} 0%, ${p.surface || '#141428'} 100%)`,
    flexDirection:   'column',
    justifyContent:  'flex-end',
    padding:         pad.outer,
    position:        'relative',
  },
    // Badge sticker (top-right)
    el('div', {
      position:        'absolute',
      top:             pad.outer,
      right:           pad.outer,
      backgroundColor: accent,
      borderRadius:    99,
      padding:         `${Math.round(ty.eyebrow * 0.5)}px ${Math.round(ty.eyebrow * 1.2)}px`,
    },
      text((copy.eyebrow || 'NEW').toUpperCase(), {
        fontSize:    ty.eyebrow,
        fontWeight:  700,
        color:       '#ffffff',
        letterSpacing: 1,
      }),
    ),

    text(copy.headline, {
      fontSize:    Math.round(ty.headline * 1.1),
      fontWeight:  700,
      color:       p.headline,
      lineHeight:  1.05,
      letterSpacing: -1.5,
      maxWidth:    size.width * 0.94,
      marginBottom: copy.body ? pad.gap : (copy.cta ? pad.inner : 0),
    }),

    copy.body && text(copy.body, {
      fontSize:  Math.round(ty.body * 0.95),
      color:     p.body,
      lineHeight: 1.5,
      maxWidth:   size.width * 0.8,
      marginBottom: copy.cta ? pad.inner : 0,
    }),

    copy.cta && ctaButton(copy.cta, accent, '#ffffff', ty.cta),
  );
}

// ─── 9. Problem Slide ────────────────────────────────────────────────────────
// Full-height red left stripe. Dark bg. Eyebrow + headline with drama.

function templateProblemSlide(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || '#EF4444';

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: '#0d0d0d',
    flexDirection:   'row',
  },
    // Left warning stripe
    el('div', {
      width:           Math.round(size.width * 0.018),
      height:          size.height,
      backgroundColor: accent,
      flexShrink:      0,
    }),

    // Content
    el('div', {
      flex:          1,
      flexDirection: 'column',
      justifyContent: 'center',
      padding:       pad.outer,
    },
      el('div', { flexDirection: 'row', alignItems: 'center', marginBottom: pad.inner },
        el('div', { width: Math.round(size.width * 0.04), height: 3, backgroundColor: accent, borderRadius: 2, marginRight: pad.gap }),
        copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
          fontSize:    ty.eyebrow,
          color:       accent,
          fontWeight:  700,
          letterSpacing: 3,
        }),
      ),

      text(copy.headline, {
        fontSize:  ty.headline,
        fontWeight: 700,
        color:     '#ffffff',
        lineHeight: 1.1,
        maxWidth:  size.width * 0.88,
        marginBottom: copy.body ? pad.inner : 0,
      }),

      copy.body && text(copy.body, {
        fontSize:  ty.body,
        color:     'rgba(255,255,255,0.62)',
        lineHeight: 1.6,
        maxWidth:   size.width * 0.82,
      }),
    ),
  );
}

// ─── 10. Story Hook ──────────────────────────────────────────────────────────
// Simulated phone notch + swipe dots. Pattern interrupt hook.

function templateStoryHook(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;
  const notchW = Math.round(size.width * 0.2);
  const notchH = Math.round(size.width * 0.032);

  return el('div', {
    width: size.width, height: size.height,
    backgroundImage: `linear-gradient(180deg, ${p.background} 0%, ${accent}40 100%)`,
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         pad.outer,
    position:        'relative',
  },
    // Phone notch
    el('div', {
      position:        'absolute',
      top:             Math.round(size.height * 0.038),
      left:            Math.round(size.width / 2) - Math.round(notchW / 2),
      width:           notchW,
      height:          notchH,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius:    99,
    }),

    copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
      fontSize:    ty.eyebrow,
      color:       accent,
      fontWeight:  700,
      letterSpacing: 3,
      marginBottom: pad.inner,
      textAlign:   'center',
    }),

    text(copy.headline, {
      fontSize:  Math.round(ty.headline * 1.08),
      fontWeight: 700,
      color:     p.headline,
      textAlign: 'center',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.86,
      marginBottom: copy.body ? pad.inner : 0,
    }),

    copy.body && text(copy.body, {
      fontSize:  ty.body,
      color:     p.body,
      textAlign: 'center',
      lineHeight: 1.55,
      maxWidth:   size.width * 0.7,
      marginBottom: pad.inner * 1.8,
    }),

    // Swipe dots (story indicator)
    el('div', { position: 'absolute', bottom: pad.outer, flexDirection: 'row', alignItems: 'center' },
      el('div', { width: 36, height: 3, backgroundColor: accent,       borderRadius: 2, marginRight: 6 }),
      el('div', { width: 20, height: 3, backgroundColor: `${accent}66`, borderRadius: 2, marginRight: 6 }),
      el('div', { width: 12, height: 3, backgroundColor: `${accent}33`, borderRadius: 2 }),
    ),
  );
}

// ─── 11. Color Block ─────────────────────────────────────────────────────────
// Accent top / neutral bottom. Seam badge label bridges both zones.

function templateColorBlock(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;
  const topH   = Math.round(size.height * 0.47);
  const badgeH = Math.round(ty.eyebrow * 2.2);

  return el('div', {
    width: size.width, height: size.height,
    flexDirection: 'column',
    position:      'relative',
  },
    // Top accent zone
    el('div', {
      width:           size.width,
      height:          topH,
      backgroundColor: accent,
      flexDirection:   'column',
      justifyContent:  'flex-end',
      padding:         pad.outer,
      paddingBottom:   pad.inner,
    },
      copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
        fontSize:    ty.eyebrow,
        color:       'rgba(255,255,255,0.72)',
        fontWeight:  700,
        letterSpacing: 2,
        marginBottom: pad.gap,
      }),
      text(copy.headline, {
        fontSize:  Math.round(ty.headline * 0.82),
        fontWeight: 700,
        color:     '#ffffff',
        lineHeight: 1.1,
        maxWidth:  size.width * 0.9,
      }),
    ),

    // Seam badge (bridges both zones)
    el('div', {
      position:        'absolute',
      top:             topH - Math.round(badgeH / 2),
      left:            pad.outer,
      backgroundColor: '#ffffff',
      color:           accent,
      fontSize:        Math.round(ty.eyebrow * 1.1),
      fontWeight:      700,
      padding:         `${Math.round(ty.eyebrow * 0.45)}px ${Math.round(ty.eyebrow * 1.1)}px`,
      borderRadius:    6,
      letterSpacing:   1,
    }, (copy.cta || 'Learn More').toUpperCase()),

    // Bottom neutral zone
    el('div', {
      width:           size.width,
      flex:            1,
      backgroundColor: p.background,
      flexDirection:   'column',
      justifyContent:  'center',
      padding:         pad.outer,
      paddingTop:      Math.round(pad.inner * 2.5),
    },
      copy.body && text(copy.body, {
        fontSize:  ty.body,
        color:     p.body,
        lineHeight: 1.55,
        maxWidth:   size.width * 0.9,
      }),
    ),
  );
}

// ─── 12. Number List ─────────────────────────────────────────────────────────
// 2×2 bento grid cells with numbered accent circles (Reeeads bento pattern).

function templateNumberList(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  const items = (copy.body || '')
    .split(/\||\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  const cellW  = Math.round((size.width  - pad.outer * 2 - pad.gap) / 2);
  const cellH  = Math.round((size.height - pad.outer * 2 - ty.headline * 1.4 - pad.inner - pad.gap) / 2);
  const circSz = Math.round(ty.body * 1.65);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection:   'column',
    padding:         pad.outer,
    justifyContent:  'center',
  },
    text(copy.headline, {
      fontSize:  Math.round(ty.headline * 0.62),
      fontWeight: 700,
      color:     p.headline,
      lineHeight: 1.15,
      marginBottom: pad.inner,
      maxWidth:  size.width * 0.9,
    }),

    // Row 1
    el('div', { flexDirection: 'row', marginBottom: pad.gap },
      ...items.slice(0, 2).map((item, i) =>
        el('div', {
          width:           cellW,
          minHeight:       cellH,
          backgroundColor: `${accent}12`,
          borderRadius:    14,
          padding:         pad.inner,
          flexDirection:   'column',
          marginRight:     i === 0 ? pad.gap : 0,
        },
          numCircle(i + 1, accent, '#ffffff', circSz),
          el('div', { height: Math.round(pad.gap * 0.7) }),
          text(item, { fontSize: Math.round(ty.body * 0.9), color: p.body, lineHeight: 1.35, flex: 1 }),
        ),
      ),
    ),

    // Row 2
    items.length > 2 && el('div', { flexDirection: 'row' },
      ...items.slice(2, 4).map((item, i) =>
        el('div', {
          width:           cellW,
          minHeight:       cellH,
          backgroundColor: i === 0 ? `${accent}0e` : `${accent}08`,
          borderRadius:    14,
          padding:         pad.inner,
          flexDirection:   'column',
          marginRight:     i === 0 ? pad.gap : 0,
        },
          numCircle(i + 3, accent, '#ffffff', circSz),
          el('div', { height: Math.round(pad.gap * 0.7) }),
          text(item, { fontSize: Math.round(ty.body * 0.9), color: p.body, lineHeight: 1.35, flex: 1 }),
        ),
      ),
    ),
  );
}

// ─── 13. Brand Manifesto ─────────────────────────────────────────────────────
// Oversized decorative opening quote mark behind the centered statement.

function templateBrandManifesto(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         pad.outer,
    position:        'relative',
  },
    // Huge decorative quote mark (background element — rendered first = behind)
    el('div', {
      position:   'absolute',
      top:        Math.round(size.height * 0.04),
      left:       Math.round(size.width * 0.04),
      fontSize:   Math.round(size.width * 0.46),
      fontWeight: 700,
      color:      `${accent}14`,
      lineHeight: 0.75,
    }, '“'),

    copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
      fontSize:    ty.eyebrow,
      color:       accent,
      fontWeight:  700,
      letterSpacing: 3,
      marginBottom: pad.gap,
    }),

    text(copy.headline, {
      fontSize:    Math.round(ty.headline * 1.05),
      fontWeight:  700,
      color:       p.headline,
      textAlign:   'center',
      lineHeight:  1.1,
      letterSpacing: -1,
      maxWidth:    size.width * 0.86,
    }),

    // Accent bar below headline
    el('div', {
      width:           Math.round(size.width * 0.08),
      height:          Math.round(size.width * 0.007),
      backgroundColor: accent,
      borderRadius:    4,
      marginTop:       pad.inner,
      marginBottom:    copy.body ? pad.gap : 0,
    }),

    copy.body && text(copy.body, {
      fontSize:  ty.body,
      color:     p.body,
      textAlign: 'center',
      lineHeight: 1.55,
      maxWidth:   size.width * 0.6,
    }),
  );
}

// ─── 14. Empathy Card ────────────────────────────────────────────────────────
// Avatar circle + 5 stars + quote + author attribution.

function templateEmpathyCard(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const warm   = style.primaryColor || '#F97316';
  const avaR   = Math.round(size.width * 0.11);

  return el('div', {
    width: size.width, height: size.height,
    backgroundImage: `linear-gradient(145deg, ${warm}20 0%, ${p.background} 65%)`,
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         pad.outer,
  },
    // Avatar circle
    el('div', {
      width:           avaR * 2,
      height:          avaR * 2,
      borderRadius:    99,
      backgroundColor: `${warm}30`,
      borderWidth:     3,
      borderStyle:     'solid',
      borderColor:     `${warm}60`,
      alignItems:      'center',
      justifyContent:  'center',
      marginBottom:    pad.gap,
    },
      text('★', { fontSize: Math.round(avaR * 0.9), color: warm, fontWeight: 700 }),
    ),

    // Stars
    starRating(5, '#FBBF24', Math.round(ty.body * 0.95)),
    el('div', { height: pad.gap }),

    // Small decorative quote mark
    text('“', {
      fontSize:    Math.round(size.width * 0.1),
      color:       `${warm}55`,
      lineHeight:  0.7,
      fontWeight:  700,
    }),

    text(copy.headline, {
      fontSize:  Math.round(ty.headline * 0.85),
      fontWeight: 700,
      color:     p.headline,
      textAlign: 'center',
      lineHeight: 1.2,
      maxWidth:   size.width * 0.82,
      marginBottom: pad.gap,
    }),

    // Attribution
    copy.body && text(`— ${copy.body}`, {
      fontSize:  Math.round(ty.body * 0.85),
      color:     p.body,
      textAlign: 'center',
      lineHeight: 1.4,
      marginBottom: copy.cta ? pad.inner : 0,
    }),

    copy.cta && ctaButton(copy.cta, warm, '#ffffff', ty.cta, 99),
  );
}

// ─── 15. Hot Take ────────────────────────────────────────────────────────────
// Vivid solid-color bg. Badge sticker top-right. Bold statement + dark inset box.

function templateHotTake(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty      = getTypographyScale(size, style.tone);
  const pad     = getPadding(size);
  const accent  = style.primaryColor || p.cta;
  const badgeSz = Math.round(size.width * 0.18);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: accent,
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         pad.outer,
    position:        'relative',
  },
    // Circular badge sticker (top-right)
    el('div', {
      position:        'absolute',
      top:             pad.outer,
      right:           pad.outer,
      width:           badgeSz,
      height:          badgeSz,
      borderRadius:    99,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems:      'center',
      justifyContent:  'center',
    },
      text('!', { fontSize: Math.round(badgeSz * 0.48), fontWeight: 700, color: '#ffffff' }),
    ),

    copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
      fontSize:    ty.eyebrow,
      color:       'rgba(255,255,255,0.72)',
      fontWeight:  700,
      letterSpacing: 3,
      marginBottom: pad.inner,
      textAlign:   'center',
    }),

    text(copy.headline, {
      fontSize:  Math.round(ty.headline * 1.05),
      fontWeight: 700,
      color:     '#ffffff',
      textAlign: 'center',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.86,
      marginBottom: copy.body ? pad.inner : 0,
    }),

    copy.body && el('div', {
      backgroundColor: 'rgba(0,0,0,0.22)',
      borderRadius:    12,
      padding:         `${pad.gap}px ${pad.inner}px`,
    },
      text(copy.body, {
        fontSize:  ty.body,
        color:     'rgba(255,255,255,0.88)',
        textAlign: 'center',
        lineHeight: 1.5,
        maxWidth:   size.width * 0.8,
      }),
    ),

    // Bottom progress dots
    el('div', { position: 'absolute', bottom: pad.outer, flexDirection: 'row', alignItems: 'center' },
      el('div', { width: 32, height: 4, backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 2, marginRight: 6 }),
      el('div', { width: 20, height: 4, backgroundColor: 'rgba(255,255,255,0.38)', borderRadius: 2, marginRight: 6 }),
      el('div', { width: 12, height: 4, backgroundColor: 'rgba(255,255,255,0.2)',  borderRadius: 2 }),
    ),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NEW 8 TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

// ─── 16. Testimonial Card ────────────────────────────────────────────────────
// Stars → quote → author row (avatar + name + Trustpilot badge).

function templateTestimonialCard(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;
  const avaW   = Math.round(ty.body * 2.2);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection:   'column',
    justifyContent:  'space-between',
    padding:         pad.outer,
    position:        'relative',
  },
    // Giant background quote mark (decorative — first = behind)
    el('div', {
      position:   'absolute',
      top:        pad.outer,
      left:       pad.outer,
      fontSize:   Math.round(size.width * 0.36),
      fontWeight: 700,
      color:      `${accent}11`,
      lineHeight: 0.75,
    }, '“'),

    // Top: stars
    starRating(5, '#FBBF24', ty.body),

    // Middle: quote text
    text(copy.headline, {
      fontSize:    Math.round(ty.headline * 0.72),
      fontWeight:  700,
      color:       p.headline,
      lineHeight:  1.25,
      maxWidth:    size.width * 0.88,
      flex:        1,
      marginTop:   pad.inner,
      marginBottom: pad.inner,
    }),

    // Bottom: author row
    el('div', { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
      // Author info
      el('div', { flexDirection: 'row', alignItems: 'center' },
        el('div', {
          width:           avaW,
          height:          avaW,
          borderRadius:    99,
          backgroundColor: `${accent}33`,
          alignItems:      'center',
          justifyContent:  'center',
          marginRight:     Math.round(pad.gap * 0.9),
        },
          text('★', { fontSize: Math.round(avaW * 0.45), color: accent, fontWeight: 700 }),
        ),
        el('div', { flexDirection: 'column' },
          text(copy.body || 'Verified Customer', {
            fontSize:  Math.round(ty.body * 0.85),
            fontWeight: 700,
            color:     p.headline,
            marginBottom: 3,
          }),
          text('Verified Buyer', {
            fontSize:    ty.eyebrow,
            color:       accent,
            fontWeight:  700,
            letterSpacing: 0.5,
          }),
        ),
      ),

      // Trustpilot badge
      el('div', {
        backgroundColor: '#00B67A',
        borderRadius:    5,
        padding:         `${Math.round(ty.eyebrow * 0.4)}px ${Math.round(ty.eyebrow * 0.9)}px`,
        flexDirection:   'column',
        alignItems:      'center',
      },
        text('★★★★★', { fontSize: Math.round(ty.eyebrow * 0.88), color: '#ffffff', letterSpacing: 1, marginBottom: 2 }),
        text('Trustpilot', { fontSize: Math.round(ty.eyebrow * 0.75), color: '#ffffff', fontWeight: 700, letterSpacing: 0.4 }),
      ),
    ),
  );
}

// ─── 17. Versus Slide ────────────────────────────────────────────────────────
// Dark left panel (WITHOUT) vs accent right panel (WITH US). VS circle in center.

function templateVersusSlide(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  const rawItems  = (copy.body || '').split(/\||\n/).map(s => s.trim()).filter(Boolean);
  const leftItems = rawItems.filter((_, i) => i % 2 === 0).slice(0, 3);
  const rightItems= rawItems.filter((_, i) => i % 2 === 1).slice(0, 3);

  const halfW  = Math.round(size.width / 2);
  const vsSz   = Math.round(size.width * 0.1);
  const circSz = Math.round(ty.body * 1.5);

  return el('div', {
    width: size.width, height: size.height,
    flexDirection: 'row',
    position:      'relative',
  },
    // Left — WITHOUT panel
    el('div', {
      width:          halfW,
      height:         size.height,
      backgroundColor: '#111111',
      flexDirection:  'column',
      justifyContent: 'center',
      padding:        pad.outer,
      paddingRight:   Math.round(pad.outer * 0.7),
    },
      text('WITHOUT', { fontSize: ty.eyebrow, color: 'rgba(255,255,255,0.38)', fontWeight: 700, letterSpacing: 2, marginBottom: pad.inner }),

      ...leftItems.map((item, i) =>
        el('div', { flexDirection: 'row', alignItems: 'center', marginTop: i === 0 ? 0 : pad.gap },
          iconCircle('x', 'rgba(239,68,68,0.18)', '#EF4444', circSz),
          text(item, {
            fontSize:  Math.round(ty.body * 0.88),
            color:     'rgba(255,255,255,0.6)',
            lineHeight: 1.35,
            flex:      1,
            marginLeft: Math.round(pad.gap * 0.8),
          }),
        ),
      ),

      copy.headline && el('div', { marginTop: pad.inner },
        text(copy.headline, { fontSize: Math.round(ty.body * 0.82), color: 'rgba(255,255,255,0.35)', lineHeight: 1.3 }),
      ),
    ),

    // Right — WITH US panel
    el('div', {
      width:          halfW,
      height:         size.height,
      backgroundColor: accent,
      flexDirection:  'column',
      justifyContent: 'center',
      padding:        pad.outer,
      paddingLeft:    Math.round(pad.outer * 0.7),
    },
      text('WITH US', { fontSize: ty.eyebrow, color: 'rgba(255,255,255,0.72)', fontWeight: 700, letterSpacing: 2, marginBottom: pad.inner }),

      ...rightItems.map((item, i) =>
        el('div', { flexDirection: 'row', alignItems: 'center', marginTop: i === 0 ? 0 : pad.gap },
          iconCircle('✓', 'rgba(255,255,255,0.25)', '#ffffff', circSz),
          text(item, {
            fontSize:  Math.round(ty.body * 0.88),
            color:     '#ffffff',
            lineHeight: 1.35,
            flex:      1,
            marginLeft: Math.round(pad.gap * 0.8),
          }),
        ),
      ),

      copy.cta && el('div', { marginTop: pad.inner },
        ctaButton(copy.cta, '#ffffff', accent, ty.cta),
      ),
    ),

    // VS divider circle (centered, absolutely positioned)
    el('div', {
      position:        'absolute',
      top:             Math.round(size.height / 2) - Math.round(vsSz / 2),
      left:            Math.round(size.width  / 2) - Math.round(vsSz / 2),
      width:           vsSz,
      height:          vsSz,
      borderRadius:    99,
      backgroundColor: '#ffffff',
      alignItems:      'center',
      justifyContent:  'center',
    },
      text('VS', { fontSize: Math.round(vsSz * 0.34), fontWeight: 700, color: accent, letterSpacing: 1 }),
    ),
  );
}

// ─── 18. Before / After Slide ────────────────────────────────────────────────
// Dark top (BEFORE) / accent bottom (AFTER). Down-arrow circle on the seam.

function templateBeforeAfterSlide(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  const parts      = (copy.body || '').split(/\||\n/).map(s => s.trim()).filter(Boolean);
  const beforeText = parts[0] || copy.headline;
  const afterText  = parts[1] || copy.headline;
  const halfH      = Math.round(size.height / 2);
  const arrowSz    = Math.round(size.width * 0.11);

  return el('div', {
    width: size.width, height: size.height,
    flexDirection: 'column',
    position:      'relative',
  },
    // BEFORE zone
    el('div', {
      width:           size.width,
      height:          halfH,
      backgroundColor: '#111111',
      flexDirection:   'column',
      justifyContent:  'center',
      padding:         pad.outer,
    },
      badge('BEFORE', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.65)', 4, ty.eyebrow, Math.round(ty.eyebrow), Math.round(ty.eyebrow * 0.5)),
      el('div', { height: pad.gap }),
      text(beforeText, {
        fontSize:  Math.round(ty.headline * 0.65),
        fontWeight: 700,
        color:     'rgba(255,255,255,0.72)',
        lineHeight: 1.2,
        maxWidth:  size.width * 0.85,
      }),
    ),

    // AFTER zone
    el('div', {
      width:           size.width,
      height:          halfH,
      backgroundColor: accent,
      flexDirection:   'column',
      justifyContent:  'center',
      padding:         pad.outer,
      paddingTop:      Math.round(halfH * 0.22),
    },
      badge('AFTER', 'rgba(255,255,255,0.25)', '#ffffff', 4, ty.eyebrow, Math.round(ty.eyebrow), Math.round(ty.eyebrow * 0.5)),
      el('div', { height: pad.gap }),
      text(afterText, {
        fontSize:  Math.round(ty.headline * 0.65),
        fontWeight: 700,
        color:     '#ffffff',
        lineHeight: 1.2,
        maxWidth:  size.width * 0.85,
      }),
    ),

    // Arrow divider circle on the seam
    el('div', {
      position:        'absolute',
      top:             halfH - Math.round(arrowSz / 2),
      left:            Math.round(size.width / 2) - Math.round(arrowSz / 2),
      width:           arrowSz,
      height:          arrowSz,
      borderRadius:    99,
      backgroundColor: '#ffffff',
      alignItems:      'center',
      justifyContent:  'center',
    },
      text('v', { fontSize: Math.round(arrowSz * 0.42), fontWeight: 700, color: accent }),
    ),
  );
}

// ─── 19. Press Slide ─────────────────────────────────────────────────────────
// "AS SEEN IN" media logo bar → pull quote → CTA (Reeeads press ads pattern).

function templatePressSlide(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection:   'column',
    justifyContent:  'space-between',
    padding:         pad.outer,
  },
    // Top: media logo bar
    el('div', { flexDirection: 'column', alignItems: 'center' },
      text('AS SEEN IN', {
        fontSize:    ty.eyebrow,
        color:       p.body,
        fontWeight:  700,
        letterSpacing: 3,
        marginBottom: pad.inner,
      }),
      mediaRow(['Forbes', 'Inc', 'TechCrunch', 'Bloomberg'], p.headline, Math.round(ty.body * 0.82)),
      el('div', { marginTop: pad.inner },
        dividerLine(`${p.body}22`, Math.round(size.width * 0.78)),
      ),
    ),

    // Middle: pull quote
    el('div', { flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' },
      text('“', {
        fontSize:    Math.round(size.width * 0.17),
        color:       `${accent}35`,
        lineHeight:  0.7,
        fontWeight:  700,
        marginBottom: Math.round(pad.gap * 0.4),
      }),
      text(copy.headline, {
        fontSize:  Math.round(ty.headline * 0.7),
        fontWeight: 700,
        color:     p.headline,
        textAlign: 'center',
        lineHeight: 1.2,
        maxWidth:   size.width * 0.82,
        marginBottom: copy.body ? pad.gap : 0,
      }),
      copy.body && text(`— ${copy.body}`, {
        fontSize:  Math.round(ty.body * 0.85),
        color:     accent,
        fontWeight: 700,
        textAlign: 'center',
      }),
    ),

    // Bottom: CTA
    copy.cta && el('div', { alignItems: 'center' },
      ctaButton(copy.cta, accent, '#ffffff', ty.cta, 99),
    ),
  );
}

// ─── 20. Point-Out Slide ─────────────────────────────────────────────────────
// Central product placeholder + 3 annotated feature callouts with dash connectors.

function templatePointOutSlide(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  const items  = (copy.body || '').split(/\||\n/).map(s => s.trim()).filter(Boolean).slice(0, 3);
  const prodW  = Math.round(size.width * 0.44);
  const prodH  = Math.round(size.height * 0.44);
  const dotSz  = Math.round(size.width * 0.028);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection:   'column',
    padding:         pad.outer,
  },
    text(copy.headline, {
      fontSize:    Math.round(ty.headline * 0.62),
      fontWeight:  700,
      color:       p.headline,
      lineHeight:  1.15,
      maxWidth:    size.width * 0.85,
      marginBottom: pad.inner,
    }),

    // Product zone + callout labels
    el('div', { flexDirection: 'row', flex: 1, alignItems: 'center' },
      // Central product placeholder
      el('div', {
        width:           prodW,
        height:          prodH,
        backgroundColor: `${accent}16`,
        borderRadius:    18,
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
        position:        'relative',
      },
        text('✦', { fontSize: Math.round(prodW * 0.28), color: `${accent}55`, fontWeight: 700 }),

        // Dot markers on right edge (callout anchors)
        ...items.map((_, i) => {
          const positions = [0.22, 0.5, 0.78];
          return el('div', {
            position:        'absolute',
            top:             Math.round(prodH * positions[i]) - Math.round(dotSz / 2),
            right:           -Math.round(dotSz / 2),
            width:           dotSz,
            height:          dotSz,
            borderRadius:    99,
            backgroundColor: accent,
          });
        }),
      ),

      // Callout labels on right
      el('div', {
        flex:          1,
        flexDirection: 'column',
        justifyContent: 'center',
        paddingLeft:   pad.inner,
      },
        ...items.map((item, i) =>
          el('div', {
            flexDirection: 'row',
            alignItems:    'center',
            marginTop:     i === 0 ? 0 : Math.round((prodH - ty.body * 3) / (items.length - 1 || 1)),
          },
            el('div', { width: Math.round(size.width * 0.06), height: 2, backgroundColor: accent, marginRight: pad.gap }),
            text(item, {
              fontSize:  Math.round(ty.body * 0.9),
              color:     p.body,
              lineHeight: 1.35,
              flex:      1,
            }),
          ),
        ),
      ),
    ),

    copy.cta && el('div', { marginTop: pad.inner },
      ctaButton(copy.cta, accent, '#ffffff', ty.cta),
    ),
  );
}

// ─── 21. Gallery Slide ───────────────────────────────────────────────────────
// 2×2 tinted grid (accent color fills simulating product images) + headline footer.

function templateGallerySlide(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  const footerH = Math.round(size.height * 0.19);
  const gridH   = size.height - footerH;
  const cellW   = Math.round(size.width  / 2);
  const cellH   = Math.round(gridH / 2);
  const gap     = 2;

  const labels  = (copy.body || '').split(/\||\n/).map(s => s.trim()).filter(Boolean);
  const opacities = ['cc', '99', '77', '55'];

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection:   'column',
  },
    // Grid
    el('div', { width: size.width, height: gridH, flexDirection: 'column' },
      // Row 1
      el('div', { flexDirection: 'row', height: cellH, marginBottom: gap },
        ...[0, 1].map(i =>
          el('div', {
            width:           cellW - (i === 0 ? gap : 0),
            height:          cellH,
            backgroundColor: `${accent}${opacities[i]}`,
            alignItems:      'center',
            justifyContent:  'center',
            marginRight:     i === 0 ? gap : 0,
            position:        'relative',
          },
            labels[i] && el('div', {
              position:        'absolute',
              bottom:          Math.round(cellH * 0.08),
              left:            Math.round(pad.gap * 0.8),
              backgroundColor: 'rgba(0,0,0,0.52)',
              borderRadius:    5,
              padding:         `${Math.round(ty.eyebrow * 0.35)}px ${Math.round(ty.eyebrow * 0.75)}px`,
            },
              text(labels[i], { fontSize: ty.eyebrow, color: '#ffffff', fontWeight: 700 }),
            ),
          ),
        ),
      ),

      // Row 2
      el('div', { flexDirection: 'row', height: cellH },
        ...[2, 3].map(i =>
          el('div', {
            width:           cellW - (i === 2 ? gap : 0),
            height:          cellH,
            backgroundColor: `${accent}${opacities[i]}`,
            alignItems:      'center',
            justifyContent:  'center',
            marginRight:     i === 2 ? gap : 0,
            position:        'relative',
          },
            labels[i] && el('div', {
              position:        'absolute',
              bottom:          Math.round(cellH * 0.08),
              left:            Math.round(pad.gap * 0.8),
              backgroundColor: 'rgba(0,0,0,0.52)',
              borderRadius:    5,
              padding:         `${Math.round(ty.eyebrow * 0.35)}px ${Math.round(ty.eyebrow * 0.75)}px`,
            },
              text(labels[i], { fontSize: ty.eyebrow, color: '#ffffff', fontWeight: 700 }),
            ),
          ),
        ),
      ),
    ),

    // Footer bar
    el('div', {
      width:          size.width,
      height:         footerH,
      backgroundColor: p.background,
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        `0 ${pad.outer}px`,
    },
      text(copy.headline, {
        fontSize:  Math.round(ty.headline * 0.46),
        fontWeight: 700,
        color:     p.headline,
        maxWidth:  size.width * 0.62,
        lineHeight: 1.15,
      }),
      copy.cta && ctaButton(copy.cta, accent, '#ffffff', ty.cta),
    ),
  );
}

// ─── 22. Chat Native ─────────────────────────────────────────────────────────
// iMessage-style chat bubbles. Body split on '|' → messages.

function templateChatNative(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  const parts = (copy.body || '').split(/\|/).map(s => s.trim()).filter(Boolean);
  const msg1  = parts[0] || copy.headline;
  const msg2  = parts[1] || copy.cta || 'Yes, here is how we help...';
  const msg3  = parts[2] || '';

  const headerH = Math.round(size.height * 0.12);
  const inputH  = Math.round(size.height * 0.1);
  const avaW    = Math.round(ty.body * 1.8);
  const bubbleW = Math.round(size.width * 0.72);
  const bubbleMb= Math.round(ty.body * 0.7);
  const bubbleFs= Math.round(ty.body * 0.9);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: '#F2F2F7',
    flexDirection:   'column',
  },
    // Header
    el('div', {
      width:           size.width,
      height:          headerH,
      backgroundColor: '#ffffff',
      flexDirection:   'row',
      alignItems:      'center',
      padding:         `0 ${pad.outer}px`,
    },
      el('div', {
        width:           avaW,
        height:          avaW,
        borderRadius:    99,
        backgroundColor: accent,
        alignItems:      'center',
        justifyContent:  'center',
        marginRight:     Math.round(pad.gap * 0.8),
      },
        text('★', { fontSize: Math.round(avaW * 0.44), color: '#ffffff', fontWeight: 700 }),
      ),
      el('div', { flexDirection: 'column' },
        text(style.platform || 'Support', { fontSize: ty.body, fontWeight: 700, color: '#111111', marginBottom: 2 }),
        text('Usually replies instantly', { fontSize: ty.eyebrow, color: '#34C759' }),
      ),
    ),

    // Messages
    el('div', {
      flex:          1,
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding:       `${pad.inner}px ${pad.outer}px`,
    },
      chatBubble(msg1, 'left',  '#E9E9EB', '#111111', bubbleFs, bubbleW, bubbleMb),
      chatBubble(msg2, 'right', accent,    '#ffffff', bubbleFs, bubbleW, msg3 ? bubbleMb : 0),
      msg3 && chatBubble(msg3, 'left', '#E9E9EB', '#111111', bubbleFs, bubbleW, 0),
    ),

    // Input bar
    el('div', {
      width:           size.width,
      height:          inputH,
      backgroundColor: '#ffffff',
      flexDirection:   'row',
      alignItems:      'center',
      padding:         `0 ${pad.outer}px`,
    },
      el('div', {
        flex:            1,
        height:          Math.round(ty.body * 2.1),
        backgroundColor: '#F2F2F7',
        borderRadius:    99,
        paddingLeft:     pad.inner,
        alignItems:      'center',
        justifyContent:  'flex-start',
        marginRight:     pad.gap,
      },
        text('iMessage', { fontSize: Math.round(ty.body * 0.85), color: '#999999' }),
      ),
      el('div', {
        width:           Math.round(ty.body * 2.1),
        height:          Math.round(ty.body * 2.1),
        borderRadius:    99,
        backgroundColor: accent,
        alignItems:      'center',
        justifyContent:  'center',
      },
        text('^', { fontSize: ty.body, color: '#ffffff', fontWeight: 700 }),
      ),
    ),
  );
}

// ─── 23. Offer Drop ──────────────────────────────────────────────────────────
// Large circular offer badge (bordered) with SAVE label. CTA below. Eyebrow pill top.

function templateOfferDrop(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty     = getTypographyScale(size, style.tone);
  const pad    = getPadding(size);
  const accent = style.primaryColor || p.cta;

  const badgeSz = Math.round(Math.min(size.width, size.height) * 0.42);
  const border  = Math.round(size.width * 0.007);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         pad.outer,
    position:        'relative',
  },
    // Background glow
    el('div', {
      position:        'absolute',
      top:             Math.round(size.height / 2) - badgeSz,
      left:            Math.round(size.width  / 2) - badgeSz,
      width:           badgeSz * 2,
      height:          badgeSz * 2,
      borderRadius:    99999,
      backgroundColor: `${accent}10`,
    }),

    // Eyebrow pill (limited time label)
    copy.eyebrow && el('div', { marginBottom: pad.inner },
      badge(copy.eyebrow, accent, '#ffffff', 99, ty.eyebrow),
    ),

    // Main offer circle
    el('div', {
      width:           badgeSz,
      height:          badgeSz,
      borderRadius:    99999,
      backgroundColor: `${accent}14`,
      borderWidth:     border,
      borderStyle:     'solid',
      borderColor:     accent,
      alignItems:      'center',
      justifyContent:  'center',
      flexDirection:   'column',
      marginBottom:    pad.inner,
    },
      text('SAVE', {
        fontSize:    Math.round(ty.eyebrow * 0.92),
        fontWeight:  700,
        color:       accent,
        letterSpacing: 3,
        marginBottom: Math.round(ty.eyebrow * 0.3),
      }),
      text(copy.headline, {
        fontSize:    Math.round(badgeSz * 0.37),
        fontWeight:  700,
        color:       accent,
        lineHeight:  0.95,
        letterSpacing: -2,
        textAlign:   'center',
      }),
    ),

    copy.body && text(copy.body, {
      fontSize:    ty.body,
      color:       p.body,
      textAlign:   'center',
      lineHeight:  1.5,
      maxWidth:    size.width * 0.72,
      marginBottom: copy.cta ? pad.inner : 0,
    }),

    copy.cta && ctaButton(copy.cta, accent, '#ffffff', ty.cta, 99),
  );
}
