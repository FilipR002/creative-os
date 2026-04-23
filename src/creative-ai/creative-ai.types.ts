// ─── AI Creative Generation Layer — Types ────────────────────────────────────
// DTOs are classes so the global ValidationPipe can enforce required fields.

import { IsString, IsOptional, IsNumber, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ── Ad Copy ──────────────────────────────────────────────────────────────────

export class GenerateAdCopyDto {
  @IsString()
  campaignId!: string;

  @IsOptional() @IsString()
  conceptId?: string;

  @IsString()
  angleSlug!: string;

  @IsString()
  coreMessage!: string;

  @IsString()
  platform!: string;   // instagram | tiktok | facebook | youtube | linkedin

  @IsString()
  format!: string;     // video | carousel | banner | story

  @IsOptional() @IsString()
  audience?: string;

  @IsOptional() @IsString()
  tone?: string;       // bold | subtle | humorous | inspirational | direct

  @IsOptional() @IsNumber() @Type(() => Number)
  charLimit?: number;
}

export interface AdCopyResult {
  headline:    string;
  body:        string;
  cta:         string;
  hashtags:    string[];
  altVersions: { headline: string; body: string; cta: string }[];
}

// ── Hook Variations ───────────────────────────────────────────────────────────

export class GenerateHooksDto {
  @IsString()
  coreMessage!: string;

  @IsString()
  angleSlug!: string;

  @IsString()
  platform!: string;

  @IsOptional() @IsString()
  audience?: string;

  @IsOptional() @IsInt() @Min(1) @Max(10) @Type(() => Number)
  count?: number;
}

export interface HookVariation {
  hook:        string;
  hookType:    string;
  emotion:     string;
  rationale:   string;
}

export interface HooksResult {
  hooks: HookVariation[];
}

// ── Video Script ──────────────────────────────────────────────────────────────

export class GenerateVideoScriptDto {
  @IsString()
  campaignId!: string;

  @IsOptional() @IsString()
  conceptId?: string;

  @IsString()
  angleSlug!: string;

  @IsString()
  coreMessage!: string;

  @IsString()
  platform!: string;

  @IsInt() @Min(10) @Max(120) @Type(() => Number)
  durationSec!: number;

  @IsOptional() @IsString()
  audience?: string;

  @IsOptional() @IsString()
  hook?: string;
}

export interface ScriptScene {
  sceneNumber: number;
  duration:    string;
  visual:      string;
  voiceover:   string;
  note?:       string;
}

export interface VideoScriptResult {
  title:       string;
  totalLength: string;
  hook:        string;
  scenes:      ScriptScene[];
  endCard:     string;
}

// ── Image Prompt ──────────────────────────────────────────────────────────────

export class GenerateImagePromptsDto {
  @IsString()
  coreMessage!: string;

  @IsString()
  angleSlug!: string;

  @IsString()
  platform!: string;

  @IsString()
  format!: string;

  @IsOptional() @IsString()
  emotion?: string;

  @IsOptional() @IsInt() @Min(1) @Max(10) @Type(() => Number)
  count?: number;
}

export interface ImagePromptResult {
  prompts: {
    prompt:      string;
    composition: string;
    mood:        string;
    copyOverlay: string;
  }[];
}

// ── Block Refinement ──────────────────────────────────────────────────────────

export class RefineBlockDto {
  @IsString()
  blockType!: string;   // 'hook' | 'copy' | 'cta' | 'scene' | 'headline' | 'body'

  @IsString()
  currentValue!: string;

  @IsString()
  instruction!: string; // preset id or free-text instruction

  @IsOptional() @IsString()
  brief?: string;

  @IsOptional() @IsString()
  angleSlug?: string;
}

export interface RefinedBlockResult {
  value:     string;
  rationale: string;
}
