// ─── Phase 8.3 — Creative Learning & Generation Layer ────────────────────────
// Bridges 8.2 vision insights → 8.1 angle selection + creative generation.
//
// Three integration points:
//   1. getInsightBoosts()   → AngleService confidence scoring (+insightBoost)
//   2. getPromptContext()   → CreativeAiService prompt enrichment (learned patterns)
//   3. synthesize()         → Full pattern synthesis endpoint (on demand)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import axios                  from 'axios';
import { AngleInsightsService } from './angle-insights.service';

const MODEL          = 'claude-sonnet-4-6';
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000;   // 24h — patterns rarely change
const MAX_BOOST      = 0.05;                   // cap — insight boost never dominates
const BOOST_PER_ITEM = 0.01;                   // each insight adds 1% confidence
const PROMPT_TOP_N   = 3;                      // inject top N hooks/insights into prompts

export interface SynthesizedPattern {
  angle:           string;
  learnedPatterns: string[];
  creativeRules:   string[];
  generatedAds:    {
    headline:  string;
    body:      string;
    cta:       string;
    emotion:   string;
    basedOn:   string;
  }[];
  confidence:     number;
  diversityScore: number;
  synthesizedAt:  string;
}

interface CacheEntry {
  data:      SynthesizedPattern;
  expiresAt: number;
}

@Injectable()
export class InsightPatternService {
  private readonly logger = new Logger(InsightPatternService.name);
  private readonly cache  = new Map<string, CacheEntry>();

  constructor(
    private readonly insights: AngleInsightsService,
    private readonly config:   ConfigService,
  ) {}

  // ── 1. BOOST — used by AngleService ──────────────────────────────────────────
  // Returns a small confidence modifier per angle slug.
  // Angles with more vision data get a slightly higher score — system "knows" them better.
  // Range: 0.00 (no insights) → 0.05 max (5+ insights)
  // Fetched in one batched query — no N+1.

  async getInsightBoosts(slugs: string[]): Promise<Record<string, number>> {
    if (!slugs.length) return {};

    const summary = await this.insights.getSummaryByAngle();
    const countMap = Object.fromEntries(summary.map(s => [s.angleSlug, s.count]));

    const result: Record<string, number> = {};
    for (const slug of slugs) {
      const count = countMap[slug] ?? 0;
      result[slug] = Math.min(MAX_BOOST, count * BOOST_PER_ITEM);
    }
    return result;
  }

  // ── 2. PROMPT CONTEXT — used by CreativeAiService ────────────────────────────
  // Returns a formatted string of the top N hooks + insights for a given angle.
  // Injected into Claude system prompt to ground generation in real ad patterns.
  // Returns null when no insights exist — caller falls back to standard prompt.

  async getPromptContext(angleSlug: string): Promise<string | null> {
    const items = await this.insights.getByAngle(angleSlug, PROMPT_TOP_N);
    if (!items.length) return null;

    const lines = [
      `LEARNED FROM REAL ADS FOR "${angleSlug.replace(/_/g, ' ').toUpperCase()}" ANGLE:`,
      '',
      ...items.map((item, i) => [
        `Example ${i + 1}:`,
        `  Hook pattern:  ${item.hook}`,
        `  Emotion:       ${item.emotion}`,
        `  Layout:        ${item.layout}`,
        `  Insight:       ${item.insight}`,
      ].join('\n')),
      '',
      'Apply these PROVEN PATTERNS (do not copy — generalize and adapt to the new brief):',
    ];

    return lines.join('\n');
  }

  // ── 3. SYNTHESIZE — full pattern extraction + ad generation (on demand) ──────
  // Calls Claude with all insights for the angle, extracts patterns, generates
  // 2–3 fresh ads. Results cached 24h — expensive operation, call sparingly.

  async synthesize(angleSlug: string): Promise<SynthesizedPattern> {
    // Serve from cache if fresh
    const cached = this.cache.get(angleSlug);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`[8.3] Cache hit for ${angleSlug}`);
      return cached.data;
    }

    const items = await this.insights.getByAngle(angleSlug, 10);
    if (!items.length) {
      return this.emptyPattern(angleSlug, 'No insights available for this angle');
    }

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY') || process.env['ANTHROPIC_API_KEY'] || '';
    this.logger.log(`[8.3] synthesize ${angleSlug}: apiKey=${apiKey ? 'set' : 'MISSING (synthesis skipped)'}`);
    if (!apiKey) {
      return this.emptyPattern(angleSlug, 'ANTHROPIC_API_KEY not set');
    }

    const insightBlock = items.map((it, i) =>
      `[${i + 1}] hook="${it.hook}" | emotion="${it.emotion}" | layout="${it.layout}" | cta_style="${it.ctaStyle}" | insight="${it.insight}"`
    ).join('\n');

    const systemPrompt = `You are a creative pattern analyst for an AI advertising engine.
You receive structured marketing intelligence extracted from real ads and must:
1. Identify recurring patterns across multiple examples
2. Convert patterns into reusable creative rules
3. Generate NEW ad variations — do NOT copy, do NOT describe visuals

Return ONLY valid JSON. No markdown. No extra text.`;

    const userPrompt = `Analyze these ${items.length} real-ad insights for the "${angleSlug}" angle:

${insightBlock}

Extract patterns and generate fresh ad variations.

Return this exact JSON:
{
  "angle": "${angleSlug}",
  "learned_patterns": [
    "<recurring hook structure pattern>",
    "<recurring emotion trigger pattern>",
    "<recurring layout pattern>",
    "<recurring CTA pattern>"
  ],
  "creative_rules": [
    "<actionable rule 1 — e.g. 'Lead with identity validation before naming the product'>",
    "<actionable rule 2>",
    "<actionable rule 3>"
  ],
  "generated_ads": [
    {
      "headline": "<NEW headline — not copied from examples>",
      "body": "<2-3 sentences applying learned patterns>",
      "cta": "<CTA applying learned CTA pattern>",
      "emotion": "<dominant emotion this ad triggers>",
      "based_on": "<which pattern rules were applied, e.g. 'identity_validation + open_loop'>"
    },
    {
      "headline": "...",
      "body": "...",
      "cta": "...",
      "emotion": "...",
      "based_on": "..."
    },
    {
      "headline": "...",
      "body": "...",
      "cta": "...",
      "emotion": "...",
      "based_on": "..."
    }
  ],
  "confidence": <0-1 — how consistent are the patterns?>,
  "diversity_score": <0-1 — how varied are the generated ads?>
}`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model:      MODEL,
          max_tokens: 1200,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'Content-Type':      'application/json',
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
          },
          timeout: 30_000,
        },
      );

      const raw     = response.data?.content?.[0]?.text ?? '';
      const cleaned = raw.trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Unparseable response');
        parsed = JSON.parse(match[0]);
      }

      const result: SynthesizedPattern = {
        angle:           parsed.angle           ?? angleSlug,
        learnedPatterns: parsed.learned_patterns ?? [],
        creativeRules:   parsed.creative_rules   ?? [],
        generatedAds:    (parsed.generated_ads   ?? []).map((ad: any) => ({
          headline:  ad.headline  ?? '',
          body:      ad.body      ?? '',
          cta:       ad.cta       ?? '',
          emotion:   ad.emotion   ?? '',
          basedOn:   ad.based_on  ?? '',
        })),
        confidence:     parsed.confidence      ?? 0,
        diversityScore: parsed.diversity_score ?? 0,
        synthesizedAt:  new Date().toISOString(),
      };

      this.cache.set(angleSlug, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      this.logger.log(`[8.3] Synthesized ${result.learnedPatterns.length} patterns + ${result.generatedAds.length} ads for ${angleSlug}`);
      return result;
    } catch (err: any) {
      this.logger.warn(`[8.3] Synthesis failed for ${angleSlug}: ${err.message}`);
      return this.emptyPattern(angleSlug, err.message);
    }
  }

  private emptyPattern(angle: string, reason: string): SynthesizedPattern {
    return {
      angle,
      learnedPatterns: [],
      creativeRules:   [],
      generatedAds:    [],
      confidence:      0,
      diversityScore:  0,
      synthesizedAt:   new Date().toISOString(),
    };
  }
}
