/**
 * elevenlabs.controller.ts
 *
 * Phase 5 — Exposes ElevenLabs voice catalogue to the frontend.
 *
 * GET /api/elevenlabs/voices
 *   Returns the list of available voices (cached 60 s in the service).
 *   Frontend uses this to populate the voice picker dropdown.
 *
 * Authentication: UserGuard (global) — requires a valid session token.
 */

import { Controller, Get } from '@nestjs/common';
import { ElevenLabsService, ElevenLabsVoice } from './elevenlabs.service';

@Controller('elevenlabs')
export class ElevenLabsController {
  constructor(private readonly elevenLabs: ElevenLabsService) {}

  /** GET /api/elevenlabs/voices */
  @Get('voices')
  async listVoices(): Promise<ElevenLabsVoice[]> {
    return this.elevenLabs.listVoices();
  }
}
