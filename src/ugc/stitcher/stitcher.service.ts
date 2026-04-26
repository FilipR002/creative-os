/**
 * stitcher.service.ts
 *
 * UGC Stitcher — seventh stage of the UGC Engine.
 *
 * Assembles rendered scene clips into a final stitched video.
 *
 * Two execution paths:
 *   1. KLING_STITCH_URL is configured → POST timeline to Kling stitch endpoint
 *   2. Fallback → call a configurable external stitching service (STITCH_SERVICE_URL)
 *
 * Returns a StitchResult with the final video URL, total duration, and timeline.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService }                    from '@nestjs/config';

import { buildTimeline }           from './timeline.builder';
import type {
  SceneRenderResult,
  StitchResult,
  Timeline,
} from '../types/ugc.types';

// ─── Stitch request/response shapes ──────────────────────────────────────────

interface StitchRequest {
  scenes: Array<{
    video_url:      string;
    start_time:     number;
    end_time:       number;
    transition:     string;
    transition_dur: number;
  }>;
  output_format: 'mp4';
  quality:       'standard' | 'high' | 'ultra';
}

interface StitchResponse {
  stitched_url:   string;
  duration:       number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class StitcherService implements OnModuleInit {
  private readonly logger:        Logger = new Logger(StitcherService.name);
  private readonly stitchUrl:     string;
  private readonly stitchApiKey:  string;

  constructor(private readonly config: ConfigService) {
    this.stitchUrl    = config.get<string>('KLING_STITCH_URL')   ??
                        config.get<string>('STITCH_SERVICE_URL') ?? '';
    this.stitchApiKey = config.get<string>('KLING_API_KEY')      ??
                        config.get<string>('STITCH_API_KEY')     ?? '';
  }

  // ─── Startup guard ────────────────────────────────────────────────────────────
  // Fix 3: Throw at startup on missing stitch URL so Railway shows a clear
  // deployment failure instead of silently letting multi-scene UGC fail at call time.

  onModuleInit(): void {
    if (!this.stitchUrl || this.stitchUrl.trim() === '') {
      throw new Error(
        '[Stitcher] CRITICAL: Neither KLING_STITCH_URL nor STITCH_SERVICE_URL is set. ' +
        'Add KLING_STITCH_URL to Railway environment variables. ' +
        'Multi-scene UGC stitching will not function without a stitch endpoint.',
      );
    }
    this.logger.log(`[Stitcher] Initialized — url=${this.stitchUrl}`);
  }

  /**
   * Stitch rendered scenes into a final video via the configured stitch API.
   * Throws if the stitch endpoint is not configured or the API call fails.
   * NEVER falls back to returning a single scene URL — that is not a stitched video.
   */
  async stitch(
    scenes:  SceneRenderResult[],
    quality: 'standard' | 'high' | 'ultra' = 'standard',
  ): Promise<StitchResult> {
    if (scenes.length === 0) {
      throw new Error('[Stitcher] Cannot stitch zero scenes.');
    }

    // Single-scene shortcut — no stitching needed, return the one scene directly
    if (scenes.length === 1) {
      const timeline = buildTimeline(scenes);
      this.logger.log('[Stitcher] Single scene — skipping stitch API, returning scene directly');
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
      `totalDuration=${timeline.totalDuration}s quality=${quality}`,
    );

    return this.stitchViaApi(timeline, quality);
  }

  // ─── API stitching ──────────────────────────────────────────────────────

  private async stitchViaApi(
    timeline: Timeline,
    quality:  'standard' | 'high' | 'ultra',
  ): Promise<StitchResult> {
    const body: StitchRequest = {
      scenes: timeline.segments.map(seg => ({
        video_url:      seg.videoUrl,
        start_time:     seg.startTime,
        end_time:       seg.endTime,
        transition:     seg.transition,
        transition_dur: seg.transitionDur,
      })),
      output_format: 'mp4',
      quality,
    };

    const response = await fetch(this.stitchUrl, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${this.stitchApiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      throw new Error(`[Stitcher] API call failed ${response.status}: ${text}`);
    }

    const result = await response.json() as StitchResponse;

    this.logger.log(
      `[Stitcher] Done → url=${result.stitched_url} duration=${result.duration}s`,
    );

    return {
      stitchedVideoUrl: result.stitched_url,
      totalDuration:    result.duration,
      sceneCount:       timeline.segments.length,
      timeline,
    };
  }

}

