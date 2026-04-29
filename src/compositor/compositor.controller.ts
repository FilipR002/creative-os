// ─── Compositor Controller ────────────────────────────────────────────────────
// POST /api/compositor/render   — single render
// POST /api/compositor/batch    — batch render (carousel slides)
// POST /api/compositor/rerender — re-render with copy/template overrides (edit mode)
// GET  /api/compositor/templates — list all available templates
// GET  /api/compositor/fonts    — list all font pairings
// GET  /api/compositor/health   — browser health check

import {
  Controller, Post, Get, Body, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { Public }            from '../common/decorators/public.decorator';
import { UserId }            from '../common/decorators/user-id.decorator';
import { CompositorService } from './compositor.service';
import { TEMPLATE_CATALOG }  from './templates/template-engine';
import { FONT_PAIRINGS }     from './fonts/font-library';
import type { CompositorInput } from './types/compositor.types';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

class RenderDto {
  input!: CompositorInput;
}

class BatchRenderDto {
  inputs!: CompositorInput[];
}

class RerenderDto {
  originalInput!:      CompositorInput;
  copyOverrides?:      Partial<CompositorInput['copy']>;
  templateOverride?:   CompositorInput['templateId'];
  fontPairingOverride?: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('api/compositor')
export class CompositorController {
  private readonly logger = new Logger(CompositorController.name);

  constructor(private readonly compositor: CompositorService) {}

  // ── Single render ──────────────────────────────────────────────────────────
  @Post('render')
  @HttpCode(HttpStatus.OK)
  async render(@Body() dto: RenderDto, @UserId() userId: string) {
    this.logger.log(`Render | user=${userId} template=${dto.input.templateId} size=${dto.input.size}`);
    return this.compositor.render(dto.input);
  }

  // ── Batch render ───────────────────────────────────────────────────────────
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async batch(@Body() dto: BatchRenderDto, @UserId() userId: string) {
    this.logger.log(`Batch render | user=${userId} count=${dto.inputs.length}`);
    return this.compositor.renderBatch(dto.inputs);
  }

  // ── Re-render (edit mode — no AI call) ────────────────────────────────────
  @Post('rerender')
  @HttpCode(HttpStatus.OK)
  async rerender(@Body() dto: RerenderDto, @UserId() userId: string) {
    this.logger.log(`Re-render | user=${userId} template=${dto.templateOverride ?? 'same'}`);
    return this.compositor.rerender(
      dto.originalInput,
      dto.copyOverrides ?? {},
      dto.templateOverride,
      dto.fontPairingOverride,
    );
  }

  // ── List templates ─────────────────────────────────────────────────────────
  @Get('templates')
  getTemplates() {
    return { templates: TEMPLATE_CATALOG };
  }

  // ── List font pairings ─────────────────────────────────────────────────────
  @Get('fonts')
  getFonts() {
    return { fonts: FONT_PAIRINGS };
  }

  // ── Health ─────────────────────────────────────────────────────────────────
  @Public()
  @Get('health')
  health() {
    return {
      status: this.compositor.isHealthy() ? 'ok' : 'degraded',
      service: 'compositor',
    };
  }
}
