'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { getSupabase } from '@/lib/supabase';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingStatus {
  plan:               string;
  tokensRemaining:    number;
  tokensMonthlyLimit: number;
  billingCycleEnd:    string;
  isTrialActive:      boolean;
  trialExpiresAt?:    string;
}

interface TokenCosts {
  costs:    Record<string, number>;
  plans:    Record<string, number>;
  packages: Record<string, { tokens: number; priceCents: number; label: string }>;
}

interface Transaction {
  id:          string;
  type:        string;
  amount:      number;
  balanceAfter: number;
  format?:     string;
  description?: string;
  createdAt:   string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function planBadgeColor(plan: string) {
  switch (plan) {
    case 'trial':   return 'bg-zinc-700 text-zinc-200';
    case 'starter': return 'bg-blue-900/60 text-blue-300';
    case 'pro':     return 'bg-purple-900/60 text-purple-300';
    case 'agency':  return 'bg-amber-900/60 text-amber-300';
    default:        return 'bg-zinc-700 text-zinc-300';
  }
}

function txTypeLabel(type: string) {
  switch (type) {
    case 'usage':       return '−';
    case 'topup':       return '+';
    case 'reset':       return '↺';
    case 'trial_grant': return '🎁';
    default:            return '•';
  }
}

function txTypeColor(type: string) {
  switch (type) {
    case 'usage':       return 'text-red-400';
    case 'topup':       return 'text-green-400';
    case 'reset':       return 'text-blue-400';
    case 'trial_grant': return 'text-purple-400';
    default:            return 'text-zinc-400';
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Plan cards data ──────────────────────────────────────────────────────────

const PLANS = [
  {
    key:      'starter',
    label:    'Starter',
    tokens:   100,
    price:    '$29/mo',
    features: ['100 tokens/month', '2 videos/mo', '20 carousels/mo', 'Basic analytics'],
    color:    'border-blue-700',
    badge:    'bg-blue-900/40 text-blue-300',
  },
  {
    key:      'pro',
    label:    'Pro',
    tokens:   500,
    price:    '$79/mo',
    features: ['500 tokens/month', '12 videos/mo', '100 carousels/mo', 'Advanced analytics', 'Priority support'],
    color:    'border-purple-700',
    badge:    'bg-purple-900/40 text-purple-300',
    popular:  true,
  },
  {
    key:      'agency',
    label:    'Agency',
    tokens:   2000,
    price:    '$199/mo',
    features: ['2,000 tokens/month', '50 videos/mo', '400 carousels/mo', 'White-label exports', 'Dedicated support'],
    color:    'border-amber-700',
    badge:    'bg-amber-900/40 text-amber-300',
  },
];

const TOPUP_PACKAGES = [
  { key: 'topup_100',  label: '100 tokens',  price: '$9.99',  tokens: 100  },
  { key: 'topup_500',  label: '500 tokens',  price: '$39.99', tokens: 500  },
  { key: 'topup_1000', label: '1,000 tokens', price: '$69.99', tokens: 1000 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [status,       setStatus]       = useState<BillingStatus | null>(null);
  const [costs,        setCosts]        = useState<TokenCosts | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // ── Fetch auth token + data ──────────────────────────────────────────────

  const authFetch = useCallback(async (path: string) => {
    const { data: { session } } = await getSupabase().auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [s, c, t] = await Promise.all([
          authFetch('/api/billing/status'),
          authFetch('/api/billing/costs'),
          authFetch('/api/billing/history'),
        ]);
        setStatus(s);
        setCosts(c);
        setTransactions(t);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load billing info');
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch]);

  // ── Checkout ─────────────────────────────────────────────────────────────

  const startCheckout = async (type: 'subscription' | 'topup', key: string) => {
    setCheckoutLoading(key);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      const origin = window.location.origin;
      const body: Record<string, string> = {
        type,
        successUrl: `${origin}/billing?success=1`,
        cancelUrl:  `${origin}/billing?cancelled=1`,
      };
      if (type === 'subscription') body.plan    = key;
      if (type === 'topup')        body.package = key;

      const res = await fetch(`${BASE}/api/billing/checkout`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError('Checkout URL not received from server');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setCheckoutLoading(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const usedPct = status
    ? Math.round(((status.tokensMonthlyLimit - status.tokensRemaining) / (status.tokensMonthlyLimit || 1)) * 100)
    : 0;

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const justSucceeded = searchParams?.get('success') === '1';
  const justCancelled = searchParams?.get('cancelled') === '1';

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-10">

          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing & Tokens</h1>
            <p className="text-zinc-400 mt-1">Manage your subscription and creative token balance.</p>
          </div>

          {/* Banners */}
          {justSucceeded && (
            <div className="bg-green-900/40 border border-green-700 rounded-xl p-4 text-green-300">
              ✓ Payment successful! Your tokens have been credited.
            </div>
          )}
          {justCancelled && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-zinc-400">
              Checkout cancelled — no charges were made.
            </div>
          )}
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-zinc-500 py-20 text-center">Loading billing info…</div>
          ) : (
            <>
              {/* ── Current plan + token balance ─────────────────────────── */}
              {status && (
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Plan */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest">Current Plan</p>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold capitalize`}>{status.plan}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planBadgeColor(status.plan)}`}>
                        {status.isTrialActive ? 'Trial' : 'Active'}
                      </span>
                    </div>
                    {status.isTrialActive && status.trialExpiresAt && (
                      <p className="text-xs text-amber-400">
                        Trial ends {fmtDate(status.trialExpiresAt)}
                      </p>
                    )}
                    {!status.isTrialActive && (
                      <p className="text-xs text-zinc-500">
                        Renews {fmtDate(status.billingCycleEnd)}
                      </p>
                    )}
                  </div>

                  {/* Token balance */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest">Token Balance</p>
                    <p className="text-4xl font-bold tabular-nums">
                      {status.tokensRemaining.toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-500">
                      of {status.tokensMonthlyLimit.toLocaleString()} monthly tokens
                    </p>
                    {/* Usage bar */}
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all"
                        style={{ width: `${Math.min(usedPct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-600">{usedPct}% used this cycle</p>
                  </div>

                  {/* Token costs */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest">Token Costs</p>
                    <div className="space-y-2 text-sm">
                      {costs && Object.entries(costs.costs).map(([fmt, cost]) => (
                        <div key={fmt} className="flex justify-between">
                          <span className="capitalize text-zinc-300">{fmt}</span>
                          <span className="text-zinc-400 font-mono">{cost} tokens</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Upgrade plans ────────────────────────────────────────── */}
              <section>
                <h2 className="text-xl font-semibold mb-4">Subscription Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {PLANS.map(plan => {
                    const isCurrent = status?.plan === plan.key;
                    return (
                      <div
                        key={plan.key}
                        className={`relative bg-zinc-900 border rounded-2xl p-6 flex flex-col gap-4 transition-all
                          ${plan.popular ? 'border-purple-600 shadow-purple-900/30 shadow-lg' : 'border-zinc-800'}
                        `}
                      >
                        {plan.popular && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs px-3 py-0.5 rounded-full font-semibold">
                            Most Popular
                          </span>
                        )}
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${plan.badge}`}>
                            {plan.label}
                          </span>
                          {isCurrent && (
                            <span className="text-xs text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="text-3xl font-bold">{plan.price}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{plan.tokens.toLocaleString()} tokens / month</p>
                        </div>

                        <ul className="space-y-1.5 text-sm text-zinc-400 flex-1">
                          {plan.features.map(f => (
                            <li key={f} className="flex gap-2 items-start">
                              <span className="text-green-400 mt-0.5">✓</span>{f}
                            </li>
                          ))}
                        </ul>

                        <button
                          onClick={() => startCheckout('subscription', plan.key)}
                          disabled={isCurrent || checkoutLoading === plan.key}
                          className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all
                            ${isCurrent
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              : plan.popular
                                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                            }
                          `}
                        >
                          {checkoutLoading === plan.key ? 'Opening…' : isCurrent ? 'Current Plan' : `Upgrade to ${plan.label}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── Top-up packages ──────────────────────────────────────── */}
              <section>
                <h2 className="text-xl font-semibold mb-1">Token Top-Ups</h2>
                <p className="text-zinc-500 text-sm mb-4">Need extra tokens? Purchase a one-time top-up, no subscription required.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {TOPUP_PACKAGES.map(pkg => (
                    <div key={pkg.key} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{pkg.price}</span>
                        <span className="text-zinc-500 text-sm">one-time</span>
                      </div>
                      <p className="text-zinc-300 font-medium">{pkg.label}</p>
                      <p className="text-xs text-zinc-500">{pkg.tokens.toLocaleString()} tokens added instantly</p>
                      <button
                        onClick={() => startCheckout('topup', pkg.key)}
                        disabled={checkoutLoading === pkg.key}
                        className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-semibold transition-all"
                      >
                        {checkoutLoading === pkg.key ? 'Opening…' : 'Buy Tokens'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Transaction history ──────────────────────────────────── */}
              <section>
                <h2 className="text-xl font-semibold mb-4">Token History</h2>
                {transactions.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No transactions yet.</p>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 text-left text-zinc-500 text-xs uppercase tracking-wider">
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Type</th>
                          <th className="px-5 py-3">Format</th>
                          <th className="px-5 py-3">Description</th>
                          <th className="px-5 py-3 text-right">Amount</th>
                          <th className="px-5 py-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(tx => (
                          <tr key={tx.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">{fmtDate(tx.createdAt)}</td>
                            <td className="px-5 py-3">
                              <span className={`capitalize font-medium ${txTypeColor(tx.type)}`}>
                                {txTypeLabel(tx.type)} {tx.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-zinc-400 capitalize">{tx.format ?? '—'}</td>
                            <td className="px-5 py-3 text-zinc-500 max-w-xs truncate">{tx.description ?? '—'}</td>
                            <td className={`px-5 py-3 text-right font-mono font-semibold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {tx.amount > 0 ? '+' : ''}{tx.amount}
                            </td>
                            <td className="px-5 py-3 text-right font-mono text-zinc-300">{tx.balanceAfter}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
