export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

/**
 * A single text overlay to burn into the stitched video via FFmpeg drawtext.
 * Text is burned at the specified time range (seconds from video start).
 * Position: lower-third, horizontally centred.
 */
export interface TextOverlay {
  text:      string;   // display text (keep short — max ~80 chars)
  startTime: number;   // seconds from video start
  endTime:   number;   // seconds from video start
}

export interface StitchRequest {
  scenes:        string[];          // ordered list of video URLs
  transitions?:  'cut' | 'fade';   // default: cut
  audio?:        string;            // optional background audio URL
  /**
   * Phase 5 — ElevenLabs voiceover.
   * Base64-encoded MP3 audio. When present, takes priority over `audio` (URL).
   * The stitch service decodes it to a temp file before mixing with FFmpeg.
   * Prefer this over `audio` URL to avoid an extra download round-trip.
   */
  audioBase64?:  string;
  format?:       '9:16' | '16:9' | '1:1'; // default: 9:16
  /** Per-scene text to burn in via FFmpeg drawtext — no diffusion text hallucinations */
  textOverlays?: TextOverlay[];
}

export interface Job {
  id:          string;
  status:      JobStatus;
  request:     StitchRequest;
  videoUrl?:   string;
  duration?:   number;
  scenes?:     number;
  error?:      string;
  createdAt:   number;
  completedAt?: number;
}

export interface StitchResponse {
  jobId:    string;
  status:   JobStatus;
  videoUrl?: string;
  duration?: number;
  scenes?:  number;
  error?:   string;
}
