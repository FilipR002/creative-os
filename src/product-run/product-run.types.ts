// ─── Product Run — Request / Response Types ───────────────────────────────────

import {
  IsArray, IsEnum, IsNumber, IsOptional, IsString, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConceptGoal } from '../concept/concept.dto';

// ── Inbound ────────────────────────────────────────────────────────────────────

export type RunFormat = 'video' | 'carousel' | 'banner';

export class RunDto {
  @ApiProperty({ description: 'Campaign creative brief' })
  @IsString()
  brief: string;

  @ApiProperty({ enum: ['video', 'carousel', 'banner'], description: 'Creative format to generate' })
  @IsEnum(['video', 'carousel', 'banner'])
  format: RunFormat;

  @ApiPropertyOptional({ description: 'Reuse an existing campaign. If omitted, one is created automatically.' })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({ enum: ConceptGoal, default: ConceptGoal.CONVERSION })
  @IsOptional()
  @IsEnum(ConceptGoal)
  goal?: ConceptGoal;

  @ApiPropertyOptional({ description: 'Client ID — scopes memory and learning to a client' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Client industry — used for cross-client angle priors' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Target platform (e.g. instagram, tiktok, youtube)' })
  @IsOptional()
  @IsString()
  platform?: string;

  // ── Video-specific ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: ['SHORT', 'MEDIUM', 'LONG', 'EXTENDED'], default: 'SHORT' })
  @IsOptional()
  @IsString()
  durationTier?: string;

  /**
   * Video pipeline selector — required when format === 'video'.
   *   ugc      → Kling pipeline (authentic UGC style)
   *   classic  → Veo / cinematic pipeline
   * User choice OVERRIDES SmartRouting mode selection.
   */
  @ApiPropertyOptional({ enum: ['ugc', 'classic'], description: 'Video rendering pipeline. Required for format=video.' })
  @IsOptional()
  @IsString()
  videoMode?: 'ugc' | 'classic';

  // ── Carousel-specific ──────────────────────────────────────────────────────

  @ApiPropertyOptional({ default: 5, minimum: 3 })
  @IsOptional()
  @IsNumber()
  @Min(3)
  slideCount?: number;

  // ── Banner-specific ────────────────────────────────────────────────────────

  @ApiPropertyOptional({ type: [String], example: ['1080x1080', '1200x628'] })
  @IsOptional()
  @IsArray()
  sizes?: string[];

  // ── Phase 3: personalization ───────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'User style context injected into AI prompts for personalized generation' })
  @IsOptional()
  @IsString()
  styleContext?: string;

  // ── Persona + Resource context ─────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Persona ID from the user\'s resources — enriches all AI prompts with targeting context' })
  @IsOptional()
  @IsString()
  personaId?: string;

  // ── Unified creation system ────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: ['quick', 'campaign'], description: 'Creation mode: quick (single asset, inline) or campaign (full pipeline, redirect)' })
  @IsOptional()
  @IsString()
  mode?: 'quick' | 'campaign';

  @ApiPropertyOptional({ type: [String], example: ['video', 'carousel'], description: 'Assets to generate in campaign mode (multi-format)' })
  @IsOptional()
  @IsArray()
  assets?: string[];

  // ── Phase 5: ElevenLabs voiceover ─────────────────────────────────────────

  @ApiPropertyOptional({ description: 'When true, generates an ElevenLabs voiceover from overlay_text and mixes it into the stitched video.' })
  @IsOptional()
  voiceoverEnabled?: boolean;

  @ApiPropertyOptional({ description: 'ElevenLabs voice ID for TTS. Falls back to the service default (Rachel) if omitted.' })
  @IsOptional()
  @IsString()
  voiceId?: string;

  // ── Phase 6: Template override ────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Pin a specific compositor template for carousel/banner slides instead of AI auto-selection.' })
  @IsOptional()
  @IsString()
  templateId?: string;
}

// ── Outbound ───────────────────────────────────────────────────────────────────

export interface RunConceptSummary {
  id:    string;
  brief: string;
  goal:  string;
}

export interface RunAngleItem {
  slug:   string;
  role:   'exploit' | 'explore' | 'secondary';
  reason: string;
}

export interface RunCreativeItem {
  creativeId:  string;
  angleSlug:   string;
  format:      string;
  /**
   * false  → images are being generated in the background (carousel / banner).
   *          Frontend should poll GET /api/creatives/:id until imageUrl is populated.
   * true   → all images are ready (or format is video — images concept doesn't apply).
   * undefined → legacy: not tracked.
   */
  imagesReady?: boolean;
}

export interface RunScoringItem {
  creativeId:  string;
  angleSlug:   string;
  totalScore:  number;
  ctrScore:    number;
  engagement:  number;
  conversion:  number;
  isWinner:    boolean;
}

export interface RunResponse {
  executionId:           string;
  campaignId:            string;
  concept:               RunConceptSummary;
  angles:                RunAngleItem[];
  creatives:             RunCreativeItem[];
  scoring:               RunScoringItem[];
  winner:                RunScoringItem | null;
  learningUpdateStatus:  'triggered' | 'skipped';
  evolutionTriggered:    boolean;
  explanation:           string;
}
