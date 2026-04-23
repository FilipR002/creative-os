// ─── Phase 7 — Product Layer Types ───────────────────────────────────────────
// These are the ONLY types the creator UI ever sees.
// No signals, no weights, no engine internals.

export interface ProductOutput {
  title:                 string;
  primaryRecommendation: string;
  alternatives:          string[];
  explanation:           string;   // human copy only — no math, no signals
  confidence:            number;   // 0–100 integer
  category:              string;
}

export interface ProductGenerateResult {
  projectId:   string;
  output:      ProductOutput;
  generatedAt: string;
}

export interface ProductProject {
  id:          string;
  name:        string;
  goal:        string;
  context:     string;
  clientId:    string;
  createdAt:   string;
  lastResult?: ProductGenerateResult;
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

import { IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString()  name!:      string;
  @IsString()  @IsOptional() goal!:      string;
  @IsString()  @IsOptional() context!:   string;
  @IsString()  client_id!: string;
}

export class GenerateDto {
  @IsString() @IsOptional() emotion?: string;
  @IsString() @IsOptional() format?:  string;
}
