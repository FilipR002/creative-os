'use client';

import { useEffect, useRef, useState } from 'react';
import { blockTypeLabel } from '@/lib/creative-editor';

const PRESETS = [
  { id: 'shorter',        label: 'Shorter'        },
  { id: 'more_emotional', label: 'More emotional' },
  { id: 'add_urgency',    label: 'Add urgency'    },
  { id: 'more_premium',   label: 'More premium'   },
  { id: 'simpler',        label: 'Simpler'        },
  { id: 'stronger_cta',   label: 'Stronger CTA'   },
  { id: 'bolder',         label: 'Bolder'         },
  { id: 'conversational', label: 'Conversational' },
];

interface ImprovePanelProps {
  blockId:    string;
  anchorEl:   HTMLElement | null;
  loading:    boolean;
  onApply:    (blockId: string, instruction: string) => void;
  onClose:    () => void;
}

export function ImprovePanel({ blockId, anchorEl, loading, onApply, onClose }: ImprovePanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom,   setCustom]   = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset state when block changes
  useEffect(() => {
    setSelected(null);
    setCustom('');
  }, [blockId]);

  // Position the panel below the anchor element
  useEffect(() => {
    if (!panelRef.current || !anchorEl) return;
    const rect  = anchorEl.getBoundingClientRect();
    const panel = panelRef.current;
    const vw    = window.innerWidth;
    let left    = rect.left;
    const panelW = 320;
    if (left + panelW > vw - 16) left = vw - panelW - 16;
    panel.style.top  = `${rect.bottom + 8}px`;
    panel.style.left = `${Math.max(8, left)}px`;
  }, [anchorEl, blockId]);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.eb-improve-btn')) onClose();
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  function handleApply() {
    const instruction = custom.trim() || selected;
    if (!instruction || loading) return;
    onApply(blockId, instruction);
  }

  const label = blockTypeLabel(blockId);

  return (
    <div ref={panelRef} className="improve-panel" role="dialog" aria-label={`Improve ${label}`}>
      <div className="improve-panel-header">
        <span className="improve-panel-title">✦ Improve {label}</span>
        <button className="improve-panel-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="improve-presets">
        {PRESETS.map(p => (
          <button
            key={p.id}
            className={`improve-preset${selected === p.id ? ' active' : ''}`}
            onClick={() => { setSelected(p.id); setCustom(''); }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <input
        className="improve-custom-input"
        placeholder="Or type a custom instruction…"
        value={custom}
        onChange={e => { setCustom(e.target.value); setSelected(null); }}
        onKeyDown={e => { if (e.key === 'Enter') handleApply(); }}
        disabled={loading}
      />

      <button
        className="improve-apply-btn"
        onClick={handleApply}
        disabled={(!selected && !custom.trim()) || loading}
      >
        {loading ? <><span className="improve-apply-spinner" /> Applying…</> : 'Apply →'}
      </button>
    </div>
  );
}
