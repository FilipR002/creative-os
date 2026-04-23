import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { MemoryQueryDto, MemoryStoreDto } from './memory.dto';
import { UserId } from '../common/decorators/user-id.decorator';

@ApiTags('Memory')
@Controller('api/memory')
export class MemoryController {
  constructor(private readonly service: MemoryService) {}

  @Post('store')
  @ApiOperation({ summary: 'Manually store a creative memory entry' })
  store(@Body() dto: MemoryStoreDto, @UserId() userId: string) {
    return this.service.store({ ...dto, userId });
  }

  @Post('query')
  @ApiOperation({
    summary: 'Query memory — returns top creatives, best angles, avg scores',
    description: 'Filter by client, industry, format, or angle. Results are scoped to your user.',
  })
  query(@Body() dto: MemoryQueryDto, @UserId() userId: string) {
    return this.service.query({ ...dto, userId });
  }

  @Get('best-angles')
  @ApiOperation({ summary: 'Get best performing angles, ranked by avg score' })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'industry', required: false })
  getBestAngles(
    @Query('clientId') clientId: string | undefined,
    @Query('industry') industry: string | undefined,
    @UserId() userId: string,
  ) {
    return this.service.getBestAngles(clientId, industry, userId);
  }

  @Get('format-stats')
  @ApiOperation({ summary: 'Get format performance stats (video vs carousel vs banner)' })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'industry', required: false })
  getFormatStats(
    @Query('clientId') clientId: string | undefined,
    @Query('industry') industry: string | undefined,
    @UserId() userId: string,
  ) {
    return this.service.getFormatStats(clientId, industry, userId);
  }

  @Get('win-rates')
  @ApiOperation({ summary: 'Get win rate per angle (scoped to your user)' })
  getWinRates(@UserId() userId: string) {
    return this.service.getWinRates(userId);
  }
}
