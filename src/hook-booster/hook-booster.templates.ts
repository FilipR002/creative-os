// ─── 4.6 Hook Booster v1 — Templates ─────────────────────────────────────────
// 14 angles × 6 strategies = 84 base hook strings (video-optimised, ~12-20 words).
// Placeholders: {product} → product_context ?? 'this', {audience} → audience_context ?? 'people'.
// All other context (tension, benefit, specifics) baked directly into each template.

import { HookFormat, HookStrategy } from './hook-booster.types';

// ─── 84 Hook Templates ────────────────────────────────────────────────────────

export const HOOK_TEMPLATES: Record<string, Record<HookStrategy, string>> = {

  teach: {
    DIRECT_IMPACT:
      'The one thing about {product} most {audience} never learn — until it is too late.',
    CURIOSITY_GAP:
      'What {audience} are not being told about {product} — and why it changes everything.',
    SOCIAL_PROOF:
      'Thousands of {audience} swear by this {product} approach. Here is the insight they all share.',
    PROBLEM_SHOCK:
      'Stop using {product} this way. You are making the exact mistake that holds most {audience} back.',
    TRANSFORMATION:
      'Before this lesson: {audience} guess. After it: every decision about {product} clicks.',
    AUTHORITY_TRIGGER:
      'After years studying {product}, this is the single insight that separates thriving {audience} from the rest.',
  },

  show_off: {
    DIRECT_IMPACT:
      'This is what {product} actually looks like. No filter. No edits. Just real results for {audience}.',
    CURIOSITY_GAP:
      'You have not seen {product} used like this — and once {audience} do, nothing else compares.',
    SOCIAL_PROOF:
      '{audience} keep asking what delivers these results. The answer is {product}. Here is the proof.',
    PROBLEM_SHOCK:
      'Every {audience} who sees {product} for the first time says exactly the same thing.',
    TRANSFORMATION:
      'Side by side — before {product}, after {product}. The difference for {audience} is undeniable.',
    AUTHORITY_TRIGGER:
      'Industry-tested, {audience}-approved. This is {product} running at full capability.',
  },

  storytelling: {
    DIRECT_IMPACT:
      'I almost gave up on {product}. Then something changed that {audience} need to hear.',
    CURIOSITY_GAP:
      'Nobody warned me this would happen when I first brought {product} into my life.',
    SOCIAL_PROOF:
      'She was sceptical about {product}. Three months later, she is telling every {audience} she knows.',
    PROBLEM_SHOCK:
      'I wasted months before discovering that {product} could do this one thing for {audience}.',
    TRANSFORMATION:
      'From overwhelmed {audience} to confident and clear — here is how {product} changed everything for me.',
    AUTHORITY_TRIGGER:
      'After helping hundreds of {audience} with {product}, I have watched the same pattern unfold every time.',
  },

  tips_tricks: {
    DIRECT_IMPACT:
      'Three {product} moves that save {audience} hours every single week — without extra effort.',
    CURIOSITY_GAP:
      'The {product} trick most {audience} are completely sleeping on right now.',
    SOCIAL_PROOF:
      'Every high-performing {audience} uses this {product} method. Here is exactly how it works.',
    PROBLEM_SHOCK:
      'Most {audience} are using {product} the hard way and do not realise there is a better path.',
    TRANSFORMATION:
      'One small {product} habit. Completely different results for {audience} who commit to it.',
    AUTHORITY_TRIGGER:
      'After testing fifty-plus {product} methods, these three tips consistently outperform everything else for {audience}.',
  },

  spark_conversation: {
    DIRECT_IMPACT:
      'Hot take: {product} is the most underrated tool available to {audience} right now.',
    CURIOSITY_GAP:
      'What if everything {audience} believe about {product} is built on the wrong foundation?',
    SOCIAL_PROOF:
      '{audience} who have switched to {product} refuse to go back. The conversation needs to happen.',
    PROBLEM_SHOCK:
      'We need to talk about what {product} is actually doing to how {audience} think and operate.',
    TRANSFORMATION:
      'Six months with {product} shifted how I approach everything. This is my honest, unfiltered take.',
    AUTHORITY_TRIGGER:
      'I have evaluated every alternative to {product}. The conversation {audience} need to have is overdue.',
  },

  data_stats: {
    DIRECT_IMPACT:
      '87 percent of {audience} see measurable results with {product} in the first thirty days.',
    CURIOSITY_GAP:
      'The number behind {product} that {audience} almost never discuss — but absolutely should.',
    SOCIAL_PROOF:
      'Ten thousand-plus {audience} have validated this. The data on {product} is impossible to ignore.',
    PROBLEM_SHOCK:
      'The statistic about {product} that completely reframes how {audience} should be approaching this.',
    TRANSFORMATION:
      'Before {product}: these numbers. After {product}: a fundamentally different story for {audience}.',
    AUTHORITY_TRIGGER:
      'Three years of data. One clear conclusion: {product} outperforms everything else for {audience}, consistently.',
  },

  before_after: {
    DIRECT_IMPACT:
      'Before {product}: stuck, frustrated, spinning. After: {audience} who make the switch never look back.',
    CURIOSITY_GAP:
      'What {audience} look like ninety days before {product} versus ninety days after. The contrast is stark.',
    SOCIAL_PROOF:
      'Real {audience}. Real results. This is what {product} actually produces — no staging, no exaggeration.',
    PROBLEM_SHOCK:
      'This is what happens when {audience} avoid {product}. The difference speaks louder than any claim.',
    TRANSFORMATION:
      'The transformation is impossible to fake. Watch what {product} did for real {audience} over time.',
    AUTHORITY_TRIGGER:
      'We tracked {audience} for ninety days — with and without {product}. The results require no commentary.',
  },

  unpopular_opinion: {
    DIRECT_IMPACT:
      'Unpopular opinion: {product} is not for every {audience} — and that is precisely why it works.',
    CURIOSITY_GAP:
      'Everyone is recommending {product} to {audience}. They are all leaving out the most critical part.',
    SOCIAL_PROOF:
      'Most {audience} will push back on this take about {product}. The ones who do not are winning.',
    PROBLEM_SHOCK:
      'The {product} advice {audience} keep following is quietly holding them back. Somebody had to say it.',
    TRANSFORMATION:
      'I used to dismiss {product} entirely. Then I saw what {audience} who truly understood it were doing.',
    AUTHORITY_TRIGGER:
      'After years in this space I will say what nobody else will: {product} is misread by most {audience}.',
  },

  do_this_not_that: {
    DIRECT_IMPACT:
      'Stop doing this with {product}. Do this instead. {audience} who switch see results immediately.',
    CURIOSITY_GAP:
      'The {product} mistake versus the {product} method. Most {audience} have never seen the difference laid out.',
    SOCIAL_PROOF:
      '{audience} who get results with {product} do this. The ones still struggling do that.',
    PROBLEM_SHOCK:
      'You have been approaching {product} all wrong — and here is exactly what it is costing you.',
    TRANSFORMATION:
      'Wrong approach: {audience} grind with {product} and go nowhere. Right approach: this changes the outcome.',
    AUTHORITY_TRIGGER:
      'I have coached hundreds of {audience} through {product}. The gap always comes down to this one difference.',
  },

  proof: {
    DIRECT_IMPACT:
      'Real {audience}. Real results with {product}. This is what it actually looks like in practice.',
    CURIOSITY_GAP:
      'What are {audience} saying about {product} that never makes it into the official narrative?',
    SOCIAL_PROOF:
      'Thousands of {audience} have already made the move to {product}. Here is the story they all share.',
    PROBLEM_SHOCK:
      'The {product} review that stopped {audience} mid-scroll and made them reconsider everything.',
    TRANSFORMATION:
      'She did not believe {product} would deliver. Thirty days in, her results told a completely different story.',
    AUTHORITY_TRIGGER:
      'Verified by {audience}. Validated by experts. {product} does not need a sales pitch — it speaks for itself.',
  },

  curiosity: {
    DIRECT_IMPACT:
      'The {product} insight that most {audience} spend years searching for — hiding in plain sight.',
    CURIOSITY_GAP:
      'What happens when {audience} use {product} for thirty days straight? Nobody ever talks about day twenty.',
    SOCIAL_PROOF:
      'The {product} discovery that top-performing {audience} all stumbled upon. Now it is your turn.',
    PROBLEM_SHOCK:
      'The thing about {product} nobody tells {audience} — until they find out the hard, expensive way.',
    TRANSFORMATION:
      'One question reframed how an entire room of {audience} thought about {product} forever.',
    AUTHORITY_TRIGGER:
      'After years researching {product}, I found the one insight that {audience} consistently overlook.',
  },

  hot_take: {
    DIRECT_IMPACT:
      '{product} is splitting {audience} right now. Here is exactly where I stand — and why.',
    CURIOSITY_GAP:
      'The {product} debate {audience} are having in private but will not say out loud.',
    SOCIAL_PROOF:
      'Half of {audience} love {product}. Half want nothing to do with it. The truth is more interesting than both camps.',
    PROBLEM_SHOCK:
      '{product} is either the best call or the worst mistake {audience} make. There is genuinely no in-between.',
    TRANSFORMATION:
      'I reversed my position on {product}. Here is the one thing that made every {audience} around me rethink theirs.',
    AUTHORITY_TRIGGER:
      'I have seen {product} from every angle imaginable. My take: {audience} are having entirely the wrong conversation.',
  },

  problem_solution: {
    DIRECT_IMPACT:
      '{audience} who have struggled with this finally have a real, lasting answer. {product} solves it.',
    CURIOSITY_GAP:
      'Why do so many {audience} still carry this problem when {product} has already solved it?',
    SOCIAL_PROOF:
      '{audience} kept telling us this was their biggest obstacle. We built {product} around fixing it completely.',
    PROBLEM_SHOCK:
      'This is the exact problem draining {audience} every day. {product} is the solution they have been looking for.',
    TRANSFORMATION:
      'From the problem every {audience} knows too well, to the solution they did not see coming: {product}.',
    AUTHORITY_TRIGGER:
      'We identified the number-one pain point for {audience} and designed {product} specifically to eliminate it.',
  },

  mistake_avoidance: {
    DIRECT_IMPACT:
      'The {product} mistake that is quietly costing {audience} more than they realise, every single day.',
    CURIOSITY_GAP:
      'What {audience} do not know about {product} is precisely the thing that gets them every time.',
    SOCIAL_PROOF:
      'We have watched hundreds of {audience} make this exact {product} mistake. Here is how to avoid it.',
    PROBLEM_SHOCK:
      'If you are doing this with {product} right now, stop. {audience} who do not catch it pay a steep price.',
    TRANSFORMATION:
      'One {product} mistake reshaped everything. Here is what those {audience} learned so you do not have to.',
    AUTHORITY_TRIGGER:
      'The costly {product} errors I have watched {audience} repeat for years — and how to sidestep every single one.',
  },
};

// ─── Strategy Priority Per Angle (top-3 in order) ────────────────────────────
// Position 0 = primary fit → angle_fit score 1.00
// Position 1 = secondary fit → 0.80
// Position 2 = tertiary fit  → 0.65
// Any strategy not in this list → 0.45

export const STRATEGY_PRIORITY: Record<string, [HookStrategy, HookStrategy, HookStrategy]> = {
  teach:              ['AUTHORITY_TRIGGER',  'CURIOSITY_GAP',   'DIRECT_IMPACT'],
  show_off:           ['DIRECT_IMPACT',      'SOCIAL_PROOF',    'TRANSFORMATION'],
  storytelling:       ['TRANSFORMATION',     'DIRECT_IMPACT',   'SOCIAL_PROOF'],
  tips_tricks:        ['DIRECT_IMPACT',      'AUTHORITY_TRIGGER','CURIOSITY_GAP'],
  spark_conversation: ['PROBLEM_SHOCK',      'CURIOSITY_GAP',   'DIRECT_IMPACT'],
  data_stats:         ['AUTHORITY_TRIGGER',  'SOCIAL_PROOF',    'DIRECT_IMPACT'],
  before_after:       ['TRANSFORMATION',     'DIRECT_IMPACT',   'SOCIAL_PROOF'],
  unpopular_opinion:  ['DIRECT_IMPACT',      'PROBLEM_SHOCK',   'AUTHORITY_TRIGGER'],
  do_this_not_that:   ['DIRECT_IMPACT',      'PROBLEM_SHOCK',   'AUTHORITY_TRIGGER'],
  proof:              ['SOCIAL_PROOF',       'TRANSFORMATION',  'DIRECT_IMPACT'],
  curiosity:          ['CURIOSITY_GAP',      'DIRECT_IMPACT',   'AUTHORITY_TRIGGER'],
  hot_take:           ['PROBLEM_SHOCK',      'DIRECT_IMPACT',   'AUTHORITY_TRIGGER'],
  problem_solution:   ['PROBLEM_SHOCK',      'DIRECT_IMPACT',   'TRANSFORMATION'],
  mistake_avoidance:  ['PROBLEM_SHOCK',      'AUTHORITY_TRIGGER','CURIOSITY_GAP'],
};

// ─── Secondary Angle Reinforcers ──────────────────────────────────────────────
// Short phrase appended when secondary_angle is present.
// Secondary acts as TRUST / EMOTION reinforcer only — never drives the hook.

export const SECONDARY_REINFORCERS: Record<string, string> = {
  teach:              'backed by real, teachable insight',
  show_off:           'and the results speak for themselves',
  storytelling:       'a story worth paying attention to',
  tips_tricks:        'simple, effective, and endlessly repeatable',
  spark_conversation: 'and the conversation is just getting started',
  data_stats:         'the numbers do not lie',
  before_after:       'the difference is right there to see',
  unpopular_opinion:  'think differently or stay stuck',
  do_this_not_that:   'the right approach, every single time',
  proof:              'verified by thousands of real people',
  curiosity:          'once you see it, you cannot unsee it',
  hot_take:           'pick a side — neutrality is not an option',
  problem_solution:   'your solution has already arrived',
  mistake_avoidance:  'do not learn this the hard, expensive way',
};

// ─── Emotion Modifiers (prefix) ───────────────────────────────────────────────
// Applied BEFORE the base hook string.
// Keep each prefix short (2-5 words) — the hook itself carries the main weight.

export const EMOTION_MODIFIERS: Record<string, string> = {
  urgency:     'Right now — ',
  trust:       'The honest truth: ',
  curiosity:   'Nobody talks about this: ',
  fear:        'Fair warning — ',
  excitement:  'This changes everything: ',
  pain:        'It does not have to hurt — ',
  inspiration: 'Here is what is possible: ',
  confidence:  'Know this for certain — ',
};

// ─── Format Optimization Scores ───────────────────────────────────────────────
// Strategy × Format → how naturally the strategy fits the creative format.

export const FORMAT_STRATEGY_FIT: Record<HookStrategy, Record<HookFormat, number>> = {
  DIRECT_IMPACT:     { video: 0.90, carousel: 0.85, banner: 0.95 },
  CURIOSITY_GAP:     { video: 0.95, carousel: 0.90, banner: 0.70 },
  SOCIAL_PROOF:      { video: 0.85, carousel: 0.95, banner: 0.80 },
  PROBLEM_SHOCK:     { video: 0.90, carousel: 0.80, banner: 0.90 },
  TRANSFORMATION:    { video: 0.85, carousel: 0.95, banner: 0.75 },
  AUTHORITY_TRIGGER: { video: 0.90, carousel: 0.85, banner: 0.80 },
};

// ─── Emotion × Strategy Alignment Matrix ─────────────────────────────────────
// Used to compute emotional_alignment score (0–1).

export const EMOTION_STRATEGY_ALIGNMENT: Record<HookStrategy, Record<string, number>> = {
  DIRECT_IMPACT: {
    urgency: 0.95, excitement: 0.90, pain: 0.85, confidence: 0.80,
    fear: 0.75, inspiration: 0.75, trust: 0.70, curiosity: 0.65,
  },
  CURIOSITY_GAP: {
    curiosity: 0.95, fear: 0.80, excitement: 0.75, urgency: 0.70,
    inspiration: 0.75, trust: 0.70, pain: 0.65, confidence: 0.65,
  },
  SOCIAL_PROOF: {
    trust: 0.95, confidence: 0.85, inspiration: 0.80, excitement: 0.75,
    urgency: 0.70, fear: 0.65, curiosity: 0.65, pain: 0.60,
  },
  PROBLEM_SHOCK: {
    fear: 0.95, urgency: 0.90, pain: 0.90, curiosity: 0.75,
    confidence: 0.65, inspiration: 0.60, trust: 0.55, excitement: 0.50,
  },
  TRANSFORMATION: {
    inspiration: 0.95, excitement: 0.90, trust: 0.85, pain: 0.80,
    confidence: 0.80, curiosity: 0.70, urgency: 0.70, fear: 0.65,
  },
  AUTHORITY_TRIGGER: {
    trust: 0.95, confidence: 0.90, curiosity: 0.75, inspiration: 0.75,
    urgency: 0.70, fear: 0.70, pain: 0.65, excitement: 0.65,
  },
};

// ─── Word-Count Clarity Targets Per Format ───────────────────────────────────
// { ideal: [min, max], good: [min, max] }

export const FORMAT_WORD_TARGETS: Record<HookFormat, { ideal: [number, number]; good: [number, number] }> = {
  video:    { ideal: [12, 20], good: [8, 25]  },
  carousel: { ideal: [10, 18], good: [6, 23]  },
  banner:   { ideal: [4,  8],  good: [3, 10]  },
};
