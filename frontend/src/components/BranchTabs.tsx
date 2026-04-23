'use client';

import type { Branch } from '@/lib/creative-editor';

interface BranchTabsProps {
  branches:       Branch[];
  activeBranchId: string;
  onSwitch:       (id: string) => void;
  onDelete:       (id: string) => void;
  canAdd:         boolean;
}

export function BranchTabs({ branches, activeBranchId, onSwitch, onDelete, canAdd }: BranchTabsProps) {
  if (branches.length <= 1) return null;

  return (
    <div className="branch-tabs">
      <span className="branch-tabs-label">Variations</span>
      {branches.map(br => (
        <div
          key={br.id}
          className={`branch-tab${activeBranchId === br.id ? ' branch-tab--active' : ''}`}
        >
          <button
            className="branch-tab-btn"
            onClick={() => onSwitch(br.id)}
          >
            {br.id === 'main' ? '◎' : '⊕'} {br.name}
          </button>
          {br.id !== 'main' && (
            <button
              className="branch-tab-close"
              onClick={(e) => { e.stopPropagation(); onDelete(br.id); }}
              aria-label={`Delete ${br.name}`}
              title="Delete this branch"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!canAdd && (
        <span className="branch-tabs-cap">Max 5 variations</span>
      )}
    </div>
  );
}
