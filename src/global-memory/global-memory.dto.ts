// ─── 4.10 Global Creative Memory — DTO ───────────────────────────────────────

import {
  IsString, IsIn, IsOptional, MaxLength, MinLength,
  IsNumber, Min, Max, IsBoolean, IsArray, ArrayMinSize,
  ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

const VALID_FORMATS = ['video', 'carousel', 'banner'] as const;

// ─── Nested DTOs ──────────────────────────────────────────────────────────────

class BreakdownDto {
  @IsNumber() @Min(0) @Max(100) ctr:        number;
  @IsNumber() @Min(0) @Max(100) retention:  number;
  @IsNumber() @Min(0) @Max(100) conversion: number;
  @IsNumber() @Min(0) @Max(100) clarity:    number;
}

class VariantIngestRecordDto {
  @IsString() @MinLength(1) @MaxLength(100) id: string;
  @IsNumber() @Min(0) @Max(100)             final_score: number;
  @IsObject() @ValidateNested() @Type(() => BreakdownDto) breakdown: BreakdownDto;
  @IsBoolean()                              is_winner: boolean;
}

class MirofishIngestSignalDto {
  @IsOptional() @IsString() @MaxLength(100) creative_id?: string;
  @IsNumber() @Min(0) @Max(1)               predicted_score: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) actual_score?: number;
  @IsOptional() @IsNumber() @Min(-1) @Max(1) prediction_error?: number;
}

class HookBoosterIngestRefDto {
  @IsString() @MinLength(1) @MaxLength(600) hook: string;
  @IsOptional() @IsString() @MaxLength(80)  strategy?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) strength_score?: number;
  @IsIn(VALID_FORMATS)                      format: string;
}

class SceneRewriteIngestRefDto {
  @IsString() @MinLength(2) @MaxLength(50)  improvement_type: string;
  @IsNumber() @Min(0) @Max(1)               impact_score: number;
  @IsBoolean()                              accepted: boolean;
}

// ─── Main DTO ─────────────────────────────────────────────────────────────────

export class IngestMemoryDto {
  @IsString() @MinLength(1) @MaxLength(100) campaign_id: string;
  @IsString() @MinLength(1) @MaxLength(100) client_id: string;
  @IsString() @MinLength(1) @MaxLength(100) industry: string;
  @IsOptional() @IsString() @MaxLength(100) user_id?: string;

  @IsIn(VALID_FORMATS)
  format: string;

  @IsString() @MinLength(1) @MaxLength(80)  primary_angle: string;
  @IsOptional() @IsString() @MaxLength(80)  secondary_angle?: string | null;
  @IsOptional() @IsString() @MaxLength(50)  goal?: string;
  @IsOptional() @IsString() @MaxLength(50)  emotion?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantIngestRecordDto)
  variant_results: VariantIngestRecordDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MirofishIngestSignalDto)
  mirofish_signals?: MirofishIngestSignalDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HookBoosterIngestRefDto)
  hook_booster_refs?: HookBoosterIngestRefDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SceneRewriteIngestRefDto)
  scene_rewrite_refs?: SceneRewriteIngestRefDto[];
}

export class QueryMemoryDto {
  @IsOptional() @IsString() @MaxLength(100) client_id?: string;
  @IsOptional() @IsString() @MaxLength(100) industry?: string;
  @IsOptional() @IsString() @MaxLength(80)  primary_angle?: string;
}
