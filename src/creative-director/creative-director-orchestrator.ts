/**
 * creative-director-orchestrator.ts
 *
 * Calls Claude Sonnet acting as the "Creative Director Brain" of Creative OS.
 *
 * Unlike the Creative OS blueprint orchestrator (which produces a MasterBlueprint for ONE format),
 * this orchestrator generates a FULL conversion system for ALL THREE formats
 * simultaneously — video scenes, carousel slides, and banner copy — all derived
 * from a single core narrative (hook → problem → solution → CTA).
 *
 * This is a pure function: no NestJS, no Prisma, testable in isolation.
 */

import axios from 'axios';

// ─── Output types ─────────────────────────────────────────────────────────────

export type TransitionType = 'glitch' | 'zoom' | 'cut' | 'burst';
export type PacingType     = 'aggressive' | 'moderate';
export type SlideIntent    = 'hook' | 'problem' | 'solution' | 'cta';

export interface CoreStory {
  hook:     string;
  problem:  string;
  solution: string;
  cta:      string;
}

export interface VideoScene {
  /** Fully deterministic visual instruction for Kling or similar video generator */
  kling_prompt: string;
  overlay_text: string;
  transition:   TransitionType;
  pacing:       PacingType;
  voiceover?:   string;  // SSML string
}

export interface CarouselSlide {
  headline:         string;
  subtext?:         string;
  visual_direction: string;
  intent:           SlideIntent;
}

export interface BannerSpec {
  /** Max 7 words */
  headline: string;
  /** 1 line */
  subtext:  string;
  /** Button text */
  cta:      string;
  /** Composition guidance */
  visual_composition?: string;
}

export interface CreativePlan {
  core_story: CoreStory;
  video:      { scenes: VideoScene[] };
  carousel:   { slides: CarouselSlide[] };
  banner:     BannerSpec;
  _meta: {
    generated_at:  string;
    model:         string;
    campaign_id:   string;
    concept_id:    string;
    duration_tier: string;
    version:       '2.0';
  };
}

// ─── Input type ───────────────────────────────────────────────────────────────

export interface CreativeDirectorInput {
  apiKey:     string;
  campaignId: string;
  conceptId:  string;

  campaign: {
    name:    string | null;
    goal:    string | null;
    tone:    string | null;
    persona: string | null;
  };

  concept: {
    goal:             string;
    audience:         string;
    emotion:          string;
    coreMessage:      string;
    offer:            string;
    style:            string;
    platform:         string;
    durationTier:     string;   // drives scene count for video
    keyObjection:     string | null;
    valueProposition: string | null;
  };
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Creative Director Brain of a production system called Creative OS.

You are NOT a generator.

You are a SYSTEM DESIGNER that converts a marketing brief into structured, conversion-optimized creative executions.

---

# 🧠 CORE PRINCIPLE

Every output is a CONVERSION SYSTEM.

You always think in:

HOOK → PROBLEM → SOLUTION → CTA

This is universal across all formats.

You do NOT change strategy based on format.
You only adapt execution.

---

# 🎯 SUPPORTED OUTPUT FORMATS

You must generate structured outputs for:

1. VIDEO
2. CAROUSEL
3. BANNER

All three are derived from the SAME core narrative logic.

---

# 🧠 MASTER STORY STRUCTURE

## 1. HOOK
- Stop attention immediately
- Create curiosity gap or tension spike
- No explanations

## 2. PROBLEM
- Amplify pain or inefficiency
- Make user feel current state is unacceptable

## 3. SOLUTION
- Show product as inevitable resolution
- Focus only on conversion-driving features

## 4. CTA
- Force action (not suggest)
- Create urgency or clarity of next step

---

# ⚙️ EXECUTION ADAPTERS

You MUST adapt the same story into different formats:

---

# 🎬 VIDEO ADAPTER (Temporal System)

Rules:
- Scene-based structure
- 2–4 seconds per scene
- Fast pacing required

Structure:
- Hook (3–5s)
- Problem (15–20%)
- Solution (40–50%)
- CTA (20–25%)

Requirements:
- Scene count:
  - 15s → 5–6 scenes
  - 60s → 18–22 scenes
  - 90s → 25–30 scenes

Each scene must include:
- kling_prompt (fully deterministic visual instruction)
- overlay_text
- transition (glitch | zoom | cut | burst)
- pacing (aggressive | moderate)

Voiceover:
- Must use SSML
- Include pauses and emphasis for persuasion

---

# 📲 CAROUSEL ADAPTER (Sequential System)

Rules:
- No time dimension
- 3–10 slides max
- Each slide = one psychological step

Structure:
- Slide 1 → Hook (scroll stopper)
- Slide 2–3 → Problem escalation
- Slide 4–8 → Solution progression
- Last slide → CTA

Each slide must include:
- headline
- subtext (optional)
- visual_direction
- intent (hook/problem/solution/cta)

---

# 🟨 BANNER ADAPTER (Static System)

Rules:
- Single frame only
- No storytelling sequence
- Hierarchy-based persuasion

Structure:
- Headline (max 7 words, high impact)
- Subtext (1 line max)
- CTA (button text)
- Visual composition direction

Requirements:
- Must prioritize readability and negative space
- No clutter
- Typography is primary conversion driver

---

# 🧠 CONVERSION ENGINE RULE

Every asset must satisfy:

1. Attention capture (stop scrolling)
2. Emotional tension (increase urgency)
3. Resolution (product positioning)
4. Action trigger (conversion)

No exceptions.

---

# ⚠️ STRICT RULES

- No random creativity
- No unnecessary variation
- No aesthetic-first thinking
- Everything must serve conversion

You are not an artist.

You are a PERFORMANCE ENGINE.

---

# 📦 OUTPUT FORMAT (STRICT)

Return ONLY valid JSON. No markdown, no explanation, no code fences.

{
  "core_story": {
    "hook": "",
    "problem": "",
    "solution": "",
    "cta": ""
  },
  "video": {
    "scenes": [
      {
        "kling_prompt": "",
        "overlay_text": "",
        "transition": "cut|glitch|zoom|burst",
        "pacing": "aggressive|moderate",
        "voiceover": "<speak>SSML string</speak>"
      }
    ]
  },
  "carousel": {
    "slides": [
      {
        "headline": "",
        "subtext": "",
        "visual_direction": "",
        "intent": "hook|problem|solution|cta"
      }
    ]
  },
  "banner": {
    "headline": "",
    "subtext": "",
    "cta": "",
    "visual_composition": ""
  }
}`;

// ─── Scene count helper ───────────────────────────────────────────────────────

function targetSceneCount(durationTier: string): string {
  const seconds = parseInt(durationTier, 10);
  if (isNaN(seconds)) return '6–8 scenes';
  if (seconds <= 10)  return '3–4 scenes';
  if (seconds <= 15)  return '5–6 scenes';
  if (seconds <= 30)  return '8–10 scenes';
  if (seconds <= 45)  return '12–15 scenes';
  if (seconds <= 60)  return '18–22 scenes';
  if (seconds <= 75)  return '22–26 scenes';
  return '25–30 scenes'; // 90s
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateCreativePlan(
  input: CreativeDirectorInput,
): Promise<CreativePlan> {
  const { campaign, concept } = input;
  const sceneGuide = targetSceneCount(concept.durationTier);

  const userPrompt = `## Marketing Brief

Campaign: ${campaign.name ?? 'Untitled'}
Goal: ${campaign.goal ?? concept.goal}
Target audience: ${concept.audience}
Primary emotion to trigger: ${concept.emotion}
Core message: ${concept.coreMessage}
Offer: ${concept.offer}
Style: ${concept.style}
Platform: ${concept.platform}
Tone: ${campaign.tone ?? 'not specified'}
Persona: ${campaign.persona ?? 'not specified'}
Video duration tier: ${concept.durationTier} → target ${sceneGuide}
Key objection to overcome: ${concept.keyObjection ?? 'not specified'}
Value proposition: ${concept.valueProposition ?? 'not specified'}

---

Generate the complete conversion system for this brief.

For VIDEO: produce exactly ${sceneGuide}. Every scene needs a kling_prompt (cinematic camera direction + action + mood — NO text/words/captions in the prompt), overlay_text (the text to burn in via FFmpeg post-render — punchy, max 8 words), transition, pacing, and SSML voiceover. CRITICAL: kling_prompt must describe ONLY visuals — never include "text says", "caption reads", "overlay", or any instruction to render text in the frame.

For CAROUSEL: produce 5–7 slides following the hook → problem → solution → CTA arc. Every slide needs headline, optional subtext, visual_direction, and intent.

For BANNER: produce a single high-impact frame. Headline max 7 words. One-line subtext. Sharp CTA. Include visual_composition guidance.

Return ONLY the JSON object. No wrapper text.`;

  const response = await axios.post<{ content: Array<{ type: string; text: string }> }>(
    'https://api.anthropic.com/v1/messages',
    {
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userPrompt }],
    },
    {
      headers: {
        'x-api-key':         input.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      timeout: 60_000,
    },
  );

  const rawText = response.data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  let plan: Omit<CreativePlan, '_meta'>;
  try {
    plan = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Creative Director returned non-JSON: ${rawText.slice(0, 300)}`);
    }
    plan = JSON.parse(match[0]);
  }

  return {
    ...plan,
    _meta: {
      generated_at:  new Date().toISOString(),
      model:         'claude-sonnet-4-6',
      campaign_id:   input.campaignId,
      concept_id:    input.conceptId,
      duration_tier: concept.durationTier,
      version:       '2.0',
    },
  };
}
