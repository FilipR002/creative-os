import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreativeDNAService } from './creative-dna.service';

@ApiTags('creative-dna')
@Controller('api/creative-dna')
export class CreativeDNAController {
  constructor(private readonly service: CreativeDNAService) {}

  @Get('top')
  @ApiOperation({
    summary: 'Top Creative DNA patterns sorted by performance × survival rate',
    description:
      'Returns structured visual DNA including layoutComplexity, imageTextRatio, ' +
      'contrastLevel, colorMood, typographyStyle, and compositionStyle — ' +
      'the learnable visual dimensions extracted from top-performing ads.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  top(@Query('limit') limit?: string) {
    return this.service.getTopCreativeDNA(limit ? parseInt(limit, 10) : 3);
  }

  @Get('compositor-hints')
  @ApiOperation({
    summary: '[INTERNAL] Compositor-ready color/font hints from top DNA',
    description:
      'Translates the winning visual DNA into exact compositor parameters: ' +
      'colorScheme, fontPairingId, preferDense, highContrast. ' +
      'Call this before /api/compositor/render to bias generation toward proven visual patterns.',
  })
  async compositorHints() {
    return this.service.getCompositorHints();
  }

  // INTERNAL ONLY — NO DIRECT UI ACCESS
  @Get('prompt-context')
  @ApiOperation({
    summary: '[INTERNAL] Formatted DNA context string for prompt injection',
    description: 'Returns a structured prompt block including visual bias instructions. ' +
      'Injected into creative generation prompts by the AI pipeline.',
  })
  async promptContext() {
    const ctx = await this.service.getDNAPromptContext();
    return { context: ctx };
  }
}
