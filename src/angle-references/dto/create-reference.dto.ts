import { IsString, IsOptional, IsArray, IsNumber, IsIn } from 'class-validator';

export class CreateReferenceDto {
  @IsString()
  angleSlug: string;

  @IsString()
  imageUrl: string;

  @IsString()
  @IsIn(['image', 'video'])
  type: 'image' | 'video';

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  performanceScore?: number;
}
