// ─── Visual Critic Service ────────────────────────────────────────────────────
//
// Claude vision middleware that scores rendered ad creatives and returns
// structured feedback. Runs after every compositor render.
//
// Scoring dimensions (each 0–10, final score = weighted average):
//   clarity          — is the core message obvious in ≤2 s?
//   visualHierarchy  — headline → body → CTA reading order is natural
//   textReadability  — contrast, size, line-length suitable for the ad size
//   ctaProminence    — CTA is visible and action-oriented
//
// Pass threshold: score ≥ 6.0
// Low-scoring renders are flagged so callers can retry with different params.
//
// The critic is non-blocking: any error causes it to return null so the
// compositor output is always delivered to the caller.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import axios                  from 'axios';
import type { CompositorInput, CompositorOutput } from '../types/compositor.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CritiqueDimensions {
  clarity:         number;   // 0-10
  visualHierarchy: number;   // 0-10
  textReadability: number;   // 0-10
  ctaProminence:   number;   // 0-10
}

export interface CritiqueResult {
  score:      number;          // weighted average 0-10
  passed:     boolean;         // score >= PASS_THRESHOLD
  dimensions: CritiqueDimensions;
  feedback:   string;          // 1-2 sentence actionable note
  critiqueMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PASS_THRESHOLD = 6.0;

const WEIGHTS: Record<keyof CritiqueDimensions, number> = {
  clarity:         0.35,
  visualHierarchy: 0.25,
  textReadability: 0.25,
  ctaProminence:   0.15,
};

const SYSTEM_PROMPT = `You are an expert advertising creative director evaluating rendered ad images.
You analyze visual hierarchy, readability, clarity of message, and CTA effectiveness.
You respond ONLY with a valid JSON object — no markdown, no explanation outside JSON.`;

function buildUserPrompt(input: CompositorInput): string {
  return `Evaluate this rendered ad creative.

Context:
- Template: ${input.templateId}
- Size: ${input.size}
- Headline: "${input.copy.headline}"
- Body: "${input.copy.body ?? ''}"
- CTA: "${input.copy.cta ?? ''}"
- Tone: ${input.style.tone}

Score each dimension 0–10 (10 = perfect):
- clarity: Is the core message instantly obvious (≤2 second read)?
- visualHierarchy: Does the eye flow naturally from headline → body → CTA?
- textReadability: Is all text legible at this size? Good contrast?
- ctaProminence: Is the CTA visible, clear, and action-oriented?

Return ONLY this JSON (no markdown, no extra keys):
{
  "clarity": <0-10>,
  "visualHierarchy": <0-10>,
  "textReadability": <0-10>,
  "ctaProminence": <0-10>,
  "feedback": "<1-2 sentence actionable improvement note>"
}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class VisualCriticService {
  private readonly logger = new Logger(VisualCriticService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Score a rendered ad via Claude vision.
   * Returns null on any error — callers should treat null as "no critique available".
   */
  async critique(
    output: CompositorOutput,
    input:  CompositorInput,
  ): Promise<CritiqueResult | null> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) return null;

    const startMs = Date.now();

    // Extract the raw base64 from the data URL
    const b64Match = output.imageDataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!b64Match) {
      this.logger.warn('VisualCritic: imageDataUrl is not a valid PNG data URL');
      return null;
    }
    const imageBase64 = b64Match[1];

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model:      'claude-sonnet-4-6',
          max_tokens: 300,
          system:     SYSTEM_PROMPT,
          messages: [
            {
              role:    'user',
              content: [
                {
                  type:  'image',
                  source: {
                    type:       'base64',
                    media_type: 'image/png',
                    data:       imageBase64,
                  },
                },
                {
                  type: 'text',
                  text: buildUserPrompt(input),
                },
              ],
            },
          ],
        },
        {
          headers: {
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          timeout: 15_000,
        },
      );

      const rawText = response.data?.content?.[0]?.text?.trim() ?? '';
      const clean   = rawText.replace(/```json|```/g, '').trim();
      const parsed  = JSON.parse(clean) as {
        clarity:         number;
        visualHierarchy: number;
        textReadability: number;
        ctaProminence:   number;
        feedback:        string;
      };

      const dims: CritiqueDimensions = {
        clarity:         clamp(parsed.clarity         ?? 5),
        visualHierarchy: clamp(parsed.visualHierarchy ?? 5),
        textReadability: clamp(parsed.textReadability ?? 5),
        ctaProminence:   clamp(parsed.ctaProminence   ?? 5),
      };

      const score = weightedScore(dims);
      const passed = score >= PASS_THRESHOLD;

      const result: CritiqueResult = {
        score:      Math.round(score * 10) / 10,
        passed,
        dimensions: dims,
        feedback:   parsed.feedback ?? '',
        critiqueMs: Date.now() - startMs,
      };

      this.logger.debug(
        `VisualCritic | template=${input.templateId} score=${result.score} passed=${passed} ${result.critiqueMs}ms`,
      );

      return result;

    } catch (err: any) {
      this.logger.warn(`VisualCritic skipped: ${err?.message}`);
      return null;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(10, Number(n) || 0));
}

function weightedScore(dims: CritiqueDimensions): number {
  return (
    dims.clarity         * WEIGHTS.clarity         +
    dims.visualHierarchy * WEIGHTS.visualHierarchy +
    dims.textReadability * WEIGHTS.textReadability  +
    dims.ctaProminence   * WEIGHTS.ctaProminence
  );
}
