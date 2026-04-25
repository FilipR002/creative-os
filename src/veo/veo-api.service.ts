/**
 * veo-api.service.ts
 *
 * Veo API Integration — real cinematic render engine via Google AI Studio.
 *
 * Uses the same GEMINI_API_KEY as the rest of Google AI services.
 * Endpoint: generativelanguage.googleapis.com (AI Studio), NOT Vertex AI.
 *
 * Auth: x-goog-api-key header (AI Studio key — starts with AIzaSy...)
 *
 * Configuration (env):
 *   GEMINI_API_KEY         — Google AI Studio key (shared with Gemini + TTS)
 *   VEO_API_BASE_URL       — Base URL (default: https://generativelanguage.googleapis.com/v1beta)
 *   VEO_MODEL              — Model ID (default: veo-2.0-generate-001)
 *   VEO_POLL_INTERVAL_MS   — Polling interval ms (default: 5000)
 *   VEO_POLL_TIMEOUT_MS    — Max wait per scene ms (default: 600000 / 10 min)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { ApiLogService, estimateCost } from '../billing/api-log.service';

import type { KlingScene, SceneRenderResult } from '../ugc/types/ugc.types';

// ─── Google AI Studio Veo request/response shapes ────────────────────────────

interface VeoGenerateRequest {
  prompt: {
    text: string;
  };
  generationConfig: {
    aspectRatio:     string;
    durationSeconds: number;
  };
}

interface VeoOperation {
  name:  string;
  done?: boolean;
  error?: { message: string };
  response?: {
    generatedSamples?: Array<{
      video?: {
        uri:      string;
        mimeType: string;
      };
    }>;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class VeoApiService {
  private readonly logger:       Logger = new Logger(VeoApiService.name);
  private readonly baseUrl:      string;
  private readonly apiKey:       string;
  private readonly model:        string;
  private readonly pollInterval: number;
  private readonly pollTimeout:  number;

  constructor(
    private readonly config: ConfigService,
    private readonly apiLog: ApiLogService,
  ) {
    this.baseUrl      = config.get<string>('VEO_API_BASE_URL')      ??
                        'https://generativelanguage.googleapis.com/v1beta';
    // Veo uses the same GEMINI_API_KEY — one key for all Google AI Studio services
    this.apiKey       = config.get<string>('GEMINI_API_KEY')        ?? '';
    this.model        = config.get<string>('VEO_MODEL')             ?? 'veo-2.0-generate-001';
    this.pollInterval = Number(config.get('VEO_POLL_INTERVAL_MS')  ?? 5_000);
    this.pollTimeout  = Number(config.get('VEO_POLL_TIMEOUT_MS')   ?? 600_000);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Render all scenes concurrently via Veo.
   * Returns SceneRenderResult[] in scene_id order (same contract as KlingApiService).
   */
  async renderScenes(
    scenes:   KlingScene[],
    platform: string,
    quality:  'standard' | 'high' | 'ultra' = 'high',
  ): Promise<SceneRenderResult[]> {
    this.logger.log(`[VeoAPI] Rendering ${scenes.length} scene(s) quality=${quality} model=${this.model}`);

    const results = await Promise.all(
      scenes.map(scene => this.renderScene(scene, platform)),
    );

    return results.sort((a, b) => a.sceneId - b.sceneId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async renderScene(
    scene:    KlingScene,
    platform: string,
  ): Promise<SceneRenderResult> {
    const aspectRatio = this.resolveAspectRatio(platform);

    const request: VeoGenerateRequest = {
      prompt: {
        text: scene.kling_prompt,
      },
      generationConfig: {
        aspectRatio,
        durationSeconds: Math.min(Math.max(scene.duration, 5), 8), // Veo: 5–8s per clip
      },
    };

    const operation = await this.submitJob(request);
    this.logger.debug(`[VeoAPI] scene=${scene.scene_id} operation=${operation.name} queued`);

    const done = await this.pollUntilDone(operation.name, scene.scene_id);

    const videoUri = done.response?.generatedSamples?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error(`[VeoAPI] Scene ${scene.scene_id} completed but no video URI returned`);
    }

    return {
      sceneId:    scene.scene_id,
      videoUrl:   videoUri,
      duration:   scene.duration,
      klingJobId: operation.name,  // field is historical; stores any render job id
      pacing:     scene.pacing,
      transition: scene.transition,
    };
  }

  private async submitJob(request: VeoGenerateRequest): Promise<VeoOperation> {
    const t0  = Date.now();
    const url = `${this.baseUrl}/models/${this.model}:generateVideos`;

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'x-goog-api-key': this.apiKey,
        'Content-Type':   'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      this.apiLog.log({ provider: 'veo', operation: 'video_generate', costUsd: 0, latencyMs: Date.now() - t0, statusCode: response.status, success: false, errorMessage: `${response.status}: ${text}` });
      throw new Error(`[VeoAPI] Submit failed ${response.status}: ${text}`);
    }

    const op = await response.json() as VeoOperation;
    this.apiLog.log({ provider: 'veo', operation: 'video_generate', costUsd: estimateCost('veo', 'video_generate'), latencyMs: Date.now() - t0, statusCode: response.status, success: true });
    return op;
  }

  private async pollUntilDone(
    operationName: string,
    sceneId:       number,
  ): Promise<VeoOperation> {
    const deadline = Date.now() + this.pollTimeout;

    while (Date.now() < deadline) {
      await this.sleep(this.pollInterval);

      const op = await this.fetchOperation(operationName);

      if (op.done && op.error) {
        throw new Error(`[VeoAPI] Operation ${operationName} failed: ${op.error.message}`);
      }

      if (op.done) {
        this.logger.debug(`[VeoAPI] scene=${sceneId} operation=${operationName} done`);
        return op;
      }

      this.logger.debug(`[VeoAPI] scene=${sceneId} operation=${operationName} still running — waiting`);
    }

    throw new Error(`[VeoAPI] Operation ${operationName} timed out after ${this.pollTimeout / 1_000}s`);
  }

  private async fetchOperation(operationName: string): Promise<VeoOperation> {
    // operationName is the full path e.g. "operations/abc123"
    const url = `${this.baseUrl}/${operationName}`;

    const response = await fetch(url, {
      headers: { 'x-goog-api-key': this.apiKey },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      throw new Error(`[VeoAPI] Status fetch failed ${response.status}: ${text}`);
    }

    return response.json() as Promise<VeoOperation>;
  }

  private resolveAspectRatio(platform: string): string {
    const p = platform.toLowerCase();
    if (p.includes('youtube'))   return '16:9';
    if (p.includes('facebook'))  return '4:5';
    if (p.includes('instagram')) return '4:5';
    return '9:16'; // TikTok default
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
