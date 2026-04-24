/**
 * sonnet-orchestrator.ts
 *
 * Calls Claude Sonnet to generate a Master Blueprint from campaign + concept data.
 * The blueprint is a format-agnostic creative spec that the execution-mapper then
 * converts into payloads for the existing video/carousel/banner generators.
 *
 * This is a pure function — no NestJS injection, no Prisma — so it can be tested
 * and called from any service without circular dependency concerns.
 */

import axios from 'axios';

// ─── Blueprint types ──────────────────────────────────────────────────────────

export type BlueprintFormat = 'video' | 'carousel' | 'banner';

export interface StyleDna {
  tone:         string;   // e.g. 'conversational' | 'authoritative' | 'energetic'
  pacing:       'fast' | 'medium' | 'slow';
  visual_style: string;   // e.g. 'cinematic' | 'bold' | 'minimalist' | 'documentary'
  emotion:      string;   // primary emotion to trigger
  hook_type:    string;   // 'question' | 'statement' | 'statistic' | 'story'
}

export interface PlatformCopy {
  hook:              string;   // opening hook line
  core_message:      string;   // single-sentence core message
  value_proposition: string;   // crisp benefit — maps to valueProposition in DTOs
  key_objection:     string;   // biggest objection to overcome — maps to keyObjection
  cta:               string;   // call to action
  platform:          string;   // 'instagram' | 'tiktok' | 'youtube' | 'facebook'
}

export interface ProductionStack {
  // Video fields
  duration_tier?: string;   // '15s' | '30s' | '60s' etc — maps to DurationTier enum
  // Carousel fields
  slide_count?:   number;   // 3–10
  // Banner fields
  sizes?:         string[]; // ['1080x1080', '1200x628', ...]
}

export interface MasterBlueprint {
  campaign_id:      string;
  concept_id:       string;
  format:           BlueprintFormat;
  angle_slug:       string;   // the primary angle slug to use for generation
  style_dna:        StyleDna;
  platform_copy:    PlatformCopy;
  production_stack: ProductionStack;
  _meta: {
    generated_at: string;
    model:        string;
    version:      '1.0';
  };
}

// ─── Input type ───────────────────────────────────────────────────────────────

export interface OrchestratorInput {
  apiKey:     string;
  campaignId: string;
  conceptId:  string;
  campaign: {
    name:     string | null;
    goal:     string | null;
    formats:  string[];
    tone:     string | null;
    persona:  string | null;
  };
  concept: {
    goal:              string;
    audience:          string;
    emotion:           string;
    coreMessage:       string;
    offer:             string;
    style:             string;
    platform:          string;
    durationTier:      string;
    angleHint:         string | null;
    toneHint:          string | null;
    keyObjection:      string | null;
    valueProposition:  string | null;
  };
  preferredFormat?:   BlueprintFormat;
  preferredAngleSlug?: string;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a master ad creative director for a SaaS called Creative OS.

Your job is to read a campaign brief and master concept, then produce a MASTER BLUEPRINT —
a structured JSON spec that will drive video, carousel, or banner ad generation.

The blueprint is a creative decision document. Think like:
- What angle cuts deepest for this audience?
- What emotion needs to fire in the first 3 seconds?
- What objection kills this deal?

RULES:
- Return ONLY valid JSON. No markdown, no explanation, no code fences.
- Every field must be filled. No null values.
- duration_tier for video must be one of: 5s, 8s, 10s, 15s, 30s, 45s, 60s, 75s, 90s
- slide_count for carousel must be between 3 and 10
- sizes for banner must be from: 1200x628, 1080x1080, 1080x1920, 300x250, 728x90
- angle_slug must match the concept's hook angle or a closely aligned strategic choice
- pacing must be one of: fast, medium, slow
- hook_type must be one of: question, statement, statistic, story`;

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateBlueprint(
  input: OrchestratorInput,
): Promise<MasterBlueprint> {
  const format  = input.preferredFormat ?? deriveFormat(input.campaign.formats);
  const angleSlug = input.preferredAngleSlug
    ?? input.concept.angleHint
    ?? 'problem_solution';

  const userPrompt = buildPrompt(input, format, angleSlug);

  const response = await axios.post<{ content: Array<{ type: string; text: string }> }>(
    'https://api.anthropic.com/v1/messages',
    {
      model:       'claude-sonnet-4-5',
      max_tokens:  1024,
      system:      SYSTEM_PROMPT,
      messages:    [{ role: 'user', content: userPrompt }],
    },
    {
      headers: {
        'x-api-key':         input.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      timeout: 30_000,
    },
  );

  const rawText = response.data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  let blueprint: MasterBlueprint;
  try {
    blueprint = JSON.parse(rawText);
  } catch {
    // Attempt to extract JSON from any surrounding text
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Sonnet returned non-JSON response: ${rawText.slice(0, 200)}`);
    }
    blueprint = JSON.parse(match[0]);
  }

  // Stamp identity and metadata (override whatever Sonnet returned for these)
  blueprint.campaign_id = input.campaignId;
  blueprint.concept_id  = input.conceptId;
  blueprint.format      = format;
  blueprint._meta       = {
    generated_at: new Date().toISOString(),
    model:        'claude-sonnet-4-5',
    version:      '1.0',
  };

  return blueprint;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveFormat(formats: string[]): BlueprintFormat {
  if (formats.includes('video'))    return 'video';
  if (formats.includes('carousel')) return 'carousel';
  if (formats.includes('banner'))   return 'banner';
  return 'video';
}

function buildPrompt(
  input:      OrchestratorInput,
  format:     BlueprintFormat,
  angleSlug:  string,
): string {
  const { campaign, concept } = input;

  const formatSpec = getFormatSpec(format, concept.durationTier);

  return `## Campaign Brief
Name: ${campaign.name ?? 'Untitled'}
Goal: ${campaign.goal ?? concept.goal}
Tone preference: ${campaign.tone ?? concept.toneHint ?? 'not specified'}
Persona: ${campaign.persona ?? 'not specified'}

## Master Concept
Goal: ${concept.goal}
Target audience: ${concept.audience}
Primary emotion: ${concept.emotion}
Core message: ${concept.coreMessage}
Offer: ${concept.offer}
Style: ${concept.style}
Platform: ${concept.platform}
Duration tier: ${concept.durationTier}
Angle hint: ${concept.angleHint ?? angleSlug}
Key objection to overcome: ${concept.keyObjection ?? 'not specified'}
Value proposition: ${concept.valueProposition ?? 'not specified'}

## Your Task
Generate a Master Blueprint for a **${format}** ad.

Primary angle slug to use: **${angleSlug}**

${formatSpec}

Return this exact JSON structure (fill every field):
{
  "campaign_id": "${input.campaignId}",
  "concept_id": "${input.conceptId}",
  "format": "${format}",
  "angle_slug": "${angleSlug}",
  "style_dna": {
    "tone": "<tone>",
    "pacing": "<fast|medium|slow>",
    "visual_style": "<visual style>",
    "emotion": "<emotion>",
    "hook_type": "<question|statement|statistic|story>"
  },
  "platform_copy": {
    "hook": "<opening hook line>",
    "core_message": "<single sentence>",
    "value_proposition": "<crisp benefit>",
    "key_objection": "<biggest objection>",
    "cta": "<call to action>",
    "platform": "${concept.platform}"
  },
  "production_stack": {
    ${formatProductionStackTemplate(format, concept.durationTier)}
  },
  "_meta": {}
}`;
}

function getFormatSpec(format: BlueprintFormat, durationTier: string): string {
  switch (format) {
    case 'video':
      return `For VIDEO: Set duration_tier to "${durationTier}" (must match the concept's duration tier exactly).`;
    case 'carousel':
      return 'For CAROUSEL: Set slide_count to an integer between 3 and 10 based on the depth of the message.';
    case 'banner':
      return 'For BANNER: Set sizes to an array. Choose 2-3 from: ["1200x628", "1080x1080", "1080x1920", "300x250", "728x90"] based on the platform.';
  }
}

function formatProductionStackTemplate(format: BlueprintFormat, durationTier: string): string {
  switch (format) {
    case 'video':
      return `"duration_tier": "${durationTier}"`;
    case 'carousel':
      return `"slide_count": <3-10>`;
    case 'banner':
      return `"sizes": ["1080x1080", "1200x628"]`;
  }
}
