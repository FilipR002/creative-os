import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum CampaignMode {
  SINGLE = 'SINGLE',
  PARTIAL = 'PARTIAL',
  FULL = 'FULL',
}

export enum CampaignFormat {
  VIDEO = 'video',
  CAROUSEL = 'carousel',
  BANNER = 'banner',
}

export class CreateCampaignDto {
  @ApiPropertyOptional({ example: 'Summer Sale Campaign' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ enum: CampaignMode, example: 'FULL' })
  @IsEnum(CampaignMode)
  mode: CampaignMode;

  @ApiProperty({ type: [String], example: ['video', 'carousel', 'banner'] })
  @IsArray()
  formats: string[];

  @ApiPropertyOptional({ example: 'uuid-of-client' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ example: 'sales', description: 'sales | awareness | leads | conversions' })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional({ example: 'urgency', description: 'urgency | emotional | premium | price-focused | storytelling' })
  @IsOptional()
  @IsString()
  angle?: string;

  @ApiPropertyOptional({ example: 'direct', description: 'direct | casual | luxury | aggressive | friendly' })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional({ example: 'young professionals aged 25-35' })
  @IsOptional()
  @IsString()
  persona?: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional({ example: 'Updated Campaign Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'sales' })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional({ example: 'emotional' })
  @IsOptional()
  @IsString()
  angle?: string;

  @ApiPropertyOptional({ example: 'casual' })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional({ example: 'busy parents' })
  @IsOptional()
  @IsString()
  persona?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GroupAdsIntoCampaignDto {
  @ApiProperty({ example: 'Q3 Meta Campaign', description: 'Name for the new campaign group' })
  @IsString()
  name: string;

  @ApiProperty({ type: [String], example: ['uuid1', 'uuid2'], description: 'Campaign IDs (quick ads) to group' })
  @IsArray()
  adIds: string[];
}
