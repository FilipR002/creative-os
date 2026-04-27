import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserId }                 from '../common/decorators/user-id.decorator';
import { ResourcesService }       from './resources.service';
import { UpsertResourceDto, CreatePersonaDto, UpdatePersonaDto } from './resources.dto';

@ApiTags('resources')
@ApiBearerAuth()
@Controller('api/resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  // ── Resource (Product + Brand) ─────────────────────────────────────────────

  /** Get the current user's resource (product + brand + personas) */
  @Get()
  get(@UserId() userId: string) {
    return this.resources.getByUser(userId);
  }

  /** Create or update the current user's resource */
  @Put()
  upsert(@Body() dto: UpsertResourceDto, @UserId() userId: string) {
    return this.resources.upsert(dto, userId);
  }

  // ── Personas ───────────────────────────────────────────────────────────────

  /** Add a persona to the user's resource */
  @Post('personas')
  createPersona(@Body() dto: CreatePersonaDto, @UserId() userId: string) {
    return this.resources.createPersona(dto, userId);
  }

  /** Update a persona */
  @Patch('personas/:id')
  updatePersona(
    @Param('id') id: string,
    @Body() dto: UpdatePersonaDto,
    @UserId() userId: string,
  ) {
    return this.resources.updatePersona(id, dto, userId);
  }

  /** Delete a persona */
  @Delete('personas/:id')
  deletePersona(@Param('id') id: string, @UserId() userId: string) {
    return this.resources.deletePersona(id, userId);
  }
}
