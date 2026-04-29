import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ResourceContext } from '../resources/resources.service';

export class GenerateCarouselDto {
  @ApiProperty({ example: 'uuid-of-campaign' })
  @IsString()
  campaignId: string;

  @ApiProperty({ example: 'uuid-of-concept' })
  @IsString()
  conceptId: string;

  @ApiPropertyOptional({ example: 'uuid-of-angle' })
  @IsOptional()
  @IsString()
  angleId?: string;

  @ApiPropertyOptional({ example: 'teach' })
  @IsOptional()
  @IsString()
  angleSlug?: string;

  @ApiProperty({ example: 7, minimum: 3, maximum: 10 })
  @IsInt()
  @Min(3)
  @Max(10)
  slideCount: number;

  @ApiPropertyOptional({ example: 'instagram' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiPropertyOptional({ description: 'Phase 3: user style context for personalized generation' })
  @IsOptional()
  @IsString()
  styleContext?: string;

  @ApiPropertyOptional({ description: 'Key objection to overcome in the creative' })
  @IsOptional()
  @IsString()
  keyObjection?: string;

  @ApiPropertyOptional({ description: 'Core value proposition to lead with' })
  @IsOptional()
  @IsString()
  valueProposition?: string;

  /** Internal — not exposed via API; injected by ExecutionGateway */
  resourceCtx?: ResourceContext;

  /**
   * Phase 6 — user-selected template override.
   * When set, overrides autoSelectTemplate() for ALL slides.
   * Falls back to AI auto-selection if omitted.
   */
  templateId?: string;
}
