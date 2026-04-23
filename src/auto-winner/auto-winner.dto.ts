// ─── 4.9 Auto Winner System — DTO ────────────────────────────────────────────

import {
  IsString, IsIn, IsOptional, MaxLength, MinLength, IsNumber,
  Min, Max, ValidateNested, IsObject, IsArray, ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WinnerFormat } from './auto-winner.types';

const VALID_FORMATS: WinnerFormat[] = ['video', 'carousel', 'banner'];

export class VariantPerformanceSignalDto {
  @IsOptional() @IsNumber() @Min(0) @Max(1) ctr?:        number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) retention?:  number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) conversion?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) clarity?:    number;
}

export class CreativeVariantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  id: string;

  /** Structured creative content or plain hook string. */
  content: any;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VariantPerformanceSignalDto)
  performance_data?: VariantPerformanceSignalDto;
}

export class WinnerAngleContextDto {
  @IsString() @MinLength(1) @MaxLength(80) primary: string;
  @IsOptional() @IsString() @MaxLength(80) secondary?: string | null;
}

export class HookBoosterRefDto {
  @IsString() @MinLength(1) @MaxLength(600) hook: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) strength_score?: number;
}

export class SceneRewriteRefDto {
  @IsString() @MinLength(1) @MaxLength(600) rewritten_segment: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) impact_score?: number;
  @IsOptional() @IsString() @MaxLength(50)  improvement_type?: string;
}

export class MemorySignalsDto {
  @IsOptional()
  @IsObject()
  angle_performance?: Record<string, number>;
}

export class FatigueSignalsDto {
  @IsOptional()
  @IsObject()
  angle_fatigue?: Record<string, number>;
}

export class EvaluateVariantsDto {
  @IsIn(VALID_FORMATS)
  format: WinnerFormat;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreativeVariantDto)
  creative_variants: CreativeVariantDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => WinnerAngleContextDto)
  angle_context: WinnerAngleContextDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HookBoosterRefDto)
  hook_booster_outputs?: HookBoosterRefDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SceneRewriteRefDto)
  scene_rewrite_outputs?: SceneRewriteRefDto[];

  @IsOptional()
  @IsObject()
  performance_signals?: Record<string, VariantPerformanceSignalDto>;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MemorySignalsDto)
  memory_signals?: MemorySignalsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FatigueSignalsDto)
  fatigue_signals?: FatigueSignalsDto;

  @IsOptional()
  @IsNumber()
  @Min(-0.10)
  @Max(0.25)
  exploration_signal?: number;
}
