import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConceptService } from './concept.service';
import { GenerateConceptDto } from './concept.dto';
import { UserId } from '../common/decorators/user-id.decorator';

@ApiTags('Concept')
@Controller('api/concept')
export class ConceptController {
  constructor(private readonly service: ConceptService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate master concept from a brief' })
  generate(
    @Body() dto: GenerateConceptDto,
    @UserId() userId: string,
  ) {
    return this.service.generate(dto, userId);
  }

  @Get('campaign/:campaignId')
  @ApiOperation({ summary: 'Get concept for a campaign' })
  findByCampaign(
    @Param('campaignId') campaignId: string,
    @UserId() userId: string,
  ) {
    return this.service.findByCampaign(campaignId, userId);
  }
}
