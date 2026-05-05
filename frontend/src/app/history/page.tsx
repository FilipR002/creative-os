'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadHistory, type HistoryEntry } from '@/lib/api/run-client';

function formatIcon(fmt: string) {
  if (fmt === 'video')    return '🎬';
  if (fmt === 'carousel') return '🖼';
  return '⬛';
}

function perfLabel(score: number | null): { label: string; cls: string } {
  if (score === null)  return { label: 'Pending', cls: 'perf-medium' };
  if (score >= 0.65)  return { label: 'High',    cls: 'perf-high'   };
  if (score >= 0.40)  return { label: 'Medium',  cls: 'perf-medium' };
  return                     { label: 'Low',     cls: 'perf-low'    };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEntries(loadHistory());
    setMounted(true);
  }, []);

  return (
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">History</h1>
            <p className="page-sub">Your past generations</p>
          </div>

          {mounted && entries.length === 0 ? (
            <div className="empty-page">
              <div className="empty-page-icon">🗂</div>
              <div className="empty-page-title">No history yet</div>
              <div className="empty-page-sub">Your campaigns will appear here after your first generation.</div>
              <Link href="/campaigns/new" className="empty-page-cta">Create your first ad</Link>
            </div>
          ) : (
            <div className="history-grid">
              {entries.map((entry, i) => {
                const perf = perfLabel(entry.score);
                return (
                  <Link
                    key={entry.executionId}
                    href={`/result/${entry.executionId}`}
                    className="history-card"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="history-card-thumb">{formatIcon(entry.format)}</div>
                    <div className="history-card-brief">{entry.brief}</div>
                    <div className="history-card-footer">
                      <span className="history-card-format">{entry.format}</span>
                      <span className={`perf-badge ${perf.cls}`}>{perf.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>{timeAgo(entry.createdAt)}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
  );
}
