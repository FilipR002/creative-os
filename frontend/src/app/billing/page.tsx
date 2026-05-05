'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CreditCard, Zap, TrendingUp, Clock, CheckCircle2, Loader2, AlertCircle, XCircle } from 'lucide-react';

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
  id:           string;
  type:         string;
  amount:       number;
  balanceAfter: number;
  format?:      string;
  description?: string;
  createdAt:    string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    key:      'starter',
    label:    'Starter',
    price:    '$29',
    period:   '/mo',
    tokens:   100,
    features: ['100 tokens / month', '2 videos / month', '20 carousels / month', 'Basic analytics'],
    accent:   'border-blue-500/30',
    badge:    'secondary' as const,
  },
  {
    key:      'pro',
    label:    'Pro',
    price:    '$79',
    period:   '/mo',
    tokens:   500,
    features: ['500 tokens / month', '12 videos / month', '100 carousels / month', 'Advanced analytics', 'Priority support'],
    accent:   'border-primary/40',
    badge:    'orange' as const,
    popular:  true,
  },
  {
    key:      'agency',
    label:    'Agency',
    price:    '$199',
    period:   '/mo',
    tokens:   2000,
    features: ['2,000 tokens / month', '50 videos / month', '400 carousels / month', 'White-label exports', 'Dedicated support'],
    accent:   'border-amber-500/30',
    badge:    'warning' as const,
  },
];

const TOPUP_PACKAGES = [
  { key: 'topup_100',  label: '100 tokens',   price: '$9.99',  tokens: 100  },
  { key: 'topup_500',  label: '500 tokens',   price: '$39.99', tokens: 500  },
  { key: 'topup_1000', label: '1,000 tokens', price: '$69.99', tokens: 1000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function txTypeColor(type: string) {
  switch (type) {
    case 'usage':       return 'text-red-400';
    case 'topup':       return 'text-green-400';
    case 'reset':       return 'text-blue-400';
    case 'trial_grant': return 'text-purple-400';
    default:            return 'text-muted-foreground';
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [status,          setStatus]          = useState<BillingStatus | null>(null);
  const [costs,           setCosts]           = useState<TokenCosts | null>(null);
  const [transactions,    setTransactions]    = useState<Transaction[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

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
        setStatus(s); setCosts(c); setTransactions(t);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load billing info');
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch]);

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
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

  const usedPct = status
    ? Math.round(((status.tokensMonthlyLimit - status.tokensRemaining) / (status.tokensMonthlyLimit || 1)) * 100)
    : 0;

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const justSucceeded = searchParams?.get('success') === '1';
  const justCancelled = searchParams?.get('cancelled') === '1';

  return (
    <div className="mx-auto max-w-5xl px-8 py-8 space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing & Tokens</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your subscription and creative token balance.</p>
      </div>

      {/* ── Banners ─────────────────────────────────────────────────────────── */}
      {justSucceeded && (
        <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Payment successful! Your tokens have been credited.
        </div>
      )}
      {justCancelled && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
          <XCircle className="h-4 w-4 shrink-0" />
          Checkout cancelled — no charges were made.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading billing info…
        </div>
      ) : (
        <>
          {/* ── Status cards ──────────────────────────────────────────────── */}
          {status && (
            <div className="grid grid-cols-3 gap-4">
              {/* Current plan */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">Current Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold capitalize text-foreground">{status.plan}</span>
                    <Badge variant={status.isTrialActive ? 'warning' : 'success'}>
                      {status.isTrialActive ? 'Trial' : 'Active'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {status.isTrialActive && status.trialExpiresAt
                      ? `Trial ends ${fmtDate(status.trialExpiresAt)}`
                      : `Renews ${fmtDate(status.billingCycleEnd)}`
                    }
                  </div>
                </CardContent>
              </Card>

              {/* Token balance */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">Token Balance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-3xl font-bold tabular-nums text-primary">
                    {status.tokensRemaining.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">of {status.tokensMonthlyLimit.toLocaleString()} / month</p>
                  <div className="h-1.5 w-full rounded-full bg-secondary">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100 - usedPct, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{usedPct}% used this cycle</p>
                </CardContent>
              </Card>

              {/* Token costs */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">Token Costs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {costs && Object.entries(costs.costs).map(([fmt, cost]) => (
                      <div key={fmt} className="flex justify-between text-xs">
                        <span className="capitalize text-foreground">{fmt}</span>
                        <span className="font-mono text-muted-foreground">{cost} tokens</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Subscription plans ─────────────────────────────────────────── */}
          <section>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Subscription Plans</p>
            <div className="grid grid-cols-3 gap-4">
              {PLANS.map(plan => {
                const isCurrent = status?.plan === plan.key;
                return (
                  <Card
                    key={plan.key}
                    className={cn('relative flex flex-col transition-all', plan.accent, plan.popular && 'bg-primary/5')}
                  >
                    {plan.popular && (
                      <div className="absolute -top-px inset-x-4 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
                    )}
                    <CardContent className="flex flex-col gap-4 p-6 flex-1">
                      <div className="flex items-center justify-between">
                        <Badge variant={plan.badge}>{plan.label}</Badge>
                        {plan.popular && <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Popular</span>}
                        {isCurrent && <Badge variant="outline">Current</Badge>}
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                          <span className="text-sm text-muted-foreground">{plan.period}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{plan.tokens.toLocaleString()} tokens / month</p>
                      </div>
                      <ul className="flex-1 space-y-1.5">
                        {plan.features.map(f => (
                          <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={() => startCheckout('subscription', plan.key)}
                        disabled={isCurrent || checkoutLoading === plan.key}
                        variant={isCurrent ? 'secondary' : plan.popular ? 'default' : 'outline'}
                        className="w-full"
                      >
                        {checkoutLoading === plan.key
                          ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Opening…</>
                          : isCurrent ? 'Current Plan' : `Upgrade to ${plan.label}`
                        }
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* ── Token top-ups ──────────────────────────────────────────────── */}
          <section>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Token Top-Ups</p>
            <p className="mb-3 text-xs text-muted-foreground">Need extra tokens? Purchase a one-time top-up, no subscription required.</p>
            <div className="grid grid-cols-3 gap-4">
              {TOPUP_PACKAGES.map(pkg => (
                <Card key={pkg.key}>
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-foreground">{pkg.price}</span>
                      <span className="text-xs text-muted-foreground">one-time</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{pkg.label}</p>
                      <p className="text-xs text-muted-foreground">{pkg.tokens.toLocaleString()} tokens added instantly</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => startCheckout('topup', pkg.key)}
                      disabled={checkoutLoading === pkg.key}
                      className="w-full"
                    >
                      {checkoutLoading === pkg.key
                        ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Opening…</>
                        : 'Buy Tokens'
                      }
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ── Transaction history ────────────────────────────────────────── */}
          <section>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Token History</p>
            {transactions.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        {['Date', 'Type', 'Format', 'Description', 'Amount', 'Balance'].map(col => (
                          <th key={col} className={cn(
                            'px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground',
                            (col === 'Amount' || col === 'Balance') && 'text-right',
                          )}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, i) => (
                        <tr
                          key={tx.id}
                          className={cn(
                            'border-b border-border/50 transition-colors hover:bg-secondary/30',
                            i === transactions.length - 1 && 'border-0',
                          )}
                        >
                          <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(tx.createdAt)}</td>
                          <td className="px-5 py-3">
                            <span className={cn('text-xs font-semibold capitalize', txTypeColor(tx.type))}>
                              {tx.type === 'usage' ? '− Usage' : tx.type === 'topup' ? '+ Top-up' : tx.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground capitalize">{tx.format ?? '—'}</td>
                          <td className="px-5 py-3 text-xs text-muted-foreground max-w-xs truncate">{tx.description ?? '—'}</td>
                          <td className={cn('px-5 py-3 text-right text-xs font-mono font-bold', tx.amount > 0 ? 'text-green-400' : 'text-red-400')}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </td>
                          <td className="px-5 py-3 text-right text-xs font-mono text-foreground">{tx.balanceAfter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}
