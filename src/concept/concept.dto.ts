import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { ResourceContext } from '../resources/resources.service';

export enum ConceptGoal {
  CONVERSION = 'conversion', // legacy alias — maps to SALES
  SALES      = 'sales',
  AWARENESS  = 'awareness',
  ENGAGEMENT = 'engagement',
  RETENTION  = 'retention',
  INSTALL    = 'install',
}

export class GenerateConceptDto {
  @ApiProperty({ example: 'uuid-of-campaign' })
  @IsString()
  campaignId: string;

  @ApiProperty({ example: 'Most anglers lose money because they fish at the wrong times' })
  @IsString()
  brief: string;

  @ApiProperty({ enum: ConceptGoal, example: 'conversion' })
  @IsEnum(ConceptGoal)
  goal: ConceptGoal;

  @ApiPropertyOptional({ example: 'instagram' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: 'Weekend anglers aged 30-50 who fish for sport and food' })
  @IsOptional()
  @IsString()
  audience?: string;

  @ApiPropertyOptional({ example: '60s' })
  @IsOptional()
  @IsString()
  durationTier?: string;

  @ApiPropertyOptional({ example: 'urgency' })
  @IsOptional()
  @IsString()
  angleHint?: string;

  @ApiPropertyOptional({ example: 'direct-response' })
  @IsOptional()
  @IsString()
  toneHint?: string;

  /** Internal — pre-resolved persona + product/brand context for AI enrichment */
  resourceCtx?: ResourceContext;
}
