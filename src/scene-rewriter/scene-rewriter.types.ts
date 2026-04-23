// ─── 4.8 Scene Rewriting Engine — Types ──────────────────────────────────────

export type RewriteFormat     = 'video' | 'carousel' | 'banner';
export type RewriteImprovementType = 'CLARITY' | 'EMOTIONAL' | 'PERFORMANCE';

// ─── Performance signal (from scoring / analytics layer) ─────────────────────

export interface PerformanceSignal {
  /** 0–1: click-through rate. Low → PERFORMANCE improvement. */
  ctr?:            number;
  /** 0–1: video/carousel retention. Low → EMOTIONAL improvement. */
  retention?:      number;
  /** 0–1: conversion rate. Low → CLARITY improvement. */
  conversion?:     number;
  /** Human-readable drop-off point, e.g. "0–3s", "slide-2". */
  drop_off_point?: string;
}

export interface AngleContext {
  primary:    string;
  secondary?: string | null;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface SceneRewriterInput {
  format:                  RewriteFormat;
  /** The segment text to be micro-rewritten. */
  creative_segment:        string;
  /** Original hook / scene for reference context. */
  original_hook_or_scene:  string;
  performance_signal:      PerformanceSignal;
  angle_context:           AngleContext;
  emotion_context:         string;
  /** Optional — from 4.2 memory service. Soft influence only. */
  memory_signal?:          number;
  /** Optional — from 4.4 fatigue service. Soft influence only. */
  fatigue_signal?:         number;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface RewriteVariant {
  original_segment:   string;
  rewritten_segment:  string;
  improvement_type:   RewriteImprovementType;
  reason:             string;
  impact_score:       number;  // 0–1
}

export interface SceneRewriterOutput {
  format:             RewriteFormat;
  rewrites:           RewriteVariant[];
  best_rewrite_index: number;
  reasoning:          string;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

export interface WeaknessProfile {
  /** Ordered list of most-needed improvement types, primary first. */
  priority:        RewriteImprovementType[];
  /** 0–1 severity of CTR gap (1 = worst). */
  ctr_gap:         number;
  /** 0–1 severity of retention gap. */
  retention_gap:   number;
  /** 0–1 severity of conversion gap. */
  conversion_gap:  number;
}
