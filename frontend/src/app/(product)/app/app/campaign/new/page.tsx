'use client';
// ─── New Campaign ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureUser, createCampaign, generateConcept } from '@/lib/api/creator-client';
import { getUserContext } from '@/lib/user-context';

const GOALS     = ['awareness', 'conversions', 'engagement'] as const;
const PLATFORMS = ['Meta', 'TikTok', 'Google', 'LinkedIn']   as const;
const PLATFORM_MAP: Record<string, string> = { Meta: 'instagram', TikTok: 'tiktok', Google: 'google', LinkedIn: 'linkedin' };

export default function NewCampaignPage() {
  const router = useRouter();
  const [brief,    setBrief]    = useState('');
  const [audience, setAudience] = useState('');
  const [goal,     setGoal]     = useState('conversions');
  const [platform, setPlatform] = useState('Meta');
  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState('');
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit() {
    if (!brief.trim()) { setError('Describe your product or campaign brief.'); return; }
    setLoading(true); setError(null);
    try {
      setStep('Setting up…');
      await ensureUser();
      setStep('Creating campaign…');
      const campaign = await createCampaign({ mode: 'FULL', formats: ['video', 'carousel', 'banner'] });
      setStep('Generating concept with AI…');
      const ctx = getUserContext();
      if (ctx) {
        await generateConcept({ campaignId: campaign.id, brief: brief.trim(), audience: audience.trim() || undefined, userContext: ctx });
      } else {
        // Fallback for legacy product app (no onboarding context)
        await generateConcept({
          campaignId: campaign.id, brief: brief.trim(), audience: audience.trim() || undefined,
          userContext: { goalType: goal === 'conversions' ? 'sales' : goal === 'awareness' ? 'branding' : 'growth', industry: 'Other', offerType: 'product', platform: platform as import('@/lib/user-context').PlatformType, contentStyle: 'direct_response', riskLevel: 'balanced' },
        });
      }
      router.push(`/app/app/campaign/${campaign.id}/concepts`);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div style={shell}>
      <nav style={nav}>
        <a href="/app/app" style={back}>← Campaigns</a>
        <span style={logo}>Creative OS</span>
        <div style={{ width: 80 }} />
      </nav>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <div style={chip}>Step 1 of 3</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>New Campaign</h1>
          <p style={{ color: '#666', fontSize: 15 }}>Describe your product — we'll generate the concept, angles, and full creatives.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Field label="What are you promoting?">
            <textarea value={brief} onChange={e => setBrief(e.target.value)}
              placeholder="e.g. A fishing app that tells you the best times to fish based on weather, tides, and moon phases."
              rows={4} style={textareaStyle} />
          </Field>

          <Field label="Campaign goal">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {GOALS.map(g => <Pill key={g} label={g === 'conversions' ? 'Conversions' : g === 'awareness' ? 'Awareness' : 'Engagement'} active={goal === g} onClick={() => setGoal(g)} />)}
            </div>
          </Field>

          <Field label="Platform">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PLATFORMS.map(p => <Pill key={p} label={p} active={platform === p} onClick={() => setPlatform(p)} />)}
            </div>
          </Field>

          <Field label="Target audience" optional>
            <input value={audience} onChange={e => setAudience(e.target.value)}
              placeholder="e.g. Beginner anglers, 25–45, outdoors enthusiasts"
              style={{ ...textareaStyle, height: 44, resize: 'none' }} />
          </Field>

          {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}

          <button onClick={handleSubmit} disabled={loading} style={{ ...btnPrimary, padding: '16px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: loading ? 0.7 : 1 }}>
            {loading ? <><Spin />{step}</> : '✦  Generate Campaign'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} textarea:focus,input:focus{outline:none;border-color:#6366f1!important}`}</style>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        {label} {optional && <span style={{ fontWeight: 400, color: '#555' }}>(optional)</span>}
      </label>
      {children}
    </div>
  );
}
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '9px 20px', background: active ? 'rgba(99,102,241,0.2)' : 'transparent', border: active ? '1px solid #6366f1' : '1px solid #1e2330', borderRadius: 99, color: active ? '#a5b4fc' : '#666', fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
      {label}
    </button>
  );
}
function Spin() { return <span style={{ width: 16, height: 16, border: '2px solid #555', borderTopColor: '#aaa', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />; }

const shell: React.CSSProperties = { minHeight: '100vh', background: '#0d0e14', color: '#f0f0f0', fontFamily: 'system-ui, sans-serif' };
const nav:   React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e2330' };
const logo:  React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#6366f1' };
const back:  React.CSSProperties = { fontSize: 13, color: '#555', textDecoration: 'none', width: 80 };
const chip:  React.CSSProperties = { display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '3px 10px', borderRadius: 99, marginBottom: 14 };
const btnPrimary: React.CSSProperties = { background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #1e2330', borderRadius: 8, color: '#f0f0f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color 0.15s', fontFamily: 'inherit' };
