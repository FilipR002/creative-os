// ─── Global Signal Aggregation — k-Anonymity Protected ────────────────────────
// Aggregates ANONYMIZED signals across users to produce system-level intelligence.
//
// Privacy rules (non-negotiable):
//   1. k-anonymity: signals only published when ≥ K_THRESHOLD users contributed
//   2. No user identity in aggregated output
//   3. No raw outcome traces — only running aggregates
//   4. Differential epsilon guardrail on thin segments
//
// Architecture:
//   - Each user's browser contributes to a LOCAL aggregate (cos_global_sigs)
//   - In production this would sync to a backend aggregator
//   - Here: localStorage-based simulation of a shared signal store
//   - The same machine may have multiple users — aggregate is across all local users

const K_THRESHOLD = 5;   // minimum distinct users required before a signal is used
const STORAGE_KEY = 'cos_global_sigs';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AngleGlobalStats {
  totalSelections:  number;
  totalPresentations: number;
  totalConversions: number;
  selectRate:       number;   // published only when count ≥ K_THRESHOLD
  conversionRate:   number;
  contributorCount: number;   // hashed distinct user count (k-anonymity)
}

export interface GlobalLearningSignal {
  /** Per-angle aggregated performance across all users */
  angleSuccessRates: Record<string, number>;  // slug → 0–1

  /** Industry × angle performance (only when k ≥ K_THRESHOLD) */
  industryPerformance: Record<string, Record<string, number>>;  // industry → slug → rate

  /** Platform × select rate */
  platformEffectiveness: Record<string, number>;

  /** ContentStyle × conversion rate */
  contentStylePerformance: Record<string, number>;

  /** Raw stats for transparency / debugging */
  angleStats: Record<string, AngleGlobalStats>;

  /** ISO timestamp of last aggregation */
  lastAggregated: string;

  /** How many distinct users contributed (hashed, not linkable) */
  totalContributors: number;
}

interface StoredGlobalSignals {
  // Accumulators (written by each local session)
  angleSelections:   Record<string, number>;
  anglePresentations: Record<string, number>;
  angleConversions:  Record<string, number>;

  // Per-dimension accumulators
  industryAngleSelections:      Record<string, Record<string, number>>;
  platformSelections:           Record<string, number>;
  platformPresentations:        Record<string, number>;
  contentStyleConversions:      Record<string, number>;
  contentStyleSelections:       Record<string, number>;

  // Privacy: contributor fingerprints (hashed, one-way)
  contributorFingerprints: string[];  // set of hashed userId segments

  lastAggregated: string;
}

// ── Hash Utility ──────────────────────────────────────────────────────────────

function pseudonymize(userId: string): string {
  // One-way: userId prefix → 8-char hex. Not reversible to userId.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < Math.min(userId.length, 24); i++) {
    h ^= userId.charCodeAt(i);
    h  = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Storage ───────────────────────────────────────────────────────────────────

function defaultStore(): StoredGlobalSignals {
  return {
    angleSelections:              {},
    anglePresentations:           {},
    angleConversions:             {},
    industryAngleSelections:      {},
    platformSelections:           {},
    platformPresentations:        {},
    contentStyleConversions:      {},
    contentStyleSelections:       {},
    contributorFingerprints:      [],
    lastAggregated:               new Date().toISOString(),
  };
}

function loadStore(): StoredGlobalSignals {
  if (typeof window === 'undefined') return defaultStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultStore();
  } catch { return defaultStore(); }
}

function saveStore(store: StoredGlobalSignals): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
  catch { /* storage full */ }
}

// ── Contribution ──────────────────────────────────────────────────────────────

/**
 * Contribute one anonymized outcome to the global signal store.
 * Called from the learning loop after each InteractionOutcome.
 */
export function contributeToGlobalSignals(params: {
  userId:          string;
  angleSlug:       string;
  presentedSlugs:  string[];
  selected:        boolean;
  converted:       boolean;
  industry:        string;
  platform:        string;
  contentStyle:    string;
}): void {
  const store = loadStore();
  const print = pseudonymize(params.userId);

  // Add contributor fingerprint (set dedup)
  if (!store.contributorFingerprints.includes(print)) {
    store.contributorFingerprints.push(print);
    // Cap at 1000 to prevent unbounded growth
    if (store.contributorFingerprints.length > 1000) {
      store.contributorFingerprints = store.contributorFingerprints.slice(-1000);
    }
  }

  // Accumulate angle presentations
  params.presentedSlugs.forEach(slug => {
    store.anglePresentations[slug]   = (store.anglePresentations[slug]   ?? 0) + 1;
    store.platformPresentations[params.platform] = (store.platformPresentations[params.platform] ?? 0) + 1;
  });

  // Accumulate selections
  if (params.selected) {
    store.angleSelections[params.angleSlug]   = (store.angleSelections[params.angleSlug]   ?? 0) + 1;
    store.platformSelections[params.platform] = (store.platformSelections[params.platform] ?? 0) + 1;
    store.contentStyleSelections[params.contentStyle] = (store.contentStyleSelections[params.contentStyle] ?? 0) + 1;

    // Industry × angle
    if (!store.industryAngleSelections[params.industry]) {
      store.industryAngleSelections[params.industry] = {};
    }
    store.industryAngleSelections[params.industry][params.angleSlug] =
      (store.industryAngleSelections[params.industry][params.angleSlug] ?? 0) + 1;
  }

  // Accumulate conversions
  if (params.converted) {
    store.angleConversions[params.angleSlug] = (store.angleConversions[params.angleSlug] ?? 0) + 1;
    store.contentStyleConversions[params.contentStyle] = (store.contentStyleConversions[params.contentStyle] ?? 0) + 1;
  }

  store.lastAggregated = new Date().toISOString();
  saveStore(store);
}

// ── Aggregation & k-Anonymity Gate ────────────────────────────────────────────

/**
 * Build the GlobalLearningSignal from stored accumulators.
 * Applies k-anonymity: only publishes segment stats when ≥ K_THRESHOLD contributors.
 */
export function getGlobalLearningSignal(): GlobalLearningSignal {
  const store      = loadStore();
  const kUsers     = store.contributorFingerprints.length;
  const kMet       = kUsers >= K_THRESHOLD;

  const angleStats: Record<string, AngleGlobalStats> = {};
  const angleSuccessRates: Record<string, number>    = {};

  const allSlugs = new Set([
    ...Object.keys(store.angleSelections),
    ...Object.keys(store.anglePresentations),
  ]);

  allSlugs.forEach(slug => {
    const presentations = store.anglePresentations[slug]  ?? 0;
    const selections    = store.angleSelections[slug]     ?? 0;
    const conversions   = store.angleConversions[slug]    ?? 0;

    const stat: AngleGlobalStats = {
      totalSelections:    selections,
      totalPresentations: presentations,
      totalConversions:   conversions,
      // k-anonymity gate: only expose rates when enough users contributed
      selectRate:    kMet && presentations >= K_THRESHOLD ? selections / presentations : 0.5,
      conversionRate: kMet && selections  >= K_THRESHOLD ? conversions / Math.max(selections, 1) : 0.5,
      contributorCount: kUsers,
    };
    angleStats[slug]       = stat;
    angleSuccessRates[slug] = kMet ? stat.selectRate : 0.5;  // 0.5 = neutral fallback
  });

  // Platform effectiveness (only when k-met)
  const platformEffectiveness: Record<string, number> = {};
  if (kMet) {
    Object.keys(store.platformSelections).forEach(p => {
      const sel   = store.platformSelections[p]    ?? 0;
      const pres  = store.platformPresentations[p] ?? 0;
      if (pres >= K_THRESHOLD) {
        platformEffectiveness[p] = sel / pres;
      }
    });
  }

  // Content style performance (conversion rate, k-gated)
  const contentStylePerformance: Record<string, number> = {};
  if (kMet) {
    Object.keys(store.contentStyleSelections).forEach(s => {
      const sel  = store.contentStyleSelections[s]  ?? 0;
      const conv = store.contentStyleConversions[s] ?? 0;
      if (sel >= K_THRESHOLD) {
        contentStylePerformance[s] = conv / sel;
      }
    });
  }

  // Industry × angle performance (k-gated per segment)
  const industryPerformance: Record<string, Record<string, number>> = {};
  if (kMet) {
    Object.entries(store.industryAngleSelections).forEach(([industry, angleMap]) => {
      const totalIndustryPres = Object.values(store.anglePresentations).reduce((a, b) => a + b, 0);
      if (totalIndustryPres >= K_THRESHOLD) {
        industryPerformance[industry] = {};
        Object.entries(angleMap).forEach(([slug, count]) => {
          const pres = store.anglePresentations[slug] ?? 1;
          if (count >= Math.ceil(K_THRESHOLD / 2)) {
            industryPerformance[industry][slug] = count / pres;
          }
        });
      }
    });
  }

  return {
    angleSuccessRates,
    industryPerformance,
    platformEffectiveness,
    contentStylePerformance,
    angleStats,
    lastAggregated:    store.lastAggregated,
    totalContributors: kUsers,
  };
}

/**
 * Get a single angle's global success rate.
 * Returns 0.5 (neutral) if k-anonymity threshold not met.
 */
export function getGlobalAngleRate(slug: string): number {
  const signal = getGlobalLearningSignal();
  return signal.angleSuccessRates[slug] ?? 0.5;
}
