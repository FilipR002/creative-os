/**
 * Scoring utilities — deterministic, rule-based heuristics.
 * No ML. No randomness. Pure text + structure analysis.
 */

// ─── CTA vocabulary ─────────────────────────────────────────────────────────
const STRONG_CTA_WORDS = [
  'download', 'start', 'get', 'try', 'join', 'claim', 'unlock',
  'free', 'now', 'today', 'sign up', 'buy', 'shop', 'discover',
];

const HOOK_POWER_WORDS = [
  'secret', 'mistake', 'never', 'stop', 'warning', 'finally',
  'truth', 'real', 'proven', 'most', 'why', 'how', 'free',
  'instant', 'boost', 'transform', 'reveal', 'shocking',
];

const EMOTION_WORDS = [
  'feel', 'love', 'hate', 'fear', 'hope', 'dream', 'struggle',
  'confident', 'proud', 'frustrated', 'excited', 'happy', 'tired',
  'sick', 'desperate', 'worried', 'scared', 'amazed', 'inspired',
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function wordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function containsAny(text: string, words: string[]): number {
  const lower = (text || '').toLowerCase();
  return words.filter(w => lower.includes(w)).length;
}

// ─── Hook score ──────────────────────────────────────────────────────────────
/**
 * Scores the hook quality of a text string.
 * Rules:
 *   - Contains power hook words → +0.4 (max 0.4)
 *   - Ideal length 4–10 words → +0.3
 *   - Ends with ? or ! → +0.15
 *   - All-caps word present → +0.15
 */
export function calculateHookScore(hookText: string): number {
  if (!hookText) return 0.1;
  let score = 0;

  const powerMatches = containsAny(hookText, HOOK_POWER_WORDS);
  score += clamp(powerMatches * 0.2) * 2; // max 0.4

  const wc = wordCount(hookText);
  if (wc >= 4 && wc <= 10) score += 0.3;
  else if (wc >= 3 && wc <= 14) score += 0.15;

  if (/[?!]/.test(hookText)) score += 0.15;

  if (/\b[A-Z]{2,}\b/.test(hookText)) score += 0.15;

  return clamp(score);
}

// ─── CTA effectiveness ───────────────────────────────────────────────────────
/**
 * Rules:
 *   - Contains strong CTA word → +0.4 (per word, max 0.4)
 *   - Short (1–4 words) → +0.3 (ideal CTA length)
 *   - Urgency words (now/today/free) → +0.15
 *   - Starts with a verb → +0.15
 */
export function calculateCTAEffectiveness(ctaText: string): number {
  if (!ctaText) return 0.1;
  let score = 0;

  const ctaMatches = containsAny(ctaText, STRONG_CTA_WORDS);
  score += clamp(ctaMatches * 0.2) * 2; // max 0.4

  const wc = wordCount(ctaText);
  if (wc >= 1 && wc <= 4) score += 0.3;
  else if (wc <= 6) score += 0.15;

  if (containsAny(ctaText, ['now', 'today', 'free']) > 0) score += 0.15;

  // Verb-start heuristic: first word lowercase and in CTA list
  const firstWord = ctaText.trim().split(/\s+/)[0]?.toLowerCase();
  if (STRONG_CTA_WORDS.includes(firstWord)) score += 0.15;

  return clamp(score);
}

// ─── Clarity score ───────────────────────────────────────────────────────────
/**
 * Rules:
 *   - Body/copy is present → +0.2
 *   - Ideal length (10–30 words) → +0.3
 *   - No ALL-CAPS spam (less than 3 all-caps words) → +0.2
 *   - Short sentences (avg < 20 words) → +0.15
 *   - No excessive punctuation → +0.15
 */
export function calculateClarityScore(bodyText: string): number {
  if (!bodyText) return 0.1;
  let score = 0.2; // base: text exists

  const wc = wordCount(bodyText);
  if (wc >= 10 && wc <= 30) score += 0.3;
  else if (wc >= 5 && wc <= 50) score += 0.15;

  const capsWords = (bodyText.match(/\b[A-Z]{3,}\b/g) || []).length;
  if (capsWords < 3) score += 0.2;

  const sentences = bodyText.split(/[.!?]+/).filter(Boolean);
  const avgSentLen = sentences.length > 0
    ? sentences.reduce((s, sen) => s + wordCount(sen), 0) / sentences.length
    : wc;
  if (avgSentLen < 20) score += 0.15;

  const excessivePunct = (bodyText.match(/[!?]{2,}/g) || []).length;
  if (excessivePunct === 0) score += 0.15;

  return clamp(score);
}

// ─── Structure score ─────────────────────────────────────────────────────────
/**
 * Checks if all required fields in a creative object are populated.
 * Returns ratio of filled fields.
 */
export function calculateStructureScore(content: any, format: string): number {
  const checks: boolean[] = [];

  if (format === 'video') {
    const scenes: any[] = content?.scenes || [];
    checks.push(scenes.length >= 4);
    checks.push(scenes.some(s => s.type === 'hook'));
    checks.push(scenes.some(s => s.type === 'cta'));
    checks.push(scenes.every(s => s.voiceover?.length > 5));
    checks.push(scenes.every(s => s.visual_prompt?.length > 5));
    checks.push(scenes.every(s => s.on_screen_text?.length > 0));
  }

  if (format === 'carousel') {
    const slides: any[] = content?.slides || [];
    checks.push(slides.length >= 3);
    checks.push(slides[0]?.hook?.length > 0);
    checks.push(slides.some(s => s.type === 'cta'));
    checks.push(slides.every(s => s.headline?.length > 0));
    checks.push(slides.every(s => s.body?.length > 10));
    const lastSlide = slides[slides.length - 1];
    checks.push(!!lastSlide?.cta && lastSlide.cta.length > 0);
  }

  if (format === 'banner') {
    const banners: any[] = content?.banners || [];
    checks.push(banners.length >= 1);
    checks.push(banners.every(b => b.headline?.length > 0));
    checks.push(banners.every(b => b.cta?.length > 0));
    checks.push(banners.every(b => b.subtext?.length > 0));
    checks.push(banners.every(b => b.visual_direction?.length > 0));
  }

  if (checks.length === 0) return 0.5;
  return clamp(checks.filter(Boolean).length / checks.length);
}

// ─── Emotional intensity ─────────────────────────────────────────────────────
/**
 * Scans all text content for emotion words.
 * More matches = higher emotional intensity.
 */
export function calculateEmotionalIntensity(texts: string[]): number {
  const combined = texts.join(' ');
  const matches = containsAny(combined, EMOTION_WORDS);
  // 0 matches = 0.1 baseline, 5+ matches = 1.0
  return clamp(0.1 + (matches / 5) * 0.9);
}

// ─── Format-specific scoring ─────────────────────────────────────────────────

export function scoreVideo(content: any): {
  dimensions: any;
  ctrProxy: number;
  engagementProxy: number;
  conversionProxy: number;
  clarity: number;
} {
  const scenes: any[] = content?.scenes || [];
  const hookScene = scenes.find(s => s.type === 'hook') || scenes[0] || {};
  const ctaScene  = scenes.find(s => s.type === 'cta')  || scenes[scenes.length - 1] || {};

  const allTexts = scenes.flatMap(s => [
    s.voiceover || '', s.on_screen_text || '', s.visual_prompt || '',
  ]);

  const hookStrength         = calculateHookScore(hookScene.on_screen_text || hookScene.voiceover || '');
  const clarity              = calculateClarityScore(scenes.map(s => s.voiceover || '').join(' '));
  const emotionalIntensity   = calculateEmotionalIntensity(allTexts);
  const structureCompleteness = calculateStructureScore(content, 'video');
  const ctaStrength          = calculateCTAEffectiveness(ctaScene.on_screen_text || ctaScene.voiceover || '');

  const ctrProxy        = (hookStrength * 0.6) + (emotionalIntensity * 0.4);
  const engagementProxy = (emotionalIntensity * 0.5) + (hookStrength * 0.5);
  const conversionProxy = (ctaStrength * 0.6) + (clarity * 0.4);

  return {
    dimensions: { hookStrength, clarity, emotionalIntensity, structureCompleteness },
    ctrProxy,
    engagementProxy,
    conversionProxy,
    clarity,
  };
}

export function scoreCarousel(content: any): {
  dimensions: any;
  ctrProxy: number;
  engagementProxy: number;
  conversionProxy: number;
  clarity: number;
} {
  const slides: any[] = content?.slides || [];
  const firstSlide = slides[0] || {};
  const lastSlide  = slides[slides.length - 1] || {};

  const headlineClarity = calculateClarityScore(
    slides.map(s => s.headline || '').join(' ')
  );
  const ctaStrength = calculateCTAEffectiveness(lastSlide.cta || '');
  const hookStrength = calculateHookScore(firstSlide.hook || firstSlide.headline || '');

  // Slide flow: checks presence of expected slide types in order
  const types = slides.map(s => s.type);
  const hasCover   = types.includes('cover');
  const hasProblem = types.some(t => ['problem', 'conflict'].includes(t));
  const hasValue   = types.some(t => ['value', 'proof', 'tips'].includes(t));
  const hasCTA     = types.includes('cta');
  const slideFlowQuality = clamp(
    ([hasCover, hasProblem, hasValue, hasCTA].filter(Boolean).length / 4)
  );

  const allText = slides.map(s => [s.hook, s.headline, s.body].join(' ')).join(' ');
  const persuasionArc = calculateEmotionalIntensity(
    slides.map(s => s.body || '')
  );

  const bodyClarityAll = calculateClarityScore(
    slides.map(s => s.body || '').join(' ')
  );

  const ctrProxy        = (hookStrength * 0.7) + (headlineClarity * 0.3);
  const engagementProxy = (slideFlowQuality * 0.5) + (persuasionArc * 0.5);
  const conversionProxy = (ctaStrength * 0.6) + (bodyClarityAll * 0.4);

  return {
    dimensions: { headlineClarity, slideFlowQuality, ctaStrength, persuasionArc },
    ctrProxy,
    engagementProxy,
    conversionProxy,
    clarity: headlineClarity,
  };
}

export function scoreBanner(content: any): {
  dimensions: any;
  ctrProxy: number;
  engagementProxy: number;
  conversionProxy: number;
  clarity: number;
} {
  const banners: any[] = content?.banners || [];

  // Average across all banner sizes
  const avg = (fn: (b: any) => number) =>
    banners.length > 0
      ? clamp(banners.reduce((s, b) => s + fn(b), 0) / banners.length)
      : 0;

  const readability = avg(b =>
    calculateClarityScore(b.headline + ' ' + (b.subtext || ''))
  );
  const ctaVisibility = avg(b => calculateCTAEffectiveness(b.cta || ''));

  // Visual hierarchy: presence of all fields per banner
  const visualHierarchy = avg(b =>
    calculateStructureScore({ banners: [b] }, 'banner')
  );

  // Message density: penalise overly long headlines
  const messageDensity = avg(b => {
    const wc = wordCount(b.headline || '');
    if (wc <= 6) return 1.0;
    if (wc <= 10) return 0.7;
    return 0.4;
  });

  const ctrProxy        = (ctaVisibility * 0.5) + (readability * 0.5);
  const engagementProxy = (visualHierarchy * 0.6) + (messageDensity * 0.4);
  const conversionProxy = (ctaVisibility * 0.7) + (readability * 0.3);

  return {
    dimensions: { readability, visualHierarchy, ctaVisibility, messageDensity },
    ctrProxy,
    engagementProxy,
    conversionProxy,
    clarity: readability,
  };
}

// ─── Master weighted score ────────────────────────────────────────────────────
export function computeTotalScore(proxies: {
  ctrProxy: number;
  engagementProxy: number;
  conversionProxy: number;
  clarity: number;
}): number {
  return clamp(
    proxies.ctrProxy        * 0.30 +
    proxies.engagementProxy * 0.30 +
    proxies.conversionProxy * 0.25 +
    proxies.clarity         * 0.15
  );
}
