'use client';

import { useEffect, useState } from 'react';
import { loadHistory, type HistoryEntry } from '@/lib/api/run-client';

interface InsightItem { icon: string; title: string; sub: string; }

function derivePersonalInsights(entries: HistoryEntry[]): InsightItem[] {
  if (entries.length === 0) return [];
  const insights: InsightItem[] = [];

  const formatCounts: Record<string, number> = {};
  for (const e of entries) formatCounts[e.format] = (formatCounts[e.format] ?? 0) + 1;
  const topFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0];
  if (topFormat) {
    const fmtLabel = topFormat[0].charAt(0).toUpperCase() + topFormat[0].slice(1);
    insights.push({
      icon: topFormat[0] === 'video' ? '🎬' : topFormat[0] === 'carousel' ? '🖼' : '⬛',
      title: `${fmtLabel} performs best for you`,
      sub: `You've generated more ${topFormat[0]} content than any other format — keep it up.`,
    });
  }

  const goalCounts: Record<string, number> = {};
  for (const e of entries) goalCounts[e.goal] = (goalCounts[e.goal] ?? 0) + 1;
  const topGoal = Object.entries(goalCounts).sort((a, b) => b[1] - a[1])[0];
  if (topGoal) {
    const msgs: Record<string, { title: string; sub: string }> = {
      conversion: { title: 'Conversion-focused messaging works',  sub: 'Your campaigns consistently aim to drive action.' },
      awareness:  { title: 'Brand storytelling resonates',        sub: 'Your awareness campaigns build recognition over time.' },
      engagement: { title: 'Engagement drives results',           sub: 'Interactive content generates the most response in your category.' },
    };
    const msg = msgs[topGoal[0]];
    if (msg) insights.push({ icon: '🎯', ...msg });
  }

  if (entries.length >= 3) {
    const highPerf = entries.filter(e => (e.score ?? 0) >= 0.65).length;
    const pct = Math.round((highPerf / entries.length) * 100);
    insights.push({ icon: '📈', title: `${pct}% of your campaigns hit high performance`, sub: 'The system continuously improves based on your history.' });
  } else {
    insights.push({ icon: '🌱', title: 'System is learning your style', sub: 'Every generation helps the AI understand what works best for your brand.' });
  }

  insights.push({ icon: '⚡', title: 'Short hooks increase engagement', sub: 'Campaigns with punchy openings consistently outperform longer lead-ins.' });
  insights.push({ icon: '💬', title: 'Problem-first messaging converts better', sub: "Starting with your audience's pain point before the solution drives stronger results." });

  return insights.slice(0, 5);
}

const DEFAULT_INSIGHTS: InsightItem[] = [
  { icon: '⚡', title: 'Short hooks increase engagement',     sub: 'Campaigns with punchy openings consistently outperform longer lead-ins.' },
  { icon: '💬', title: 'Problem-first messaging converts',    sub: "Starting with the audience's pain point before the solution drives stronger results." },
  { icon: '🎯', title: 'Emotional storytelling performs best',sub: 'Creatives that connect emotionally outperform purely informational ads.' },
  { icon: '📱', title: 'Mobile-native formats win',           sub: 'Vertical video and swipeable carousels get significantly higher completion rates.' },
  { icon: '🔄', title: 'Consistency builds memory',           sub: 'Running variations of winning angles reinforces brand recognition over time.' },
];

export default function InsightsPage() {
  const [insights,    setInsights]    = useState<InsightItem[]>([]);
  const [hasHistory,  setHasHistory]  = useState(false);
  const [mounted,     setMounted]     = useState(false);

  useEffect(() => {
    const history = loadHistory();
    setHasHistory(history.length > 0);
    const personal = derivePersonalInsights(history);
    setInsights(personal.length > 0 ? personal : DEFAULT_INSIGHTS);
    setMounted(true);
  }, []);

  return (
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">What works best for you</h1>
            <p className="page-sub">
              {hasHistory ? 'Personalized insights based on your campaign history' : 'Universal insights to guide your creative strategy'}
            </p>
          </div>

          {mounted && (
            <div className="insights-list">
              {insights.map((ins, i) => (
                <div key={ins.title} className="insights-card" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="insights-card-icon">{ins.icon}</div>
                  <div>
                    <div className="insights-card-title">{ins.title}</div>
                    <div className="insights-card-sub">{ins.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
  );
}
