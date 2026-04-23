import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { AdGroupsService } from './ad-groups.service';
import { UserId } from '../common/decorators/user-id.decorator';

class CreateGroupDto {
  @IsString() name: string;
}
class RenameGroupDto {
  @IsString() name: string;
}
class MoveCreativeDto {
  @IsString() creativeId: string;
  @IsOptional() @IsString() targetGroupId?: string | null;
}
class ReorderDto {
  @IsString()  campaignId:  string;
  @IsOptional() @IsString() groupId?: string | null;
  @IsArray()   orderedIds:  string[];
}

@ApiTags('Ad Groups')
@Controller('api')
export class AdGroupsController {
  constructor(private readonly svc: AdGroupsService) {}

  /** GET /api/campaign/:id/groups */
  @Get('campaign/:id/groups')
  @ApiOperation({ summary: 'List ad groups with their creatives for a campaign' })
  list(@Param('id') id: string, @UserId() userId: string) {
    return this.svc.listForCampaign(id, userId);
  }

  /** POST /api/campaign/:id/groups */
  @Post('campaign/:id/groups')
  @ApiOperation({ summary: 'Create a new ad group inside a campaign' })
  create(
    @Param('id') id: string,
    @Body() dto: CreateGroupDto,
    @UserId() userId: string,
  ) {
    return this.svc.create(id, dto.name, userId);
  }

  /** PATCH /api/ad-groups/:id */
  @Patch('ad-groups/:id')
  @ApiOperation({ summary: 'Rename an ad group' })
  rename(
    @Param('id') id: string,
    @Body() dto: RenameGroupDto,
    @UserId() userId: string,
  ) {
    return this.svc.rename(id, dto.name, userId);
  }

  /** DELETE /api/ad-groups/:id */
  @Delete('ad-groups/:id')
  @ApiOperation({ summary: 'Delete an ad group (creatives become ungrouped)' })
  delete(@Param('id') id: string, @UserId() userId: string) {
    return this.svc.delete(id, userId);
  }

  /** POST /api/ad-groups/move */
  @Post('ad-groups/move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move a creative to a different ad group (or ungrouped)' })
  move(@Body() dto: MoveCreativeDto, @UserId() userId: string) {
    return this.svc.moveCreative(dto.creativeId, dto.targetGroupId ?? null, userId);
  }

  /** POST /api/ad-groups/reorder */
  @Post('ad-groups/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder creatives within a group' })
  reorder(@Body() dto: ReorderDto, @UserId() userId: string) {
    return this.svc.reorder(dto.groupId ?? null, dto.campaignId, dto.orderedIds, userId);
  }
}
