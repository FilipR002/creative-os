// ─── Creative Copy Generator ──────────────────────────────────────────────────
// Generates structured, visible ad copy from the API result data.
// Uses a seeded random so the same executionId always produces the same copy.

import type { RunResult, RunAngle } from './api/run-client';

export interface VideoScript {
  hook: string;
  scenes: { label: string; direction: string }[];
  cta: string;
}

export interface CarouselSlide {
  slideNum: number;
  headline: string;
  body: string;
}

export interface BannerCopy {
  headline: string;
  subheadline: string;
  cta: string;
}

export interface CreativeVariation {
  label: string;
  badge: string;
  hook: string;
  copy: string;
  cta: string;
}

export interface StructuredCopy {
  format: 'video' | 'carousel' | 'banner';
  primaryHook: string;
  primaryCopy: string;
  primaryCta: string;
  // Format-specific
  videoScript?: VideoScript;
  carouselSlides?: CarouselSlide[];
  bannerCopy?: BannerCopy;
  // Variations
  varA: CreativeVariation;
  varB: CreativeVariation;
  angleLabel: string;
  angleReason: string;
}

// Seeded RNG — same executionId always produces same output
function makeRng(seed: string) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= h >>> 11;
    return (h >>> 0) / 4294967295;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Extract the core product/offer from a brief
function parseBrief(brief: string): { product: string; audience: string; offer: string } {
  const lower = brief.toLowerCase();

  // Try to extract audience (after "targeting", "for", "aimed at")
  const audienceMatch = brief.match(/(?:targeting|for|aimed at|designed for)\s+([^.;,—–-]{5,50})/i);
  const audience = audienceMatch?.[1]?.trim() ?? 'your audience';

  // Try to extract product name (first proper noun or phrase before "is a" / "is an")
  const productMatch = brief.match(/^([A-Z][a-zA-Z0-9\s]{1,25})\s+is\s+(?:a|an)/);
  const product = productMatch?.[1]?.trim() ?? 'this product';

  // Try to detect offer type
  const offerMatch = brief.match(/\$[\d,]+(?:\s*\/\s*(?:mo|month|year|yr))?|\d+-week|\bfree\b|\btrial\b/i);
  const offer = offerMatch?.[0] ?? '';

  return { product, audience, offer };
}

// Map angle slug → human-readable strategy label
function angleToLabel(slug: string): string {
  const map: Record<string, string> = {
    before_after:      'Before/After',
    social_proof:      'Social Proof',
    problem_solution:  'Problem → Solution',
    curiosity:         'Curiosity Hook',
    urgency:           'Urgency/Scarcity',
    storytelling:      'Brand Story',
    value_prop:        'Value Proposition',
    emotional:         'Emotional Appeal',
    authority:         'Authority/Trust',
    comparison:        'Comparison',
    transformation:    'Transformation',
    pain_point:        'Pain Point',
  };
  return map[slug] ?? slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Video copy templates ───────────────────────────────────────────────────────
const VIDEO_HOOKS: Record<string, string[]> = {
  before_after: [
    'I was {pain} — until I tried this.',
    'What if you could {benefit} in {timeframe}?',
    'Before: {pain}. After: {outcome}.',
  ],
  social_proof: [
    '{number} people already {benefit} with {product}.',
    "Everyone's asking how we {benefit} so fast.",
    'Why {audience} switched to {product}.',
  ],
  problem_solution: [
    'Still {pain}? There is a smarter way.',
    'The {pain} problem is finally solved.',
    "If you're {pain}, watch this.",
  ],
  curiosity: [
    'Nobody talks about this — but it works.',
    'The {benefit} secret {audience} are using.',
    'This one thing changed everything.',
  ],
  urgency: [
    'Only a few spots left — here is why.',
    'This closes in 48 hours. Seriously.',
    "Don't wait until {pain} gets worse.",
  ],
  default: [
    "Here is what nobody tells you about {pain}.",
    'The fastest way to {benefit}.',
    '{product} does something your competitors cannot.',
  ],
};

const CTAS: Record<string, string[]> = {
  conversion: ['Get Started Free', 'Claim Your Spot', 'Start Today', 'Try It Free', 'Get Instant Access'],
  awareness:  ['Learn More', 'See How It Works', 'Discover More', 'Find Out Why', 'Watch the Story'],
  engagement: ['Join the Community', 'Comment Below', 'Share Your Story', 'Tag a Friend', 'See More'],
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? key);
}

function inferVars(brief: string, angle: RunAngle | null, rng: () => number) {
  const { product, audience, offer } = parseBrief(brief);
  const lower = brief.toLowerCase();

  const benefits = ['grow faster', 'save time', 'get results', 'transform your results', 'reach your goals', 'scale without limits'];
  const pains    = ['struggling', 'wasting time', 'stuck', 'overwhelmed', 'not seeing results', 'falling behind'];
  const times    = ['30 days', '2 weeks', '8 weeks', 'one session', 'under a month'];
  const numbers  = ['1,000+', '5,000+', '10,000+', 'thousands of'];

  // Try to read real data from brief
  const timeMatch = brief.match(/(\d+-week|\d+ weeks?|\d+ days?|\d+ months?)/i);
  const numberMatch = brief.match(/(\d[\d,]+\+?\s*(?:users?|customers?|clients?|people|students?))/i);

  return {
    product,
    audience:   audience.length > 30 ? audience.substring(0, 30) : audience,
    benefit:    pick(benefits, rng),
    pain:       pick(pains, rng),
    outcome:    pick(benefits, rng),
    timeframe:  timeMatch?.[1] ?? pick(times, rng),
    number:     numberMatch?.[1] ?? pick(numbers, rng),
    offer:      offer || 'the deal',
  };
}

// ── Main generator ─────────────────────────────────────────────────────────────
export function generateCreativeCopy(result: RunResult): StructuredCopy {
  const rng    = makeRng(result.executionId);
  const format = (result.creatives[0]?.format ?? 'video') as 'video' | 'carousel' | 'banner';
  const goal   = result.concept.goal as 'conversion' | 'awareness' | 'engagement';
  const brief  = result.concept.brief;

  const winnerAngle = result.angles.find(a => a.slug === (result.winner?.angleSlug ?? result.scoring[0]?.angleSlug))
    ?? result.angles[0]
    ?? null;
  const secAngle    = result.angles.find(a => a !== winnerAngle) ?? null;

  const vars     = inferVars(brief, winnerAngle, rng);
  const angleKey = winnerAngle?.slug ?? 'default';
  const hooks    = VIDEO_HOOKS[angleKey] ?? VIDEO_HOOKS.default;
  const ctaList  = CTAS[goal] ?? CTAS.conversion;

  const primaryHook = fillTemplate(pick(hooks, rng), vars);
  const primaryCta  = pick(ctaList, rng);

  // Build primary copy from explanation + angle reason
  const explanation  = result.explanation ?? '';
  const angleReason  = winnerAngle?.reason ?? '';
  const angleLabel   = angleToLabel(winnerAngle?.slug ?? '');

  // Primary copy body — use angle reason if available, else derive from brief
  let primaryCopy = angleReason
    ? angleReason.charAt(0).toUpperCase() + angleReason.slice(1)
    : `${vars.product} helps ${vars.audience} ${vars.benefit}. No fluff, no filler — just results.`;

  // Trim to 2 sentences max for cleanliness
  const sentences = primaryCopy.match(/[^.!?]+[.!?]+/g) ?? [primaryCopy];
  primaryCopy = sentences.slice(0, 2).join(' ').trim();

  // ── Format-specific output ──────────────────────────────────────────────────
  let videoScript: VideoScript | undefined;
  let carouselSlides: CarouselSlide[] | undefined;
  let bannerCopy: BannerCopy | undefined;

  if (format === 'video') {
    videoScript = {
      hook: primaryHook,
      scenes: [
        { label: 'Scene 1 (0–3s)',  direction: `Open on: ${primaryHook} — tight shot, no music yet. Text overlay.` },
        { label: 'Scene 2 (3–10s)', direction: `Show the problem: someone dealing with "${vars.pain}". Quick cuts, relatable.` },
        { label: 'Scene 3 (10–25s)',direction: `Introduce ${vars.product}. Show the ${vars.benefit} moment. Add social proof or metric.` },
        { label: 'Scene 4 (25–30s)',direction: `End card: ${primaryCta}. Logo. Clear button/link.` },
      ],
      cta: primaryCta,
    };
  } else if (format === 'carousel') {
    carouselSlides = [
      { slideNum: 1, headline: primaryHook,                              body: 'Swipe to see how →' },
      { slideNum: 2, headline: `The problem: ${vars.pain}`,              body: `${vars.audience} deal with this every day. There is a better way.` },
      { slideNum: 3, headline: `The solution: ${vars.product}`,          body: primaryCopy },
      { slideNum: 4, headline: `Real results in ${vars.timeframe}`,      body: `${vars.number} ${vars.audience} already ${vars.benefit}.` },
      { slideNum: 5, headline: primaryCta,                               body: `Link in bio · No commitment required` },
    ];
  } else {
    bannerCopy = {
      headline:    primaryHook,
      subheadline: primaryCopy.substring(0, 80) + (primaryCopy.length > 80 ? '…' : ''),
      cta:         primaryCta,
    };
  }

  // ── Variation A (punchier / shorter) ───────────────────────────────────────
  const altHooks  = VIDEO_HOOKS[secAngle?.slug ?? 'default'] ?? VIDEO_HOOKS.default;
  const varAHook  = fillTemplate(pick(altHooks, rng), { ...vars, benefit: vars.outcome });
  const varACopy  = secAngle?.reason
    ? secAngle.reason.charAt(0).toUpperCase() + secAngle.reason.slice(1, 80) + '…'
    : `${vars.product}: the fastest path to ${vars.benefit}.`;
  const varACta   = pick(ctaList, rng);

  // ── Variation B (emotional / urgency) ──────────────────────────────────────
  const urgencyHooks = VIDEO_HOOKS.urgency;
  const varBHook  = fillTemplate(pick(urgencyHooks, rng), vars);
  const varBCopy  = `Imagine ${vars.audience} who ${vars.benefit} — without the usual ${vars.pain}. That is what ${vars.product} makes possible.`;
  const varBCta   = goal === 'conversion' ? 'Claim Your Spot Now' : pick(ctaList, rng);

  return {
    format,
    primaryHook,
    primaryCopy,
    primaryCta,
    videoScript,
    carouselSlides,
    bannerCopy,
    varA: { label: 'Variation A', badge: 'Punchy',    hook: varAHook, copy: varACopy, cta: varACta },
    varB: { label: 'Variation B', badge: 'Emotional', hook: varBHook, copy: varBCopy, cta: varBCta },
    angleLabel,
    angleReason: angleReason || explanation.substring(0, 160),
  };
}
