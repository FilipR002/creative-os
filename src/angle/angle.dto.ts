import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SelectAngleDto {
  @ApiProperty({ example: 'uuid-of-concept' })
  @IsString()
  conceptId: string;

  @ApiProperty({ example: 'video' })
  @IsString()
  format: string;

  @ApiPropertyOptional({ example: 'fishing' })
  @IsOptional()
  @IsString()
  clientIndustry?: string;
}
