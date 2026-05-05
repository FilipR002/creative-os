// ─── Satori Template Library ───────────────────────────────────────────────────
//
// Each template is a pure function:
//   (input: CompositorInput, size: ParsedSize, palette: ColorPalette) → SatoriNode
//
// Satori constraints:
//  - All elements must have display: flex (block / inline not supported)
//  - backgroundImage: 'linear-gradient(...)' works
//  - backgroundImage: 'url(data:...)' works for data URLs
//  - No overflow:hidden on containers with text (use clip sparingly)
//  - Fonts: only what's in SatoriRendererService.fonts[] (Inter 400/700)
//  - No CSS variables, no @keyframes, no pseudo-elements

import type { CompositorInput, ParsedSize } from '../types/compositor.types';
import type { ColorPalette }                from '../design/design-system';
import { getTypographyScale, getPadding }   from '../design/design-system';

// ─── Element builder ──────────────────────────────────────────────────────────

type Child = SatoriNode | string | false | null | undefined;

export interface SatoriNode {
  type:  string;
  props: {
    style?:    Record<string, any>;
    children?: SatoriNode | SatoriNode[] | string | Child[];
    [k: string]: any;
  };
}

function el(
  type:     string,
  style:    Record<string, any>,
  ...children: Child[]
): SatoriNode {
  const validChildren = children.filter(
    (c): c is SatoriNode | string => c !== false && c !== null && c !== undefined,
  );
  return {
    type,
    props: {
      style: { display: 'flex', ...style },
      children: validChildren.length === 1 ? validChildren[0] : validChildren,
    },
  };
}

// Leaf text node — Satori renders strings directly as text content
function text(content: string, style: Record<string, any>): SatoriNode {
  return { type: 'span', props: { style: { display: 'flex', ...style }, children: content } };
}

// CTA button pill
function ctaButton(label: string, bg: string, fg: string, fontSize: number, radius = 12): SatoriNode {
  return el('div', {
    backgroundColor: bg,
    color:           fg,
    padding:         `${Math.round(fontSize * 0.55)}px ${Math.round(fontSize * 1.4)}px`,
    borderRadius:    radius,
    fontSize,
    fontWeight:      700,
    letterSpacing:   0.3,
  }, label);
}

// Eyebrow label (small uppercase tag above headline)
function eyebrowTag(label: string, color: string, fontSize: number, accent: string): SatoriNode {
  return el('div', {
    backgroundColor: `${accent}22`,
    color,
    fontSize,
    fontWeight:      700,
    letterSpacing:   2,
    padding:         `${Math.round(fontSize * 0.4)}px ${Math.round(fontSize * 0.9)}px`,
    borderRadius:    6,
    marginBottom:    Math.round(fontSize * 1.2),
  }, label.toUpperCase());
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function buildSatoriElement(
  input:   CompositorInput,
  size:    ParsedSize,
  palette: ColorPalette,
): SatoriNode {
  switch (input.templateId) {
    case 'minimal':        return templateMinimal(input, size, palette);
    case 'text-only-bold': return templateTextOnlyBold(input, size, palette);
    case 'gradient-pop':   return templateGradientPop(input, size, palette);
    case 'feature-list':   return templateFeatureList(input, size, palette);
    case 'bright-minimal': return templateBrightMinimal(input, size, palette);
    case 'cta-final':      return templateCtaFinal(input, size, palette);
    case 'stats-hero':     return templateStatsHero(input, size, palette);
    case 'bold-headline':  return templateBoldHeadline(input, size, palette);
    case 'problem-slide':  return templateProblemSlide(input, size, palette);
    case 'story-hook':     return templateStoryHook(input, size, palette);
    case 'color-block':    return templateColorBlock(input, size, palette);
    case 'number-list':    return templateNumberList(input, size, palette);
    case 'brand-manifesto':return templateBrandManifesto(input, size, palette);
    case 'empathy-card':   return templateEmpathyCard(input, size, palette);
    case 'hot-take':       return templateHotTake(input, size, palette);
    default:               return templateMinimal(input, size, palette);
  }
}

// ─── 1. Minimal ───────────────────────────────────────────────────────────────
// Clean centered content on a solid background. Works for value / tips slides.

function templateMinimal(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy } = input;
  const ty  = getTypographyScale(size, input.style.tone);
  const pad = getPadding(size);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: pad.outer,
  },
    copy.eyebrow && eyebrowTag(copy.eyebrow, p.eyebrow, ty.eyebrow, p.cta),

    text(copy.headline, {
      fontSize:   ty.headline,
      fontWeight: 700,
      color:      p.headline,
      textAlign:  'center',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.88,
    }),

    copy.body && el('div', { marginTop: pad.inner },
      text(copy.body, {
        fontSize:  ty.body,
        color:     p.body,
        textAlign: 'center',
        lineHeight: 1.55,
        maxWidth:  size.width * 0.78,
      }),
    ),

    copy.cta && el('div', { marginTop: pad.inner * 1.5 },
      ctaButton(copy.cta, p.cta, p.ctaText, ty.cta),
    ),
  );
}

// ─── 2. Text-Only Bold ────────────────────────────────────────────────────────
// Giant typography. Dark bg, oversized headline, minimal extras.

function templateTextOnlyBold(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy } = input;
  const ty  = getTypographyScale(size, input.style.tone);
  const pad = getPadding(size);
  const bigFont = Math.round(ty.headline * 1.15);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection: 'column',
    justifyContent: 'center',
    padding: pad.outer,
  },
    // Accent bar left
    el('div', {
      width: Math.round(size.width * 0.045),
      height: Math.round(bigFont * 0.15),
      backgroundColor: p.cta,
      borderRadius: 4,
      marginBottom: pad.inner,
    }),

    text(copy.headline, {
      fontSize:   bigFont,
      fontWeight: 700,
      color:      p.headline,
      lineHeight: 1.05,
      letterSpacing: -1,
      maxWidth:   size.width * 0.92,
    }),

    copy.body && el('div', { marginTop: pad.inner },
      text(copy.body, {
        fontSize:   ty.body,
        color:      p.body,
        lineHeight: 1.6,
        maxWidth:   size.width * 0.72,
      }),
    ),
  );
}

// ─── 3. Gradient Pop ─────────────────────────────────────────────────────────
// Vivid gradient bg, centered headline + CTA. Scroll-stopping.

function templateGradientPop(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || p.cta;
  const grad = `linear-gradient(135deg, ${accent}dd 0%, ${p.background} 100%)`;

  return el('div', {
    width: size.width, height: size.height,
    backgroundImage: grad,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: pad.outer,
  },
    copy.eyebrow && eyebrowTag(copy.eyebrow, '#ffffff', ty.eyebrow, '#ffffff'),

    text(copy.headline, {
      fontSize:   ty.headline,
      fontWeight: 700,
      color:      '#ffffff',
      textAlign:  'center',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.86,
    }),

    copy.body && el('div', { marginTop: pad.inner },
      text(copy.body, {
        fontSize:  ty.body,
        color:     'rgba(255,255,255,0.85)',
        textAlign: 'center',
        lineHeight: 1.55,
        maxWidth:   size.width * 0.74,
      }),
    ),

    copy.cta && el('div', { marginTop: pad.inner * 1.6 },
      ctaButton(copy.cta, '#ffffff', accent, ty.cta),
    ),
  );
}

// ─── 4. Feature List ─────────────────────────────────────────────────────────
// Checklist slide. Body lines split on ' | ' or newline for list items.

function templateFeatureList(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy } = input;
  const ty  = getTypographyScale(size, input.style.tone);
  const pad = getPadding(size);

  const items = (copy.body || '')
    .split(/\||\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection: 'column',
    justifyContent: 'center',
    padding: pad.outer,
  },
    copy.eyebrow && eyebrowTag(copy.eyebrow, p.eyebrow, ty.eyebrow, p.cta),

    text(copy.headline, {
      fontSize:   Math.round(ty.headline * 0.72),
      fontWeight: 700,
      color:      p.headline,
      lineHeight: 1.15,
      marginBottom: pad.inner,
      maxWidth:   size.width * 0.9,
    }),

    ...items.map((item, i) =>
      el('div', {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: i === 0 ? 0 : pad.gap,
      },
        // Checkmark dot
        el('div', {
          width:           Math.round(ty.body * 1.1),
          height:          Math.round(ty.body * 1.1),
          borderRadius:    99,
          backgroundColor: p.cta,
          marginRight:     Math.round(pad.gap * 0.9),
          marginTop:       Math.round(ty.body * 0.1),
          flexShrink:      0,
          alignItems:      'center',
          justifyContent:  'center',
        },
          text('✓', { fontSize: Math.round(ty.body * 0.65), color: p.ctaText, fontWeight: 700 }),
        ),
        text(item, {
          fontSize:   ty.body,
          color:      p.body,
          lineHeight: 1.45,
          flex:       1,
        }),
      )
    ),

    copy.cta && el('div', { marginTop: pad.inner },
      ctaButton(copy.cta, p.cta, p.ctaText, ty.cta),
    ),
  );
}

// ─── 5. Bright Minimal ───────────────────────────────────────────────────────
// White/light canvas with single brand-color accent. SaaS / display banner style.

function templateBrightMinimal(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || p.cta;

  // Force light bg
  const bg  = p.background === '#000000' || p.background.startsWith('#0') ? '#F8F8F8' : p.background;
  const fg  = '#111111';
  const sub = '#555555';

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: bg,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: pad.outer,
  },
    // Top accent line
    el('div', {
      width:           size.width * 0.12,
      height:          Math.round(size.width * 0.006),
      backgroundColor: accent,
      borderRadius:    4,
      marginBottom:    pad.inner,
    }),

    copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
      fontSize:      ty.eyebrow,
      color:         accent,
      letterSpacing: 3,
      fontWeight:    700,
      marginBottom:  Math.round(ty.eyebrow * 0.9),
    }),

    text(copy.headline, {
      fontSize:   ty.headline,
      fontWeight: 700,
      color:      fg,
      textAlign:  'center',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.84,
    }),

    copy.body && el('div', { marginTop: pad.inner },
      text(copy.body, {
        fontSize:  ty.body,
        color:     sub,
        textAlign: 'center',
        lineHeight: 1.6,
        maxWidth:   size.width * 0.72,
      }),
    ),

    copy.cta && el('div', { marginTop: pad.inner * 1.6 },
      ctaButton(copy.cta, accent, '#ffffff', ty.cta),
    ),
  );
}

// ─── 6. CTA Final ────────────────────────────────────────────────────────────
// Closing carousel slide. Urgency headline + large CTA button.

function templateCtaFinal(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || p.cta;

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: pad.outer,
  },
    // "Don't miss out" style eyebrow
    copy.eyebrow && el('div', {
      backgroundColor: `${accent}22`,
      borderRadius:    99,
      padding:         `${Math.round(ty.eyebrow * 0.45)}px ${Math.round(ty.eyebrow * 1.1)}px`,
      marginBottom:    pad.inner,
    },
      text(copy.eyebrow.toUpperCase(), {
        fontSize:      ty.eyebrow,
        color:         accent,
        fontWeight:    700,
        letterSpacing: 2,
      }),
    ),

    text(copy.headline, {
      fontSize:   ty.headline,
      fontWeight: 700,
      color:      p.headline,
      textAlign:  'center',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.84,
    }),

    copy.body && el('div', { marginTop: pad.gap },
      text(copy.body, {
        fontSize:  ty.body,
        color:     p.body,
        textAlign: 'center',
        lineHeight: 1.5,
        maxWidth:   size.width * 0.72,
      }),
    ),

    // Big prominent CTA button
    el('div', { marginTop: pad.inner * 1.8, flexDirection: 'column', alignItems: 'center' },
      el('div', {
        backgroundColor: accent,
        color:           '#ffffff',
        fontSize:        Math.round(ty.cta * 1.3),
        fontWeight:      700,
        padding:         `${Math.round(ty.cta * 0.85)}px ${Math.round(ty.cta * 2.2)}px`,
        borderRadius:    16,
        letterSpacing:   0.3,
      }, copy.cta || 'Get Started'),
    ),
  );
}

// ─── 7. Stats Hero ───────────────────────────────────────────────────────────
// Giant number as visual anchor. Headline treated as the stat value.

function templateStatsHero(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || p.cta;

  // Try to extract a number from headline for giant display
  const numMatch = copy.headline.match(/[\d,.%+x×]+/);
  const statNumber = numMatch ? numMatch[0] : copy.headline.slice(0, 4);
  const statLabel  = numMatch ? copy.headline.replace(numMatch[0], '').trim() : '';

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: pad.outer,
  },
    // Giant stat number
    text(statNumber, {
      fontSize:      Math.round(size.width * 0.32),
      fontWeight:    700,
      color:         accent,
      lineHeight:    1.0,
      letterSpacing: -4,
    }),

    statLabel && text(statLabel, {
      fontSize:      Math.round(ty.headline * 0.55),
      fontWeight:    600,
      color:         p.headline,
      textAlign:     'center',
      marginTop:     Math.round(pad.gap * 0.4),
      maxWidth:      size.width * 0.8,
    }),

    // Divider
    el('div', {
      width:           size.width * 0.1,
      height:          3,
      backgroundColor: p.cta,
      borderRadius:    4,
      marginTop:       pad.inner,
      marginBottom:    pad.inner,
    }),

    copy.body && text(copy.body, {
      fontSize:  ty.body,
      color:     p.body,
      textAlign: 'center',
      lineHeight: 1.55,
      maxWidth:   size.width * 0.74,
    }),
  );
}

// ─── 8. Bold Headline (no-image variant) ─────────────────────────────────────
// Huge typography over gradient background. No photo needed.

function templateBoldHeadline(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || p.cta;

  return el('div', {
    width: size.width, height: size.height,
    backgroundImage: `linear-gradient(160deg, ${p.background} 0%, ${p.surface || '#1a1a2e'} 100%)`,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: pad.outer,
  },
    copy.eyebrow && eyebrowTag(copy.eyebrow, p.eyebrow, ty.eyebrow, accent),

    text(copy.headline, {
      fontSize:      Math.round(ty.headline * 1.1),
      fontWeight:    700,
      color:         p.headline,
      lineHeight:    1.05,
      letterSpacing: -1.5,
      maxWidth:      size.width * 0.94,
    }),

    copy.body && el('div', { marginTop: pad.gap },
      text(copy.body, {
        fontSize:  Math.round(ty.body * 0.95),
        color:     p.body,
        lineHeight: 1.5,
        maxWidth:   size.width * 0.8,
      }),
    ),

    copy.cta && el('div', { marginTop: pad.inner },
      ctaButton(copy.cta, accent, '#ffffff', ty.cta),
    ),
  );
}

// ─── 9. Problem Slide ────────────────────────────────────────────────────────
// Pain-point agitation. Dark, high-contrast, tension-building.

function templateProblemSlide(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || '#EF4444'; // Red for problem slides

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: '#0d0d0d',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: pad.outer,
  },
    // Warning bar
    el('div', {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: pad.inner,
    },
      el('div', {
        width: Math.round(size.width * 0.05),
        height: 3,
        backgroundColor: accent,
        borderRadius: 2,
        marginRight: pad.gap,
      }),
      copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
        fontSize:      ty.eyebrow,
        color:         accent,
        fontWeight:    700,
        letterSpacing: 3,
      }),
    ),

    text(copy.headline, {
      fontSize:   ty.headline,
      fontWeight: 700,
      color:      '#ffffff',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.9,
    }),

    copy.body && el('div', { marginTop: pad.inner },
      text(copy.body, {
        fontSize:  ty.body,
        color:     'rgba(255,255,255,0.65)',
        lineHeight: 1.6,
        maxWidth:   size.width * 0.82,
      }),
    ),
  );
}

// ─── 10. Story Hook ──────────────────────────────────────────────────────────
// Pattern interrupt. Big question, full-frame, stop-scroll hook.

function templateStoryHook(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || p.cta;

  return el('div', {
    width: size.width, height: size.height,
    backgroundImage: `linear-gradient(180deg, ${p.background} 0%, ${accent}33 100%)`,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: pad.outer,
  },
    copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
      fontSize:      ty.eyebrow,
      color:         accent,
      fontWeight:    700,
      letterSpacing: 3,
      marginBottom:  pad.inner,
    }),

    text(copy.headline, {
      fontSize:   Math.round(ty.headline * 1.08),
      fontWeight: 700,
      color:      p.headline,
      textAlign:  'center',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.86,
    }),

    copy.body && el('div', { marginTop: pad.inner },
      text(copy.body, {
        fontSize:  ty.body,
        color:     p.body,
        textAlign: 'center',
        lineHeight: 1.55,
        maxWidth:   size.width * 0.7,
      }),
    ),

    // Swipe indicator
    el('div', {
      marginTop:       pad.inner * 1.8,
      flexDirection:   'row',
      alignItems:      'center',
    },
      el('div', { width: 36, height: 3, backgroundColor: accent, borderRadius: 2, marginRight: 6 }),
      el('div', { width: 18, height: 3, backgroundColor: `${accent}66`, borderRadius: 2, marginRight: 6 }),
      el('div', { width: 10, height: 3, backgroundColor: `${accent}33`, borderRadius: 2 }),
    ),
  );
}

// ─── 11. Color Block ─────────────────────────────────────────────────────────
// Two-tone horizontal split — bold top, neutral bottom.

function templateColorBlock(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || p.cta;
  const topH = Math.round(size.height * 0.48);

  return el('div', {
    width: size.width, height: size.height,
    flexDirection: 'column',
  },
    // Top color zone
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
        fontSize:      ty.eyebrow,
        color:         'rgba(255,255,255,0.75)',
        fontWeight:    700,
        letterSpacing: 2,
        marginBottom:  pad.gap,
      }),
      text(copy.headline, {
        fontSize:   Math.round(ty.headline * 0.82),
        fontWeight: 700,
        color:      '#ffffff',
        lineHeight: 1.1,
        maxWidth:   size.width * 0.9,
      }),
    ),

    // Bottom neutral zone
    el('div', {
      width:          size.width,
      flex:           1,
      backgroundColor: p.background,
      flexDirection:  'column',
      justifyContent: 'center',
      padding:        pad.outer,
    },
      copy.body && text(copy.body, {
        fontSize:  ty.body,
        color:     p.body,
        lineHeight: 1.55,
        maxWidth:   size.width * 0.9,
      }),

      copy.cta && el('div', { marginTop: pad.inner },
        ctaButton(copy.cta, accent, '#ffffff', ty.cta),
      ),
    ),
  );
}

// ─── 12. Number List ─────────────────────────────────────────────────────────
// 01 / 02 / 03 editorial list with large numerals.

function templateNumberList(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || p.cta;

  const items = (copy.body || '')
    .split(/\||\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  const numSize = Math.round(ty.body * 1.9);

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection: 'column',
    justifyContent: 'center',
    padding: pad.outer,
  },
    text(copy.headline, {
      fontSize:   Math.round(ty.headline * 0.68),
      fontWeight: 700,
      color:      p.headline,
      lineHeight: 1.15,
      marginBottom: pad.inner,
      maxWidth:   size.width * 0.9,
    }),

    ...items.map((item, i) =>
      el('div', {
        flexDirection: 'row',
        alignItems:    'center',
        marginTop:     i === 0 ? 0 : pad.gap,
        paddingBottom: pad.gap,
        borderBottom:  i < items.length - 1 ? `1px solid ${p.body}22` : 'none',
      },
        text(`0${i + 1}`, {
          fontSize:    numSize,
          fontWeight:  700,
          color:       accent,
          marginRight: pad.inner,
          lineHeight:  1,
          minWidth:    numSize * 1.5,
        }),
        text(item, {
          fontSize:  ty.body,
          color:     p.body,
          lineHeight: 1.45,
          flex:      1,
        }),
      )
    ),
  );
}

// ─── 13. Brand Manifesto ─────────────────────────────────────────────────────
// Full-frame centered typographic statement. Big and bold.

function templateBrandManifesto(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || p.cta;

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: p.background,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: pad.outer,
  },
    // Top accent mark
    el('div', {
      width: Math.round(size.width * 0.06),
      height: Math.round(size.width * 0.007),
      backgroundColor: accent,
      borderRadius: 4,
      marginBottom: pad.inner,
    }),

    text(copy.headline, {
      fontSize:      Math.round(ty.headline * 1.05),
      fontWeight:    700,
      color:         p.headline,
      textAlign:     'center',
      lineHeight:    1.1,
      letterSpacing: -1,
      maxWidth:      size.width * 0.86,
    }),

    // Bottom accent mark
    el('div', {
      width:           Math.round(size.width * 0.03),
      height:          Math.round(size.width * 0.007),
      backgroundColor: accent,
      borderRadius:    4,
      marginTop:       pad.inner,
    }),

    copy.body && el('div', { marginTop: pad.inner },
      text(copy.body, {
        fontSize:  ty.body,
        color:     p.body,
        textAlign: 'center',
        lineHeight: 1.55,
        maxWidth:   size.width * 0.6,
      }),
    ),
  );
}

// ─── 14. Empathy Card ────────────────────────────────────────────────────────
// Warm gradient, feeling-first. Leads with emotion.

function templateEmpathyCard(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const warm = style.primaryColor || '#F97316';

  return el('div', {
    width: size.width, height: size.height,
    backgroundImage: `linear-gradient(145deg, ${warm}22 0%, ${p.background} 60%)`,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: pad.outer,
  },
    // Quote mark
    text('"', {
      fontSize:    Math.round(size.width * 0.18),
      color:       `${warm}55`,
      lineHeight:  0.7,
      fontWeight:  700,
      marginBottom: Math.round(pad.gap * 0.5),
    }),

    text(copy.headline, {
      fontSize:   Math.round(ty.headline * 0.88),
      fontWeight: 700,
      color:      p.headline,
      textAlign:  'center',
      lineHeight: 1.2,
      maxWidth:   size.width * 0.82,
    }),

    copy.body && el('div', { marginTop: pad.inner },
      text(copy.body, {
        fontSize:  ty.body,
        color:     p.body,
        textAlign: 'center',
        lineHeight: 1.6,
        maxWidth:   size.width * 0.7,
      }),
    ),

    copy.cta && el('div', { marginTop: pad.inner * 1.4 },
      ctaButton(copy.cta, warm, '#ffffff', ty.cta, 99),
    ),
  );
}

// ─── 15. Hot Take ────────────────────────────────────────────────────────────
// Bold contrarian statement on vivid solid background. Scroll-stopper.

function templateHotTake(input: CompositorInput, size: ParsedSize, p: ColorPalette): SatoriNode {
  const { copy, style } = input;
  const ty   = getTypographyScale(size, style.tone);
  const pad  = getPadding(size);
  const accent = style.primaryColor || p.cta;

  return el('div', {
    width: size.width, height: size.height,
    backgroundColor: accent,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: pad.outer,
  },
    copy.eyebrow && text(copy.eyebrow.toUpperCase(), {
      fontSize:      ty.eyebrow,
      color:         'rgba(255,255,255,0.7)',
      fontWeight:    700,
      letterSpacing: 3,
      marginBottom:  pad.inner,
    }),

    text(copy.headline, {
      fontSize:   Math.round(ty.headline * 1.05),
      fontWeight: 700,
      color:      '#ffffff',
      textAlign:  'center',
      lineHeight: 1.1,
      maxWidth:   size.width * 0.86,
    }),

    copy.body && el('div', {
      marginTop:       pad.inner,
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius:    12,
      padding:         `${pad.gap}px ${pad.inner}px`,
    },
      text(copy.body, {
        fontSize:  ty.body,
        color:     'rgba(255,255,255,0.85)',
        textAlign: 'center',
        lineHeight: 1.5,
        maxWidth:   size.width * 0.8,
      }),
    ),
  );
}
