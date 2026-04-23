import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreativeDNAService } from './creative-dna.service';

@ApiTags('creative-dna')
@Controller('api/creative-dna')
export class CreativeDNAController {
  constructor(private readonly service: CreativeDNAService) {}

  @Get('top')
  @ApiOperation({ summary: 'Top Creative DNA patterns sorted by performance × survival rate' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  top(@Query('limit') limit?: string) {
    return this.service.getTopCreativeDNA(limit ? parseInt(limit, 10) : 3);
  }

  // INTERNAL ONLY — NO DIRECT UI ACCESS (used by AI generation pipeline for prompt injection)
  @Get('prompt-context')
  @ApiOperation({ summary: '[INTERNAL] Formatted DNA context string for prompt injection' })
  async promptContext() {
    const ctx = await this.service.getDNAPromptContext();
    return { context: ctx };
  }
}
