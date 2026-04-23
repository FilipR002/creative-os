'use client';

import { useEffect, useState } from 'react';
import { listCampaigns, getCampaign } from '@/lib/api/creator-client';

interface Creative {
  id:      string;
  label:   string;
  campaign: string;
}

interface Props {
  onSelect:  (creative: Creative) => void;
  onClose:   () => void;
  rowAdName: string;
}

export function CreativeSelectorModal({ onSelect, onClose, rowAdName }: Props) {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    (async () => {
      try {
        const campaigns = await listCampaigns();
        const all: Creative[] = [];
        await Promise.all(
          campaigns.map(async c => {
            try {
              const detail = await getCampaign(c.id);
              // Campaign detail includes creatives in the response
              const creativesArr = (detail as any).creatives ?? [];
              for (const cr of creativesArr) {
                all.push({
                  id:      cr.id,
                  label:   `${cr.format ?? 'Creative'} – Variant ${cr.variant ?? 'A'}`,
                  campaign: c.name ?? `Campaign ${c.id.slice(0,6)}`,
                });
              }
            } catch { /* skip */ }
          })
        );
        setCreatives(all);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = creatives.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.campaign.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex:     100,
        }}
      />

      {/* Modal */}
      <div style={{
        position:     'fixed',
        top:          '50%',
        left:         '50%',
        transform:    'translate(-50%,-50%)',
        zIndex:       101,
        background:   '#0d0e14',
        border:       '1px solid #1e2330',
        borderRadius: 16,
        padding:      '24px',
        width:        480,
        maxWidth:     'calc(100vw - 32px)',
        maxHeight:    '70vh',
        display:      'flex',
        flexDirection: 'column',
        gap:          16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0' }}>Select Creative</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
              Assigning: <em>{rowAdName || 'this ad'}</em>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer', padding: 4 }}
          >
            ×
          </button>
        </div>

        <input
          autoFocus
          placeholder="Search creatives…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width:        '100%',
            padding:      '9px 12px',
            background:   '#080910',
            border:       '1px solid #1e2330',
            borderRadius: 8,
            color:        '#f0f0f0',
            fontSize:     13,
            outline:      'none',
            boxSizing:    'border-box',
            fontFamily:   'inherit',
          }}
        />

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {loading ? (
            <div style={{ fontSize: 13, color: '#444', padding: '16px 0', textAlign: 'center' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ fontSize: 13, color: '#444', padding: '16px 0', textAlign: 'center' }}>
              {creatives.length === 0 ? 'No creatives found. Generate some first.' : 'No matches.'}
            </div>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                style={{
                  display:      'flex',
                  flexDirection: 'column',
                  gap:          2,
                  textAlign:    'left',
                  padding:      '10px 14px',
                  background:   'rgba(255,255,255,0.03)',
                  border:       '1px solid #1e2330',
                  borderRadius: 8,
                  cursor:       'pointer',
                  transition:   'all 0.15s',
                  fontFamily:   'inherit',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1e2330'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f0' }}>{c.label}</span>
                <span style={{ fontSize: 11, color: '#555' }}>{c.campaign}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
