import { Body, Controller, Delete, Get, Param, Patch, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto, UpdateCampaignDto, GroupAdsIntoCampaignDto } from './campaign.dto';
import { UserId } from '../common/decorators/user-id.decorator';

@ApiTags('Campaign')
@Controller('api/campaign')
export class CampaignController {
  constructor(private readonly service: CampaignService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campaign' })
  create(@Body() dto: CreateCampaignDto, @UserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all campaigns for the requesting user' })
  findAll(@UserId() userId: string) {
    return this.service.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign with its concept + creatives' })
  findOne(@Param('id') id: string, @UserId() userId: string) {
    return this.service.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update campaign settings (name, goal, angle, tone, persona)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @UserId() userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Set campaign as active (deactivates others)' })
  activate(@Param('id') id: string, @UserId() userId: string) {
    return this.service.activate(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a campaign and all its related data' })
  delete(@Param('id') id: string, @UserId() userId: string) {
    return this.service.delete(id, userId);
  }

  @Post('from-ads')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Group selected quick-ad campaigns into a named campaign container' })
  fromAds(@Body() dto: GroupAdsIntoCampaignDto, @UserId() userId: string) {
    return this.service.fromAds(dto, userId);
  }
}
