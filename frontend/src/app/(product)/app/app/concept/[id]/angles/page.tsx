'use client';
// ─── Concept → Angle Selection ────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { selectAngles } from '@/lib/api/creator-client';
import { getUserContext } from '@/lib/user-context';
import type { SelectedAngle, AngleSelectResult } from '@/lib/types/creator';

const TYPE_COLOR: Record<string, string> = {
  exploit:   '#22c55e',
  secondary: '#f59e0b',
  explore:   '#6366f1',
};
const TYPE_LABEL: Record<string, string> = {
  exploit:   'Best Bet',
  secondary: 'Secondary',
  explore:   'Explore',
};
const FATIGUE_COLOR: Record<string, string> = {
  HEALTHY:  '#22c55e',
  WARMING:  '#f59e0b',
  FATIGUED: '#f87171',
  BLOCKED:  '#555',
};

export default function AnglesPage() {
  const { id: conceptId } = useParams<{ id: string }>();
  const searchParams  = useSearchParams();
  const campaignId    = searchParams.get('campaignId') ?? '';
  const router        = useRouter();

  const [result,   setResult]   = useState<AngleSelectResult | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const ctx = getUserContext() ?? {
      goalType: 'sales' as const, industry: 'Other', offerType: 'product' as const,
      platform: 'Meta' as const, contentStyle: 'direct_response' as const, riskLevel: 'balanced' as const,
    };
    selectAngles({ conceptId, userContext: ctx })
      .then(setResult)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [conceptId]);

  function handlePick(angle: SelectedAngle) {
    setSelected(angle.angle);
    router.push(
      `/app/app/angle/${encodeURIComponent(angle.angle)}/creatives?conceptId=${conceptId}&campaignId=${campaignId}`
    );
  }

  const backHref = campaignId
    ? `/app/app/campaign/${campaignId}/concepts`
    : '/app/app';

  return (
    <div style={shell}>
      <nav style={nav}>
        <a href={backHref} style={back}>← Concept</a>
        <span style={logo}>Creative OS</span>
        <div style={{ width: 80 }} />
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={chip}>Step 3 of 3</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
            Pick Your Angle
          </h1>
          <p style={{ color: '#666', fontSize: 15 }}>
            Three angles, each with a different approach. Pick one to generate your full creative suite.
          </p>
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 160, borderRadius: 12, background: '#111', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
            <p style={{ color: '#555', fontSize: 13, textAlign: 'center' }}>Analysing angles…</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#1a0a0a', border: '1px solid #3a1010', borderRadius: 10, padding: 24, color: '#f87171' }}>
            <strong>Failed to load angles</strong><br />
            <span style={{ fontSize: 13, opacity: 0.8 }}>{error}</span>
          </div>
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {result.selected_angles.map((a, i) => (
              <button
                key={a.angle}
                onClick={() => handlePick(a)}
                disabled={!!selected}
                style={{
                  ...angleCard,
                  opacity: selected && selected !== a.angle ? 0.4 : 1,
                  borderColor: selected === a.angle ? '#6366f1' : '#1e2330',
                  cursor: selected ? 'default' : 'pointer',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[a.type] ?? '#888', background: `${TYPE_COLOR[a.type] ?? '#333'}22`, padding: '3px 10px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {TYPE_LABEL[a.type] ?? a.type}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: FATIGUE_COLOR[a.fatigue_level], marginLeft: 'auto' }}>
                    {a.fatigue_level}
                  </span>
                </div>

                {/* Angle label */}
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f0', marginBottom: 8, textAlign: 'left' }}>
                  {a.angleData?.label ?? a.angle}
                </div>

                {/* Learning signal badge */}
                <LearningBadge boost={a.outcome_learning_boost} />

                {/* Description / reason */}
                {a.reason && (
                  <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, margin: '0 0 14px 0', textAlign: 'left' }}>
                    {a.reason}
                  </p>
                )}

                {/* Tags + confidence */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {a.emotion && <Tag>{a.emotion}</Tag>}
                  {a.tag     && <Tag>{a.tag}</Tag>}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#555' }}>Confidence</span>
                    <ConfBar value={a.confidence_score} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', minWidth: 32 }}>
                      {Math.round(a.confidence_score * 100)}%
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {selected && (
              <p style={{ textAlign: 'center', color: '#6366f1', fontSize: 13, fontWeight: 600 }}>
                Generating creatives…
              </p>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}`}</style>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, color: '#888', background: '#1a1a2e', padding: '2px 9px', borderRadius: 99, textTransform: 'capitalize' }}>{children}</span>;
}

function LearningBadge({ boost }: { boost?: number }) {
  if (!boost || boost === 1.0) return null;
  const pct   = Math.round(Math.abs(boost - 1.0) * 100);
  const up    = boost > 1.05;
  const down  = boost < 0.95;
  if (!up && !down) return null;

  const bg    = up ? 'rgba(34,197,94,0.10)' : 'rgba(248,113,113,0.10)';
  const color = up ? '#22c55e' : '#f87171';
  const icon  = up ? '↑' : '↓';
  const label = up
    ? `+${pct}% from your campaigns`
    : `−${pct}% — underperforming recently`;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, border: `1px solid ${color}22`, borderRadius: 99, padding: '3px 10px', marginBottom: 10 }}>
      <span style={{ fontSize: 11, color, fontWeight: 700 }}>{icon} Learned from your data</span>
      <span style={{ fontSize: 10, color: `${color}cc` }}>{label}</span>
    </div>
  );
}

function ConfBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div style={{ width: 60, height: 4, background: '#1e2330', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#6366f1', borderRadius: 4, transition: 'width 0.5s ease' }} />
    </div>
  );
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#0d0e14', color: '#f0f0f0', fontFamily: 'system-ui, sans-serif' };
const nav:   React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e2330' };
const logo:  React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#6366f1' };
const back:  React.CSSProperties = { fontSize: 13, color: '#555', textDecoration: 'none', width: 80 };
const chip:  React.CSSProperties = { display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '3px 10px', borderRadius: 99, marginBottom: 14 };
const angleCard: React.CSSProperties = { width: '100%', background: '#111', border: '1px solid #1e2330', borderRadius: 12, padding: '20px 22px', transition: 'border-color 0.15s, opacity 0.2s' };
