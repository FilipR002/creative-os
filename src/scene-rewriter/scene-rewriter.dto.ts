// ─── 4.8 Scene Rewriting Engine — DTO ────────────────────────────────────────

import {
  IsString, IsIn, IsOptional, MaxLength, MinLength,
  IsNumber, Min, Max, ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RewriteFormat } from './scene-rewriter.types';

const VALID_FORMATS: RewriteFormat[] = ['video', 'carousel', 'banner'];

export class PerformanceSignalDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  ctr?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  retention?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  conversion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  drop_off_point?: string;
}

export class AngleContextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  primary: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  secondary?: string | null;
}

export class RewriteSceneDto {
  @IsIn(VALID_FORMATS)
  format: RewriteFormat;

  @IsString()
  @MinLength(2)
  @MaxLength(600)
  creative_segment: string;

  @IsString()
  @MinLength(2)
  @MaxLength(600)
  original_hook_or_scene: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PerformanceSignalDto)
  performance_signal: PerformanceSignalDto;

  @IsObject()
  @ValidateNested()
  @Type(() => AngleContextDto)
  angle_context: AngleContextDto;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  emotion_context: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  memory_signal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  fatigue_signal?: number;
}
