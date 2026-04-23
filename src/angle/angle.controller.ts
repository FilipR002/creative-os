import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AngleService } from './angle.service';
import { SelectAngleDto } from './angle.dto';

@ApiTags('Angle')
@Controller('api/angles')
export class AngleController {
  constructor(private readonly service: AngleService) {}

  @Get()
  @ApiOperation({ summary: 'List all active angles' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get angle by slug' })
  findOne(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Post('select')
  @ApiOperation({
    summary: 'Select 3 angles for a concept — exploit + secondary + explore',
    description: 'Goal-aware, emotion-aware selection with confidence scores and dynamic exploration rates.',
  })
  select(@Body() dto: SelectAngleDto) {
    return this.service.selectForConcept(dto);
  }
}
