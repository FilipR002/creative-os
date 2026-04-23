import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateReferenceDto } from './create-reference.dto';

export class BulkCreateReferenceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReferenceDto)
  items: CreateReferenceDto[];
}
