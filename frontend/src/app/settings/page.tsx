'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';

const ENGINE_CONTEXT = [
  ['Goal Type',      'Sales'],
  ['Industry',       'Other'],
  ['Offer Type',     'SaaS'],
  ['Platform',       'Meta'],
  ['Content Style',  'Storytelling'],
  ['Risk Level',     'Balanced'],
];

export default function SettingsPage() {
  const [name, setName] = useState('Filip Radonjic');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">Settings</h1>
            <p className="page-sub">Manage your profile and engine context.</p>
          </div>

          {/* Profile card */}
          <div className="settings-card">
            <div className="settings-card-label">Profile</div>

            <div style={{ marginBottom: 16 }}>
              <div className="form-label">Full Name</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
                <button className="btn-primary" style={{ flexShrink: 0 }} onClick={handleSave}>
                  {saved ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="form-label">Email</div>
              <div style={{ fontSize: 14, color: 'var(--text)', padding: '4px 0' }}>filipradonjic1@gmail.com</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Email cannot be changed.</div>
            </div>

            <div>
              <div className="form-label">Member since</div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>April 20, 2026</div>
            </div>
          </div>

          {/* Engine context */}
          <div className="settings-card">
            <div className="settings-card-label">Engine Context</div>
            <div className="engine-context-grid">
              {ENGINE_CONTEXT.map(([k, v]) => (
                <div key={k} className="engine-context-cell">
                  <div className="engine-context-key">{k}</div>
                  <div className="engine-context-val">{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn-secondary">⟳ Re-run Onboarding</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
