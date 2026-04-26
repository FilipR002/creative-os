// ─── Token costs per creative format ─────────────────────────────────────────
export const TOKEN_COST: Record<string, number> = {
  video:    40,
  carousel: 5,
  banner:   2,
};

// ─── Monthly token allowances per plan ────────────────────────────────────────
export const PLAN_TOKENS: Record<string, number> = {
  trial:   50,
  starter: 100,
  pro:     500,
  agency:  2000,
};

// ─── Top-up packages (tokens → price in cents) ───────────────────────────────
export const TOPUP_PACKAGES: Record<string, { tokens: number; priceCents: number; label: string }> = {
  topup_100:  { tokens: 100,  priceCents: 999,   label: '100 tokens — $9.99'  },
  topup_500:  { tokens: 500,  priceCents: 3999,  label: '500 tokens — $39.99' },
  topup_1000: { tokens: 1000, priceCents: 6999,  label: '1000 tokens — $69.99' },
};

// ─── Stripe price IDs per plan (set in .env) ─────────────────────────────────
// STRIPE_PRICE_STARTER=price_xxx
// STRIPE_PRICE_PRO=price_xxx
// STRIPE_PRICE_AGENCY=price_xxx
