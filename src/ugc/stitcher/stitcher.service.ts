/**
 * stitcher.service.ts
 *
 * UGC Stitcher — seventh stage of the UGC Engine.
 *
 * Calls the Creative OS stitch-service microservice (FFmpeg-based).
 * The service accepts a list of scene URLs, stitches them, and returns a
 * final video URL. The call is async (job-based) — we poll until done.
 *
 * Set STITCH_SERVICE_URL in Railway env vars, e.g.:
 *   https://stitch-service.up.railway.app
 */

import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService }                    from '@nestjs/config';

import { buildTimeline }           from './timeline.builder';
import type {
  SceneRenderResult,
  StitchResult,
  Timeline,
} from '../types/ugc.types';

// ─── Stitch service shapes ────────────────────────────────────────────────────

export interface TextOverlay {
  text:      string;
  startTime: number;   // seconds from video start
  endTime:   number;   // seconds from video start
}

interface StitchJobRequest {
  scenes:        string[];
  transitions:   'cut' | 'fade';
  audio?:        string;
  /** Phase 5 — ElevenLabs voiceover as base64 MP3. Priority over `audio`. */
  audioBase64?:  string;
  textOverlays?: TextOverlay[];
}

interface StitchJobResponse {
  jobId:    string;
  status:   string;
  videoUrl?: string;
  duration?: number;
  scenes?:  number;
  error?:   string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class StitcherService implements OnModuleInit {
  private readonly logger:        Logger = new Logger(StitcherService.name);
  private readonly stitchUrl:     string;
  private readonly stitchApiKey:  string;

  private readonly pollInterval: number;
  private readonly pollTimeout:  number;

  constructor(private readonly config: ConfigService) {
    this.stitchUrl    = config.get<string>('STITCH_SERVICE_URL') ??
                        config.get<string>('KLING_STITCH_URL')  ?? '';
    this.stitchApiKey = config.get<string>('STITCH_API_KEY')    ?? '';
    this.pollInterval = Number(config.get('STITCH_POLL_INTERVAL_MS') ?? 4_000);
    this.pollTimeout  = Number(config.get('STITCH_POLL_TIMEOUT_MS')  ?? 300_000);
  }

  onModuleInit(): void {
    if (!this.stitchUrl) {
      this.logger.warn(
        '[Stitcher] STITCH_SERVICE_URL not set — multi-scene stitching disabled. ' +
        'Deploy stitch-service and set STITCH_SERVICE_URL in Railway env vars.',
      );
      return;
    }
    this.logger.log(`[Stitcher] Initialized — url=${this.stitchUrl}`);
  }

  /**
   * Stitch rendered scenes into a final video via the configured stitch API.
   * Throws if the stitch endpoint is not configured or the API call fails.
   * NEVER falls back to returning a single scene URL — that is not a stitched video.
   *
   * @param textOverlays Optional per-scene text to burn via FFmpeg drawtext.
   *                     Pass undefined to skip text burn (pre-Phase 3 behaviour).
   * @param audioBase64  Phase 5 — ElevenLabs voiceover as base64-encoded MP3.
   *                     Mixed into the stitched video by FFmpeg (-shortest flag).
   */
  async stitch(
    scenes:        SceneRenderResult[],
    quality:       'standard' | 'high' | 'ultra' = 'standard',
    textOverlays?: TextOverlay[],
    audioBase64?:  string,
  ): Promise<StitchResult> {
    if (scenes.length === 0) {
      throw new Error('[Stitcher] Cannot stitch zero scenes.');
    }

    // Single-scene shortcut — no stitching needed, return the one scene directly.
    // Still go through the API if text overlays or voiceover audio are requested.
    if (scenes.length === 1 && !textOverlays?.length && !audioBase64) {
      const timeline = buildTimeline(scenes);
      this.logger.log('[Stitcher] Single scene, no text, no audio — skipping stitch API');
      return {
        stitchedVideoUrl: scenes[0].videoUrl,
        totalDuration:    scenes[0].duration,
        sceneCount:       1,
        timeline,
      };
    }

    const timeline = buildTimeline(scenes);

    this.logger.log(
      `[Stitcher] Stitching ${scenes.length} scenes | ` +
      `totalDuration=${timeline.totalDuration}s quality=${quality} ` +
      `textOverlays=${textOverlays?.length ?? 0} ` +
      `voiceover=${audioBase64 ? `yes (${Math.round(audioBase64.length * 0.75 / 1024)}KB)` : 'no'}`,
    );

    return this.stitchViaApi(timeline, quality, textOverlays, audioBase64);
  }

  // ─── Stitch via stitch-service microservice ────────────────────────────────

  private async stitchViaApi(
    timeline:      Timeline,
    _quality:      'standard' | 'high' | 'ultra',
    textOverlays?: TextOverlay[],
    audioBase64?:  string,
  ): Promise<StitchResult> {
    if (!this.stitchUrl) {
      throw new ServiceUnavailableException(
        'Multi-scene video stitching requires STITCH_SERVICE_URL to be configured in Railway. ' +
        'Deploy the stitch-service and set STITCH_SERVICE_URL to enable multi-scene videos.',
      );
    }

    const sceneUrls = timeline.segments.map(s => s.videoUrl);

    const body: StitchJobRequest = {
      scenes:       sceneUrls,
      transitions:  'cut',
      textOverlays: textOverlays?.length ? textOverlays : undefined,
      audioBase64:  audioBase64 || undefined,
    };

    // ── 1. Submit job ────────────────────────────────────────────────────────
    const submitRes = await fetch(`${this.stitchUrl}/stitch`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(15_000),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text().catch(() => 'unknown');
      throw new Error(`[Stitcher] Submit failed ${submitRes.status}: ${text}`);
    }

    const { jobId } = await submitRes.json() as { jobId: string };
    this.logger.log(`[Stitcher] Job submitted — jobId=${jobId}`);

    // ── 2. Poll until done ───────────────────────────────────────────────────
    const deadline = Date.now() + this.pollTimeout;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, this.pollInterval));

      const pollRes = await fetch(`${this.stitchUrl}/stitch/${jobId}`, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!pollRes.ok) continue;

      const job = await pollRes.json() as StitchJobResponse;

      if (job.status === 'done' && job.videoUrl) {
        this.logger.log(
          `[Stitcher] Done — jobId=${jobId} url=${job.videoUrl} duration=${job.duration}s`,
        );
        return {
          stitchedVideoUrl: job.videoUrl,
          totalDuration:    job.duration ?? timeline.totalDuration,
          sceneCount:       timeline.segments.length,
          timeline,
        };
      }

      if (job.status === 'failed') {
        throw new Error(`[Stitcher] Job ${jobId} failed: ${job.error ?? 'unknown'}`);
      }

      this.logger.debug(`[Stitcher] jobId=${jobId} status=${job.status}`);
    }

    throw new Error(`[Stitcher] Job ${jobId} timed out after ${this.pollTimeout}ms`);
  }

}

