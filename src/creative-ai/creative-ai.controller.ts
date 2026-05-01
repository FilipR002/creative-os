// ─── AI Creative Generation Layer — Controller ───────────────────────────────

import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreativeAiService }     from './creative-ai.service';
// Must be value imports (not `import type`) so NestJS metadata reflection works
// for the global ValidationPipe to enforce DTO constraints.
import {
  GenerateAdCopyDto,
  GenerateHooksDto,
  GenerateVideoScriptDto,
  GenerateImagePromptsDto,
  RefineBlockDto,
  GenerateBackgroundDto,
} from './creative-ai.types';

@ApiTags('Creative AI')
@Controller('api/creative-ai')
export class CreativeAiController {
  constructor(private readonly service: CreativeAiService) {}

  /**
   * Generate ad copy: headline, body, CTA, hashtags, + 2 A/B variants.
   */
  @Post('copy')
  @ApiOperation({ summary: 'Generate ad copy for a campaign angle' })
  generateCopy(@Body() dto: GenerateAdCopyDto) {
    return this.service.generateAdCopy(dto);
  }

  /**
   * Generate 5 hook variations with typed opening lines.
   */
  @Post('hooks')
  @ApiOperation({ summary: 'Generate hook variations for a concept' })
  generateHooks(@Body() dto: GenerateHooksDto) {
    return this.service.generateHooks(dto);
  }

  /**
   * Generate a full scene-by-scene video script with timing.
   */
  @Post('script')
  @ApiOperation({ summary: 'Generate a video script' })
  generateScript(@Body() dto: GenerateVideoScriptDto) {
    return this.service.generateVideoScript(dto);
  }

  /**
   * Generate image generation prompts for use with DALL-E / Midjourney / Flux.
   */
  @Post('image-prompts')
  @ApiOperation({ summary: 'Generate image prompts for ad visuals' })
  generateImagePrompts(@Body() dto: GenerateImagePromptsDto) {
    return this.service.generateImagePrompts(dto);
  }

  /**
   * Refine a single copy block (hook / copy / cta / scene / headline) in-place.
   * Accepts a preset instruction id or free-text instruction.
   */
  @Post('refine-block')
  @ApiOperation({ summary: 'Refine a single copy block with a targeted instruction' })
  refineBlock(@Body() dto: RefineBlockDto) {
    return this.service.refineBlock(dto);
  }

  /**
   * Generate an AI photographic background for a template using Imagen 4.
   * Returns a base64 data URL — ready to render as <img src> in the builder.
   *
   * POST /api/creative-ai/background
   * Body: { templateId, product?, brand?, style?, mood? }
   */
  @Post('background')
  @ApiOperation({ summary: 'Generate a photographic AI background for a template (Imagen 4)' })
  generateBackground(@Body() dto: GenerateBackgroundDto) {
    return this.service.generateBackground(dto);
  }
}
