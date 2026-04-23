// ─── User Style Profile — Frontend Store ─────────────────────────────────────
// localStorage-based profile that mirrors the backend UserStyleProfile.
// Updated locally on every signal; synced to backend in background.

const STORAGE_KEY = 'cos_style_profile';
const THRESHOLD   = 0.63;
const BASE_URL    = '';

export type SignalType =
  | 'shorter' | 'more_emotional' | 'add_urgency' | 'more_premium'
  | 'simpler'  | 'stronger_cta'  | 'bolder'      | 'conversational'
  | 'manual_shorten_hook' | 'manual_shorten_copy'
  | 'manual_lengthen_hook' | 'manual_lengthen_copy'
  | 'feedback_worked' | 'feedback_didnt_work';

export interface StyleProfile {
  hookShort:      number;
  toneEmotional:  number;
  tonePremium:    number;
  toneAggressive: number;
  toneCasual:     number;
  ctaUrgency:     number;
  ctaDirect:      number;
  copyShort:      number;
  totalSignals:   number;
  lastUpdated:    number;
}

const DEFAULT: StyleProfile = {
  hookShort: 0.5, toneEmotional: 0.5, tonePremium: 0.5,
  toneAggressive: 0.5, toneCasual: 0.5, ctaUrgency: 0.5,
  ctaDirect: 0.5, copyShort: 0.5, totalSignals: 0, lastUpdated: Date.now(),
};

// EWMA deltas per signal type
const RATES: Record<SignalType, Partial<Record<keyof StyleProfile, number>>> = {
  shorter:               { hookShort: 0.12, copyShort: 0.08 },
  more_emotional:        { toneEmotional: 0.15 },
  add_urgency:           { ctaUrgency: 0.15, toneAggressive: 0.08 },
  more_premium:          { tonePremium: 0.15 },
  simpler:               { toneCasual: 0.15, copyShort: 0.08 },
  stronger_cta:          { ctaDirect: 0.12, ctaUrgency: 0.08 },
  bolder:                { toneAggressive: 0.15 },
  conversational:        { toneCasual: 0.15 },
  manual_shorten_hook:   { hookShort: 0.08 },
  manual_shorten_copy:   { copyShort: 0.08 },
  manual_lengthen_hook:  { hookShort: -0.06 },
  manual_lengthen_copy:  { copyShort: -0.06 },
  feedback_worked:       { toneEmotional: 0.04, ctaUrgency: 0.04, hookShort: 0.02 },
  feedback_didnt_work:   { toneEmotional: -0.04, ctaUrgency: -0.04 },
};

function clamp(v: number) { return Math.max(0.1, Math.min(0.95, v)); }

export function loadProfile(): StyleProfile {
  if (typeof window === 'undefined') return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch { return { ...DEFAULT }; }
}

export function saveProfile(p: StyleProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function ingestSignal(signalType: SignalType, weight = 1.0): StyleProfile {
  const p    = loadProfile();
  const rates = RATES[signalType];
  if (!rates) return p;

  const next = { ...p, totalSignals: p.totalSignals + 1, lastUpdated: Date.now() };
  for (const [dim, rate] of Object.entries(rates) as [keyof StyleProfile, number][]) {
    if (typeof next[dim] !== 'number') continue;
    const current   = next[dim] as number;
    const effective = (rate as number) * weight;
    (next as any)[dim] = clamp(effective > 0
      ? current + effective * (1.0 - current)
      : current + effective * current,
    );
  }

  saveProfile(next);
  // Sync to backend in background (best-effort)
  fetch(`${BASE_URL}/api/style/signal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signalType, weight }),
  }).catch(() => undefined);

  return next;
}

export function resetProfile(): StyleProfile {
  const fresh = { ...DEFAULT, lastUpdated: Date.now() };
  saveProfile(fresh);
  return fresh;
}

// ── Derived values ────────────────────────────────────────────────────────────

export function buildStyleContext(p: StyleProfile): string {
  if (p.totalSignals < 3) return '';
  const hints: string[] = [];
  if (p.hookShort      > THRESHOLD) hints.push('HOOK: Short and punchy — keep hooks under 10 words');
  if (p.toneEmotional  > THRESHOLD) hints.push('TONE: Emotionally resonant — use feeling-driven language');
  if (p.tonePremium    > THRESHOLD) hints.push('TONE: Premium — sophisticated, elevated language');
  if (p.toneAggressive > THRESHOLD) hints.push('TONE: Bold and direct — confident, no hedging');
  if (p.toneCasual     > THRESHOLD) hints.push('TONE: Conversational — casual, natural speech patterns');
  if (p.ctaUrgency     > THRESHOLD) hints.push('CTA: Urgent — time-sensitive action triggers');
  if (p.ctaDirect      > THRESHOLD) hints.push('CTA: Direct command — strong verb, no soft language');
  if (p.copyShort      > THRESHOLD) hints.push('COPY: Concise — max 20 words per paragraph, cut filler');
  if (hints.length === 0) return '';
  return `PERSONALIZATION (apply to this output):\n${hints.map(h => `• ${h}`).join('\n')}`;
}

export function buildAdaptations(p: StyleProfile): string[] {
  if (p.totalSignals < 3) return [];
  const reasons: string[] = [];
  if (p.hookShort      > THRESHOLD) reasons.push('Hook kept short — you tend to shorten openings');
  if (p.toneEmotional  > THRESHOLD) reasons.push('Emotional language prioritized — based on your past refinements');
  if (p.tonePremium    > THRESHOLD) reasons.push('Premium tone applied — matches your brand style');
  if (p.toneAggressive > THRESHOLD) reasons.push('Bold, direct voice used — based on your edits');
  if (p.ctaUrgency     > THRESHOLD) reasons.push('Urgency built into CTA — reflects your CTA preferences');
  if (p.copyShort      > THRESHOLD) reasons.push('Copy kept concise — you prefer shorter paragraphs');
  return reasons;
}

export function dominantTone(p: StyleProfile): string {
  const tones = [
    { label: 'Emotional',      score: p.toneEmotional  },
    { label: 'Premium',        score: p.tonePremium    },
    { label: 'Bold & Direct',  score: p.toneAggressive },
    { label: 'Conversational', score: p.toneCasual     },
  ];
  const best = tones.reduce((a, b) => b.score > a.score ? b : a);
  return best.score > THRESHOLD ? best.label : 'Balanced';
}

// ── Stability signals (passive acceptance) ────────────────────────────────────
// Called when the user views the result for >15 s without editing a block.
// Reinforces whichever active preferences are confirmed by their inaction.
// Rate is deliberately weak (0.03) — passive signals should never dominate.

const STABILITY_RATE = 0.03;

export function ingestStabilitySignals(
  uneditedBlockIds: string[],
): StyleProfile {
  const p = loadProfile();
  if (p.totalSignals < 3) return p;   // need a baseline before passive learning

  const hasHook = uneditedBlockIds.some(id => id === 'hook' || id.endsWith('-hook'));
  const hasCopy = uneditedBlockIds.some(id => id === 'copy' || id.endsWith('-copy'));
  const hasCta  = uneditedBlockIds.some(id => id === 'cta'  || id.endsWith('-cta'));

  const next = { ...p, totalSignals: p.totalSignals + 1, lastUpdated: Date.now() };

  function reinforce(dim: keyof StyleProfile) {
    const v = next[dim] as number;
    if (typeof v !== 'number' || v <= THRESHOLD) return;
    (next as any)[dim] = clamp(v + STABILITY_RATE * (1 - v));
  }

  if (hasHook) reinforce('hookShort');
  if (hasCopy) {
    reinforce('copyShort');
    reinforce('toneEmotional');
    reinforce('tonePremium');
    reinforce('toneAggressive');
    reinforce('toneCasual');
  }
  if (hasCta) {
    reinforce('ctaUrgency');
    reinforce('ctaDirect');
  }

  saveProfile(next);
  return next;
}

// Derive a signal from a manual text edit
export function signalFromEdit(blockId: string, oldText: string, newText: string): SignalType | null {
  if (!oldText || !newText) return null;
  const ratio = newText.length / oldText.length;
  if (blockId === 'hook' || blockId.endsWith('-hook')) {
    if (ratio < 0.75) return 'manual_shorten_hook';
    if (ratio > 1.35) return 'manual_lengthen_hook';
  } else if (blockId === 'copy' || blockId.endsWith('-copy')) {
    if (ratio < 0.75) return 'manual_shorten_copy';
    if (ratio > 1.35) return 'manual_lengthen_copy';
  }
  return null;
}
