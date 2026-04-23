'use client';
// ─── Smart 5-Step Onboarding ─────────────────────────────────────────────────
// Saves partial draft after every step → supports resume.
// On completion: writes full UserContext → auth record → engine session.

import { useEffect, useState } from 'react';
import { getAuthUser, updateAuthUser } from '@/lib/auth';
import {
  saveOnboardingDraft,
  loadOnboardingDraft,
  type GoalType,
  type OfferType,
  type PlatformType,
  type ContentStyle,
  type RiskLevel,
  type OnboardingDraft,
} from '@/lib/user-context';

// ── Config ────────────────────────────────────────────────────────────────────

const GOALS: { value: GoalType; label: string; desc: string; icon: string }[] = [
  { value: 'lead_generation', label: 'Lead Generation', desc: 'Capture qualified prospects',    icon: '🎯' },
  { value: 'sales',           label: 'Sales',           desc: 'Drive direct purchases',          icon: '💰' },
  { value: 'branding',        label: 'Branding',        desc: 'Build awareness & recognition',   icon: '✦' },
  { value: 'growth',          label: 'Growth',          desc: 'Expand reach & engagement',       icon: '📈' },
];

const INDUSTRIES = [
  'Fitness', 'SaaS', 'E-commerce', 'Finance', 'Health & Wellness',
  'Education', 'Real Estate', 'Food & Beverage', 'Fashion', 'Travel', 'B2B', 'Other',
];

const OFFER_TYPES: { value: OfferType; label: string; desc: string }[] = [
  { value: 'product', label: 'Physical Product', desc: 'Tangible goods shipped to customers' },
  { value: 'service', label: 'Service',          desc: 'Coaching, consulting, freelance work' },
  { value: 'saas',    label: 'SaaS / App',       desc: 'Software or digital subscription'    },
];

const PLATFORMS: { value: PlatformType; label: string; icon: string; note: string }[] = [
  { value: 'TikTok',     label: 'TikTok',      icon: '🎵', note: 'Short-form vertical video'      },
  { value: 'Meta',       label: 'Meta',         icon: '📘', note: 'Facebook & Instagram ads'       },
  { value: 'YouTube',    label: 'YouTube',      icon: '▶️', note: 'Pre-roll & mid-roll video'      },
  { value: 'Google Ads', label: 'Google Ads',   icon: '🔍', note: 'Search, Display & Performance'  },
];

const STYLES: { value: ContentStyle; label: string; desc: string; icon: string }[] = [
  { value: 'viral',           label: 'Viral',           desc: 'Trend-driven, shareable hooks',        icon: '🔥' },
  { value: 'educational',     label: 'Educational',     desc: 'Value-first, authority building',       icon: '🎓' },
  { value: 'direct_response', label: 'Direct Response', desc: 'Clear CTA, offer-led messaging',        icon: '⚡' },
  { value: 'storytelling',    label: 'Storytelling',    desc: 'Narrative arc, emotional connection',   icon: '📖' },
];

const RISKS: { value: RiskLevel; label: string; desc: string; color: string }[] = [
  { value: 'safe',       label: 'Safe',       desc: 'Proven angles, low variance',           color: '#22c55e' },
  { value: 'balanced',   label: 'Balanced',   desc: 'Mix of proven and fresh approaches',    color: '#f59e0b' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Maximum exploration, high upside',      color: '#ef4444' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step,         setStep]         = useState(1);
  const [loading,      setLoading]      = useState(false);

  // Step fields
  const [goalType,     setGoalType]     = useState<GoalType | ''>('');
  const [industry,     setIndustry]     = useState('');
  const [offerType,    setOfferType]    = useState<OfferType | ''>('');
  const [platform,     setPlatform]     = useState<PlatformType | ''>('');
  const [contentStyle, setContentStyle] = useState<ContentStyle | ''>('');
  const [riskLevel,    setRiskLevel]    = useState<RiskLevel | ''>('');

  // Guard + resume draft
  useEffect(() => {
    const user = getAuthUser();
    if (!user) { window.location.href = '/login'; return; }
    // Allow re-run via ?rerun=1 (from Settings "Re-run Onboarding" / "Complete Setup")
    const rerun = new URLSearchParams(window.location.search).get('rerun') === '1';
    if (user.onboarded && !rerun) { window.location.href = '/dashboard'; return; }

    if (rerun) {
      // Re-run: start fresh from step 1. Pre-fill values from existing context
      // so each step feels familiar, but the user walks through all steps again.
      saveOnboardingDraft({});  // clear any stale draft
      if (user.goalType)     setGoalType(user.goalType);
      if (user.industry)     setIndustry(user.industry);
      if (user.offerType)    setOfferType(user.offerType as OfferType);
      if (user.platform)     setPlatform(user.platform as PlatformType);
      if (user.contentStyle) setContentStyle(user.contentStyle as ContentStyle);
      if (user.riskLevel)    setRiskLevel(user.riskLevel as RiskLevel);
      setStep(1);  // always start at step 1 on re-run
      return;
    }

    // Resume from partial draft if exists
    const draft: OnboardingDraft = loadOnboardingDraft();
    if (draft.goalType)     { setGoalType(draft.goalType);         }
    if (draft.industry)     { setIndustry(draft.industry);         }
    if (draft.offerType)    { setOfferType(draft.offerType);       }
    if (draft.platform)     { setPlatform(draft.platform);         }
    if (draft.contentStyle) { setContentStyle(draft.contentStyle); }
    if (draft.riskLevel)    { setRiskLevel(draft.riskLevel);       }

    // Advance to furthest completed step
    if (draft.goalType && draft.industry && draft.offerType) {
      if (draft.platform) {
        if (draft.contentStyle) {
          setStep(5);
        } else { setStep(4); }
      } else { setStep(3); }
    } else if (draft.goalType) {
      setStep(2);
    }
  }, []);

  // Persist draft after each field change
  function saveDraft(patch: OnboardingDraft) {
    saveOnboardingDraft({
      goalType:     (goalType     || undefined) as GoalType | undefined,
      industry:     industry      || undefined,
      offerType:    (offerType    || undefined) as OfferType | undefined,
      platform:     (platform     || undefined) as PlatformType | undefined,
      contentStyle: (contentStyle || undefined) as ContentStyle | undefined,
      riskLevel:    (riskLevel    || undefined) as RiskLevel | undefined,
      ...patch,
    });
  }

  function nextStep(patch: OnboardingDraft) {
    saveDraft(patch);
    setStep(s => s + 1);
  }

  async function handleFinish() {
    if (!goalType || !industry || !offerType || !platform || !contentStyle || !riskLevel) return;
    setLoading(true);

    updateAuthUser({
      goalType,
      industry,
      offerType,
      platform,
      contentStyle,
      riskLevel,
      goal:      goalType,   // legacy compat
      onboarded: true,
    });

    await new Promise(r => setTimeout(r, 500)); // brief UX pause
    window.location.href = '/dashboard';
  }

  const totalSteps = 5;

  return (
    <div style={shell}>
      {/* Progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <div style={{ height: 3, background: '#0d0e14' }}>
          <div style={{
            height: '100%',
            width:  `${((step - 1) / totalSteps) * 100}%`,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Step dots */}
      <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center' }}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} style={{
            width: step > i + 1 ? 22 : step === i + 1 ? 28 : 8,
            height: 8, borderRadius: 99,
            background: step > i + 1 ? '#6366f1' : step === i + 1 ? '#818cf8' : '#1e2330',
            transition: 'all 0.35s',
          }} />
        ))}
      </div>

      <div style={{ maxWidth: 560, width: '100%', padding: '0 24px' }}>

        {/* ── Step 1: Goal Type ── */}
        {step === 1 && (
          <StepCard>
            <StepHeader step="1 of 5" title="What's your primary goal?" desc="This drives the AI engine's scoring weights for every decision." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {GOALS.map(g => (
                <OptionRow
                  key={g.value}
                  active={goalType === g.value}
                  onClick={() => setGoalType(g.value)}
                  icon={g.icon}
                  label={g.label}
                  desc={g.desc}
                />
              ))}
            </div>
            <PrimaryBtn disabled={!goalType} onClick={() => nextStep({ goalType: goalType as GoalType })}>
              Continue →
            </PrimaryBtn>
          </StepCard>
        )}

        {/* ── Step 2: Industry + Offer ── */}
        {step === 2 && (
          <StepCard>
            <StepHeader step="2 of 5" title="Industry & offer type" desc="The engine uses this to pull the right angle pool and memory signals." />

            <div>
              <Label>Your industry</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind}
                    onClick={() => setIndustry(ind)}
                    style={pill(industry === ind)}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Offer type</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {OFFER_TYPES.map(o => (
                  <OptionRow
                    key={o.value}
                    active={offerType === o.value}
                    onClick={() => setOfferType(o.value)}
                    label={o.label}
                    desc={o.desc}
                    compact
                  />
                ))}
              </div>
            </div>

            <NavRow
              onBack={() => setStep(1)}
              onNext={() => nextStep({ industry, offerType: offerType as OfferType })}
              disabled={!industry || !offerType}
            />
          </StepCard>
        )}

        {/* ── Step 3: Platform ── */}
        {step === 3 && (
          <StepCard>
            <StepHeader step="3 of 5" title="Primary platform" desc="Determines format selection, duration tier, and creative structure." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PLATFORMS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 20px',
                    background:   platform === p.value ? 'rgba(99,102,241,0.12)' : '#111',
                    border:       platform === p.value ? '1px solid #6366f1' : '1px solid #1e2330',
                    borderRadius: 12,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%',
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: platform === p.value ? '#a5b4fc' : '#f0f0f0' }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{p.note}</div>
                  </div>
                </button>
              ))}
            </div>
            <NavRow
              onBack={() => setStep(2)}
              onNext={() => nextStep({ platform: platform as PlatformType })}
              disabled={!platform}
            />
          </StepCard>
        )}

        {/* ── Step 4: Content Style ── */}
        {step === 4 && (
          <StepCard>
            <StepHeader step="4 of 5" title="Content style" desc="Controls hook generation strategy and creative tone across all formats." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {STYLES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setContentStyle(s.value)}
                  style={{
                    padding: '18px 16px',
                    background:   contentStyle === s.value ? 'rgba(99,102,241,0.12)' : '#111',
                    border:       contentStyle === s.value ? '1px solid #6366f1' : '1px solid #1e2330',
                    borderRadius: 12,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: contentStyle === s.value ? '#a5b4fc' : '#f0f0f0', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: '#555', lineHeight: 1.4 }}>{s.desc}</div>
                </button>
              ))}
            </div>
            <NavRow
              onBack={() => setStep(3)}
              onNext={() => nextStep({ contentStyle: contentStyle as ContentStyle })}
              disabled={!contentStyle}
            />
          </StepCard>
        )}

        {/* ── Step 5: Risk Level ── */}
        {step === 5 && (
          <StepCard>
            <StepHeader step="5 of 5" title="Risk level" desc="Sets the exploration vs. exploitation balance in the angle engine." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {RISKS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRiskLevel(r.value)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px',
                    background:   riskLevel === r.value ? 'rgba(99,102,241,0.10)' : '#111',
                    border:       riskLevel === r.value ? `1px solid ${r.color}55` : '1px solid #1e2330',
                    borderRadius: 12,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: riskLevel === r.value ? '#f0f0f0' : '#ccc', marginBottom: 4 }}>{r.label}</div>
                    <div style={{ fontSize: 13, color: '#555' }}>{r.desc}</div>
                  </div>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: riskLevel === r.value ? r.color : '#333',
                    flexShrink: 0, transition: 'background 0.2s',
                  }} />
                </button>
              ))}
            </div>

            {/* Summary card */}
            {goalType && industry && offerType && platform && contentStyle && riskLevel && (
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Engine Config Preview</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { k: 'Goal',    v: goalType.replace('_', ' ')   },
                    { k: 'Industry',v: industry                      },
                    { k: 'Offer',   v: offerType                     },
                    { k: 'Platform',v: platform                      },
                    { k: 'Style',   v: contentStyle.replace('_',' ') },
                    { k: 'Risk',    v: riskLevel                     },
                  ].map(({ k, v }) => (
                    <div key={k} style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 6, padding: '4px 10px', fontSize: 11 }}>
                      <span style={{ color: '#555' }}>{k}: </span>
                      <span style={{ color: '#a5b4fc', fontWeight: 600, textTransform: 'capitalize' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(4)} style={backBtnStyle}>Back</button>
              <button
                onClick={handleFinish}
                disabled={!riskLevel || loading}
                style={{
                  flex: 1, padding: '14px', border: 'none', borderRadius: 9,
                  background: !riskLevel || loading ? '#1a1a2a' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  color: !riskLevel || loading ? '#444' : '#fff',
                  fontWeight: 700, fontSize: 15,
                  cursor: !riskLevel || loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {loading ? <><Spin /> Initialising engine…</> : '✦ Launch Creative OS'}
              </button>
            </div>
          </StepCard>
        )}
      </div>
      <style>{`button{font-family:inherit} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 20, padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {children}
    </div>
  );
}

function StepHeader({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Step {step}</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: '#f0f0f0', marginBottom: 6 }}>{title}</h1>
      <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{children}</div>;
}

function OptionRow({ active, onClick, icon, label, desc, compact }: {
  active: boolean; onClick: () => void;
  icon?: string; label: string; desc: string; compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: compact ? '12px 16px' : '16px 20px',
        background:   active ? 'rgba(99,102,241,0.12)' : '#111',
        border:       active ? '1px solid #6366f1' : '1px solid #1e2330',
        borderRadius: 12, cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.15s', width: '100%',
      }}
    >
      {icon && <span style={{ fontSize: 22, flexShrink: 0, width: 28, textAlign: 'center' }}>{icon}</span>}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#a5b4fc' : '#f0f0f0', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#555' }}>{desc}</div>
      </div>
    </button>
  );
}

function NavRow({ onBack, onNext, disabled }: { onBack: () => void; onNext: () => void; disabled: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button onClick={onBack} style={backBtnStyle}>Back</button>
      <button
        onClick={onNext}
        disabled={disabled}
        style={{
          flex: 1, padding: '13px', border: 'none', borderRadius: 9,
          background: disabled ? '#1a1a2a' : '#6366f1',
          color: disabled ? '#444' : '#fff',
          fontWeight: 700, fontSize: 15,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s', fontFamily: 'inherit',
        }}
      >
        Continue →
      </button>
    </div>
  );
}

function PrimaryBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '14px', border: 'none', borderRadius: 9,
        background: disabled ? '#1a1a2a' : '#6366f1',
        color: disabled ? '#444' : '#fff',
        fontWeight: 700, fontSize: 15,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Spin() {
  return <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  minHeight: '100vh', background: '#080910', color: '#f0f0f0',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '80px 0 40px',
};

const backBtnStyle: React.CSSProperties = {
  flex: '0 0 auto', padding: '13px 20px',
  background: 'transparent', border: '1px solid #1e2330', borderRadius: 9,
  color: '#555', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
};

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
    border: active ? '1px solid #6366f1' : '1px solid #1e2330',
    borderRadius: 99,
    color: active ? '#a5b4fc' : '#666',
    fontWeight: active ? 700 : 500,
    fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
  };
}
