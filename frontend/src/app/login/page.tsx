'use client';
// ─── Login / Signup — tabbed auth page ───────────────────────────────────────

import { useState, useEffect } from 'react';
import { getSupabase }         from '@/lib/supabase';

type Tab = 'signin' | 'signup';

export default function AuthPage() {
  const [tab,      setTab]      = useState<Tab>('signin');
  // sign-in fields
  const [siEmail,  setSiEmail]  = useState('');
  const [siPass,   setSiPass]   = useState('');
  // sign-up fields
  const [suName,   setSuName]   = useState('');
  const [suEmail,  setSuEmail]  = useState('');
  const [suPass,   setSuPass]   = useState('');
  // shared
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');
  const [done,     setDone]     = useState(false); // email confirm sent

  const supabase = getSupabase();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/dashboard';
    });
    // Pre-fill from query string
    const q    = new URLSearchParams(window.location.search);
    const mode = q.get('mode');
    const mail = q.get('email');
    if (mode === 'signup') setTab('signup');
    if (mail) { setSiEmail(decodeURIComponent(mail)); setSuEmail(decodeURIComponent(mail)); }
  }, [supabase]);

  function switchTab(t: Tab) {
    setTab(t);
    setErr('');
    setDone(false);
  }

  // ── Sign In ────────────────────────────────────────────────────────────────

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!siEmail.trim()) { setErr('Please enter your email.');    return; }
    if (!siPass)         { setErr('Please enter your password.'); return; }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email:    siEmail.trim(),
      password: siPass,
    });

    if (error) {
      setErr(
        error.message.toLowerCase().includes('invalid')
          ? 'Incorrect email or password.'
          : error.message,
      );
      setLoading(false);
      return;
    }

    const next = new URLSearchParams(window.location.search).get('next') ?? '/dashboard';
    window.location.href = next;
  }

  // ── Sign Up ────────────────────────────────────────────────────────────────

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!suName.trim())  { setErr('Please enter your full name.');           return; }
    if (!suEmail.trim()) { setErr('Please enter your email.');               return; }
    if (!suPass)         { setErr('Please enter a password.');               return; }
    if (suPass.length < 6) { setErr('Password must be at least 6 characters.'); return; }

    setLoading(true);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signUp({
      email:    suEmail.trim(),
      password: suPass,
      options: {
        data: { full_name: suName.trim() },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      setErr(
        error.message.toLowerCase().includes('already registered')
          ? 'An account with this email already exists.'
          : error.message,
      );
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      window.location.href = '/dashboard';
    } else {
      setDone(true);
      setLoading(false);
    }
  }

  // ── Email confirm screen ───────────────────────────────────────────────────

  if (done) {
    return (
      <div style={shell}>
        <div style={card}>
          <Logo />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', marginTop: 20, marginBottom: 10 }}>Check your email</h2>
          <p style={{ fontSize: 14, color: '#888', lineHeight: 1.7 }}>
            We sent a confirmation link to{' '}
            <strong style={{ color: '#f0f0f0' }}>{suEmail}</strong>.<br />
            Click it to activate your account.
          </p>
          <button onClick={() => { setDone(false); setTab('signin'); }}
            style={{ marginTop: 24, background: 'none', border: 'none', color: '#a5b4fc', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            ← Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // ── Main auth card ─────────────────────────────────────────────────────────

  return (
    <div style={shell}>
      <div style={card}>

        {/* Logo */}
        <a href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <Logo />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em' }}>Creative OS</span>
        </a>

        {/* Tab switcher */}
        <div style={tabBar}>
          <button style={tabBtn(tab === 'signin')}  onClick={() => switchTab('signin')}>Sign In</button>
          <button style={tabBtn(tab === 'signup')}  onClick={() => switchTab('signup')}>Sign Up</button>
        </div>

        {/* Sign In form */}
        {tab === 'signin' && (
          <>
            <p style={subtitle}>Welcome back — sign in to your account.</p>
            <form onSubmit={handleSignIn} noValidate style={formStyle}>
              <Field label="Email">
                <input
                  type="email" value={siEmail}
                  onChange={e => { setSiEmail(e.target.value); setErr(''); }}
                  placeholder="you@example.com"
                  style={inputStyle} autoComplete="email" autoFocus
                />
              </Field>
              <Field label="Password">
                <input
                  type="password" value={siPass}
                  onChange={e => { setSiPass(e.target.value); setErr(''); }}
                  placeholder="••••••••"
                  style={inputStyle} autoComplete="current-password"
                />
              </Field>
              {err && <ErrBox>{err}</ErrBox>}
              <button type="submit" disabled={loading} style={submitBtn(loading)}>
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>
            </form>
            <p style={switchHint}>
              No account?{' '}
              <button onClick={() => switchTab('signup')} style={linkBtn}>Create one free →</button>
            </p>
          </>
        )}

        {/* Sign Up form */}
        {tab === 'signup' && (
          <>
            <p style={subtitle}>Create your account — free to start.</p>
            <form onSubmit={handleSignUp} noValidate style={formStyle}>
              <Field label="Full name">
                <input
                  value={suName}
                  onChange={e => { setSuName(e.target.value); setErr(''); }}
                  placeholder="Alex Johnson"
                  style={inputStyle} autoComplete="name" autoFocus
                />
              </Field>
              <Field label="Email">
                <input
                  type="email" value={suEmail}
                  onChange={e => { setSuEmail(e.target.value); setErr(''); }}
                  placeholder="you@company.com"
                  style={inputStyle} autoComplete="email"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password" value={suPass}
                  onChange={e => { setSuPass(e.target.value); setErr(''); }}
                  placeholder="Min. 6 characters"
                  style={inputStyle} autoComplete="new-password"
                />
              </Field>
              {err && (
                <ErrBox>
                  {err.includes('already exists')
                    ? <span>Account exists. <button onClick={() => switchTab('signin')} style={{ ...linkBtn, color: '#fca5a5' }}>Sign in →</button></span>
                    : err}
                </ErrBox>
              )}
              <button type="submit" disabled={loading} style={submitBtn(loading)}>
                {loading ? 'Creating account…' : 'Create Account →'}
              </button>
            </form>
            <p style={switchHint}>
              Already have an account?{' '}
              <button onClick={() => switchTab('signin')} style={linkBtn}>Sign in →</button>
            </p>
          </>
        )}

      </div>
      <style>{`input:focus{outline:none!important;border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,0.15)}`}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      C
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#1a0a0a', border: '1px solid #3a1010', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
      {children}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const shell:      React.CSSProperties = { minHeight: '100vh', background: '#080910', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' };
const card:       React.CSSProperties = { width: '100%', maxWidth: 420, background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 18, padding: '36px 32px' };
const tabBar:     React.CSSProperties = { display: 'flex', background: '#111', border: '1px solid #1e2330', borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 };
const tabBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
  background: active ? '#6366f1' : 'transparent',
  color:      active ? '#fff'    : '#555',
  transition: 'all 0.15s',
  fontFamily: 'inherit',
});
const subtitle:   React.CSSProperties = { fontSize: 14, color: '#555', marginBottom: 22, marginTop: -4 };
const formStyle:  React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 14px', background: '#111', border: '1px solid #1e2330', borderRadius: 8, color: '#f0f0f0', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s' };
const switchHint: React.CSSProperties = { marginTop: 22, textAlign: 'center', fontSize: 14, color: '#555' };
const linkBtn:    React.CSSProperties = { background: 'none', border: 'none', color: '#a5b4fc', fontWeight: 600, cursor: 'pointer', fontSize: 14, padding: 0, fontFamily: 'inherit' };
const submitBtn = (loading: boolean): React.CSSProperties => ({ marginTop: 4, padding: '13px', background: loading ? '#2d2d4a' : '#6366f1', color: loading ? '#666' : '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', width: '100%', fontFamily: 'inherit', transition: 'background 0.15s' });
