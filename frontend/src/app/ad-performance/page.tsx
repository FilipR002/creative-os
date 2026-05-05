'use client';

import { useState } from 'react';

export default function AdPerformancePage() {
  const [campaignId,   setCampaignId]   = useState('');
  const [angle,        setAngle]        = useState('before after');
  const [impressions,  setImpressions]  = useState('10000');
  const [clicks,       setClicks]       = useState('450');
  const [conversions,  setConversions]  = useState('32');
  const [spend,        setSpend]        = useState('250.00');
  const [revenue,      setRevenue]      = useState('890.00');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);

  async function handleSubmit() {
    if (!campaignId.trim() || submitting) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
        <div className="page-content" style={{ display: 'flex', gap: 20, padding: '28px 32px' }}>
          {/* Left form col */}
          <div className="adperf-form-col">
            <h1 className="page-title" style={{ marginBottom: 6 }}>Outcome Learning</h1>
            <p className="page-sub" style={{ marginBottom: 24, lineHeight: 1.6 }}>
              Report real ad performance → the engine updates angle weights automatically.
            </p>

            <div className="adperf-panel">
              <div className="adperf-panel-label">Report Outcome</div>

              <div style={{ marginBottom: 14 }}>
                <div className="form-label">Campaign ID</div>
                <input className="form-input" placeholder="Paste your campaign ID" value={campaignId} onChange={e => setCampaignId(e.target.value)} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div className="form-label">Angle</div>
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                  <span>{angle}</span>
                  <span style={{ color: 'var(--sub)' }}>▾</span>
                </div>
              </div>

              <div className="metric-grid-3">
                {([['Impressions *', impressions, setImpressions], ['Clicks *', clicks, setClicks], ['Conversions *', conversions, setConversions]] as [string,string,(v:string)=>void][]).map(([label, val, set]) => (
                  <div key={label}>
                    <div className="form-label">{label}</div>
                    <input className="form-input" value={val} onChange={e => set(e.target.value)} />
                  </div>
                ))}
              </div>

              <div className="metric-grid-2">
                {([['Spend ($) Optional', spend, setSpend], ['Revenue ($) Optional', revenue, setRevenue]] as [string,string,(v:string)=>void][]).map(([label, val, set]) => (
                  <div key={label}>
                    <div className="form-label">{label}</div>
                    <input className="form-input" value={val} onChange={e => set(e.target.value)} />
                  </div>
                ))}
              </div>

              <div className="warning-note">
                ⚠ Minimum 100 impressions required. Lower volumes are ignored as noise.
              </div>

              <button
                onClick={handleSubmit}
                disabled={!campaignId.trim() || submitting}
                style={{ width: '100%', height: 44, background: 'var(--grad)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,201,122,0.35)', opacity: (!campaignId.trim() || submitting) ? 0.6 : 1 }}
              >
                {submitting ? 'Submitting…' : '↑ Submit Outcome'}
              </button>
            </div>

            <div className="adperf-panel">
              <div className="adperf-panel-label">Recent Outcomes</div>
              {submitted ? (
                <p style={{ fontSize: 13, color: 'var(--accent-l)' }}>✓ Outcome submitted successfully.</p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>No outcomes reported yet.</p>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="adperf-right">
            <div className="adperf-panel-label">Learned Angle Weights</div>
            <div className="empty-state">
              <div className="empty-icon">◎</div>
              <p className="empty-text">No outcome data yet. Submit your first report to begin learning.</p>
            </div>
          </div>
        </div>
  );
}
