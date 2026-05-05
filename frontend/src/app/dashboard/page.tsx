'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { getSupabase } from '@/lib/supabase';
import { loadHistory, type HistoryEntry } from '@/lib/api/run-client';
import { listCampaigns } from '@/lib/api/creator-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles, FolderOpen, TrendingUp, Bot, Brain,
  Activity, Shield, ArrowRight, Clock, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function timeAgo(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn('text-3xl font-bold tracking-tight', accent ?? 'text-foreground')}>{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
      {/* subtle orange glow line at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
    </Card>
  );
}

// ── Quick action card ─────────────────────────────────────────────────────────

function ActionCard({
  href, icon: Icon, title, desc, primary,
}: {
  href: string; icon: React.ElementType; title: string; desc: string; primary?: boolean;
}) {
  return (
    <Link href={href} className="group block no-underline">
      <Card className={cn(
        'h-full transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5',
        primary && 'border-primary/30 bg-primary/5',
      )}>
        <CardContent className="p-5">
          <div className={cn(
            'mb-4 flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
            primary
              ? 'bg-primary text-white shadow-[0_0_16px_rgba(249,115,22,0.35)]'
              : 'bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <p className="mb-1 font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Intelligence card ─────────────────────────────────────────────────────────

function IntelCard({
  href, icon: Icon, label, desc, color,
}: {
  href: string; icon: React.ElementType; label: string; desc: string; color: string;
}) {
  return (
    <Link href={href} className="group block no-underline">
      <Card className="h-full transition-all duration-200 hover:-translate-y-0.5" style={{ borderColor: `${color}22` }}>
        <CardContent className="p-4">
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: `${color}14`, border: `1px solid ${color}30` }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <p className="mb-1 text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [history,   setHistory]   = useState<HistoryEntry[]>([]);
  const [firstName, setFirstName] = useState('');
  const [apiStats,  setApiStats]  = useState<{ total: number; ready: number } | null>(null);

  useEffect(() => {
    setHistory(loadHistory());

    getSupabase().auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const full = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '';
        setFirstName(full.split(' ')[0] ?? '');
      }
    });

    listCampaigns()
      .then(list => setApiStats({
        total: list.length,
        ready: list.filter(c => c.status === 'SCORED' || c.status === 'DONE' || c.isActive).length,
      }))
      .catch(() => {});
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const generated = history.filter(h => (h.score ?? 0) >= 0.40).length;
  const totalCampaigns = apiStats?.total ?? history.length;
  const readyToLaunch  = apiStats?.ready ?? generated;

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        <div className="mx-auto max-w-6xl px-8 py-8">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {greeting}{firstName ? `, ${firstName}` : ''} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Here's what's happening with your campaigns.
            </p>
          </div>

          {/* ── Stat cards ─────────────────────────────────────────────────── */}
          <div className="mb-8 grid grid-cols-3 gap-4">
            <StatCard label="Total Campaigns" value={totalCampaigns} />
            <StatCard label="Ready to Launch" value={readyToLaunch} accent="text-green-400" />
            <StatCard label="Ad Formats" value={3} sub="Video · Carousel · Banner" accent="text-amber-400" />
          </div>

          {/* ── Quick Actions ───────────────────────────────────────────────── */}
          <div className="mb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick Actions</p>
            <div className="grid grid-cols-3 gap-4">
              <ActionCard href="/campaigns/new"  icon={Sparkles}   title="New Campaign"    desc="Describe a product → AI builds the ad strategy" primary />
              <ActionCard href="/campaigns"       icon={FolderOpen}  title="My Campaigns"   desc="All your generated ad creatives" />
              <ActionCard href="/ad-performance"  icon={TrendingUp}  title="Ad Performance" desc="Report results — AI learns from them" />
            </div>
          </div>

          {/* ── Intelligence Layer ──────────────────────────────────────────── */}
          <div className="mb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Intelligence Layer
            </p>
            <div className="grid grid-cols-4 gap-3">
              <IntelCard href="/autonomous"   icon={Bot}      label="Autonomous System"  desc="Live cockpit — mode, decisions, stream"  color="#6366f1" />
              <IntelCard href="/ai-stream"    icon={Brain}    label="AI Brain Stream"    desc="SSE live feed of every AI decision"       color="#8b5cf6" />
              <IntelCard href="/pro-mode"     icon={Activity} label="Pro Diagnostics"    desc="Evolution, fatigue, memory, audit log"    color="#06b6d4" />
              <IntelCard href="/system-audit" icon={Shield}   label="System Audit"       desc="Backend ↔ UI connectivity map"            color="#10b981" />
            </div>
          </div>

          {/* ── Recent Campaigns ────────────────────────────────────────────── */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent Campaigns</p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/campaigns">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>

            {history.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <p className="mb-1 font-semibold text-foreground">No campaigns yet</p>
                  <p className="mb-4 text-sm text-muted-foreground">Create your first AI-powered ad campaign</p>
                  <Button asChild>
                    <Link href="/campaigns/new">
                      <Sparkles className="mr-2 h-4 w-4" /> New Campaign
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="divide-y divide-border p-0">
                  {history.slice(0, 5).map((entry, i) => (
                    <div key={entry.executionId} className={cn('flex items-center gap-4 px-5 py-4', i === 0 && 'rounded-t-xl')}>
                      {/* icon */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>

                      {/* text */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{entry.brief}</p>
                        <div className="mt-1 flex gap-2">
                          <Badge variant="success">Generated</Badge>
                          <Badge variant="outline" className="text-muted-foreground">{entry.format}</Badge>
                        </div>
                      </div>

                      {/* date */}
                      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {timeAgo(entry.createdAt)}
                      </div>

                      {/* actions */}
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/studio/${entry.executionId}`}>Preview</Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/result/${entry.executionId}`}>Details</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
