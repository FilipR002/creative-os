// ─── User Style Profile — Types ───────────────────────────────────────────────

import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export type SignalType =
  | 'shorter' | 'more_emotional' | 'add_urgency' | 'more_premium'
  | 'simpler'  | 'stronger_cta'  | 'bolder'      | 'conversational'
  | 'manual_shorten_hook' | 'manual_shorten_copy'
  | 'manual_lengthen_hook' | 'manual_lengthen_copy'
  | 'feedback_worked' | 'feedback_didnt_work';

export class IngestSignalDto {
  @IsString()
  signalType!: SignalType;

  @IsOptional() @IsNumber() @Min(0) @Max(1) @Type(() => Number)
  weight?: number; // override default weight (0.5–1.0)
}

export interface StyleProfileResponse {
  hookShort:      number;
  toneEmotional:  number;
  tonePremium:    number;
  toneAggressive: number;
  toneCasual:     number;
  ctaUrgency:     number;
  ctaDirect:      number;
  copyShort:      number;
  totalSignals:   number;
  // Derived labels for UI
  dominantTone:    string;
  hookLabel:       string;
  ctaLabel:        string;
  copyLabel:       string;
  styleContext:    string; // pre-built prompt context string
  adaptations:     string[]; // "Why you're seeing this" reasons
}
