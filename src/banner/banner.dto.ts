import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import type { ResourceContext } from '../resources/resources.service';

export const BANNER_SIZES = ['1200x628', '1080x1080', '1080x1920', '300x250', '728x90'];

export class GenerateBannerDto {
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

  @ApiPropertyOptional({ example: 'before_after' })
  @IsOptional()
  @IsString()
  angleSlug?: string;

  @ApiProperty({
    type: [String],
    example: ['1200x628', '1080x1080'],
    description: 'Banner sizes to generate',
  })
  @IsArray()
  sizes: string[];

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
}
