'use client';
// ─── Login Page — Supabase Auth ───────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { getSupabase }         from '@/lib/supabase';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');

  const supabase = getSupabase();

  useEffect(() => {
    // Already logged in → skip to app
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/dashboard';
    });
    // Pre-fill email from query string
    const q = new URLSearchParams(window.location.search).get('email');
    if (q) setEmail(decodeURIComponent(q));
  }, [supabase]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!email.trim()) { setErr('Please enter your email.');    return; }
    if (!password)     { setErr('Please enter your password.'); return; }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    });

    if (error) {
      setErr(
        error.message.includes('Invalid login')
          ? 'Incorrect email or password.'
          : error.message,
      );
      setLoading(false);
      return;
    }

    // Session set via cookie automatically — redirect
    const next = new URLSearchParams(window.location.search).get('next') ?? '/dashboard';
    window.location.href = next;
  }

  return (
    <div style={shell}>
      <div style={card}>
        <a href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <Logo />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em' }}>Creative OS</span>
        </a>

        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6, color: '#f0f0f0' }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 28 }}>Sign in to your Creative OS account.</p>

        <form onSubmit={handleLogin} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErr(''); }}
              placeholder="you@example.com"
              style={inputStyle}
              autoComplete="email"
              autoFocus
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setErr(''); }}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="current-password"
            />
          </Field>

          {err && <div style={errBox}>{err}</div>}

          <button type="submit" disabled={loading} style={submitBtn(loading)}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p style={{ marginTop: 28, textAlign: 'center', fontSize: 14, color: '#555' }}>
          Don't have an account?{' '}
          <a href="/signup" style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 600 }}>Sign up free</a>
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
const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 14px', background: '#111', border: '1px solid #1e2330', borderRadius: 8, color: '#f0f0f0', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s' };
const errBox:     React.CSSProperties = { background: '#1a0a0a', border: '1px solid #3a1010', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' };
const submitBtn = (loading: boolean): React.CSSProperties => ({ marginTop: 4, padding: '13px', background: loading ? '#2d2d4a' : '#6366f1', color: loading ? '#666' : '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', width: '100%', fontFamily: 'inherit' });
