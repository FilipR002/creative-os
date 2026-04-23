import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto, UpdateCampaignDto, GroupAdsIntoCampaignDto } from './campaign.dto';
import { CampaignMode } from './campaign.dto';

@Injectable()
export class CampaignService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCampaignDto, userId: string) {
    return this.prisma.campaign.create({
      data: {
        userId,
        mode:     dto.mode as any,
        formats:  dto.formats,
        clientId: dto.clientId || null,
        status:   'DRAFT',
        name:     dto.name    || null,
        goal:     dto.goal    || null,
        angle:    dto.angle   || null,
        tone:     dto.tone    || null,
        persona:  dto.persona || null,
      },
    });
  }

  async update(id: string, dto: UpdateCampaignDto, userId: string) {
    await this.assertOwnership(id, userId);
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name     !== undefined && { name:     dto.name }),
        ...(dto.goal     !== undefined && { goal:     dto.goal }),
        ...(dto.angle    !== undefined && { angle:    dto.angle }),
        ...(dto.tone     !== undefined && { tone:     dto.tone }),
        ...(dto.persona  !== undefined && { persona:  dto.persona }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async activate(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    // Deactivate all other campaigns for this user first
    await this.prisma.campaign.updateMany({
      where: { userId, isActive: true, id: { not: id } },
      data:  { isActive: false },
    });
    return this.prisma.campaign.update({
      where: { id },
      data:  { isActive: true },
    });
  }

  async findOne(id: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        concept:   true,
        creatives: { include: { angle: true } },
      },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    if (campaign.userId && campaign.userId !== userId) {
      throw new ForbiddenException(`Campaign ${id} does not belong to you`);
    }
    return campaign;
  }

  async findAll(userId: string) {
    return this.prisma.campaign.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        concept:   true,
        creatives: { select: { id: true, format: true, isWinner: true, score: { select: { totalScore: true } } } },
      },
    });
  }

  async delete(id: string, userId: string): Promise<{ deleted: boolean }> {
    await this.assertOwnership(id, userId);

    await this.prisma.$transaction(async (tx) => {
      // Gather related IDs first
      const creativeIds = (await tx.creative.findMany({
        where:  { campaignId: id },
        select: { id: true },
      })).map(c => c.id);

      const generationIds = (await tx.generation.findMany({
        where:  { campaignId: id },
        select: { id: true },
      })).map(g => g.id);

      // ── Children of Creatives (FK-constrained, must go first) ──
      if (creativeIds.length > 0) {
        await tx.creativeImprovement.deleteMany({ where: { originalCreativeId: { in: creativeIds } } });
        await tx.creativeInsight.deleteMany({ where: { creativeId: { in: creativeIds } } });
        await tx.creativeScore.deleteMany({ where: { creativeId: { in: creativeIds } } });
        await tx.predictionError.deleteMany({ where: { creativeId: { in: creativeIds } } });
        await tx.creativeMemory.deleteMany({ where: { creativeId: { in: creativeIds } } });
      }

      // ── Children of Generations (FK-constrained) ──
      if (generationIds.length > 0) {
        await tx.generationVersion.deleteMany({ where: { generationId: { in: generationIds } } });
        await tx.feedbackSignal.deleteMany({ where: { generationId: { in: generationIds } } });
      }

      // ── Tables keyed by campaignId (no FK, best-effort cleanup) ──
      await tx.mirofishSignal.deleteMany({ where: { campaignId: id } });
      await tx.learningCycle.deleteMany({ where: { campaignId: id } });
      await tx.campaignOutcome.deleteMany({ where: { campaignId: id } });
      await tx.causalTrace.deleteMany({ where: { campaignId: id } });
      await tx.realWorldEvent.deleteMany({ where: { campaignId: id } });

      // ── Main children ──
      await tx.creative.deleteMany({ where: { campaignId: id } });
      await tx.generation.deleteMany({ where: { campaignId: id } });
      await tx.concept.deleteMany({ where: { campaignId: id } });

      // ── Campaign itself ──
      await tx.campaign.delete({ where: { id } });
    });

    return { deleted: true };
  }

  /**
   * POST /api/campaign/from-ads
   * Creates a new FULL campaign container and groups the selected SINGLE
   * (quick-ad) campaigns under it by setting their groupCampaignId.
   */
  async fromAds(dto: GroupAdsIntoCampaignDto, userId: string) {
    if (!dto.adIds || dto.adIds.length === 0) {
      throw new BadRequestException('adIds must not be empty');
    }

    // Verify ownership of every selected quick-ad campaign
    const ads = await this.prisma.campaign.findMany({
      where: { id: { in: dto.adIds }, userId },
      select: { id: true, mode: true },
    });
    if (ads.length !== dto.adIds.length) {
      throw new ForbiddenException('One or more campaigns not found or do not belong to you');
    }

    // Create the new group/container campaign (no concept, just a named container)
    const group = await this.prisma.campaign.create({
      data: {
        userId,
        mode:    CampaignMode.FULL,
        formats: [...new Set(ads.flatMap(() => ['video', 'carousel', 'banner']))],
        name:    dto.name,
        status:  'DRAFT' as any,
      },
    });

    // Tag each quick-ad with the group id and promote to PARTIAL
    await this.prisma.campaign.updateMany({
      where: { id: { in: dto.adIds } },
      data:  { groupCampaignId: group.id, mode: CampaignMode.PARTIAL },
    });

    return { groupId: group.id, name: group.name, adCount: dto.adIds.length };
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.campaign.update({
      where: { id },
      data:  { status: status as any },
    });
  }

  /**
   * Utility used by other services (concept, video, etc.) to verify
   * that a campaign is owned by the requesting user before proceeding.
   * Throws ForbiddenException if ownership check fails.
   */
  async assertOwnership(campaignId: string, userId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where:  { id: campaignId },
      select: { id: true, userId: true },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);
    if (campaign.userId && campaign.userId !== userId) {
      throw new ForbiddenException(`Campaign ${campaignId} does not belong to you`);
    }
  }
}
