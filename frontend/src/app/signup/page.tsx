'use client';
// ─── Signup Page — Supabase Auth ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { getSupabase }         from '@/lib/supabase';

export default function SignupPage() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const supabase = getSupabase();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/app/dashboard';
    });
    const q = new URLSearchParams(window.location.search).get('email');
    if (q) setEmail(decodeURIComponent(q));
  }, [supabase]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim())  { setError('Please enter your name.');     return; }
    if (!email.trim()) { setError('Please enter your email.');    return; }
    if (!password)     { setError('Please enter a password.');    return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email:    email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        // emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(
        error.message.includes('already registered')
          ? 'An account with this email already exists.'
          : error.message,
      );
      setLoading(false);
      return;
    }

    // Supabase may require email confirmation depending on project settings.
    // If email confirmation is disabled → session is set immediately.
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      window.location.href = '/onboarding';
    } else {
      // Email confirmation required
      setDone(true);
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={shell}>
        <div style={card}>
          <Logo />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', marginTop: 20, marginBottom: 8 }}>Check your email</h2>
          <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: '#f0f0f0' }}>{email}</strong>. Click it to activate your account and get started.
          </p>
          <a href="/login" style={{ display: 'inline-block', marginTop: 24, color: '#a5b4fc', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            ← Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={card}>
        <a href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <Logo />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em' }}>Creative OS</span>
        </a>

        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6, color: '#f0f0f0' }}>Create your account</h1>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 28 }}>Start generating campaigns for free.</p>

        <form onSubmit={handleSignup} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Full name">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Alex Johnson" style={inputStyle} autoComplete="name" autoFocus />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" style={inputStyle} autoComplete="email" />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" style={inputStyle} autoComplete="new-password" />
          </Field>

          {error && (
            <div style={errBox}>
              {error.includes('already exists')
                ? <span>Account exists. <a href="/login" style={{ color: '#fca5a5', fontWeight: 700 }}>Sign in →</a></span>
                : error}
            </div>
          )}

          <button type="submit" disabled={loading} style={submitBtn(loading)}>
            {loading ? 'Creating account…' : 'Create Account →'}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#555' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 600 }}>Sign in</a>
        </p>
      </div>
      <style>{`input:focus{outline:none!important;border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,0.15)}`}</style>
    </div>
  );
}

function Logo() {
  return <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>C</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

const shell:      React.CSSProperties = { minHeight: '100vh', background: '#080910', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' };
const card:       React.CSSProperties = { width: '100%', maxWidth: 420, background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 18, padding: '36px 32px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 14px', background: '#111', border: '1px solid #1e2330', borderRadius: 8, color: '#f0f0f0', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
const errBox:     React.CSSProperties = { background: '#1a0a0a', border: '1px solid #3a1010', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#f87171', lineHeight: 1.5 };
const submitBtn = (loading: boolean): React.CSSProperties => ({ marginTop: 4, padding: '13px', background: loading ? '#2d2d4a' : '#6366f1', color: loading ? '#666' : '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', width: '100%', fontFamily: 'inherit' });
