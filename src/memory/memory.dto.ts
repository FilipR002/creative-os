import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsObject, IsOptional, IsString, IsBoolean } from 'class-validator';

export class MemoryQueryDto {
  @ApiPropertyOptional({ example: 'client-uuid' })
  @IsOptional() @IsString()
  clientId?: string;

  @ApiPropertyOptional({ example: 'fitness' })
  @IsOptional() @IsString()
  industry?: string;

  @ApiPropertyOptional({ enum: ['video', 'carousel', 'banner'] })
  @IsOptional() @IsString()
  format?: string;

  @ApiPropertyOptional({ example: 'before_after' })
  @IsOptional() @IsString()
  angle?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional() @IsNumber()
  limit?: number;
}

export class MemoryStoreDto {
  @ApiProperty({ example: 'client-uuid-or-unknown' })
  @IsString()
  clientId: string;

  @ApiProperty({ example: 'fitness' })
  @IsString()
  industry: string;

  @ApiProperty({ example: 'campaign-uuid' })
  @IsString()
  campaignId: string;

  @ApiProperty({ example: 'creative-uuid' })
  @IsString()
  creativeId: string;

  @ApiProperty({ enum: ['video', 'carousel', 'banner'] })
  @IsIn(['video', 'carousel', 'banner'])
  format: string;

  @ApiProperty({ example: 'before_after' })
  @IsString()
  angle: string;

  @ApiProperty({ example: {} })
  @IsObject()
  concept: Record<string, any>;

  @ApiProperty({ example: { ctr: 0.7, engagement: 0.8, conversion: 0.75, clarity: 0.9, total: 0.77 } })
  @IsObject()
  scores: { ctr: number; engagement: number; conversion: number; clarity: number; total: number };

  @ApiProperty({ example: 0.77 })
  @IsNumber()
  totalScore: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  isWinner: boolean;
}
