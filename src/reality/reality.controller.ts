import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags }              from '@nestjs/swagger';
import { RealityAggregatorService, IngestEventDto } from './reality.service';

@ApiTags('reality')
@Controller('api/reality')
export class RealityController {
  constructor(private readonly service: RealityAggregatorService) {}

  @Post('event')
  @ApiOperation({ summary: 'Ingest a single real-world event (meta/google/manual)' })
  ingest(@Body() dto: IngestEventDto) {
    return this.service.ingestEvent(dto);
  }

  @Post('events')
  @ApiOperation({ summary: 'Batch ingest real-world events' })
  ingestBatch(@Body() body: { events: IngestEventDto[] }) {
    return this.service.ingestBatch(body.events);
  }

  @Get('aggregate/:campaignId')
  @ApiOperation({ summary: 'Aggregate real-world events into metric shape for a campaign' })
  aggregate(@Param('campaignId') campaignId: string) {
    return this.service.aggregate(campaignId);
  }

  @Get('events/:campaignId')
  @ApiOperation({ summary: 'Raw event list for a campaign (audit)' })
  events(@Param('campaignId') campaignId: string) {
    return this.service.getEventsForCampaign(campaignId);
  }
}
