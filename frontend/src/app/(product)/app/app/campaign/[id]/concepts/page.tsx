'use client';
// ─── Campaign → Concept View ──────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getConceptForCampaign } from '@/lib/api/creator-client';
import type { Concept } from '@/lib/types/creator';

export default function ConceptsPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const router = useRouter();
  const [concept,  setConcept]  = useState<Concept | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    getConceptForCampaign(campaignId)
      .then(setConcept)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [campaignId]);

  function handleGenerateAngles() {
    if (!concept) return;
    router.push(`/app/app/concept/${concept.id}/angles?campaignId=${campaignId}`);
  }

  return (
    <div style={shell}>
      <nav style={nav}>
        <a href="/app/app" style={back}>← Campaigns</a>
        <span style={logo}>Creative OS</span>
        <div style={{ width: 80 }} />
      </nav>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={chip}>Step 2 of 3</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
            Campaign Concept
          </h1>
          <p style={{ color: '#666', fontSize: 15 }}>
            Your AI-generated strategy. Review it, then pick your angle.
          </p>
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[120, 80, 80, 100].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 10, background: '#111', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: '#1a0a0a', border: '1px solid #3a1010', borderRadius: 10, padding: 24, color: '#f87171' }}>
            <strong>Failed to load concept</strong><br />
            <span style={{ fontSize: 13, opacity: 0.8 }}>{error}</span>
          </div>
        )}

        {concept && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Core message */}
            <div style={card}>
              <Label>Core Message</Label>
              <p style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4, color: '#f0f0f0', margin: 0 }}>
                {concept.coreMessage}
              </p>
            </div>

            {/* Hook angle */}
            {concept.rawJson?.hook_angle && (
              <div style={card}>
                <Label>Hook Angle</Label>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: '#c0c0d0', margin: 0 }}>
                  {concept.rawJson.hook_angle}
                </p>
              </div>
            )}

            {/* Why / Insight */}
            {concept.rawJson?.why && (
              <div style={card}>
                <Label>Strategic Insight</Label>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: '#aaa', margin: 0 }}>
                  {concept.rawJson.why}
                </p>
              </div>
            )}

            {/* Meta row */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {concept.goal      && <MetaTile label="Goal"      value={concept.goal} />}
              {concept.platform  && <MetaTile label="Platform"  value={concept.platform} />}
              {concept.emotion   && <MetaTile label="Emotion"   value={concept.emotion} />}
              {concept.audience  && <MetaTile label="Audience"  value={concept.audience} />}
            </div>

            {/* Tone tags from rawJson */}
            {Array.isArray((concept.rawJson as any)?.tone_keywords) && (concept.rawJson as any).tone_keywords.length > 0 && (
              <div style={card}>
                <Label>Tone</Label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(concept.rawJson as any).tone_keywords.map((t: string) => (
                    <span key={t} style={tag}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleGenerateAngles} style={btnPrimary}>
              Select Angles →
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}`}</style>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 140px', background: '#111', border: '1px solid #1e2330', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#c0c0d0', textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#0d0e14', color: '#f0f0f0', fontFamily: 'system-ui, sans-serif' };
const nav:   React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e2330' };
const logo:  React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#6366f1' };
const back:  React.CSSProperties = { fontSize: 13, color: '#555', textDecoration: 'none', width: 80 };
const chip:  React.CSSProperties = { display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '3px 10px', borderRadius: 99, marginBottom: 14 };
const card:  React.CSSProperties = { background: '#111', border: '1px solid #1e2330', borderRadius: 12, padding: '20px 22px' };
const tag:   React.CSSProperties = { fontSize: 12, color: '#888', background: '#1a1a2e', padding: '3px 10px', borderRadius: 99 };
const btnPrimary: React.CSSProperties = { width: '100%', padding: '16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 8 };
