'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams }   from 'next/navigation';
import Link            from 'next/link';
import { Sidebar }     from '@/components/Sidebar';
import {
  getCampaign,
  listAdGroups,
  createAdGroup,
  renameAdGroup,
  deleteAdGroup,
  moveCreative,
  reorderCreatives,
  type AdGroup,
  type AdGroupCreative,
  type CampaignGroups,
  type CampaignWithConcept,
} from '@/lib/api/creator-client';

// ─── Format helpers ───────────────────────────────────────────────────────────

const FORMAT_META: Record<string, { icon: string; color: string; label: string }> = {
  VIDEO:    { icon: '🎬', color: '#6366f1', label: 'Video'    },
  CAROUSEL: { icon: '🖼️',  color: '#8b5cf6', label: 'Carousel' },
  BANNER:   { icon: '⬛', color: '#f59e0b', label: 'Banner'   },
};

function fmtMeta(fmt: string) {
  return FORMAT_META[fmt.toUpperCase()] ?? { icon: '📄', color: '#6b7280', label: fmt };
}

function scoreBar(s: number) {
  const c = s >= 0.65 ? '#10b981' : s >= 0.40 ? '#f59e0b' : '#6b7280';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
      <div style={{ flex: 1, height: 2, background: 'var(--border)', borderRadius: 99 }}>
        <div style={{ height: '100%', width: `${s * 100}%`, background: c, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 9, color: c, fontWeight: 700, flexShrink: 0 }}>{(s * 100).toFixed(0)}%</span>
    </div>
  );
}

// ─── Drag state singleton ─────────────────────────────────────────────────────
// We track drag info in refs so we don't cause re-renders during drag.

interface DragInfo {
  creativeId:    string;
  sourceGroupId: string | null; // null = ungrouped
  sourceIndex:   number;
}

// ─── Creative Card ────────────────────────────────────────────────────────────

function CreativeCard({
  creative,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  creative:    AdGroupCreative;
  isDragging:  boolean;
  onDragStart: (e: React.DragEvent, c: AdGroupCreative) => void;
  onDragEnd:   (e: React.DragEvent) => void;
}) {
  const { icon, color, label } = fmtMeta(creative.format);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, creative)}
      onDragEnd={onDragEnd}
      style={{
        padding: '10px 12px',
        background: 'var(--bg)',
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? 'scale(0.97)' : 'scale(1)',
        transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
        boxShadow: isDragging ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
        {creative.isWinner && (
          <span style={{ marginLeft: 'auto', fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 700 }}>WINNER</span>
        )}
        {creative.variant !== 'A' && (
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(99,102,241,0.1)', color: 'var(--indigo-l)', fontWeight: 700 }}>v{creative.variant}</span>
        )}
        {/* Drag handle visual */}
        <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--muted)', cursor: 'grab', lineHeight: 1 }}>⠿</span>
      </div>
      {creative.angle && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Angle: {creative.angle.label}</div>
      )}
      {creative.score && scoreBar(creative.score.totalScore)}
    </div>
  );
}

// ─── Drop Zone (between cards) ────────────────────────────────────────────────

function DropLine({ active }: { active: boolean }) {
  return (
    <div style={{
      height: active ? 3 : 2,
      borderRadius: 99,
      background: active ? 'var(--indigo)' : 'transparent',
      margin: '2px 0',
      transition: 'all 0.1s',
      boxShadow: active ? '0 0 6px var(--indigo)' : 'none',
    }} />
  );
}

// ─── Ad Group Column ──────────────────────────────────────────────────────────

function AdGroupColumn({
  group,
  draggingId,
  onDragStart,
  onDragEnd,
  onDropOnGroup,
  onDropBetween,
  onRename,
  onDelete,
  dropTargetGroupId,
  dropTargetIndex,
}: {
  group:              AdGroup | { id: null; name: string; creatives: AdGroupCreative[] };
  draggingId:         string | null;
  onDragStart:        (e: React.DragEvent, c: AdGroupCreative, groupId: string | null) => void;
  onDragEnd:          (e: React.DragEvent) => void;
  onDropOnGroup:      (groupId: string | null) => void;
  onDropBetween:      (groupId: string | null, index: number) => void;
  onRename?:          (groupId: string, newName: string) => void;
  onDelete?:          (groupId: string) => void;
  dropTargetGroupId:  string | null | undefined; // undefined = nothing over this column
  dropTargetIndex:    number | null;
}) {
  const [editing,  setEditing]  = useState(false);
  const [nameVal,  setNameVal]  = useState('id' in group && group.id ? group.name : '');
  const [hovered,  setHovered]  = useState(false);

  const isDropTarget = dropTargetGroupId === (group.id ?? null);
  const isEmpty      = group.creatives.length === 0;

  return (
    <div
      style={{
        minWidth: 240,
        maxWidth: 280,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        background: isDropTarget ? 'rgba(99,102,241,0.04)' : hovered ? 'rgba(255,255,255,0.02)' : 'var(--surface)',
        border: `1.5px solid ${isDropTarget ? 'var(--indigo)' : 'var(--border)'}`,
        borderRadius: 12,
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragOver={e => { e.preventDefault(); }}
      onDrop={e => { e.preventDefault(); onDropOnGroup(group.id ?? null); }}
    >
      {/* Group header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)' }}>
        {group.id !== null && editing ? (
          <input
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (nameVal.trim() && nameVal !== group.name && onRename && group.id) {
                onRename(group.id, nameVal.trim());
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter')  { (e.target as HTMLInputElement).blur(); }
              if (e.key === 'Escape') { setEditing(false); setNameVal(group.name); }
            }}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'inherit' }}
          />
        ) : (
          <span
            onClick={() => { if (group.id !== null) { setEditing(true); setNameVal(group.name); } }}
            style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: group.id !== null ? 'text' : 'default' }}
            title={group.id !== null ? 'Click to rename' : undefined}
          >
            {group.name}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>{group.creatives.length}</span>
        {group.id !== null && onDelete && (
          <button
            onClick={() => onDelete(group.id as string)}
            style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            title="Delete group">
            ✕
          </button>
        )}
      </div>

      {/* Cards + drop lines */}
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 0, minHeight: 120, flex: 1 }}>
        {isEmpty ? (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onDropOnGroup(group.id ?? null); }}
            style={{
              flex: 1, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: 'var(--muted)', borderRadius: 6,
              border: `1.5px dashed ${isDropTarget ? 'var(--indigo)' : 'var(--border)'}`,
              transition: 'border-color 0.15s',
            }}>
            {isDropTarget ? '↓ Drop here' : 'Drop ads here'}
          </div>
        ) : (
          <>
            {/* Drop line before first */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); onDropBetween(group.id ?? null, 0); }}
            >
              <DropLine active={isDropTarget && dropTargetIndex === 0} />
            </div>
            {group.creatives.map((c, idx) => (
              <div key={c.id}>
                <CreativeCard
                  creative={c}
                  isDragging={draggingId === c.id}
                  onDragStart={(e, creative) => onDragStart(e, creative, group.id ?? null)}
                  onDragEnd={onDragEnd}
                />
                {/* Drop line after each card */}
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); onDropBetween(group.id ?? null, idx + 1); }}
                >
                  <DropLine active={isDropTarget && dropTargetIndex === idx + 1} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignWorkspacePage() {
  const params     = useParams();
  const campaignId = params.id as string;

  const [campaign,  setCampaign]  = useState<CampaignWithConcept | null>(null);
  const [groups,    setGroups]    = useState<AdGroup[]>([]);
  const [ungrouped, setUngrouped] = useState<AdGroupCreative[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [newGroupInput, setNewGroupInput] = useState('');
  const [addingGroup,   setAddingGroup]   = useState(false);

  // DnD state
  const [draggingId,       setDraggingId]       = useState<string | null>(null);
  const [dropTargetGroup,  setDropTargetGroup]  = useState<string | null | undefined>(undefined);
  const [dropTargetIndex,  setDropTargetIndex]  = useState<number | null>(null);
  const dragInfo = useRef<DragInfo | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [camp, groupData] = await Promise.all([
        getCampaign(campaignId),
        listAdGroups(campaignId),
      ]);
      setCampaign(camp);
      setGroups(groupData.groups);
      setUngrouped(groupData.ungrouped);
    } catch {
      setError('Failed to load campaign workspace.');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // ── Create group ────────────────────────────────────────────────────────────
  async function handleCreateGroup() {
    const name = newGroupInput.trim();
    if (!name) return;
    setAddingGroup(true);
    try {
      const g = await createAdGroup(campaignId, name);
      setGroups(prev => [...prev, { ...g, creatives: [] }]);
      setNewGroupInput('');
    } finally {
      setAddingGroup(false);
    }
  }

  // ── Rename group (optimistic) ───────────────────────────────────────────────
  async function handleRename(groupId: string, newName: string) {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
    await renameAdGroup(groupId, newName).catch(() => load());
  }

  // ── Delete group ────────────────────────────────────────────────────────────
  async function handleDeleteGroup(groupId: string) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    // Optimistic: remove group, add its creatives back to ungrouped
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setUngrouped(prev => [...prev, ...group.creatives.map(c => ({ ...c, adGroupId: null }))]);
    await deleteAdGroup(groupId).catch(() => load());
  }

  // ── Drag handlers ───────────────────────────────────────────────────────────

  function onDragStart(e: React.DragEvent, creative: AdGroupCreative, sourceGroupId: string | null) {
    dragInfo.current = {
      creativeId:    creative.id,
      sourceGroupId,
      sourceIndex:   sourceGroupId
        ? groups.find(g => g.id === sourceGroupId)?.creatives.findIndex(c => c.id === creative.id) ?? 0
        : ungrouped.findIndex(c => c.id === creative.id),
    };
    e.dataTransfer.effectAllowed = 'move';
    // Slight delay so browser paints dragged element before we dim it
    setTimeout(() => setDraggingId(creative.id), 0);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDropTargetGroup(undefined);
    setDropTargetIndex(null);
    dragInfo.current = null;
  }

  // Called when dropping ON a group container (append to end)
  async function onDropOnGroup(targetGroupId: string | null) {
    const info = dragInfo.current;
    if (!info) return;
    if (info.sourceGroupId === targetGroupId) { onDragEnd(); return; }

    const creativeId  = info.creativeId;
    const prevGroups  = groups;
    const prevUngrouped = ungrouped;

    // Optimistic update
    const creative = findCreative(info.sourceGroupId, creativeId);
    if (!creative) { onDragEnd(); return; }

    removeFromSource(info.sourceGroupId, creativeId);
    appendToTarget(targetGroupId, { ...creative, adGroupId: targetGroupId, position: 9999 });

    onDragEnd();

    try {
      await moveCreative(creativeId, targetGroupId);
    } catch {
      setGroups(prevGroups);
      setUngrouped(prevUngrouped);
    }
  }

  // Called when dropping between cards (specific index reorder/move)
  async function onDropBetween(targetGroupId: string | null, index: number) {
    const info = dragInfo.current;
    if (!info) return;

    const creativeId  = info.creativeId;
    const prevGroups  = groups;
    const prevUngrouped = ungrouped;

    const creative = findCreative(info.sourceGroupId, creativeId);
    if (!creative) { onDragEnd(); return; }

    const movingGroup = info.sourceGroupId !== targetGroupId;

    // Build optimistic new order
    removeFromSource(info.sourceGroupId, creativeId);

    // Determine new list for target
    setGroups(prev => {
      if (targetGroupId === null) return prev;
      return prev.map(g => {
        if (g.id !== targetGroupId) return g;
        const list = [...g.creatives.filter(c => c.id !== creativeId)];
        list.splice(index, 0, { ...creative, adGroupId: targetGroupId });
        return { ...g, creatives: list.map((c, i) => ({ ...c, position: i })) };
      });
    });
    if (targetGroupId === null) {
      setUngrouped(prev => {
        const list = [...prev.filter(c => c.id !== creativeId)];
        list.splice(index, 0, { ...creative, adGroupId: null });
        return list.map((c, i) => ({ ...c, position: i }));
      });
    }

    onDragEnd();

    try {
      if (movingGroup) {
        await moveCreative(creativeId, targetGroupId);
      }
      // Get final ordered IDs for the target list
      const finalIds = targetGroupId
        ? (groups.find(g => g.id === targetGroupId)?.creatives.map(c => c.id) ?? [])
        : ungrouped.map(c => c.id);
      await reorderCreatives(campaignId, targetGroupId, finalIds);
    } catch {
      setGroups(prevGroups);
      setUngrouped(prevUngrouped);
    }
  }

  // ── State mutation helpers ──────────────────────────────────────────────────

  function findCreative(groupId: string | null, id: string): AdGroupCreative | undefined {
    if (groupId === null) return ungrouped.find(c => c.id === id);
    return groups.find(g => g.id === groupId)?.creatives.find(c => c.id === id);
  }

  function removeFromSource(groupId: string | null, id: string) {
    if (groupId === null) {
      setUngrouped(prev => prev.filter(c => c.id !== id));
    } else {
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, creatives: g.creatives.filter(c => c.id !== id) }
        : g
      ));
    }
  }

  function appendToTarget(groupId: string | null, creative: AdGroupCreative) {
    if (groupId === null) {
      setUngrouped(prev => [...prev, creative]);
    } else {
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, creatives: [...g.creatives, creative] }
        : g
      ));
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const totalCreatives = groups.reduce((s, g) => s + g.creatives.length, 0) + ungrouped.length;
  const campName = campaign?.name || campaign?.concept?.coreMessage?.slice(0, 50) || 'Campaign';

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">

        {/* Top bar */}
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/campaigns" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Campaigns</Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{campName}</span>
          {campaign?.mode && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: campaign.mode === 'SINGLE' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)', color: campaign.mode === 'SINGLE' ? '#f59e0b' : 'var(--indigo-l)', fontWeight: 700 }}>
              {campaign.mode === 'SINGLE' ? '⚡ Quick Ad' : '📋 Campaign'}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>{totalCreatives} creative{totalCreatives !== 1 ? 's' : ''}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Link href={`/result/${campaignId}`}
              style={{ fontSize: 11, color: 'var(--indigo-l)', textDecoration: 'none', border: '1px solid var(--indigo)', borderRadius: 5, padding: '3px 10px' }}>
              Result Editor →
            </Link>
          </div>
        </div>

        {/* Workspace */}
        <div style={{ padding: '20px 24px', overflowX: 'auto', minHeight: 'calc(100vh - 60px)' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)', padding: 40 }}>
              <div className="spinner" /> Loading workspace…
            </div>
          )}
          {error && !loading && (
            <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--rose)' }}>
              ⚠ {error}
            </div>
          )}

          {!loading && !error && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'nowrap' }}>

              {/* Ungrouped column (always shown if any ungrouped creatives or no groups yet) */}
              {(ungrouped.length > 0 || groups.length === 0) && (
                <AdGroupColumn
                  group={{ id: null, name: '📥 Ungrouped', creatives: ungrouped }}
                  draggingId={draggingId}
                  onDragStart={(e, c) => onDragStart(e, c, null)}
                  onDragEnd={onDragEnd}
                  onDropOnGroup={onDropOnGroup}
                  onDropBetween={onDropBetween}
                  dropTargetGroupId={dropTargetGroup}
                  dropTargetIndex={dropTargetIndex}
                />
              )}

              {/* Ad Group columns */}
              {groups.map(g => (
                <AdGroupColumn
                  key={g.id}
                  group={g}
                  draggingId={draggingId}
                  onDragStart={(e, c) => onDragStart(e, c, g.id)}
                  onDragEnd={onDragEnd}
                  onDropOnGroup={onDropOnGroup}
                  onDropBetween={onDropBetween}
                  onRename={handleRename}
                  onDelete={handleDeleteGroup}
                  dropTargetGroupId={dropTargetGroup}
                  dropTargetIndex={dropTargetIndex}
                />
              ))}

              {/* Add group input */}
              <div style={{ minWidth: 240, maxWidth: 280, flexShrink: 0 }}>
                <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1.5px dashed var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>+ New Group</span>
                  <input
                    value={newGroupInput}
                    onChange={e => setNewGroupInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); }}
                    placeholder="Group name…"
                    disabled={addingGroup}
                    style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
                  />
                  <button
                    onClick={handleCreateGroup}
                    disabled={!newGroupInput.trim() || addingGroup}
                    style={{ padding: '6px 0', borderRadius: 7, border: 'none', background: newGroupInput.trim() ? 'var(--indigo)' : 'var(--surface-2)', color: newGroupInput.trim() ? '#fff' : 'var(--muted)', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: newGroupInput.trim() ? 'pointer' : 'not-allowed' }}>
                    {addingGroup ? 'Creating…' : 'Create Group'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

      </main>
    </div>
  );
}
