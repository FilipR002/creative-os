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

  @ApiPropertyOptional({ enum: ['SHORT', 'MEDIUM', 'LONG'], default: 'SHORT' })
  @IsOptional()
  @IsString()
  durationTier?: string;

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

  // ── Unified creation system ────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: ['quick', 'campaign'], description: 'Creation mode: quick (single asset, inline) or campaign (full pipeline, redirect)' })
  @IsOptional()
  @IsString()
  mode?: 'quick' | 'campaign';

  @ApiPropertyOptional({ type: [String], example: ['video', 'carousel'], description: 'Assets to generate in campaign mode (multi-format)' })
  @IsOptional()
  @IsArray()
  assets?: string[];
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
  creativeId: string;
  angleSlug:  string;
  format:     string;
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
