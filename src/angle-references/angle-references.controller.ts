import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags }       from '@nestjs/swagger';
import { AngleReferencesService }      from './angle-references.service';
import { CreateReferenceDto }          from './dto/create-reference.dto';
import { BulkCreateReferenceDto }      from './dto/bulk-create.dto';

@ApiTags('angle-references')
@Controller('angle-references')
export class AngleReferencesController {
  constructor(private readonly service: AngleReferencesService) {}

  // INTERNAL ONLY — NO DIRECT UI ACCESS (called by reference ingestion pipeline)
  @Post()
  @ApiOperation({ summary: '[INTERNAL] Add a single creative reference for an angle' })
  create(@Body() dto: CreateReferenceDto) {
    return this.service.create(dto);
  }

  // INTERNAL ONLY — NO DIRECT UI ACCESS (bulk reference ingestion pipeline)
  @Post('bulk')
  @ApiOperation({ summary: '[INTERNAL] Bulk-insert creative references (skipDuplicates)' })
  bulkCreate(@Body() dto: BulkCreateReferenceDto) {
    return this.service.bulkInsert(dto.items);
  }

  @Get()
  @ApiOperation({ summary: 'List all creative references' })
  getAll() {
    return this.service.getAll();
  }

  @Get(':angleSlug')
  @ApiOperation({ summary: 'Get top references for a specific angle' })
  getByAngle(
    @Param('angleSlug') angleSlug: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getByAngle(angleSlug, limit ? Number(limit) : 3);
  }

  // ADMIN ONLY — data maintenance
  @Delete(':angleSlug')
  @ApiOperation({ summary: '[ADMIN] Delete all references for an angle' })
  deleteByAngle(@Param('angleSlug') angleSlug: string) {
    return this.service.deleteByAngle(angleSlug);
  }
}
