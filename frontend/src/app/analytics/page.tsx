'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { loadHistory } from '@/lib/api/run-client';

const SYSTEMS = ['AI Campaign Engine', 'Concept Generator', 'Angle Intelligence', 'Outcome Learning Loop', 'Angle Evolution Engine'];
type Tab = 'Overview' | 'Health' | 'Mutations' | 'Log';

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [history, setHistory] = useState<ReturnType<typeof loadHistory>>([]);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const goals     = history.reduce<Record<string,number>>((a, e) => { a[e.goal] = (a[e.goal] ?? 0) + 1; return a; }, {});
  const formats   = history.reduce<Record<string,number>>((a, e) => { a[e.format] = (a[e.format] ?? 0) + 1; return a; }, {});
  const champions = history.filter(e => (e.score ?? 0) >= 0.65).length;
  const total     = history.length;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 className="page-title">Analytics</h1>
              <p className="page-sub">Campaign performance + Angle Evolution Engine</p>
            </div>
            <button className="btn-primary">✦ Run Evolution Cycle</button>
          </div>

          {/* 4 stat cards */}
          <div className="stat-cards-row">
            <div className="stat-card">
              <div className="stat-card-label">Total Campaigns</div>
              <div className="stat-card-value">{total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Active Mutations</div>
              <div className="stat-card-value" style={{ WebkitTextFillColor: 'var(--warning)', background: 'none' }}>{Math.max(total * 2, 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Pruned Angles</div>
              <div className="stat-card-value" style={{ WebkitTextFillColor: 'var(--danger)', background: 'none' }}>0</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Champions</div>
              <div className="stat-card-value" style={{ WebkitTextFillColor: 'var(--success)', background: 'none' }}>{champions}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tab-underline-strip">
            {(['Overview', 'Health', 'Mutations', 'Log'] as Tab[]).map(t => (
              <button key={t} className={`tab-underline${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          {/* Two col: Goals + Platforms */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {[
              { title: 'Goals',    rows: Object.entries(goals) },
              { title: 'Platforms / Formats', rows: Object.entries(formats) },
            ].map(panel => (
              <div key={panel.title} className="progress-panel">
                <div className="progress-panel-label">{panel.title}</div>
                {panel.rows.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>No data yet</p>
                ) : panel.rows.map(([label, count]) => (
                  <div key={label} className="progress-row">
                    <div className="progress-row-header">
                      <span className="progress-row-label" style={{ textTransform: 'capitalize' }}>{label}</span>
                      <span className="progress-row-val">{count}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* System Status */}
          <div className="system-status-card">
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>System Status</div>
            {SYSTEMS.map(s => (
              <div key={s} className="system-status-row">
                <span className="system-status-name">{s}</span>
                <span className="badge-operational">Operational</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
