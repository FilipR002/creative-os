'use client';
// ─── Dashboard — campaigns + admin observatory ────────────────────────────────

import { useEffect, useState, useRef } from 'react';
import { listCampaigns, ensureUser } from '@/lib/api/creator-client';
import { ObservatoryPanel } from '@/components/ObservatoryPanel';
import type { CampaignWithConcept } from '@/lib/api/creator-client';

const ADMIN_EMAIL = 'filipradonjic1@gmail.com';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#555', GENERATED: '#6366f1', SCORED: '#f59e0b', DONE: '#22c55e',
};

type MainTab = 'campaigns' | 'observatory';

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<CampaignWithConcept[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<MainTab>('campaigns');

  // Email / admin identity
  const [email,       setEmail]       = useState('');
  const [emailInput,  setEmailInput]  = useState('');
  const [showPrompt,  setShowPrompt]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = email === ADMIN_EMAIL;

  // Load saved email on mount
  useEffect(() => {
    const saved = localStorage.getItem('cos_user_email') ?? '';
    setEmail(saved);
  }, []);

  // If observatory tab is active but admin revoked, fall back
  useEffect(() => {
    if (tab === 'observatory' && !isAdmin) setTab('campaigns');
  }, [isAdmin, tab]);

  useEffect(() => {
    (async () => {
      await ensureUser();
      try { setCampaigns(await listCampaigns()); }
      catch { setCampaigns([]); }
      finally { setLoading(false); }
    })();
  }, []);

  function openEmailPrompt() {
    setEmailInput(email);
    setShowPrompt(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function saveEmail() {
    const trimmed = emailInput.trim().toLowerCase();
    localStorage.setItem('cos_user_email', trimmed);
    setEmail(trimmed);
    setShowPrompt(false);
  }

  return (
    <div style={shell}>
      {/* Nav */}
      <nav style={nav}>
        <span style={logo}>Creative OS</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Email identity pill */}
          <button onClick={openEmailPrompt} style={emailPill}>
            {email
              ? <><span style={{ opacity: 0.6, marginRight: 4 }}>👤</span>{email}</>
              : <span style={{ opacity: 0.6 }}>Set email for admin access</span>
            }
          </button>

          <a href="/app/app/campaign/new" style={btnPrimary}>+ New Campaign</a>
        </div>
      </nav>

      {/* Email prompt modal */}
      {showPrompt && (
        <div style={overlay} onClick={() => setShowPrompt(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Your email</div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              Used to unlock admin features. Stays in your browser only.
            </p>
            <input
              ref={inputRef}
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEmail()}
              placeholder="you@example.com"
              style={{ width: '100%', padding: '10px 14px', background: '#111', border: '1px solid #2a2a3a', borderRadius: 8, color: '#f0f0f0', fontSize: 14, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEmail} style={{ ...btnPrimary, flex: 1, padding: '10px', fontSize: 14 }}>Save</button>
              <button onClick={() => setShowPrompt(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1e2330', borderRadius: 8, color: '#666', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={content}>
        {/* Page header + tab switcher */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {tab === 'campaigns' ? 'Campaigns' : '🔭 Observatory'}
            </h1>
            <p style={{ color: '#666', fontSize: 14 }}>
              {tab === 'campaigns'
                ? 'AI-generated creative strategies for every brief.'
                : 'Live AI decision observability — admin view.'}
            </p>
          </div>

          {/* Main tab switcher — only shown when admin */}
          {isAdmin && (
            <div style={{ display: 'flex', gap: 4, background: '#111', borderRadius: 10, padding: 4 }}>
              <TabBtn active={tab === 'campaigns'}   onClick={() => setTab('campaigns')}>📁 Campaigns</TabBtn>
              <TabBtn active={tab === 'observatory'} onClick={() => setTab('observatory')}>🔭 Observatory</TabBtn>
            </div>
          )}
        </div>

        {/* ── Campaigns tab ── */}
        {tab === 'campaigns' && (
          <>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ height: 140, borderRadius: 12, background: '#111', animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>✦</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No campaigns yet</h2>
                <p style={{ color: '#666', fontSize: 14, marginBottom: 28 }}>
                  Create your first campaign to get AI-powered creatives.
                </p>
                <a href="/app/app/campaign/new" style={btnPrimary}>Create campaign</a>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
                {campaigns.map(c => (
                  <a key={c.id} href={`/app/app/campaign/${c.id}/concepts`} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[c.status] ?? '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {c.status}
                      </span>
                      <span style={{ fontSize: 11, color: '#444' }}>{fmtDate(c.createdAt)}</span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35, marginBottom: 8, color: '#f0f0f0' }}>
                      {c.concept?.coreMessage
                        ? c.concept.coreMessage.length > 60
                          ? c.concept.coreMessage.slice(0, 57) + '…'
                          : c.concept.coreMessage
                        : 'Campaign ' + c.id.slice(0, 8)}
                    </h3>
                    {c.concept && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Tag>{c.concept.goal}</Tag>
                        {c.concept.platform && <Tag>{c.concept.platform}</Tag>}
                        {c.concept.emotion  && <Tag>{c.concept.emotion}</Tag>}
                      </div>
                    )}
                    <div style={{ marginTop: 16, fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
                      View creatives →
                    </div>
                  </a>
                ))}

                {/* New campaign card */}
                <a href="/app/app/campaign/new" style={{ ...card, background: 'transparent', border: '2px dashed #1e2330', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, minHeight: 140, textDecoration: 'none' }}>
                  <span style={{ fontSize: 28, opacity: 0.3 }}>+</span>
                  <span style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>New campaign</span>
                </a>
              </div>
            )}
          </>
        )}

        {/* ── Observatory tab (admin only) ── */}
        {tab === 'observatory' && isAdmin && (
          <ObservatoryPanel />
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}`}</style>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: 7, border: 'none', fontWeight: 600, fontSize: 13,
      background: active ? '#6366f1' : 'transparent',
      color: active ? '#fff' : '#555',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, color: '#888', background: '#1a1a2e', padding: '2px 8px', borderRadius: 99 }}>{children}</span>;
}

const shell: React.CSSProperties    = { minHeight: '100vh', background: '#0d0e14', color: '#f0f0f0', fontFamily: 'system-ui, sans-serif' };
const nav: React.CSSProperties      = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e2330' };
const logo: React.CSSProperties     = { fontSize: 14, fontWeight: 800, color: '#6366f1', letterSpacing: '-0.01em' };
const content: React.CSSProperties  = { maxWidth: 1100, margin: '0 auto', padding: '48px 24px' };
const btnPrimary: React.CSSProperties = { padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const card: React.CSSProperties     = { display: 'block', background: '#111', border: '1px solid #1e2330', borderRadius: 12, padding: 20, cursor: 'pointer', textDecoration: 'none', transition: 'border-color 0.15s', minHeight: 140 };
const emailPill: React.CSSProperties = { padding: '6px 14px', background: '#111', border: '1px solid #1e2330', borderRadius: 99, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'inherit', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const overlay: React.CSSProperties  = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal: React.CSSProperties    = { background: '#13141c', border: '1px solid #1e2330', borderRadius: 14, padding: 28, width: 360, maxWidth: '90vw' };
