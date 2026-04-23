/**
 * Structure Patcher — fixes missing scene/slide types.
 * Ensures proper narrative arc exists. Deterministic.
 */
import { AppliedChange } from '../improvement.types';

// ─── VIDEO structure: required scene types + default templates ────────────────
const REQUIRED_VIDEO_TYPES = ['hook', 'cta'] as const;

const SCENE_TEMPLATES: Record<string, (concept: any) => any> = {
  hook: (concept) => ({
    scene_number: 1,
    type: 'hook',
    duration_seconds: 3,
    voiceover: `What if ${concept?.rawJson?.core_message || 'everything changed'}? Here's what nobody tells you.`,
    on_screen_text: 'WAIT.',
    visual_prompt: 'Extreme close-up, dynamic handheld camera, high contrast lighting',
    emotion: 'curiosity',
    _injected: true,
  }),
  cta: (concept) => {
    const goal = concept?.goal || 'conversion';
    const ctas: Record<string, string> = {
      conversion: 'Start your free trial today',
      awareness:  'Learn more — it\'s free',
      engagement: 'Share your experience below',
    };
    return {
      type: 'cta',
      duration_seconds: 5,
      voiceover: `${concept?.rawJson?.offer || 'Start today'}. ${ctas[goal] || ctas.conversion}.`,
      on_screen_text: ctas[goal] || ctas.conversion,
      visual_prompt: 'Clean brand shot, logo center frame, warm lighting',
      emotion: 'confidence',
      _injected: true,
    };
  },
};

export function patchVideoStructure(
  scenes: any[], concept: any,
): { scenes: any[]; changes: AppliedChange[] } {
  const changes: AppliedChange[] = [];
  let patched = [...scenes];

  for (const requiredType of REQUIRED_VIDEO_TYPES) {
    const exists = patched.some(s => s.type === requiredType);
    if (!exists) {
      const newScene = SCENE_TEMPLATES[requiredType]?.(concept);
      if (newScene) {
        if (requiredType === 'hook') {
          patched = [newScene, ...patched];
        } else {
          patched = [...patched, newScene];
        }
        changes.push({
          field:  `scenes.${requiredType}`,
          before: '(missing)',
          after:  `scene type "${requiredType}" added`,
          reason: `Required scene type "${requiredType}" was absent — narrative arc was incomplete`,
        });
      }
    }
  }

  // Renumber scenes
  patched = patched.map((s, i) => ({ ...s, scene_number: i + 1 }));

  return { scenes: patched, changes };
}

// ─── CAROUSEL structure: required slide types ──────────────────────────────────
const REQUIRED_SLIDE_TYPES = ['cover', 'cta'] as const;

const SLIDE_TEMPLATES: Record<string, (concept: any) => any> = {
  cover: (concept) => ({
    slide_number: 1,
    type: 'cover',
    hook: concept?.rawJson?.core_message || 'You need to see this.',
    headline: concept?.coreMessage || 'The truth about this',
    body: concept?.rawJson?.audience
      ? `Created for ${concept.rawJson.audience}.`
      : 'Swipe to discover.',
    cta: 'Swipe to see →',
    _injected: true,
  }),
  cta: (concept) => ({
    type: 'cta',
    hook: 'Ready to get started?',
    headline: 'Take the next step',
    body: concept?.rawJson?.offer || 'Start today and see the difference.',
    cta: 'Start free today',
    _injected: true,
  }),
};

export function patchCarouselStructure(
  slides: any[], concept: any,
): { slides: any[]; changes: AppliedChange[] } {
  const changes: AppliedChange[] = [];
  let patched = [...slides];

  for (const requiredType of REQUIRED_SLIDE_TYPES) {
    const exists = patched.some(s => s.type === requiredType);
    if (!exists) {
      const newSlide = SLIDE_TEMPLATES[requiredType]?.(concept);
      if (newSlide) {
        if (requiredType === 'cover') {
          patched = [newSlide, ...patched];
        } else {
          patched = [...patched, newSlide];
        }
        changes.push({
          field:  `slides.${requiredType}`,
          before: '(missing)',
          after:  `slide type "${requiredType}" added`,
          reason: `Required slide type "${requiredType}" was absent`,
        });
      }
    }
  }

  // Renumber
  patched = patched.map((s, i) => ({ ...s, slide_number: i + 1 }));

  return { slides: patched, changes };
}
