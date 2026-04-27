import {
  IsArray, IsOptional, IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// ─── Resource (Product + Brand) ───────────────────────────────────────────────

export class UpsertResourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productDescription?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  productBenefits?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandTone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandVoice?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  imageUrls?: string[];
}

// ─── Persona ──────────────────────────────────────────────────────────────────

export class CreatePersonaDto {
  @ApiPropertyOptional()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  description: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  painPoints?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  desires?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  demographics?: string;
}

export class UpdatePersonaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  painPoints?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  desires?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  demographics?: string;
}
