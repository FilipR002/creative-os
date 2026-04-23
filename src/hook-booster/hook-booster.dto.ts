// ─── 4.6 Hook Booster v1 — DTO  /  4.7 Hook Booster v2 — DTO ─────────────────

import {
  IsString,
  IsIn,
  IsOptional,
  MaxLength,
  MinLength,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HookFormat, HookBoosterOutput } from './hook-booster.types';

const VALID_FORMATS: HookFormat[] = ['video', 'carousel', 'banner'];

export class GenerateHooksDto {
  @IsIn(VALID_FORMATS)
  format: HookFormat;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  primary_angle: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  secondary_angle?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  emotion: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  goal: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  product_context?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  audience_context?: string | null;
}

// ─── 4.7 Hook Booster v2 ─────────────────────────────────────────────────────

export class BoostHooksDto {
  @IsIn(VALID_FORMATS)
  format: HookFormat;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  primary_angle: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  secondary_angle?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  emotion: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  goal: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  product_context?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  audience_context?: string | null;

  /** Pre-generated v1 output from POST /api/hook-booster/generate. */
  @IsObject()
  hook_v1_outputs: HookBoosterOutput;

  /** 0–1: historical angle performance from memory service. */
  @IsNumber()
  @Min(0)
  @Max(1)
  memory_signal: number;

  /** 0–1: soft fatigue modifier from fatigue service. */
  @IsNumber()
  @Min(0)
  @Max(1)
  fatigue_signal: number;

  /** −0.10 to +0.25: exploration pressure delta from 4.5 engine. */
  @IsNumber()
  @Min(-0.10)
  @Max(0.25)
  exploration_pressure_delta: number;
}
