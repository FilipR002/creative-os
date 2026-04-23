/**
 * Clarity Patcher — deterministic text simplification.
 * Rules: shorter sentences, remove vague language, clearer benefit statements.
 */
import { AppliedChange } from '../improvement.types';

// ─── Vague / filler phrases to strip ─────────────────────────────────────────
const VAGUE_PHRASES: [RegExp, string][] = [
  [/\b(various|numerous|multiple|several|many|some)\s+(things|features|options|ways|aspects)\b/gi, ''],
  [/\b(essentially|basically|literally|actually|really|very|quite|rather|somewhat)\b\s*/gi, ''],
  [/\band (so on|etc\.?|more\.?)\b/gi, ''],
  [/\bthat (being said|said)\b/gi, ''],
  [/\bwith that in mind\b/gi, ''],
  [/\bwithout further ado\b/gi, ''],
  [/\bin order to\b/gi, 'to'],
  [/\bat the end of the day\b/gi, 'ultimately'],
  [/\bit is worth noting that\b/gi, ''],
  [/\bthe fact that\b/gi, ''],
];

// ─── Passive to active voice (simple cases) ───────────────────────────────────
const PASSIVE_TO_ACTIVE: [RegExp, string][] = [
  [/\bis (designed|built|made|created) to\b/gi, 'helps you'],
  [/\bcan be used to\b/gi, 'helps you'],
  [/\bis (able|capable) to\b/gi, 'can'],
];

// ─── Simplify a single text string ───────────────────────────────────────────
function simplifyText(text: string, maxSentences = 2): string {
  if (!text || text.length < 10) return text;

  let result = text;

  // Remove vague phrases
  for (const [pattern, replacement] of VAGUE_PHRASES) {
    result = result.replace(pattern, replacement);
  }

  // Passive → active
  for (const [pattern, replacement] of PASSIVE_TO_ACTIVE) {
    result = result.replace(pattern, replacement);
  }

  // Collapse multiple spaces
  result = result.replace(/\s{2,}/g, ' ').trim();

  // Truncate to maxSentences
  const sentences = result.match(/[^.!?]+[.!?]+/g) || [result];
  if (sentences.length > maxSentences) {
    result = sentences.slice(0, maxSentences).join(' ').trim();
  }

  return result || text; // fallback to original if we erased too much
}

// ─── Simplify headline (max 8 words, crisp benefit statement) ─────────────────
function simplifyHeadline(text: string): string {
  if (!text) return text;
  let result = simplifyText(text, 1);

  // Hard-cap at 10 words
  const words = result.split(/\s+/);
  if (words.length > 10) result = words.slice(0, 10).join(' ');

  return result;
}

// ─── VIDEO: simplify voiceovers ───────────────────────────────────────────────
export function patchVideoClarity(
  scenes: any[],
): { scenes: any[]; changes: AppliedChange[] } {
  const changes: AppliedChange[] = [];

  const patched = scenes.map((scene, i) => {
    const simplified = simplifyText(scene.voiceover || '', 2);
    if (simplified !== scene.voiceover && simplified.length > 5) {
      changes.push({
        field:  `scene[${i}].voiceover`,
        before: scene.voiceover,
        after:  simplified,
        reason: 'Removed filler language and passive constructions for clarity',
      });
      return { ...scene, voiceover: simplified };
    }
    return scene;
  });

  return { scenes: patched, changes };
}

// ─── CAROUSEL: simplify slide body + headline ─────────────────────────────────
export function patchCarouselClarity(
  slides: any[],
): { slides: any[]; changes: AppliedChange[] } {
  const changes: AppliedChange[] = [];

  const patched = slides.map((slide, i) => {
    const updated = { ...slide };

    const simBody = simplifyText(slide.body || '', 2);
    if (simBody !== slide.body && simBody.length > 5) {
      changes.push({ field: `slide[${i}].body`, before: slide.body, after: simBody, reason: 'Body text simplified for clarity' });
      updated.body = simBody;
    }

    const simHead = simplifyHeadline(slide.headline || '');
    if (simHead !== slide.headline && simHead.length > 3) {
      changes.push({ field: `slide[${i}].headline`, before: slide.headline, after: simHead, reason: 'Headline shortened for impact' });
      updated.headline = simHead;
    }

    return updated;
  });

  return { slides: patched, changes };
}

// ─── BANNER: simplify headline + subtext ──────────────────────────────────────
export function patchBannerClarity(
  banners: any[],
): { banners: any[]; changes: AppliedChange[] } {
  const changes: AppliedChange[] = [];

  const patched = banners.map((banner, i) => {
    const updated = { ...banner };

    const simHead = simplifyHeadline(banner.headline || '');
    if (simHead !== banner.headline && simHead.length > 3) {
      changes.push({ field: `banner[${i}].headline`, before: banner.headline, after: simHead, reason: 'Banner headline simplified' });
      updated.headline = simHead;
    }

    const simSub = simplifyText(banner.subtext || '', 1);
    if (simSub !== banner.subtext && simSub.length > 3) {
      changes.push({ field: `banner[${i}].subtext`, before: banner.subtext, after: simSub, reason: 'Banner subtext shortened' });
      updated.subtext = simSub;
    }

    return updated;
  });

  return { banners: patched, changes };
}
