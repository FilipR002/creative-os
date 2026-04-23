import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Flat DTO — avoids nested-object transform issues in NestJS ValidationPipe.
 * All metric fields are at the top level.
 */
export class SubmitFeedbackDto {
  @ApiProperty({ description: 'Creative ID to receive real performance data' })
  @IsString()
  creativeId: string;

  @ApiProperty({ description: 'Real CTR (e.g. 0.08 = 8%)', minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0) @Max(1)
  @Type(() => Number)
  ctr: number;

  @ApiProperty({ description: 'Real retention / watch-through rate (0–1)', minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0) @Max(1)
  @Type(() => Number)
  retention: number;

  @ApiProperty({ description: 'Real conversion rate (0–1)', minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0) @Max(1)
  @Type(() => Number)
  conversion: number;

  @ApiPropertyOptional({ description: 'Industry context for future segmentation' })
  @IsOptional()
  @IsString()
  industry?: string;
}
