/**
 * CTA Patcher — deterministic CTA upgrade for all formats.
 * Rules: add urgency, add specificity, reduce friction, max 5 words.
 */
import { AppliedChange } from '../improvement.types';

// ─── Weak CTA signal phrases ──────────────────────────────────────────────────
const WEAK_CTA = [
  'learn more', 'click here', 'find out', 'read more', 'see more',
  'view now', 'check out', 'visit us', 'contact us', 'get in touch',
  'discover', 'explore', 'see details', 'shop now', 'buy now',
];

// ─── Strong CTA templates keyed by goal ──────────────────────────────────────
const CTA_BY_GOAL: Record<string, string[]> = {
  conversion: [
    'Start your free trial today',
    'Get instant access — free',
    'Claim your spot now',
    'Try it free for 14 days',
    'Unlock it now — no card needed',
  ],
  awareness: [
    'See how it works — free',
    'Get the free guide now',
    'Watch the full story',
    'Discover more today',
    'Learn the secret — free',
  ],
  engagement: [
    'Join the conversation below',
    'Share your experience now',
    'Drop your answer below',
    'Tag someone who needs this',
    'Tell us — does this happen to you?',
  ],
};

const DEFAULT_CTA = 'Start now — it\'s free';

function pickCTA(goal: string, index: number): string {
  const pool = CTA_BY_GOAL[goal] || CTA_BY_GOAL.conversion;
  return pool[index % pool.length];
}

function isWeakCTA(text: string): boolean {
  const lower = (text || '').toLowerCase().trim();
  if (!lower || lower.length < 3) return true;
  return WEAK_CTA.some(w => lower === w || lower.startsWith(w));
}

// ─── VIDEO: patch the CTA scene ──────────────────────────────────────────────
export function patchVideoCTA(
  scenes: any[], concept: any, goal: string,
): { scenes: any[]; changes: AppliedChange[] } {
  const changes: AppliedChange[] = [];
  const ctaIdx = scenes.findIndex(s => s.type === 'cta');
  if (ctaIdx < 0) return { scenes, changes };

  const ctaScene = { ...scenes[ctaIdx] };
  const raw = concept?.rawJson || concept || {};
  const offer = raw.offer || concept?.offer || '';

  // Upgrade voiceover CTA
  const newCTA = pickCTA(goal, 0);
  const newVoiceover = offer
    ? `${offer}. ${newCTA}.`
    : `${newCTA}.`;

  if (isWeakCTA(ctaScene.on_screen_text) || ctaScene.voiceover?.length < 10) {
    changes.push({
      field:  'cta.voiceover',
      before: ctaScene.voiceover,
      after:  newVoiceover,
      reason: 'CTA voiceover was too vague — added specific offer + urgency',
    });
    changes.push({
      field:  'cta.on_screen_text',
      before: ctaScene.on_screen_text,
      after:  newCTA,
      reason: 'CTA on-screen text upgraded from generic to action-specific',
    });
    ctaScene.voiceover     = newVoiceover;
    ctaScene.on_screen_text = newCTA;
  }

  const boosted = [...scenes];
  boosted[ctaIdx] = ctaScene;
  return { scenes: boosted, changes };
}

// ─── CAROUSEL: patch last slide CTA ──────────────────────────────────────────
export function patchCarouselCTA(
  slides: any[], goal: string,
): { slides: any[]; changes: AppliedChange[] } {
  const changes: AppliedChange[] = [];

  const boosted = slides.map((slide, i) => {
    const isCTASlide = slide.type === 'cta' || i === slides.length - 1;
    if (!isCTASlide) return slide;

    const upgraded = { ...slide };
    const newCTA = pickCTA(goal, i);

    if (isWeakCTA(slide.cta)) {
      changes.push({
        field:  `slide[${i}].cta`,
        before: slide.cta || '(empty)',
        after:  newCTA,
        reason: 'Slide CTA was generic — upgraded with urgency and specificity',
      });
      upgraded.cta = newCTA;
    }

    // Also upgrade headline on CTA slide if it's weak
    if (!slide.headline || slide.headline.length < 5) {
      const newHeadline = goal === 'conversion'
        ? 'Ready to get started?'
        : 'Want to learn more?';
      changes.push({ field: `slide[${i}].headline`, before: slide.headline || '', after: newHeadline, reason: 'Missing CTA headline added' });
      upgraded.headline = newHeadline;
    }

    return upgraded;
  });

  return { slides: boosted, changes };
}

// ─── BANNER: patch all banner CTAs ───────────────────────────────────────────
export function patchBannerCTA(
  banners: any[], goal: string,
): { banners: any[]; changes: AppliedChange[] } {
  const changes: AppliedChange[] = [];

  const boosted = banners.map((banner, i) => {
    if (!isWeakCTA(banner.cta)) return banner;

    const newCTA = pickCTA(goal, i);
    changes.push({
      field:  `banner[${banner.size || i}].cta`,
      before: banner.cta || '(empty)',
      after:  newCTA,
      reason: 'Banner CTA replaced — original was too generic',
    });
    return { ...banner, cta: newCTA };
  });

  return { banners: boosted, changes };
}
