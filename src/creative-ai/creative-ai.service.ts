// ─── AI Creative Generation Layer — Service ──────────────────────────────────
// Uses Claude claude-opus-4-5 via Anthropic API to generate:
//   • Ad copy   (headline + body + CTA + A/B variants)
//   • Hook variations (5 opening lines, typed by hook style)
//   • Video scripts  (scene-by-scene with timing)
//   • Image prompts  (for downstream image generation)

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService }               from '@nestjs/config';
import axios                           from 'axios';
import { InsightPatternService }       from '../angle-insights/insight-pattern.service';
import { AutonomousLoopService }       from '../autonomous-loop/autonomous-loop.service';
import { CreativeDNAService }          from '../creative-dna/creative-dna.service';
import { buildAngleBlock }             from '../creative-os/lib/angle-definitions';
import type {
  GenerateAdCopyDto,   AdCopyResult,
  GenerateHooksDto,    HooksResult,
  GenerateVideoScriptDto, VideoScriptResult,
  GenerateImagePromptsDto, ImagePromptResult,
  RefineBlockDto, RefinedBlockResult,
} from './creative-ai.types';

const MODEL   = 'claude-opus-4-5';
const MAX_TOK = 1800;
const AI_TIMEOUT_MS = 10_000;

// ── Fallback shapes — returned when AI output cannot be parsed ────────────────
const FALLBACK_AD_COPY: AdCopyResult = {
  headline: 'Unable to generate headline',
  body: 'We could not generate copy for this request. Please try again.',
  cta: 'Try Again',
  hashtags: [],
  altVersions: [],
};
const FALLBACK_HOOKS: HooksResult = { hooks: [] };
const FALLBACK_VIDEO: VideoScriptResult = { title: '', totalLength: '', hook: '', scenes: [], endCard: '' };
const FALLBACK_IMAGE: ImagePromptResult = { prompts: [] };

@Injectable()
export class CreativeAiService {
  private readonly logger = new Logger(CreativeAiService.name);

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly insightPatterns:  InsightPatternService,
    @Optional() private readonly autonomousLoop:   AutonomousLoopService,
    @Optional() private readonly creativeDna:      CreativeDNAService,
  ) {}

  // ── Ad Copy ─────────────────────────────────────────────────────────────────

  async generateAdCopy(dto: GenerateAdCopyDto): Promise<AdCopyResult> {
    const learnedContext = this.insightPatterns
      ? await this.insightPatterns.getPromptContext(dto.angleSlug).catch(() => null)
      : null;

    // 8.4 ALC — inject global strong-angle intelligence into every generation call.
    // Null when no ALC cycle has run yet (no-op, safe fallback).
    const alcContext = this.autonomousLoop
      ? this.autonomousLoop.getGlobalStrongContext()
      : null;

    // 9.2 Creative DNA — inject top proven patterns to bias generation toward winners.
    const dnaContext = this.creativeDna
      ? await this.creativeDna.getDNAPromptContext().catch(() => null)
      : null;

    const system = [
      `You are a world-class direct-response copywriter.`,
      `You write ad copy that stops scrolls, speaks to real pain and aspiration, and drives action.`,
      `Return ONLY valid JSON. No markdown, no explanation, no backticks.`,
      learnedContext ? `\n${learnedContext}` : '',
      alcContext     ? `\n${alcContext}`     : '',
      dnaContext     ? `\n${dnaContext}`     : '',
    ].filter(Boolean).join('\n');

    const user = `Write ad copy for this campaign:

Core message: "${dto.coreMessage}"
Angle: ${dto.angleSlug.replace(/_/g, ' ')}
Platform: ${dto.platform}
Format: ${dto.format}
Audience: ${dto.audience ?? 'general consumers'}
Tone: ${dto.tone ?? 'bold and direct'}
${dto.charLimit ? `Character limit: ${dto.charLimit} chars for body copy` : ''}

Return JSON matching this exact schema:
{
  "headline":    "...",
  "body":        "...",
  "cta":         "...",
  "hashtags":    ["..."],
  "altVersions": [
    { "headline": "...", "body": "...", "cta": "..." },
    { "headline": "...", "body": "...", "cta": "..." }
  ]
}`;

    const raw = await this.callClaude(system, user);
    return this.parseJsonSafe<AdCopyResult>(raw, FALLBACK_AD_COPY, 'generateAdCopy');
  }

  // ── Hook Variations ──────────────────────────────────────────────────────────

  async generateHooks(dto: GenerateHooksDto): Promise<HooksResult> {
    const count = dto.count ?? 5;

    const system = `You are a master hook writer for short-form video and social ads.
Your hooks make people stop mid-scroll in the first 2 seconds.
Return ONLY valid JSON.`;

    const user = `Write ${count} hook variations for this campaign:

Core message: "${dto.coreMessage}"
Angle: ${dto.angleSlug.replace(/_/g, ' ')}
Platform: ${dto.platform}
Audience: ${dto.audience ?? 'general audience'}

Each hook must use a different hook type from: question, bold-claim, story-open, contrast, data-drop.

Return JSON:
{
  "hooks": [
    {
      "hook":      "...",
      "hookType":  "question|bold-claim|story-open|contrast|data-drop",
      "emotion":   "...",
      "rationale": "..."
    }
  ]
}`;

    const raw = await this.callClaude(system, user);
    return this.parseJsonSafe<HooksResult>(raw, FALLBACK_HOOKS, 'generateHooks');
  }

  // ── Video Script ──────────────────────────────────────────────────────────────

  async generateVideoScript(dto: GenerateVideoScriptDto): Promise<VideoScriptResult> {
    const system = `You are a senior video scriptwriter specialising in short-form social ads.
You write tight, engaging scripts that drive results.
Return ONLY valid JSON.`;

    const scenes = Math.round(dto.durationSec / 7);   // ~1 scene per 7 seconds

    const user = `Write a ${dto.durationSec}-second video script for this ad:

Core message: "${dto.coreMessage}"
Angle: ${dto.angleSlug.replace(/_/g, ' ')}
Platform: ${dto.platform}
Audience: ${dto.audience ?? 'general audience'}
${dto.hook ? `Opening hook: "${dto.hook}"` : ''}

Structure: ~${scenes} scenes, each 5–10 seconds.
The script must open hard (hook), build tension, then release with CTA.

Return JSON:
{
  "title":       "...",
  "totalLength": "${dto.durationSec}s",
  "hook":        "...",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration":    "0:00–0:05",
      "visual":      "...",
      "voiceover":   "...",
      "note":        "..."
    }
  ],
  "endCard": "..."
}`;

    const raw = await this.callClaude(system, user);
    return this.parseJsonSafe<VideoScriptResult>(raw, FALLBACK_VIDEO, 'generateVideoScript');
  }

  // ── Image Prompts ─────────────────────────────────────────────────────────────

  async generateImagePrompts(dto: GenerateImagePromptsDto): Promise<ImagePromptResult> {
    const count = dto.count ?? 3;

    const system = `You are a creative director and AI image prompt engineer.
You write prompts that produce scroll-stopping ad visuals when fed to Midjourney or DALL-E.
Return ONLY valid JSON.`;

    const user = `Write ${count} image generation prompts for this ad:

Core message: "${dto.coreMessage}"
Angle: ${dto.angleSlug.replace(/_/g, ' ')}
Platform: ${dto.platform}
Format: ${dto.format}
Emotion: ${dto.emotion ?? 'confident and energetic'}

Each prompt must be specific, visual, and include: subject, composition, lighting, colour palette, style.
Include a short text overlay suggestion for each.

Return JSON:
{
  "prompts": [
    {
      "prompt":      "...",
      "composition": "...",
      "mood":        "...",
      "copyOverlay": "..."
    }
  ]
}`;

    const raw = await this.callClaude(system, user);
    return this.parseJsonSafe<ImagePromptResult>(raw, FALLBACK_IMAGE, 'generateImagePrompts');
  }

  // ── Block Refinement ─────────────────────────────────────────────────────────

  async refineBlock(dto: RefineBlockDto): Promise<RefinedBlockResult> {
    const fallback: RefinedBlockResult = { value: dto.currentValue, rationale: 'Could not refine — returning original.' };

    const instructionMap: Record<string, string> = {
      shorter:        'Make it significantly shorter and punchier, keeping the core message.',
      more_emotional: 'Rewrite with stronger emotional resonance and feeling.',
      add_urgency:    'Add a sense of urgency or scarcity without being spammy.',
      more_premium:   'Elevate the language to feel more premium and exclusive.',
      simpler:        'Simplify the language so a 12-year-old could understand it.',
      stronger_cta:   'Make the call-to-action more compelling and action-driven.',
      bolder:         'Make it bolder and more confident. Cut hedging language.',
      conversational: 'Rewrite in a natural, conversational tone — like talking to a friend.',
    };

    const instruction = instructionMap[dto.instruction] ?? dto.instruction;

    const angleBlock = buildAngleBlock(dto.angleSlug);

    const system = [
      `You are a direct-response copywriter specialising in micro-edits.`,
      `You refine individual ad copy blocks for maximum impact without losing the core message.`,
      `Return ONLY valid JSON. No markdown, no explanation.`,
      angleBlock,
    ].filter(Boolean).join('\n\n');

    const user = `Refine this ${dto.blockType}:

Current: "${dto.currentValue}"
Instruction: ${instruction}
${dto.brief ? `Brief: "${dto.brief}"` : ''}

Return JSON exactly:
{
  "value": "...",
  "rationale": "..."
}`;

    const raw = await this.callClaude(system, user);
    return this.parseJsonSafe<RefinedBlockResult>(raw, fallback, 'refineBlock');
  }

  // ── Anthropic API call ────────────────────────────────────────────────────────

  private async callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const timeoutSignal = AbortSignal.timeout(AI_TIMEOUT_MS);

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model:      MODEL,
        max_tokens: MAX_TOK,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userPrompt }],
      },
      {
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout:     AI_TIMEOUT_MS,
        signal:      timeoutSignal,
      },
    );

    const content = response.data?.content?.[0]?.text ?? '';

    // Strip any accidental markdown fencing
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/,           '');

    this.logger.debug(`Claude response (${cleaned.length} chars)`);
    return cleaned;
  }

  // ── Safe JSON parser — never crashes the server ───────────────────────────────
  // 1. Try direct parse
  // 2. Extract first {...} block via regex (handles markdown wrapping or preamble text)
  // 3. Return typed fallback — logs raw output for debugging

  private parseJsonSafe<T>(raw: string, fallback: T, caller: string): T {
    // Direct parse
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Regex extraction — find the first balanced {...} object
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch {
          // fall through to fallback
        }
      }
      this.logger.warn(`[${caller}] JSON parse failed — returning fallback. Raw (200 chars): ${raw.slice(0, 200)}`);
      return fallback;
    }
  }
}
