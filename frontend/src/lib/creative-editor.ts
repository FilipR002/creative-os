// ─── Creative Editor State ────────────────────────────────────────────────────
// Manages block values, version history, and variation branching.
//
// Branch model:
//   Main ("Original") is always present (id = 'main').
//   Each branch is a named fork of the blocks at the moment of creation.
//   The anchorBlockId is the block that triggered the fork — shown with a
//   visual lock indicator so the user knows what they were keeping.

import type { StructuredCopy } from './creative-copy';

export interface Version {
  num:       number;
  label:     string;
  timestamp: number;
  blocks:    Record<string, string>;
}

export interface Branch {
  id:            string;   // 'main' | uuid
  name:          string;   // 'Original' | 'From Hook' | 'Branch 2'
  anchorBlockId: string | null;  // null for main
  blocks:        Record<string, string>;
  createdAt:     number;
}

export interface EditorState {
  blocks:         Record<string, string>;
  versions:       Version[];
  currentVersion: number;
  branches:       Branch[];
  activeBranchId: string;   // 'main' by default
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initEditorState(copy: StructuredCopy): EditorState {
  const blocks = extractBlocks(copy);
  const mainBranch: Branch = {
    id:            'main',
    name:          'Original',
    anchorBlockId: null,
    blocks:        { ...blocks },
    createdAt:     Date.now(),
  };
  return {
    blocks,
    versions: [{ num: 1, label: 'Original', timestamp: Date.now(), blocks: { ...blocks } }],
    currentVersion: 1,
    branches:       [mainBranch],
    activeBranchId: 'main',
  };
}

// ── Block operations ──────────────────────────────────────────────────────────

export function extractBlocks(copy: StructuredCopy): Record<string, string> {
  const b: Record<string, string> = {
    hook:        copy.primaryHook,
    copy:        copy.primaryCopy,
    cta:         copy.primaryCta,
    'varA-hook': copy.varA.hook,
    'varA-copy': copy.varA.copy,
    'varA-cta':  copy.varA.cta,
    'varB-hook': copy.varB.hook,
    'varB-copy': copy.varB.copy,
    'varB-cta':  copy.varB.cta,
  };

  copy.videoScript?.scenes.forEach((s, i) => {
    b[`scene-${i}`] = s.direction;
  });

  copy.carouselSlides?.forEach(s => {
    b[`slide-${s.slideNum}-headline`] = s.headline;
    b[`slide-${s.slideNum}-body`]     = s.body;
  });

  if (copy.bannerCopy) {
    b['banner-headline'] = copy.bannerCopy.headline;
    b['banner-sub']      = copy.bannerCopy.subheadline;
    b['banner-cta']      = copy.bannerCopy.cta;
  }

  return b;
}

export function updateBlock(state: EditorState, blockId: string, value: string): EditorState {
  const newBlocks = { ...state.blocks, [blockId]: value };
  // Keep active branch blocks in sync
  const branches = state.branches.map(br =>
    br.id === state.activeBranchId ? { ...br, blocks: newBlocks } : br,
  );
  return { ...state, blocks: newBlocks, branches };
}

// ── Version operations ────────────────────────────────────────────────────────

export function saveVersion(state: EditorState, label: string): EditorState {
  const next = state.versions[state.versions.length - 1].num + 1;
  const newVersion: Version = { num: next, label, timestamp: Date.now(), blocks: { ...state.blocks } };
  return {
    ...state,
    versions:       [...state.versions.slice(-9), newVersion],
    currentVersion: next,
  };
}

export function revertToVersion(state: EditorState, versionNum: number): EditorState {
  const v = state.versions.find(v => v.num === versionNum);
  if (!v) return state;
  const blocks = { ...v.blocks };
  const branches = state.branches.map(br =>
    br.id === state.activeBranchId ? { ...br, blocks } : br,
  );
  return { ...state, blocks, currentVersion: versionNum, branches };
}

// ── Branch operations ─────────────────────────────────────────────────────────

const MAX_BRANCHES = 5;

/** Fork current blocks into a new named branch anchored on anchorBlockId. */
export function branchFromBlock(state: EditorState, anchorBlockId: string): EditorState {
  if (state.branches.length >= MAX_BRANCHES) return state; // cap

  const id      = `branch-${Date.now()}`;
  const label   = blockTypeLabel(anchorBlockId);
  const siblings = state.branches.filter(b => b.name.startsWith('From ')).length;
  const name    = siblings === 0 ? `From ${label}` : `From ${label} ${siblings + 1}`;

  // Flush current blocks into the active branch first
  const flushedBranches = state.branches.map(br =>
    br.id === state.activeBranchId ? { ...br, blocks: { ...state.blocks } } : br,
  );

  const newBranch: Branch = {
    id,
    name,
    anchorBlockId,
    blocks:    { ...state.blocks },
    createdAt: Date.now(),
  };

  return {
    ...state,
    branches:       [...flushedBranches, newBranch],
    activeBranchId: id,
    // blocks stay the same — same content, new branch context
  };
}

/** Switch to a different branch — saves current blocks to active branch first. */
export function switchBranch(state: EditorState, branchId: string): EditorState {
  if (branchId === state.activeBranchId) return state;
  const target = state.branches.find(b => b.id === branchId);
  if (!target) return state;

  // Flush current blocks into the currently active branch
  const flushed = state.branches.map(br =>
    br.id === state.activeBranchId ? { ...br, blocks: { ...state.blocks } } : br,
  );

  return {
    ...state,
    branches:       flushed,
    activeBranchId: branchId,
    blocks:         { ...target.blocks },
    // Reset version display to 1 when switching branches
    currentVersion: 1,
    versions:       [{ num: 1, label: target.name, timestamp: target.createdAt, blocks: { ...target.blocks } }],
  };
}

/** Delete a branch (cannot delete 'main'). Falls back to main. */
export function deleteBranch(state: EditorState, branchId: string): EditorState {
  if (branchId === 'main') return state;

  const remaining = state.branches.filter(b => b.id !== branchId);
  const isActive  = state.activeBranchId === branchId;

  if (isActive) {
    const main = remaining.find(b => b.id === 'main')!;
    return {
      ...state,
      branches:       remaining,
      activeBranchId: 'main',
      blocks:         { ...main.blocks },
      currentVersion: 1,
      versions:       [{ num: 1, label: 'Original', timestamp: main.createdAt, blocks: { ...main.blocks } }],
    };
  }

  return { ...state, branches: remaining };
}

/** Anchor block ID for the active branch (null if main). */
export function getActiveBranchAnchor(state: EditorState): string | null {
  return state.branches.find(b => b.id === state.activeBranchId)?.anchorBlockId ?? null;
}

export function canAddBranch(state: EditorState): boolean {
  return state.branches.length < MAX_BRANCHES;
}

// ── Labels ────────────────────────────────────────────────────────────────────

export function blockTypeLabel(blockId: string): string {
  if (blockId === 'hook')            return 'Hook';
  if (blockId === 'copy')            return 'Copy';
  if (blockId === 'cta')             return 'CTA';
  if (blockId === 'banner-headline') return 'Headline';
  if (blockId === 'banner-sub')      return 'Subheadline';
  if (blockId === 'banner-cta')      return 'CTA';
  if (blockId.endsWith('-hook'))     return 'Hook';
  if (blockId.endsWith('-copy'))     return 'Copy';
  if (blockId.endsWith('-cta'))      return 'CTA';
  if (blockId.startsWith('scene'))   return 'Scene';
  if (blockId.endsWith('-headline')) return 'Headline';
  if (blockId.endsWith('-body'))     return 'Body';
  return 'Block';
}

export function versionLabel(blockId: string, instruction: string): string {
  const type   = blockTypeLabel(blockId);
  const action = instruction.replace(/_/g, ' ');
  return `${type}: ${action}`;
}
