/**
 * elevenlabs.module.ts
 *
 * Phase 5 — ElevenLabs TTS module.
 *
 * Provides:
 *   - ElevenLabsService  — TTS generation + voice listing
 *
 * Exported so ExecutionGatewayModule can inject ElevenLabsService.
 */

import { Module } from '@nestjs/common';
import { ElevenLabsService }    from './elevenlabs.service';
import { ElevenLabsController } from './elevenlabs.controller';

@Module({
  controllers: [ElevenLabsController],
  providers:   [ElevenLabsService],
  exports:     [ElevenLabsService],
})
export class ElevenLabsModule {}
