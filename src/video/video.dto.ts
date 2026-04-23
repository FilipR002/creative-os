import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DurationTier {
  S5  = '5s',
  S8  = '8s',
  S10 = '10s',
  S15 = '15s',
  S30 = '30s',
  S45 = '45s',
  S60 = '60s',
  S75 = '75s',
  S90 = '90s',
}

export class GenerateVideoDto {
  @ApiProperty({ example: 'uuid-of-campaign' })
  @IsString()
  campaignId: string;

  @ApiProperty({ example: 'uuid-of-concept' })
  @IsString()
  conceptId: string;

  @ApiPropertyOptional({ example: 'uuid-of-angle (or pass angleSlug)' })
  @IsOptional()
  @IsString()
  angleId?: string;

  @ApiPropertyOptional({ example: 'teach' })
  @IsOptional()
  @IsString()
  angleSlug?: string;

  @ApiProperty({ enum: DurationTier, example: '60s' })
  @IsEnum(DurationTier)
  durationTier: DurationTier;

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
}
