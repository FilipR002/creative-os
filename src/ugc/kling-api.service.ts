/**
 * kling-api.service.ts
 *
 * Kling API Integration — fifth stage of the UGC Engine.
 *
 * Responsibilities:
 *   - Submit scene render requests to the Kling API
 *   - Poll job status until completion or timeout
 *   - Return video URLs per completed scene
 *
 * Authentication:
 *   Kling uses signed JWT tokens, NOT plain Bearer API keys.
 *   JWT is generated from KLING_API_KEY (Access Key ID) + KLING_API_SECRET (Secret Key).
 *   Tokens are valid for 30 minutes — a fresh token is generated per request.
 *
 * Configuration (env):
 *   KLING_API_KEY          — Access Key ID (AK)
 *   KLING_API_SECRET       — Secret Access Key (SK)
 *   KLING_API_BASE_URL     — Base URL (default: https://api.kling.ai/v1)
 *   KLING_POLL_INTERVAL_MS — Polling interval ms (default: 3000)
 *   KLING_POLL_TIMEOUT_MS  — Max wait per scene ms (default: 300000 / 5 min)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService }                    from '@nestjs/config';
import { createHmac }                       from 'crypto';
import { ApiLogService, estimateCost }      from '../billing/api-log.service';

import type {
  KlingScene,
  KlingApiRequest,
  KlingJobResponse,
  KlingStatusResponse,
  KlingJobStatus,
  SceneRenderResult,
} from './types/ugc.types';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class KlingApiService implements OnModuleInit {
  private readonly logger        = new Logger(KlingApiService.name);
  private readonly baseUrl:      string;
  private readonly apiKey:       string;
  private readonly apiSecret:    string;
  private readonly pollInterval: number;
  private readonly pollTimeout:  number;

  constructor(
    private readonly config:  ConfigService,
    private readonly apiLog:  ApiLogService,
  ) {
    this.baseUrl      = config.get<string>('KLING_API_BASE_URL')     ?? 'https://api.kling.ai/v1';
    this.apiKey       = config.get<string>('KLING_API_KEY')          ?? '';
    this.apiSecret    = config.get<string>('KLING_API_SECRET')       ?? '';
    this.pollInterval = Number(config.get('KLING_POLL_INTERVAL_MS') ?? 3_000);
    this.pollTimeout  = Number(config.get('KLING_POLL_TIMEOUT_MS')  ?? 300_000);
  }

  // ─── Startup guard ─────────────────────────────────────────────────────────
  // Warn on missing Kling credentials — server boots without them so other
  // features (carousel, banner, billing) remain available. UGC renders will
  // fail fast at call time with a clear error. Set KLING_API_KEY +
  // KLING_API_SECRET in Railway env vars to enable video generation.

  onModuleInit(): void {
    if (!this.apiKey || this.apiKey.trim() === '') {
      this.logger.warn(
        '[KlingAPI] KLING_API_KEY not set — UGC video generation disabled. ' +
        'Add KLING_API_KEY + KLING_API_SECRET to Railway env vars to enable.',
      );
      return;
    }
    if (!this.apiSecret || this.apiSecret.trim() === '') {
      this.logger.warn(
        '[KlingAPI] KLING_API_SECRET not set — UGC video generation disabled.',
      );
      return;
    }
    this.logger.log(`[KlingAPI] Initialized — base=${this.baseUrl} poll=${this.pollInterval}ms timeout=${this.pollTimeout}ms`);
  }

  // ─── JWT generation ────────────────────────────────────────────────────────
  // Kling requires a signed HS256 JWT. A fresh token is generated per request
  // (valid 30 min) so long-running servers never hit token expiry mid-request.

  private generateJWT(): string {
    const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now     = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      iss: this.apiKey,
      exp: now + 1_800,   // valid for 30 minutes
      nbf: now - 5,       // allow 5s clock skew
    })).toString('base64url');

    const signature = createHmac('sha256', this.apiSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Render all scenes in a compiled plan concurrently (or sequentially
   * if Kling rate-limits), returning SceneRenderResult[] in scene_id order.
   */
  async renderScenes(
    scenes:   KlingScene[],
    platform: string,
    quality:  'standard' | 'high' | 'ultra' = 'standard',
  ): Promise<SceneRenderResult[]> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('[KlingAPI] KLING_API_KEY and KLING_API_SECRET must be set to render video scenes.');
    }
    const results = await Promise.all(
      scenes.map(scene => this.renderScene(scene, platform, quality)),
    );
    return results.sort((a, b) => a.sceneId - b.sceneId);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async renderScene(
    scene:    KlingScene,
    platform: string,
    quality:  'standard' | 'high' | 'ultra',
  ): Promise<SceneRenderResult> {
    const aspectRatio = this.resolveAspectRatio(platform);

    const request: KlingApiRequest = {
      prompt:       scene.kling_prompt,
      duration:     scene.duration,
      aspect_ratio: aspectRatio,
      style:        'ugc',
      quality,
      motion:       scene.pacing === 'aggressive' ? 'dynamic' : 'natural',
      voice:        'off',
      scene_id:     String(scene.scene_id),
    };

    const job = await this.submitJob(request);
    this.logger.debug(`[KlingAPI] scene=${scene.scene_id} job_id=${job.job_id} queued`);

    const status = await this.pollUntilDone(job.job_id, scene.scene_id);

    if (!status.video_url) {
      throw new Error(`[KlingAPI] Scene ${scene.scene_id} completed but no video_url returned`);
    }

    return {
      sceneId:    scene.scene_id,
      videoUrl:   status.video_url,
      duration:   status.duration ?? scene.duration,
      klingJobId: job.job_id,
      pacing:     scene.pacing,
      transition: scene.transition,
    };
  }

  private async submitJob(request: KlingApiRequest): Promise<KlingJobResponse> {
    const t0       = Date.now();
    let   success  = true;
    let   errMsg: string | undefined;

    const response = await fetch(`${this.baseUrl}/videos/generate`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${this.generateJWT()}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      success = false;
      errMsg  = `${response.status}: ${text}`;
      this.apiLog.log({ provider: 'kling', operation: 'video_generate', costUsd: 0, latencyMs: Date.now() - t0, statusCode: response.status, success: false, errorMessage: errMsg });
      throw new Error(`[KlingAPI] Submit failed ${errMsg}`);
    }

    const job = await response.json() as KlingJobResponse;
    // Fire-and-forget cost log for successful submit
    this.apiLog.log({ provider: 'kling', operation: 'video_generate', costUsd: estimateCost('kling', 'video_generate'), latencyMs: Date.now() - t0, statusCode: response.status, success });
    return job;
  }

  private async pollUntilDone(
    jobId:   string,
    sceneId: number,
  ): Promise<KlingStatusResponse> {
    const deadline = Date.now() + this.pollTimeout;

    while (Date.now() < deadline) {
      await this.sleep(this.pollInterval);

      const status = await this.fetchStatus(jobId);
      const s: KlingJobStatus = status.status;

      if (s === 'done') {
        this.logger.debug(`[KlingAPI] scene=${sceneId} job=${jobId} done`);
        return status;
      }

      if (s === 'failed') {
        throw new Error(`[KlingAPI] Job ${jobId} failed: ${status.error ?? 'unknown error'}`);
      }

      this.logger.debug(`[KlingAPI] scene=${sceneId} job=${jobId} status=${s} — waiting`);
    }

    throw new Error(
      `[KlingAPI] Job ${jobId} timed out after ${this.pollTimeout / 1000}s`,
    );
  }

  private async fetchStatus(jobId: string): Promise<KlingStatusResponse> {
    const response = await fetch(`${this.baseUrl}/videos/${jobId}`, {
      headers: { 'Authorization': `Bearer ${this.generateJWT()}` },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      throw new Error(`[KlingAPI] Status fetch failed ${response.status}: ${text}`);
    }

    return response.json() as Promise<KlingStatusResponse>;
  }

  private resolveAspectRatio(platform: string): '9:16' | '16:9' | '1:1' | '4:5' {
    const p = platform.toLowerCase();
    if (p.includes('youtube'))   return '9:16';
    if (p.includes('facebook'))  return '4:5';
    if (p.includes('instagram')) return '4:5';
    return '9:16'; // TikTok and default
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
