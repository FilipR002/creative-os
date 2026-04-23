// ─── Phase 7 — User Product Controller ───────────────────────────────────────
// Public-facing endpoints. Returns ONLY ProductOutput — never engine internals.

import {
  Body, Controller, Get, NotFoundException,
  Param, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags }     from '@nestjs/swagger';
import { Public }                    from '../../common/decorators/public.decorator';
import { assertClientScope }         from '../../common/guards/client-scope';
import { ProjectStoreService }       from './project-store.service';
import { ProductOrchestratorService } from './product-orchestrator.service';
import {
  CreateProjectDto,
  GenerateDto,
  ProductGenerateResult,
  ProductProject,
} from './product.types';

@Public()
@ApiTags('product-user')
@Controller('product/project')
export class UserProductController {
  constructor(
    private readonly projects:   ProjectStoreService,
    private readonly generator:  ProductOrchestratorService,
  ) {}

  // ── Projects ──────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  create(@Body() dto: CreateProjectDto): ProductProject {
    assertClientScope(dto.client_id);
    return this.projects.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List projects for a client' })
  list(@Query('client_id') clientId: string): ProductProject[] {
    assertClientScope(clientId);
    return this.projects.listByClient(clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by id' })
  getOne(@Param('id') id: string): ProductProject {
    const project = this.projects.get(id);
    if (!project) throw new NotFoundException(`project ${id} not found`);
    return project;
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  @Post(':id/generate')
  @ApiOperation({ summary: 'Generate AI recommendations for a project' })
  async generate(
    @Param('id')  id:  string,
    @Body()       dto: GenerateDto,
  ): Promise<ProductGenerateResult> {
    const project = this.projects.get(id);
    if (!project) throw new NotFoundException(`project ${id} not found`);

    const output = await this.generator.generate(project, dto.emotion, dto.format);
    const result: ProductGenerateResult = {
      projectId:   id,
      output,
      generatedAt: new Date().toISOString(),
    };

    this.projects.setLastResult(id, result);
    return result;
  }
}
