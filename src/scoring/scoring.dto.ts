import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class EvaluateDto {
  @ApiProperty({
    type: [String],
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
    description: 'IDs of creatives to score and rank',
  })
  @IsArray()
  @IsString({ each: true })
  creativeIds: string[];
}
