/**
 * ugc.types.ts
 *
 * Canonical type definitions for the Creative OS UGC Engine.
 *
 * Pipeline:
 *   CreativePlan → UGC Brain → Variant Generator → Kling Compiler
 *   → Queue → Kling API → Stitcher → Scoring + Learning
 */

// ─── UGC Brain ────────────────────────────────────────────────────────────────

export interface UGCBrainInput {
  product:    string;
  audience:   string;
  painPoint:  string;
  angle:      string;
  platform:   string;
  emotion?:   string;
  goal?:      string;
}

export type UGCPersonaId =
  | 'skeptical_user'
  | 'excited_user'
  | 'founder_voice'
  | 'reviewer'
  | 'before_after'
  | 'tutorial'
  | 'testimonial'
  | 'authority';

export interface UGCPersona {
  id:          UGCPersonaId;
  name:        string;
  description: string;
  tone:        string;
  energy:      'low' | 'medium' | 'high';
  /** Platforms where this persona converts best */
  bestFor:     string[];
  /** Hook opening templates for this persona */
  hookTemplates: string[];
}

export type HookStrategy =
  | 'shock'
  | 'curiosity'
  | 'relatable_pain'
  | 'authority'
  | 'social_proof'
  | 'before_after'
  | 'controversy'
  | 'tutorial';

export interface UGCBrainOutput {
  personas:        UGCPersona[];
  hookStrategies:  HookStrategy[];
  emotionalArc:    string;
  /** Ranked platform-specific recommendations */
  platformSignals: {
    preferredPacing:   'slow' | 'medium' | 'fast';
    openingStyle:      string;
    ctaStyle:          string;
  };
}

// ─── UGC Variants ─────────────────────────────────────────────────────────────

export type UGCPacing = 'slow' | 'medium' | 'fast';
export type UGCTone   = 'authentic' | 'energetic' | 'educational' | 'emotional' | 'authoritative';

export interface UGCVariant {
  id:                 string;
  persona:            UGCPersonaId;
  hook:               string;
  emotion:            string;
  tone:               UGCTone;
  pacing:             UGCPacing;
  script:             string;
  conversionStrength: number;   // 0–1
  hookStrategy:       HookStrategy;
}

// ─── Kling Compiler ───────────────────────────────────────────────────────────

export type KlingTransition = 'cut' | 'zoom' | 'glitch' | 'burst' | 'fade';
export type KlingPacing     = 'aggressive' | 'moderate';
export type KlingCamera     = 'front' | 'back' | 'wide' | 'close_up' | 'overhead';

export interface KlingScene {
  scene_id:     number;
  visual:       string;
  camera:       KlingCamera;
  speech:       string;
  emotion:      string;
  transition:   KlingTransition;
  pacing:       KlingPacing;
  duration:     number;   // seconds per scene
  kling_prompt: string;   // final prompt sent to Kling API
  voiceover?:   string;   // optional SSML
}

export interface KlingCompilerOutput {
  model:      'kling';
  mode:       'ugc';
  totalDuration: number;
  scenes:     KlingScene[];
}

// ─── Kling API ────────────────────────────────────────────────────────────────

export interface KlingApiRequest {
  prompt:       string;
  duration:     number;
  aspect_ratio: '9:16' | '16:9' | '1:1' | '4:5';
  style:        'ugc' | 'cinematic' | 'animated';
  quality:      'standard' | 'high' | 'ultra';
  motion:       string;
  voice?:       'auto' | 'off';
  scene_id:     string;
}

export interface KlingJobResponse {
  job_id:         string;
  status:         'processing' | 'queued';
  estimated_time: number;   // seconds
}

export type KlingJobStatus = 'processing' | 'queued' | 'done' | 'failed';

export interface KlingStatusResponse {
  job_id:     string;
  status:     KlingJobStatus;
  video_url?: string;
  duration?:  number;
  error?:     string;
}

// ─── Stitcher ─────────────────────────────────────────────────────────────────

export interface SceneRenderResult {
  sceneId:    number;
  videoUrl:   string;
  duration:   number;
  klingJobId: string;
  pacing:     KlingPacing;
  transition: KlingTransition;
}

export interface Timeline {
  totalDuration:  number;
  segments: Array<{
    sceneId:       number;
    videoUrl:      string;
    startTime:     number;
    endTime:       number;
    transition:    KlingTransition;
    transitionDur: number;   // seconds
  }>;
}

export interface StitchResult {
  stitchedVideoUrl: string;
  totalDuration:    number;
  sceneCount:       number;
  timeline:         Timeline;
}

// ─── Generation DTO / Response ────────────────────────────────────────────────

export interface GenerateUGCDto {
  campaignId:       string;
  conceptId?:       string;
  platform?:        string;
  variantCount?:    number;   // 1–10, default 3
  durationSeconds?: number;   // 15 | 60 | 90, default 15
}

export interface GenerateUGCResponse {
  executionId:                  string;
  campaignId:                   string;
  jobIds:                       string[];
  status:                       'queued';
  variantCount:                 number;
  estimatedRenderTimeSeconds:   number;
}

export interface UGCJobStatusResponse {
  jobId:             string;
  status:            string;
  campaignId:        string;
  persona:           string;
  hook:              string;
  videoUrl?:         string;
  stitchedVideoUrl?: string;
  score?:            number;
  error?:            string;
  createdAt:         string;
  completedAt?:      string;
}
