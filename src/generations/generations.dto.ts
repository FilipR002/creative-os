import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class OverrideSettingsDto {
  @ApiPropertyOptional({ example: 'sales' })
  @IsOptional() @IsString() goal?: string;

  @ApiPropertyOptional({ example: 'urgency' })
  @IsOptional() @IsString() angle?: string;

  @ApiPropertyOptional({ example: 'direct' })
  @IsOptional() @IsString() tone?: string;

  @ApiPropertyOptional({ example: 'young professionals' })
  @IsOptional() @IsString() persona?: string;

  @ApiPropertyOptional({ example: 'video', description: 'video | carousel | banner' })
  @IsOptional() @IsString() format?: string;
}

export class CreateGenerationDto {
  @ApiProperty({ example: 'uuid-of-campaign' })
  @IsString()
  campaign_id: string;

  @ApiProperty({ example: 'Shoe brand targeting runners who hate expensive gear' })
  @IsString()
  brief: string;

  @ApiPropertyOptional({ type: OverrideSettingsDto })
  @IsOptional()
  override_settings?: OverrideSettingsDto;
}

export class UpdateBlockDto {
  @ApiProperty({ example: 'hook', description: 'hook | body | cta' })
  @IsIn(['hook', 'body', 'cta'])
  block: 'hook' | 'body' | 'cta';

  @ApiProperty({ example: 'Stop wasting money on shoes that break in a month.' })
  @IsString()
  value: string;
}

export class ImproveBlockDto {
  @ApiProperty({ example: 'hook', description: 'hook | body | cta' })
  @IsIn(['hook', 'body', 'cta'])
  block: 'hook' | 'body' | 'cta';

  @ApiProperty({ example: 'make it more emotional' })
  @IsString()
  instruction: string;

  @ApiPropertyOptional({ description: 'Additional context (campaign_id used for settings lookup)' })
  @IsOptional()
  context?: { campaign_id?: string };
}

export class CreateVersionDto {
  @ApiPropertyOptional({ example: 'manual', description: 'edit | improve | regenerate | manual' })
  @IsOptional() @IsString()
  created_from?: string;
}

export class SendFeedbackDto {
  @ApiPropertyOptional({ example: 'uuid-of-generation' })
  @IsOptional() @IsString()
  generation_id?: string;

  @ApiProperty({ example: 'edit', description: 'edit | accept | reject | regenerate | copy' })
  @IsIn(['edit', 'accept', 'reject', 'regenerate', 'copy'])
  signal_type: string;

  @ApiPropertyOptional({ example: 'hook', description: 'hook | body | cta | full' })
  @IsOptional() @IsString()
  block?: string;

  @ApiPropertyOptional({ example: 'shortened', description: 'shortened | expanded | tone_shift | replaced' })
  @IsOptional() @IsString()
  change_type?: string;
}
