'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  listCampaigns,
  deleteCampaign,
  groupAdsIntoCampaign,
  type CampaignWithConcept,
} from '@/lib/api/creator-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'campaigns' | 'quick-ads';

// SINGLE = quick ad (one-off, no name required)
// FULL   = full campaign with strategy
// PARTIAL= quick ad that was grouped into a FULL campaign
function isQuickAd(c: CampaignWithConcept) {
  return c.mode === 'SINGLE' && !c.groupCampaignId;
}
function isCampaign(c: CampaignWithConcept) {
  return c.mode === 'FULL' || c.mode === 'PARTIAL';
}

function formatLabel(fmt: string) {
  if (fmt === 'VIDEO')    return { icon: '🎬', label: 'Video'    };
  if (fmt === 'CAROUSEL') return { icon: '🖼️',  label: 'Carousel' };
  if (fmt === 'BANNER')   return { icon: '⬛', label: 'Banner'   };
  return { icon: '📄', label: fmt };
}

function scoreColor(s: number) {
  if (s >= 0.65) return '#10b981';
  if (s >= 0.40) return '#f59e0b';
  return '#6b7280';
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteModal({
  campaign,
  onConfirm,
  onCancel,
  deleting,
}: {
  campaign: CampaignWithConcept;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  const name = campaign.name || campaign.concept?.coreMessage?.slice(0, 50) || campaign.id.slice(0, 8);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: 400, maxWidth: '90vw' }}>
        <div style={{ fontSize: 24, marginBottom: 12, textAlign: 'center' }}>🗑️</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px', textAlign: 'center' }}>Delete Campaign</h3>
        <p style={{ fontSize: 13, color: 'var(--sub)', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>&ldquo;{name}&rdquo;</strong>?
          <br />All creatives and associated data will be permanently removed.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={deleting}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--sub)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group Into Campaign Modal ────────────────────────────────────────────────

function GroupModal({
  count,
  onConfirm,
  onCancel,
  loading,
}: {
  count: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: 420, maxWidth: '90vw' }}>
        <div style={{ fontSize: 24, marginBottom: 12, textAlign: 'center' }}>📁</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>Create Campaign from Ads</h3>
        <p style={{ fontSize: 13, color: 'var(--sub)', textAlign: 'center', marginBottom: 20 }}>
          Group <strong style={{ color: 'var(--text)' }}>{count} quick ad{count !== 1 ? 's' : ''}</strong> into a named campaign.
        </p>
        <div className="form-label" style={{ marginBottom: 6 }}>Campaign Name</div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); }}
          placeholder="e.g. Q3 Meta Launch"
          autoFocus
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={loading}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--sub)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={() => name.trim() && onConfirm(name.trim())} disabled={!name.trim() || loading}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--indigo)', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: !name.trim() || loading ? 'not-allowed' : 'pointer', opacity: !name.trim() || loading ? 0.6 : 1 }}>
            {loading ? 'Creating…' : '✦ Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onDelete,
  selectable,
  selected,
  onToggle,
}: {
  campaign: CampaignWithConcept;
  onDelete: (c: CampaignWithConcept) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
}) {
  const name     = campaign.name || campaign.concept?.coreMessage?.slice(0, 60) || `Campaign ${campaign.id.slice(0, 6)}`;
  const formats  = campaign.creatives?.map(c => c.format) ?? [];
  const unique   = [...new Set(formats)];
  const topScore = campaign.creatives
    ?.filter(c => c.score)
    .sort((a, b) => (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0))[0]
    ?.score?.totalScore ?? null;

  return (
    <div className="campaign-card" style={{ position: 'relative', textDecoration: 'none', cursor: 'default',
      outline: selected ? '2px solid var(--indigo)' : undefined }}>
      {selectable && (
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}
          onClick={e => { e.preventDefault(); onToggle?.(campaign.id); }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${selected ? 'var(--indigo)' : 'var(--border)'}`,
            background: selected ? 'var(--indigo)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {selected && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>✓</span>}
          </div>
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={e => { e.preventDefault(); onDelete(campaign); }}
        style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
        title="Delete">
        🗑
      </button>

      <Link href={`/campaigns/${campaign.id}`} style={{ textDecoration: 'none', display: 'block', paddingLeft: selectable ? 28 : 0 }}>
        <div className="campaign-card-header">
          <span className={`perf-badge ${topScore !== null ? (topScore >= 0.65 ? 'perf-high' : topScore >= 0.40 ? 'perf-medium' : 'perf-low') : 'perf-medium'}`}>
            {topScore !== null ? `${(topScore * 100).toFixed(0)}%` : campaign.status}
          </span>
          <span className="campaign-card-date">{relativeTime(campaign.createdAt as unknown as string)}</span>
        </div>

        <div className="campaign-card-title" style={{ paddingRight: 32 }}>{name}</div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {unique.map(f => {
            const { icon, label } = formatLabel(f);
            return <span key={f} className="tag tag-green">{icon} {label}</span>;
          })}
          {campaign.goal && <span className="tag tag-muted">{campaign.goal}</span>}
        </div>

        {topScore !== null && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${topScore * 100}%`, background: scoreColor(topScore), borderRadius: 99, transition: 'width 0.4s' }} />
            </div>
            <span style={{ fontSize: 10, color: scoreColor(topScore), fontWeight: 700 }}>{(topScore * 100).toFixed(0)}%</span>
          </div>
        )}
      </Link>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [all,         setAll]         = useState<CampaignWithConcept[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [tab,         setTab]         = useState<Tab>('campaigns');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<CampaignWithConcept | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // Group state
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [groupModal,   setGroupModal]   = useState(false);
  const [grouping,     setGrouping]     = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCampaigns();
      setAll(data);
    } catch {
      setError('Could not load campaigns — check backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Derived lists
  const campaigns = all.filter(isCampaign);
  const quickAds  = all.filter(isQuickAd);
  const displayed = tab === 'campaigns' ? campaigns : quickAds;

  // ── Delete ──────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCampaign(deleteTarget.id);
      setAll(prev => prev.filter(c => c.id !== deleteTarget.id));
      setSelectedIds(prev => { prev.delete(deleteTarget.id); return new Set(prev); });
      setDeleteTarget(null);
    } catch {
      setDeleting(false);
    }
    setDeleting(false);
  }

  // ── Group ───────────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleGroup(name: string) {
    setGrouping(true);
    try {
      await groupAdsIntoCampaign(name, [...selectedIds]);
      setSelectedIds(new Set());
      setGroupModal(false);
      await fetchAll();  // refresh from backend
    } catch {
      // keep modal open on error
    } finally {
      setGrouping(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
        <div className="page-content">

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h1 className="page-title">Campaigns</h1>
              <p className="page-sub">Manage all your campaigns and quick ads.</p>
            </div>
            <Link href="/create" className="btn-primary sm">✦ New</Link>
          </div>

          {/* Tabs */}
          <div className="tab-strip" style={{ marginBottom: 20 }}>
            <button className={`tab-pill${tab === 'campaigns' ? ' active' : ''}`} onClick={() => { setTab('campaigns'); setSelectedIds(new Set()); }}>
              📋 Campaigns <span style={{ opacity: 0.6 }}>({campaigns.length})</span>
            </button>
            <button className={`tab-pill${tab === 'quick-ads' ? ' active' : ''}`} onClick={() => { setTab('quick-ads'); setSelectedIds(new Set()); }}>
              ⚡ Quick Ads <span style={{ opacity: 0.6 }}>({quickAds.length})</span>
            </button>
          </div>

          {/* Quick Ads action bar */}
          {tab === 'quick-ads' && selectedIds.size > 0 && (
            <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{selectedIds.size} ad{selectedIds.size !== 1 ? 's' : ''} selected</span>
              <button onClick={() => setGroupModal(true)}
                style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: 'var(--indigo)', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                📁 Create Campaign from Selection
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
                Clear
              </button>
            </div>
          )}

          {/* Select-all hint for quick ads */}
          {tab === 'quick-ads' && quickAds.length > 0 && selectedIds.size === 0 && (
            <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--muted)' }}>
              ✓ Click the checkbox on any ad to select it, then group into a campaign.
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 24, color: 'var(--muted)' }}>
              <div className="spinner" />
              <span>Loading…</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--rose)', marginBottom: 16 }}>
              ⚠ {error}
              <button onClick={fetchAll} style={{ marginLeft: 12, fontSize: 12, color: 'var(--indigo-l)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Retry</button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && displayed.length === 0 && (
            <div className="empty-page">
              <div className="empty-page-icon">{tab === 'campaigns' ? '📋' : '⚡'}</div>
              <div className="empty-page-title">
                {tab === 'campaigns' ? 'No campaigns yet' : 'No quick ads yet'}
              </div>
              <div className="empty-page-sub">
                {tab === 'campaigns'
                  ? 'Switch to Campaign mode in Create to generate a full strategy campaign.'
                  : 'Quick Ads appear here when you generate in Quick Ad mode.'}
              </div>
              <Link href="/create" className="empty-page-cta">
                ✦ {tab === 'campaigns' ? 'Create a Campaign' : 'Create a Quick Ad'}
              </Link>
            </div>
          )}

          {/* Grid */}
          {!loading && !error && displayed.length > 0 && (
            <div className="campaigns-grid">
              {displayed.map(c => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onDelete={setDeleteTarget}
                  selectable={tab === 'quick-ads'}
                  selected={selectedIds.has(c.id)}
                  onToggle={toggleSelect}
                />
              ))}
              <Link href="/create" className="campaign-card-new" style={{ textDecoration: 'none' }}>
                <div className="campaign-card-new-icon">+</div>
                <span className="campaign-card-new-text">
                  {tab === 'campaigns' ? 'New campaign' : 'New quick ad'}
                </span>
              </Link>
            </div>
          )}

        </div>
      </main>

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          campaign={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
          deleting={deleting}
        />
      )}

      {/* Group modal */}
      {groupModal && (
        <GroupModal
          count={selectedIds.size}
          onConfirm={handleGroup}
          onCancel={() => { if (!grouping) setGroupModal(false); }}
          loading={grouping}
        />
      )}
    </div>
  );
}
