// ─── MIROFISH Simulation Engine ───────────────────────────────────────────────
//
// Maps creative signals through weighted persona clusters.
// Produces per-cluster behavioral responses representing the 200-persona model.
//
// NO randomness in v1. In v2: small deterministic perturbation per cluster
// derived from the angle slug hash — stable across identical inputs.
// ─────────────────────────────────────────────────────────────────────────────

import { PERSONA_CLUSTERS } from '../clusters/persona.clusters';

// ─── Creative signal profile ──────────────────────────────────────────────────

export interface CreativeSignals {
  hookStrength:     number;  // 0–1  pattern interrupt / opening power
  trustSignals:     number;  // 0–1  proof / credibility elements
  emotionalLoad:    number;  // 0–1  emotional intensity of messaging
  educationalValue: number;  // 0–1  informational density / insight
  ctaClarity:       number;  // 0–1  call-to-action directness
  urgencyLevel:     number;  // 0–1  scarcity / problem-pressure / deadline
  socialProof:      number;  // 0–1  testimonials / data / before-after evidence
}

// ─── Per-cluster simulation result ────────────────────────────────────────────

export interface ClusterResponse {
  clusterId:        string;
  clusterName:      string;
  weight:           number;
  attention:        number;
  trust:            number;
  emotion:          number;
  conversionIntent: number;
  compositeScore:   number;  // weighted combination of all four dimensions
}

// ─── Angle → base signal map ──────────────────────────────────────────────────
// Defines the default creative signal profile for each angle slug.
// Missing keys default to 0.50 (neutral).

const ANGLE_SIGNALS: Record<string, Partial<CreativeSignals>> = {
  before_after:       { hookStrength: 0.75, trustSignals: 0.70, emotionalLoad: 0.65, urgencyLevel: 0.60, socialProof: 0.68 },
  show_off:           { hookStrength: 0.72, trustSignals: 0.62, emotionalLoad: 0.55, socialProof: 0.62, ctaClarity: 0.65 },
  proof:              { hookStrength: 0.48, trustSignals: 0.92, socialProof: 0.88, emotionalLoad: 0.32, ctaClarity: 0.60 },
  storytelling:       { hookStrength: 0.82, emotionalLoad: 0.88, trustSignals: 0.52, educationalValue: 0.45 },
  curiosity:          { hookStrength: 0.92, emotionalLoad: 0.72, urgencyLevel: 0.38, educationalValue: 0.52 },
  unpopular_opinion:  { hookStrength: 0.88, emotionalLoad: 0.72, trustSignals: 0.28, urgencyLevel: 0.28 },
  spark_conversation: { hookStrength: 0.78, emotionalLoad: 0.82, trustSignals: 0.32, ctaClarity: 0.40 },
  tips_tricks:        { hookStrength: 0.58, educationalValue: 0.82, trustSignals: 0.62, ctaClarity: 0.68 },
  hot_take:           { hookStrength: 0.92, emotionalLoad: 0.78, trustSignals: 0.22, urgencyLevel: 0.35 },
  teach:              { hookStrength: 0.52, educationalValue: 0.92, trustSignals: 0.68, ctaClarity: 0.72 },
  data_stats:         { hookStrength: 0.58, trustSignals: 0.82, educationalValue: 0.78, socialProof: 0.72 },
  do_this_not_that:   { hookStrength: 0.65, educationalValue: 0.78, ctaClarity: 0.82, urgencyLevel: 0.52 },
  problem_solution:   { hookStrength: 0.72, urgencyLevel: 0.78, ctaClarity: 0.78, emotionalLoad: 0.62 },
  mistake_avoidance:  { hookStrength: 0.65, urgencyLevel: 0.82, emotionalLoad: 0.72, ctaClarity: 0.72 },
};

// ─── Goal modifiers ───────────────────────────────────────────────────────────

const GOAL_DELTAS: Record<string, Partial<CreativeSignals>> = {
  conversion: { urgencyLevel: 0.12, ctaClarity: 0.10 },
  awareness:  { emotionalLoad: 0.08, hookStrength: 0.05 },
  engagement: { hookStrength: 0.12, emotionalLoad: 0.06 },
};

// ─── Emotion modifiers ────────────────────────────────────────────────────────

const EMOTION_DELTAS: Record<string, Partial<CreativeSignals>> = {
  trust:       { trustSignals: 0.10, socialProof: 0.08 },
  hope:        { trustSignals: 0.08, emotionalLoad: 0.08 },
  inspiration: { emotionalLoad: 0.12, trustSignals: 0.06 },
  fear:        { urgencyLevel: 0.12, emotionalLoad: 0.06 },
  anxiety:     { urgencyLevel: 0.10, emotionalLoad: 0.08 },
  urgency:     { urgencyLevel: 0.15, ctaClarity: 0.08 },
  curiosity:   { hookStrength: 0.12, emotionalLoad: 0.06 },
  humor:       { hookStrength: 0.10, emotionalLoad: 0.08 },
  excitement:  { emotionalLoad: 0.12, hookStrength: 0.06 },
  pride:       { emotionalLoad: 0.10, socialProof: 0.06 },
  empathy:     { emotionalLoad: 0.14, trustSignals: 0.06 },
  nostalgia:   { emotionalLoad: 0.12 },
};

// ─── Format modifiers ─────────────────────────────────────────────────────────

const FORMAT_DELTAS: Record<string, Partial<CreativeSignals>> = {
  video:    { hookStrength: 0.08, emotionalLoad: 0.08 },
  carousel: { educationalValue: 0.10, ctaClarity: 0.06 },
  banner:   { hookStrength: 0.06, ctaClarity: 0.10 },
};

// ─── Signal extraction ────────────────────────────────────────────────────────

export function extractSignals(input: {
  primaryAngle:   string;
  secondaryAngle?: string;
  goal?:   string;
  emotion?: string;
  format?:  string;
}): CreativeSignals {
  const DEFAULTS: CreativeSignals = {
    hookStrength:     0.50,
    trustSignals:     0.50,
    emotionalLoad:    0.50,
    educationalValue: 0.50,
    ctaClarity:       0.50,
    urgencyLevel:     0.50,
    socialProof:      0.50,
  };

  // Start from primary angle base
  const base = { ...DEFAULTS, ...(ANGLE_SIGNALS[input.primaryAngle] ?? {}) };

  // Blend secondary angle signals at 35% weight if present
  if (input.secondaryAngle && ANGLE_SIGNALS[input.secondaryAngle]) {
    const sec = ANGLE_SIGNALS[input.secondaryAngle]!;
    const keys = Object.keys(DEFAULTS) as (keyof CreativeSignals)[];
    for (const k of keys) {
      if (sec[k] !== undefined) {
        base[k] = clamp(base[k] * 0.65 + sec[k]! * 0.35);
      }
    }
  }

  // Apply goal modifier
  const goalDelta = GOAL_DELTAS[input.goal ?? ''] ?? {};
  for (const [k, v] of Object.entries(goalDelta)) {
    base[k as keyof CreativeSignals] = clamp(base[k as keyof CreativeSignals] + v);
  }

  // Apply emotion modifier
  const emoDelta = EMOTION_DELTAS[input.emotion ?? ''] ?? {};
  for (const [k, v] of Object.entries(emoDelta)) {
    base[k as keyof CreativeSignals] = clamp(base[k as keyof CreativeSignals] + v);
  }

  // Apply format modifier
  const fmtDelta = FORMAT_DELTAS[input.format ?? ''] ?? {};
  for (const [k, v] of Object.entries(fmtDelta)) {
    base[k as keyof CreativeSignals] = clamp(base[k as keyof CreativeSignals] + v);
  }

  return base;
}

// ─── Deterministic noise (v2 only) ───────────────────────────────────────────
// Stable hash from angle slug + cluster index → small perturbation ±0.04.
// Ensures consistent v2 results for the same input without true randomness.

function deterministicNoise(seed: string, clusterIdx: number): number {
  let h = clusterIdx * 31;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 17 + seed.charCodeAt(i)) % 997;
  }
  return ((h % 80) - 40) / 1000; // -0.04 to +0.04
}

// ─── Core simulation ──────────────────────────────────────────────────────────

export function simulate(
  signals: CreativeSignals,
  mode: 'v1' | 'v2',
  noiseSeed: string,
): ClusterResponse[] {
  return PERSONA_CLUSTERS.map((cluster, idx) => {
    const noise = mode === 'v2' ? deterministicNoise(noiseSeed, idx) : 0;

    // Each dimension = base + signal_strength × sensitivity × delta_budget
    // Delta budget caps how far a signal can move a cluster from its base.
    const attention = clamp(
      cluster.base.attention +
      signals.hookStrength      * cluster.sensitivity.hook        * 0.28 +
      signals.urgencyLevel      * cluster.sensitivity.urgency     * 0.08 +
      noise,
    );

    const trust = clamp(
      cluster.base.trust +
      signals.trustSignals      * cluster.sensitivity.social_proof * 0.32 +
      signals.socialProof       * cluster.sensitivity.social_proof * 0.14 +
      signals.educationalValue  * cluster.sensitivity.educational  * 0.08 +
      noise * 0.8,
    );

    const emotion = clamp(
      cluster.base.emotion +
      signals.emotionalLoad     * cluster.sensitivity.emotional    * 0.28 +
      signals.hookStrength      * cluster.sensitivity.hook         * 0.08 +
      noise * 0.6,
    );

    const conversionIntent = clamp(
      cluster.base.conversionIntent +
      signals.urgencyLevel      * cluster.sensitivity.urgency      * 0.22 +
      signals.ctaClarity        * cluster.sensitivity.urgency      * 0.12 +
      trust                     * 0.16 +
      attention                 * 0.10 +
      noise * 0.5,
    );

    // Composite: conversion is the heaviest driver (reflects business goal)
    const compositeScore = clamp(
      attention        * 0.22 +
      trust            * 0.26 +
      emotion          * 0.18 +
      conversionIntent * 0.34,
    );

    return {
      clusterId:        cluster.id,
      clusterName:      cluster.name,
      weight:           cluster.weight,
      attention:        r3(attention),
      trust:            r3(trust),
      emotion:          r3(emotion),
      conversionIntent: r3(conversionIntent),
      compositeScore:   r3(compositeScore),
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
