'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { getSupabase } from '@/lib/supabase';
import { loadHistory, type HistoryEntry } from '@/lib/api/run-client';

function timeAgo(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const [history,   setHistory]   = useState<HistoryEntry[]>([]);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    setHistory(loadHistory());
    getSupabase().auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const full = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '';
        setFirstName(full.split(' ')[0] ?? '');
      }
    });
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const generated = history.filter(h => (h.score ?? 0) >= 0.40).length;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{greeting}{firstName ? `, ${firstName}` : ''}</h1>
            <p style={{ fontSize: 14, color: 'var(--sub)' }}>Here's what's happening with your campaigns.</p>
          </div>

          {/* Stat cards */}
          <div className="stat-cards-row" style={{ marginBottom: 28 }}>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Total Campaigns</span>
                <span className="stat-card-icon">💬</span>
              </div>
              <div className="stat-card-value">{history.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Ready to Launch</span>
                <span className="stat-card-icon">✦</span>
              </div>
              <div className="stat-card-value" style={{ WebkitTextFillColor: 'var(--success)', background: 'none' }}>{generated}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Ad Formats</span>
                <span className="stat-card-icon">🎨</span>
              </div>
              <div className="stat-card-value" style={{ WebkitTextFillColor: 'var(--warning)', background: 'none' }}>3</div>
              <div className="stat-card-sub">Video · Carousel · Banner</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ marginBottom: 28 }}>
            <div className="section-label">Quick Actions</div>
            <div className="quick-actions-grid">
              <Link href="/campaigns/new" className="action-card accent" style={{ textDecoration: 'none' }}>
                <div className="action-card-icon">✦</div>
                <div className="action-card-title">New Campaign</div>
                <div className="action-card-sub">Describe a product → AI builds the ad strategy</div>
              </Link>
              <Link href="/campaigns" className="action-card" style={{ textDecoration: 'none' }}>
                <div className="action-card-icon">⊞</div>
                <div className="action-card-title">My Campaigns</div>
                <div className="action-card-sub">All your generated ad creatives</div>
              </Link>
              <Link href="/ad-performance" className="action-card" style={{ textDecoration: 'none' }}>
                <div className="action-card-icon">↗</div>
                <div className="action-card-title">Ad Performance</div>
                <div className="action-card-sub">Report results — AI learns from them</div>
              </Link>
            </div>
          </div>

          {/* Intelligence Layer */}
          <div style={{ marginBottom: 28 }}>
            <div className="section-label">⚡ Intelligence Layer</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { href: '/autonomous',   icon: '🤖', label: 'Autonomous System',  desc: 'Live cockpit — mode, decisions, stream',  color: '#6366f1' },
                { href: '/ai-stream',    icon: '🧠', label: 'AI Brain Stream',    desc: 'SSE live feed of every AI decision',       color: '#8b5cf6' },
                { href: '/pro-mode',     icon: '🔬', label: 'Pro Diagnostics',    desc: 'Evolution, fatigue, memory, audit log',    color: '#06b6d4' },
                { href: '/system-audit', icon: '🗂', label: 'System Audit',       desc: 'Backend ↔ UI connectivity map',            color: '#10b981' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ display: 'block', padding: '16px 18px', background: 'var(--surface)', border: `1px solid ${item.color}22`, borderRadius: 12, textDecoration: 'none', transition: 'border-color 0.15s' }}>
                  <div style={{ width: 32, height: 32, background: `${item.color}14`, border: `1px solid ${item.color}33`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>{item.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{item.desc}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Campaigns */}
          <div>
            <div className="section-label">Recent Campaigns</div>
            {history.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                No campaigns yet.{' '}
                <Link href="/campaigns/new" style={{ color: 'var(--accent-l)' }}>Create your first →</Link>
              </p>
            ) : (
              history.slice(0, 5).map(entry => (
                <Link key={entry.executionId} href={`/result/${entry.executionId}`}
                  style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, cursor: 'pointer', textDecoration: 'none', transition: 'border-color 0.2s' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#00C97A,#34DFA0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, flexShrink: 0, marginRight: 14 }}>✦</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, lineHeight: 1.4 }}>{entry.brief}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(46,213,115,0.12)', border: '1px solid rgba(46,213,115,0.3)', color: 'var(--success)', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>GENERATED</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(0,201,122,0.1)', border: '1px solid rgba(0,201,122,0.25)', color: 'var(--accent-l)', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{entry.format}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 12 }}>{timeAgo(entry.createdAt)}</div>
                  <div style={{ marginLeft: 12, color: 'var(--accent-l)', fontSize: 16 }}>→</div>
                </Link>
              ))
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
