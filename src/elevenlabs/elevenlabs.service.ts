/**
 * elevenlabs.service.ts
 *
 * Phase 5 — ElevenLabs TTS integration.
 *
 * Responsibilities:
 *   - listVoices()       → fetch available ElevenLabs voices (cached 60 s)
 *   - generateSpeech()   → convert text → MP3 Buffer via /v1/text-to-speech
 *
 * The MP3 buffer is Base64-encoded and passed to the stitch-service
 * alongside the scene URLs. FFmpeg mixes the voiceover audio into the
 * final stitched video (replacing any background audio track).
 *
 * Set ELEVENLABS_API_KEY in Railway env vars.
 *
 * Voice model: eleven_multilingual_v2 (best quality, multilingual).
 * Default voice: Rachel (calm, clear — good for voiceovers).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService }                    from '@nestjs/config';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ElevenLabsVoice {
  voiceId:     string;
  name:        string;
  description: string;
  previewUrl:  string;
  category:    string;
}

// ─── ElevenLabs API shapes ───────────────────────────────────────────────────

interface ELVoiceRaw {
  voice_id:    string;
  name:        string;
  description: string | null;
  preview_url: string;
  category:    string;
}

interface ELVoicesResponse {
  voices: ELVoiceRaw[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — calm, clear
const TTS_MODEL        = 'eleven_multilingual_v2';
const BASE_URL         = 'https://api.elevenlabs.io';

@Injectable()
export class ElevenLabsService implements OnModuleInit {
  private readonly logger = new Logger(ElevenLabsService.name);
  private readonly apiKey: string;

  /** 60-second in-memory voice cache to avoid hammering the EL API */
  private voiceCache: ElevenLabsVoice[] = [];
  private cacheTtl   = 0;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('ELEVENLABS_API_KEY') ?? '';
  }

  onModuleInit(): void {
    if (!this.apiKey) {
      this.logger.warn(
        '[ElevenLabs] ELEVENLABS_API_KEY not set — voiceover generation disabled.',
      );
    } else {
      this.logger.log('[ElevenLabs] API key loaded — TTS ready.');
    }
  }

  // ─── Voice catalogue ───────────────────────────────────────────────────────

  /**
   * Fetch available ElevenLabs voices.
   * Results are cached for 60 seconds to avoid redundant API calls.
   * Returns an empty array if the API key is not configured.
   */
  async listVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.apiKey) return [];

    if (this.voiceCache.length > 0 && Date.now() < this.cacheTtl) {
      return this.voiceCache;
    }

    try {
      const res = await fetch(`${BASE_URL}/v1/voices`, {
        headers: { 'xi-api-key': this.apiKey },
        signal:  AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`[ElevenLabs] listVoices ${res.status}: ${await res.text().catch(() => '')}`);
        return this.voiceCache; // return stale cache on error
      }

      const data = await res.json() as ELVoicesResponse;

      this.voiceCache = (data.voices ?? []).map(v => ({
        voiceId:     v.voice_id,
        name:        v.name,
        description: v.description ?? '',
        previewUrl:  v.preview_url,
        category:    v.category,
      }));
      this.cacheTtl = Date.now() + 60_000;

      this.logger.log(`[ElevenLabs] Cached ${this.voiceCache.length} voices.`);
      return this.voiceCache;

    } catch (err) {
      this.logger.warn(`[ElevenLabs] listVoices error: ${(err as Error).message}`);
      return this.voiceCache;
    }
  }

  // ─── TTS generation ───────────────────────────────────────────────────────

  /**
   * Convert a text script to an MP3 buffer via ElevenLabs TTS.
   *
   * @param text     Script to synthesise (max ~5 000 chars).
   * @param voiceId  ElevenLabs voice ID — falls back to DEFAULT_VOICE_ID.
   * @returns        MP3 audio as a Buffer, or null if the API key is missing / fails.
   */
  async generateSpeech(
    text:    string,
    voiceId: string = DEFAULT_VOICE_ID,
  ): Promise<Buffer | null> {
    if (!this.apiKey) {
      this.logger.warn('[ElevenLabs] generateSpeech called without API key — skipping.');
      return null;
    }

    const safeText = text.trim().slice(0, 5_000);
    if (!safeText) return null;

    this.logger.log(
      `[ElevenLabs] Generating speech — voiceId=${voiceId} chars=${safeText.length}`,
    );

    try {
      const res = await fetch(
        `${BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key':   this.apiKey,
            'Content-Type': 'application/json',
            'Accept':       'audio/mpeg',
          },
          body: JSON.stringify({
            text:       safeText,
            model_id:   TTS_MODEL,
            voice_settings: {
              stability:        0.50,
              similarity_boost: 0.75,
              style:            0.00,
              use_speaker_boost: true,
            },
          }),
          signal: AbortSignal.timeout(60_000),
        },
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        this.logger.warn(`[ElevenLabs] TTS ${res.status}: ${errText}`);
        return null;
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer      = Buffer.from(arrayBuffer);

      this.logger.log(`[ElevenLabs] TTS done — ${buffer.byteLength} bytes`);
      return buffer;

    } catch (err) {
      this.logger.warn(`[ElevenLabs] TTS error: ${(err as Error).message}`);
      return null;
    }
  }
}
