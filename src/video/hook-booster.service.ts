/**
 * Hook Booster V2 — deterministic, rule-based.
 * Optimises ONLY scene.type === "hook" (first 3 seconds).
 * Zero LLM calls. Zero randomness. Fully reproducible.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateHookScore } from '../scoring/scoring.utils';

// ─── Weakness detection thresholds ────────────────────────────────────────────
const HOOK_SCORE_THRESHOLD = 0.60;   // below this → boost
const AUTO_BOOST_CTR_THRESHOLD = 0.60; // below this → auto-boost after generate

// ─── Curiosity gap openers ────────────────────────────────────────────────────
const CURIOSITY_OPENERS = [
  'Nobody talks about THIS — but it changes everything.',
  'The truth about [TOPIC] nobody wants to admit.',
  'Most people get [TOPIC] completely wrong.',
  'This one mistake is costing [AUDIENCE] everything.',
  'What if everything you know about [TOPIC] is wrong?',
  'Stop. Before you scroll — you need to see this.',
];

// ─── Emotion-trigger openers (keyed by emotion) ───────────────────────────────
const EMOTION_OPENERS: Record<string, string[]> = {
  frustration: [
    'Tired of [PAIN]? Here\'s what actually works.',
    'I was frustrated too — until I found THIS.',
    'STOP wasting time on [PAIN]. Do this instead.',
  ],
  hope: [
    'What if getting [OUTCOME] was simpler than you think?',
    'This changed everything for [AUDIENCE] — it can for you too.',
    '[OUTCOME] is closer than you think. Here\'s proof.',
  ],
  fear: [
    'Warning: [AUDIENCE] are making this critical mistake.',
    'This is what happens if you ignore [TOPIC].',
    'You\'re losing [OUTCOME] every day you wait.',
  ],
  excitement: [
    'This just changed everything about [TOPIC].',
    'The [TOPIC] secret top [AUDIENCE] don\'t share.',
    'I can\'t believe this actually works.',
  ],
  curiosity: [
    'Nobody tells you THIS about [TOPIC]…',
    'The [TOPIC] trick that changes everything.',
    'Wait — is this actually possible?',
  ],
  confidence: [
    'The [AUDIENCE] who [OUTCOME] all do THIS one thing.',
    'This is exactly how [OUTCOME] happens.',
    'Ready to actually [OUTCOME]? Start here.',
  ],
};

const DEFAULT_EMOTION_OPENERS = EMOTION_OPENERS.curiosity;

// ─── Angle-specific hook templates ────────────────────────────────────────────
const ANGLE_HOOKS: Record<string, string> = {
  before_after:     'I used to [PAIN]. Now [OUTCOME]. Here\'s what changed.',
  storytelling:     '[CHARACTER] almost gave up. Then this happened.',
  teach:            'Most [AUDIENCE] don\'t know THIS — but they should.',
  tips_tricks:      'The [TOPIC] hack that changed everything for me.',
  spark_conversation: 'Unpopular opinion: [BOLD_CLAIM]. Agree?',
  data_stats:       '[STAT]% of [AUDIENCE] get [TOPIC] wrong. Are you one of them?',
  before_after_alt: '[TIME] ago I couldn\'t [PAIN]. Today? [OUTCOME].',
  do_this_not_that: 'STOP doing [WRONG]. Do THIS instead.',
  unpopular_opinion:'Everyone says [COMMON_BELIEF]. They\'re wrong.',
  show_off:         'This is what [OUTCOME] actually looks like.',
};

// ─── Pattern interrupt on-screen text ─────────────────────────────────────────
const PATTERN_INTERRUPTS = [
  'WAIT.', 'STOP.', 'THIS.', 'ACTUALLY?', 'NO WAY.', 'REAL TALK.',
  'TRUTH:', 'NOBODY SAYS:', 'WAIT—', 'HERE IT IS.',
];

// ─── Visual intensity boosters ─────────────────────────────────────────────────
const VISUAL_BOOSTERS = [
  'extreme close-up, ',
  'dynamic handheld camera, ',
  'fast whip-pan to ',
  'dramatic push-in on ',
  'split-screen contrast showing ',
];

// ─── Weakness detection ────────────────────────────────────────────────────────
interface WeaknessReport {
  hasCuriosityGap: boolean;
  hasEmotionTrigger: boolean;
  hasPatternInterrupt: boolean;
  isGenericOpening: boolean;
  hookScore: number;
  weaknesses: string[];
}

const CURIOSITY_SIGNALS = ['nobody', 'truth', 'secret', 'mistake', 'warning', 'stop', 'wait', 'this one', 'don\'t', 'never', 'why', '?', '…', '...'];
const EMOTION_WORDS     = ['tired', 'frustrated', 'scared', 'excited', 'love', 'hate', 'fear', 'hope', 'dream', 'struggle', 'confident', 'proud', 'sick', 'desperate', 'amazed', 'inspired'];
const PATTERN_SIGNALS   = ['wait', 'stop', 'listen', 'actually', 'truth', 'real', 'fact', '!', '?'];
const GENERIC_OPENERS   = ['this product', 'we help', 'our solution', 'introducing', 'welcome to', 'hi, i\'m', 'hello', 'today we', 'in this video'];

function detectWeaknesses(voiceover: string, onScreenText: string): WeaknessReport {
  const combined = (voiceover + ' ' + onScreenText).toLowerCase();

  const hasCuriosityGap     = CURIOSITY_SIGNALS.some(s => combined.includes(s));
  const hasEmotionTrigger   = EMOTION_WORDS.some(w => combined.includes(w));
  const hasPatternInterrupt = PATTERN_SIGNALS.some(s => combined.includes(s));
  const isGenericOpening    = GENERIC_OPENERS.some(g => combined.startsWith(g));

  const weaknesses: string[] = [];
  if (!hasCuriosityGap)     weaknesses.push('No curiosity gap — audience has no reason to keep watching');
  if (!hasEmotionTrigger)   weaknesses.push('No emotional trigger — hook is emotionally flat');
  if (!hasPatternInterrupt) weaknesses.push('No pattern interrupt — nothing stops the scroll');
  if (isGenericOpening)     weaknesses.push('Generic opening — sounds like every other ad');

  const hookScore = calculateHookScore(voiceover + ' ' + onScreenText);

  return { hasCuriosityGap, hasEmotionTrigger, hasPatternInterrupt, isGenericOpening, hookScore, weaknesses };
}

// ─── Template variable injection ───────────────────────────────────────────────
function injectVars(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\[TOPIC\]/g,     vars.topic     || vars.coreMessage?.split(' ').slice(0, 3).join(' ') || 'this')
    .replace(/\[AUDIENCE\]/g,  vars.audience  || 'people')
    .replace(/\[PAIN\]/g,      vars.pain      || 'struggling')
    .replace(/\[OUTCOME\]/g,   vars.outcome   || 'results')
    .replace(/\[CHARACTER\]/g, vars.character || 'She')
    .replace(/\[STAT\]/g,      vars.stat      || '73')
    .replace(/\[BOLD_CLAIM\]/g,vars.boldClaim || vars.coreMessage || 'this works')
    .replace(/\[WRONG\]/g,     vars.wrong     || 'that')
    .replace(/\[TIME\]/g,      vars.time      || '6 months')
    .replace(/\[COMMON_BELIEF\]/g, vars.commonBelief || 'it\'s complicated');
}

// ─── Main boost function ───────────────────────────────────────────────────────
function buildOptimizedHook(
  originalScene: any,
  concept: any,
  angleSlug: string,
  weakness: WeaknessReport,
): {
  voiceover: string;
  on_screen_text: string;
  visual_prompt: string;
  improvement_reason: string;
} {
  const raw = concept?.rawJson || concept || {};
  const emotion = (raw.emotion || concept?.emotion || 'curiosity').toLowerCase();

  const vars: Record<string, string> = {
    topic:       raw.core_message?.split(' ').slice(0, 4).join(' ') || 'this',
    audience:    raw.audience   || concept?.audience || 'people',
    pain:        raw.pain       || 'struggling',
    outcome:     raw.offer      || concept?.offer || 'better results',
    coreMessage: raw.core_message || concept?.coreMessage || '',
    boldClaim:   raw.core_message || '',
    commonBelief:`you need to spend hours to see results`,
    wrong:       'the old way',
    time:        '6 months',
  };

  // ── Pick best voiceover template ──────────────────────────────────────────
  let voiceover = originalScene.voiceover;
  let improvementReason = '';

  if (weakness.isGenericOpening || !weakness.hasCuriosityGap) {
    // Angle-specific hook if available
    const angleTemplate = ANGLE_HOOKS[angleSlug];
    if (angleTemplate) {
      voiceover = injectVars(angleTemplate, vars);
      improvementReason = `Applied ${angleSlug} angle hook pattern to eliminate generic opening.`;
    } else {
      const openers = EMOTION_OPENERS[emotion] || DEFAULT_EMOTION_OPENERS;
      voiceover = injectVars(openers[0], vars);
      improvementReason = `Added ${emotion}-driven curiosity opener to replace generic phrasing.`;
    }
  } else if (!weakness.hasEmotionTrigger) {
    const openers = EMOTION_OPENERS[emotion] || DEFAULT_EMOTION_OPENERS;
    voiceover = injectVars(openers[0], vars);
    improvementReason = `Added emotional trigger (${emotion}) — original hook was emotionally flat.`;
  } else if (!weakness.hasPatternInterrupt) {
    voiceover = injectVars(CURIOSITY_OPENERS[0], vars);
    improvementReason = 'Added curiosity gap opener — original lacked a scroll-stopping statement.';
  }

  // Clamp voiceover to 2 sentences
  const sentences = voiceover.split(/[.!?]+/).filter(Boolean);
  if (sentences.length > 2) voiceover = sentences.slice(0, 2).join('. ') + '.';

  // ── On-screen text (max 6 words, must contain pattern interrupt) ──────────
  let onScreenText = originalScene.on_screen_text;
  if (!weakness.hasPatternInterrupt || weakness.isGenericOpening) {
    const interrupt = PATTERN_INTERRUPTS[Math.floor(weakness.hookScore * PATTERN_INTERRUPTS.length) % PATTERN_INTERRUPTS.length];
    const keyWord = vars.topic.split(' ')[0].toUpperCase();
    onScreenText = `${interrupt} ${keyWord}?`.slice(0, 30);
  }

  // ── Visual prompt — add intensity booster ────────────────────────────────
  const booster = VISUAL_BOOSTERS[Math.floor(weakness.hookScore * VISUAL_BOOSTERS.length) % VISUAL_BOOSTERS.length];
  const visual = originalScene.visual_prompt || '';
  const visualPrompt = visual.startsWith(booster)
    ? visual
    : booster + visual.charAt(0).toLowerCase() + visual.slice(1);

  return {
    voiceover:          voiceover.trim(),
    on_screen_text:     onScreenText.trim(),
    visual_prompt:      visualPrompt.trim(),
    improvement_reason: improvementReason || 'Hook optimised for scroll-stop performance.',
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────
@Injectable()
export class HookBoosterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Analyse a hook and return weakness report without modifying anything.
   */
  analyseHook(scene: any): WeaknessReport {
    return detectWeaknesses(scene.voiceover || '', scene.on_screen_text || '');
  }

  /**
   * Run hook booster on a creative by ID.
   * Modifies the first scene in-place (DB update).
   * Returns the boosted scene + analysis.
   */
  async boostCreative(creativeId: string) {
    const creative = await this.prisma.creative.findUnique({
      where:   { id: creativeId },
      include: { angle: true, concept: true },
    });
    if (!creative) throw new NotFoundException(`Creative ${creativeId} not found`);
    if (creative.format !== 'VIDEO') {
      return { skipped: true, reason: 'Hook booster only applies to VIDEO format.' };
    }

    const content = creative.content as any;
    const scenes: any[] = content?.scenes || [];
    const hookScene = scenes.find(s => s.type === 'hook') || scenes[0];

    if (!hookScene) {
      return { skipped: true, reason: 'No hook scene found in this video.' };
    }

    // Analyse weakness
    const weakness = detectWeaknesses(hookScene.voiceover || '', hookScene.on_screen_text || '');

    // If already strong — skip
    if (weakness.hookScore >= HOOK_SCORE_THRESHOLD && weakness.weaknesses.length === 0) {
      return {
        skipped: true,
        reason:  `Hook already strong (score: ${weakness.hookScore.toFixed(2)}). No boost needed.`,
        hookScore: weakness.hookScore,
      };
    }

    // Build optimised hook
    const optimized = buildOptimizedHook(
      hookScene,
      creative.concept,
      creative.angle?.slug || 'teach',
      weakness,
    );

    // Patch only the hook scene — keep all other fields
    const boostedHookScene = {
      ...hookScene,
      voiceover:      optimized.voiceover,
      on_screen_text: optimized.on_screen_text,
      visual_prompt:  optimized.visual_prompt,
      duration_seconds: Math.min(hookScene.duration_seconds || 5, 3), // clamp hook to 3s
      _boosted: true,
    };

    // Replace hook in scene list (by index, not by type, to preserve order)
    const hookIdx = scenes.findIndex(s => s.type === 'hook');
    const boostedScenes = [...scenes];
    boostedScenes[hookIdx >= 0 ? hookIdx : 0] = boostedHookScene;

    // Persist back to DB
    await this.prisma.creative.update({
      where: { id: creativeId },
      data:  { content: { ...content, scenes: boostedScenes } },
    });

    return {
      creativeId,
      boosted:    true,
      hookScore: {
        before: weakness.hookScore,
        after:  calculateHookScore(optimized.voiceover + ' ' + optimized.on_screen_text),
      },
      weaknessesFixed: weakness.weaknesses,
      optimizedHook: {
        voiceover:        optimized.voiceover,
        on_screen_text:   optimized.on_screen_text,
        visual_prompt:    optimized.visual_prompt,
        improvement_reason: optimized.improvement_reason,
      },
    };
  }

  /**
   * Called internally after video generation.
   * Only boosts if hookScore < AUTO_BOOST_CTR_THRESHOLD.
   */
  async autoBoostIfWeak(creativeId: string, scenes: any[], concept: any, angleSlug: string): Promise<any[]> {
    const hookScene = scenes.find(s => s.type === 'hook') || scenes[0];
    if (!hookScene) return scenes;

    const weakness = detectWeaknesses(hookScene.voiceover || '', hookScene.on_screen_text || '');
    if (weakness.hookScore >= AUTO_BOOST_CTR_THRESHOLD) return scenes; // hook is fine

    const optimized = buildOptimizedHook(hookScene, concept, angleSlug, weakness);

    const hookIdx = scenes.findIndex(s => s.type === 'hook');
    const boosted = [...scenes];
    boosted[hookIdx >= 0 ? hookIdx : 0] = {
      ...hookScene,
      voiceover:      optimized.voiceover,
      on_screen_text: optimized.on_screen_text,
      visual_prompt:  optimized.visual_prompt,
      duration_seconds: Math.min(hookScene.duration_seconds || 5, 3),
      _boosted: true,
      _boost_reason: optimized.improvement_reason,
    };

    return boosted;
  }
}
