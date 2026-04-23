// ─── Base Profile — Stable Business Identity ─────────────────────────────────
// Stored once, rarely changed. Provides product/brand context to every
// generation. Separate from UserContext (goal/platform/industry) and from
// Campaign Settings (angle/tone/persona per run).

export interface BaseProfile {
  businessType:     string;   // e.g. "ecommerce", "SaaS", "fitness"
  product:          string;   // what you're selling
  brandDescription: string;   // optional brand voice / positioning
}

const STORAGE_KEY = 'cos_base_profile';

const EMPTY: BaseProfile = { businessType: '', product: '', brandDescription: '' };

export function loadBaseProfile(): BaseProfile {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch { return EMPTY; }
}

export function saveBaseProfile(p: Partial<BaseProfile>): BaseProfile {
  const merged = { ...loadBaseProfile(), ...p };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
}

export function isBaseProfileSet(p: BaseProfile): boolean {
  return !!p.product.trim();
}

/** Inject base profile into concept generation as a context prefix. */
export function buildBaseContext(p: BaseProfile): string {
  if (!isBaseProfileSet(p)) return '';
  const lines: string[] = [];
  if (p.businessType) lines.push(`Business type: ${p.businessType}`);
  if (p.product)      lines.push(`Product: ${p.product}`);
  if (p.brandDescription) lines.push(`Brand: ${p.brandDescription}`);
  return lines.join('\n');
}
