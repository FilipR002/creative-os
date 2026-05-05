// ─── Phase 9.2.1 — Creative DNA Visual Memory Layer ──────────────────────────
//
// Extracts structured Creative DNA from high-performing campaigns (top 20%),
// storing BOTH text patterns AND visual dimensions per angle:
//
//   Text:   hookPattern / emotionalTone / structureType / visualContext (legacy)
//   Visual: layoutComplexity / imageTextRatio / contrastLevel /
//           colorMood / typographyStyle / compositionStyle
//
// The visual dimensions map directly to compositor parameters, enabling the
// system to learn "dark + bold-display wins for this angle" and feed that
// back into every new generation — breaking the "same font/same palette" loop.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';
import { CreativeDNA }        from '@prisma/client';

const TOP_PERCENTILE    = 0.80;   // top 20% threshold
const JACCARD_THRESHOLD = 0.30;   // fuzzy merge threshold
const DNA_PROMPT_LIMIT  = 3;      // top entries injected into prompts
const SCORE_WINDOW_DAYS = 7;

// ── Visual dimension types (mirrors schema enum strings) ──────────────────────

type LayoutComplexity  = 'minimal' | 'balanced' | 'dense';
type ImageTextRatio    = 'image-dominant' | 'balanced' | 'text-dominant';
type ContrastLevel     = 'high' | 'medium' | 'low';
type ColorMood         = 'dark' | 'light' | 'vibrant' | 'muted' | 'brand';
type TypographyStyle   = 'bold-display' | 'clean-sans' | 'editorial' | 'mixed';
type CompositionStyle  = 'centered' | 'rule-of-thirds' | 'full-bleed' | 'split' | 'layered';

export interface VisualDimensions {
  layoutComplexity : LayoutComplexity;
  imageTextRatio   : ImageTextRatio;
  contrastLevel    : ContrastLevel;
  colorMood        : ColorMood;
  typographyStyle  : TypographyStyle;
  compositionStyle : CompositionStyle;
}

// ── What the compositor can directly consume from top DNA ─────────────────────
export interface DNACompositorHints {
  colorScheme    : 'dark' | 'light' | 'gradient' | 'brand';
  fontPairingId  : string;          // e.g. "bebas-inter", "playfair-lato", "inter-inter"
  preferDense    : boolean;
  highContrast   : boolean;
}

@Injectable()
export class CreativeDNAService {
  private readonly logger = new Logger(CreativeDNAService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Called after every outcome report. Persists DNA only for top-20% scores. */
  async maybePersistDNA(
    userId:           string,
    angleSlug:        string,
    performanceScore: number,
  ): Promise<void> {
    const threshold = await this.getTop20Threshold();
    if (performanceScore < threshold) return;

    const dna = await this.extractDNA(angleSlug, performanceScore);
    if (!dna) return;

    await this.upsertDNA(dna);
    this.logger.log(
      `[9.2.1] DNA persisted: angle=${angleSlug} score=${performanceScore.toFixed(3)} ` +
      `threshold=${threshold.toFixed(3)} ` +
      `visual=${dna.colorMood}/${dna.typographyStyle}/${dna.contrastLevel}`,
    );
  }

  /** Returns top DNA records sorted by performanceScore × survivalRate. */
  async getTopCreativeDNA(limit = DNA_PROMPT_LIMIT): Promise<CreativeDNA[]> {
    const all = await this.prisma.creativeDNA.findMany({
      orderBy: [{ performanceScore: 'desc' }, { survivalRate: 'desc' }],
      take:    limit * 3,
    });

    return all
      .sort((a, b) => (b.performanceScore * b.survivalRate) - (a.performanceScore * a.survivalRate))
      .slice(0, limit);
  }

  /**
   * Returns compositor-ready hints derived from the top-performing DNA.
   * Used by the generation pipeline to bias color/font selection toward
   * proven visual patterns rather than safe defaults.
   */
  async getCompositorHints(): Promise<DNACompositorHints | null> {
    const top = await this.getTopCreativeDNA(1);
    if (!top.length) return null;

    const dna = top[0];
    return {
      colorScheme   : this.colorMoodToScheme(dna.colorMood as ColorMood),
      fontPairingId : this.typographyStyleToFontPairing(dna.typographyStyle as TypographyStyle, dna.colorMood as ColorMood),
      preferDense   : dna.layoutComplexity === 'dense',
      highContrast  : dna.contrastLevel === 'high',
    };
  }

  /** Formatted string for injection into creative generation prompts. */
  async getDNAPromptContext(limit = DNA_PROMPT_LIMIT): Promise<string | null> {
    const top = await this.getTopCreativeDNA(limit);
    if (!top.length) return null;

    const lines = top.map((d, i) => {
      const visual = [
        `color:${d.colorMood}`,
        `type:${d.typographyStyle}`,
        `contrast:${d.contrastLevel}`,
        `layout:${d.layoutComplexity}`,
        `composition:${d.compositionStyle}`,
        `img-ratio:${d.imageTextRatio}`,
      ].join(' | ');

      return (
        `  ${i + 1}. Hook: "${d.hookPattern}" | Tone: ${d.emotionalTone} | ` +
        `Structure: ${d.structureType} | ` +
        `VISUAL → ${visual} ` +
        `(score: ${d.performanceScore.toFixed(2)}, angle: ${d.angleSlug})`
      );
    });

    return [
      `PROVEN CREATIVE DNA — patterns extracted from top-performing ads:`,
      ...lines,
      ``,
      `VISUAL BIAS INSTRUCTIONS:`,
      `- Prefer the color mood, typography style, and composition above for new generations.`,
      `- High-contrast + bold-display → use strong headline hierarchy.`,
      `- Dark + image-dominant → use full-bleed backgrounds with minimal text overlay.`,
      `- Light + text-dominant → use clean layouts with generous whitespace.`,
      `- Adapt creatively — do NOT copy verbatim, but honour the visual DNA.`,
    ].join('\n');
  }

  // ── Core extraction logic ──────────────────────────────────────────────────

  private async getTop20Threshold(): Promise<number> {
    const since = new Date(Date.now() - SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const outcomes = await this.prisma.campaignOutcome.findMany({
      where:   { createdAt: { gte: since } },
      select:  { performanceScore: true },
      orderBy: { performanceScore: 'asc' },
    });

    if (outcomes.length < 5) return 0.30;
    const idx = Math.floor(outcomes.length * TOP_PERCENTILE);
    return outcomes[idx]?.performanceScore ?? 0.30;
  }

  private async extractDNA(
    angleSlug:        string,
    performanceScore: number,
  ): Promise<Omit<CreativeDNA, 'id' | 'createdAt' | 'updatedAt'> | null> {
    const insights = await this.prisma.angleCreativeInsight.findMany({
      where:   { angleSlug },
      orderBy: { createdAt: 'desc' },
      take:    5,
    });

    if (!insights.length) return null;

    const insight = insights[0];
    const allElements = insight.visualElements.join(' ').toLowerCase();

    // Derive visual dimensions from the stored insight data
    const visual: VisualDimensions = {
      layoutComplexity : insight.layoutComplexity as LayoutComplexity  || this.classifyLayoutComplexity(allElements, insight.layout),
      imageTextRatio   : this.classifyImageTextRatio(allElements),
      contrastLevel    : this.classifyContrastLevel(allElements, insight.dominantColors ?? []),
      colorMood        : this.classifyColorMood(allElements, insight.dominantColors ?? []),
      typographyStyle  : this.classifyTypographyStyle(allElements, insight.layout),
      compositionStyle : this.classifyCompositionStyle(allElements, insight.layout),
    };

    return {
      hookPattern      : insight.hook,
      emotionalTone    : this.classifyEmotion(insight.emotion),
      structureType    : this.classifyStructure(insight.layout),
      visualContext    : insight.visualElements.slice(0, 3).join(', ') || insight.layout, // legacy
      angleSlug,
      performanceScore,
      survivalRate     : 0.5,
      usageCount       : 1,
      ...visual,
    };
  }

  private async upsertDNA(
    incoming: Omit<CreativeDNA, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    const existing = await this.findMergeable(
      incoming.structureType,
      incoming.emotionalTone,
      incoming.hookPattern,
    );

    if (existing) {
      const newSurvivalRate = this.mergeSurvivalRate(
        existing.survivalRate,
        existing.usageCount,
        incoming.performanceScore,
      );

      // On merge: keep the higher-performing visual fingerprint
      const useIncoming = incoming.performanceScore > existing.performanceScore;

      await this.prisma.creativeDNA.update({
        where: { id: existing.id },
        data: {
          survivalRate     : newSurvivalRate,
          usageCount       : { increment: 1 },
          performanceScore : Math.max(existing.performanceScore, incoming.performanceScore),
          // Visual fields: update only if the incoming ad outperformed the stored record
          ...(useIncoming && {
            layoutComplexity : incoming.layoutComplexity,
            imageTextRatio   : incoming.imageTextRatio,
            contrastLevel    : incoming.contrastLevel,
            colorMood        : incoming.colorMood,
            typographyStyle  : incoming.typographyStyle,
            compositionStyle : incoming.compositionStyle,
            visualContext    : incoming.visualContext,
          }),
        },
      });
      this.logger.debug(`[9.2.1] Merged DNA id=${existing.id} survivalRate=${newSurvivalRate.toFixed(3)}`);
    } else {
      await this.prisma.creativeDNA.create({ data: incoming });
    }
  }

  private async findMergeable(
    structureType : string,
    emotionalTone : string,
    hookPattern   : string,
  ): Promise<CreativeDNA | null> {
    const candidates = await this.prisma.creativeDNA.findMany({
      where: { structureType, emotionalTone },
    });

    for (const c of candidates) {
      if (this.jaccardSimilarity(c.hookPattern, hookPattern) >= JACCARD_THRESHOLD) {
        return c;
      }
    }
    return null;
  }

  // ── Visual classifiers ─────────────────────────────────────────────────────
  // Each classifier reads the raw string fields from AngleCreativeInsight
  // (visualElements joined, layout text) and maps to a structured enum value.

  private classifyLayoutComplexity(elements: string, layout: string): LayoutComplexity {
    const text = `${elements} ${layout}`.toLowerCase();
    // Dense: many elements, busy, packed, multiple sections
    if (/dense|busy|packed|complex|multi.?(section|column|layer)|cluttered|full/.test(text)) return 'dense';
    // Minimal: clean, simple, single focus, whitespace, bare
    if (/minimal|clean|simple|bare|single|sparse|whitespace|open|airy/.test(text)) return 'minimal';
    return 'balanced';
  }

  private classifyImageTextRatio(elements: string): ImageTextRatio {
    const imageWords = (elements.match(/\b(image|photo|visual|background|picture|shot|scene|graphic|illustration)\b/g) ?? []).length;
    const textWords  = (elements.match(/\b(text|headline|copy|body|caption|title|word|font|type|cta|button)\b/g) ?? []).length;
    if (imageWords > textWords * 1.5) return 'image-dominant';
    if (textWords  > imageWords * 1.5) return 'text-dominant';
    return 'balanced';
  }

  private classifyContrastLevel(elements: string, dominantColors: string[]): ContrastLevel {
    const text   = `${elements} ${dominantColors.join(' ')}`.toLowerCase();
    // High: explicit contrast mentions, black+white combos, bold on dark
    if (/high.?contrast|stark|bold.?on|black.?white|white.?black|bright.?on.?dark|neon|pop/.test(text)) return 'high';
    // Low: soft, muted, monochrome, pastel, subtle
    if (/low.?contrast|soft|muted|pastel|subtle|gentle|tonal|washed|faded/.test(text)) return 'low';
    return 'medium';
  }

  private classifyColorMood(elements: string, dominantColors: string[]): ColorMood {
    const text = `${elements} ${dominantColors.join(' ')}`.toLowerCase();
    if (/dark|black|charcoal|night|moody|deep|shadow/.test(text))                        return 'dark';
    if (/light|white|bright|clean|airy|minimal|pale/.test(text))                         return 'light';
    if (/vibrant|vivid|neon|electric|saturated|bold.?color|colorful|pop/.test(text))     return 'vibrant';
    if (/muted|desaturated|washed|faded|neutral|grey|gray|earthy|warm.?tone/.test(text)) return 'muted';
    if (/brand|branded|logo|corporate|on.?brand|signature/.test(text))                   return 'brand';
    return 'dark'; // default — most high-performing ads trend dark
  }

  private classifyTypographyStyle(elements: string, layout: string): TypographyStyle {
    const text = `${elements} ${layout}`.toLowerCase();
    if (/bold|heavy|display|impact|block|strong.?type|large.?text|giant|oversized/.test(text)) return 'bold-display';
    if (/editorial|serif|magazine|elegant|fashion|luxury|refined|classic/.test(text))          return 'editorial';
    if (/mixed|variety|contrast.*font|two.?type|dual.?font/.test(text))                        return 'mixed';
    return 'clean-sans'; // default — the most common "safe" choice
  }

  private classifyCompositionStyle(elements: string, layout: string): CompositionStyle {
    const text = `${elements} ${layout}`.toLowerCase();
    if (/full.?bleed|edge.?to.?edge|background.?fill|immersive|full.?screen/.test(text)) return 'full-bleed';
    if (/rule.?of.?third|off.?center|asymmetric|dynamic.?position/.test(text))           return 'rule-of-thirds';
    if (/split|half|dual|two.?panel|left.?right|side.?by.?side/.test(text))              return 'split';
    if (/layer|overlay|stack|depth|z.?order|foreground.*background/.test(text))          return 'layered';
    return 'centered';
  }

  // ── Text classifiers (unchanged from Phase 9.2) ───────────────────────────

  private classifyEmotion(emotion: string): string {
    const e = emotion.toLowerCase();
    if (e.includes('urgency') || e.includes('fear') || e.includes('danger'))        return 'urgency-fear';
    if (e.includes('curiosity') || e.includes('wonder'))                             return 'curiosity';
    if (e.includes('trust') || e.includes('authority') || e.includes('expert'))     return 'trust-authority';
    if (e.includes('aspiration') || e.includes('pride') || e.includes('status'))    return 'aspiration-pride';
    if (e.includes('empower') || e.includes('confidence') || e.includes('strength'))return 'empowerment';
    if (e.includes('pain') || e.includes('relief') || e.includes('problem'))        return 'pain-relief';
    if (e.includes('joy') || e.includes('humor') || e.includes('fun'))              return 'joy-humor';
    return 'general';
  }

  private classifyStructure(layout: string): string {
    const l = layout.toLowerCase();
    if (l.includes('comparison') || l.includes('vs') || l.includes('before'))       return 'comparison';
    if (l.includes('list') || l.includes('bullet') || l.includes('steps'))          return 'listicle';
    if (l.includes('story') || l.includes('narrative') || l.includes('journey'))    return 'story';
    if (l.includes('problem') || l.includes('solution') || l.includes('solve'))     return 'problem-solution';
    if (l.includes('data') || l.includes('stat') || l.includes('number') || l.includes('%')) return 'data-led';
    return 'showcase';
  }

  // ── DNA → Compositor translation ──────────────────────────────────────────
  // Maps structured visual DNA dimensions to the exact parameter names the
  // compositor endpoint accepts. This is the translation layer that was
  // previously missing — style weights → compositor parameters.

  private colorMoodToScheme(mood: ColorMood): 'dark' | 'light' | 'gradient' | 'brand' {
    switch (mood) {
      case 'dark'    : return 'dark';
      case 'light'   : return 'light';
      case 'vibrant' : return 'gradient';
      case 'brand'   : return 'brand';
      case 'muted'   : return 'light';   // muted is closest to light scheme
    }
  }

  private typographyStyleToFontPairing(style: TypographyStyle, colorMood: ColorMood): string {
    // Font pairing IDs supported by the compositor (from /api/compositor/fonts)
    switch (style) {
      case 'bold-display':
        return colorMood === 'dark' ? 'bebas-inter' : 'oswald-lato';
      case 'editorial':
        return 'playfair-lato';
      case 'mixed':
        return 'montserrat-merriweather';
      case 'clean-sans':
      default:
        return colorMood === 'dark' ? 'inter-inter' : 'poppins-inter';
    }
  }

  // ── Math helpers ───────────────────────────────────────────────────────────

  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union        = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private mergeSurvivalRate(prevRate: number, usageCount: number, newScore: number): number {
    const impact = (newScore - 0.25) / 0.25;
    const newRate = (prevRate * usageCount + (0.5 + impact * 0.3)) / (usageCount + 1);
    return Math.max(0.10, Math.min(1.0, newRate));
  }
}
