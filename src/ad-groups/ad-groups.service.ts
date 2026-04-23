import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Assert campaign ownership ─────────────────────────────────────────────

  private async assertCampaignOwner(campaignId: string, userId: string) {
    const c = await this.prisma.campaign.findUnique({
      where: { id: campaignId }, select: { id: true, userId: true },
    });
    if (!c) throw new NotFoundException(`Campaign ${campaignId} not found`);
    if (c.userId && c.userId !== userId) throw new ForbiddenException('Not your campaign');
  }

  private async assertGroupOwner(groupId: string, userId: string) {
    const g = await this.prisma.adGroup.findUnique({
      where: { id: groupId }, select: { id: true, campaignId: true },
    });
    if (!g) throw new NotFoundException(`Ad group ${groupId} not found`);
    await this.assertCampaignOwner(g.campaignId, userId);
    return g;
  }

  // ── List groups for a campaign (includes ordered creatives) ──────────────

  async listForCampaign(campaignId: string, userId: string) {
    await this.assertCampaignOwner(campaignId, userId);

    // Groups ordered by position
    const groups = await this.prisma.adGroup.findMany({
      where:   { campaignId },
      orderBy: { position: 'asc' },
      include: {
        creatives: {
          orderBy: { position: 'asc' },
          include: { angle: true, score: true },
        },
      },
    });

    // Also return ungrouped creatives so the UI can show them
    const ungrouped = await this.prisma.creative.findMany({
      where:   { campaignId, adGroupId: null },
      orderBy: { createdAt: 'asc' },
      include: { angle: true, score: true },
    });

    return { groups, ungrouped };
  }

  // ── Create a new group ────────────────────────────────────────────────────

  async create(campaignId: string, name: string, userId: string) {
    await this.assertCampaignOwner(campaignId, userId);

    const last = await this.prisma.adGroup.findFirst({
      where:   { campaignId },
      orderBy: { position: 'desc' },
      select:  { position: true },
    });

    return this.prisma.adGroup.create({
      data: { campaignId, name: name.trim(), position: (last?.position ?? -1) + 1 },
    });
  }

  // ── Rename a group ────────────────────────────────────────────────────────

  async rename(groupId: string, name: string, userId: string) {
    await this.assertGroupOwner(groupId, userId);
    return this.prisma.adGroup.update({
      where: { id: groupId },
      data:  { name: name.trim() },
    });
  }

  // ── Delete a group (ungrouped its creatives, doesn't delete them) ─────────

  async delete(groupId: string, userId: string) {
    await this.assertGroupOwner(groupId, userId);

    // Unassign creatives from this group (keep them as ungrouped)
    await this.prisma.creative.updateMany({
      where: { adGroupId: groupId },
      data:  { adGroupId: null, position: 0 },
    });

    await this.prisma.adGroup.delete({ where: { id: groupId } });
    return { deleted: true };
  }

  // ── Move a creative to a different group (or ungrouped) ───────────────────
  // Optimistic position: appended to the end of the target group.

  async moveCreative(
    creativeId: string,
    targetGroupId: string | null,
    userId:        string,
  ) {
    const creative = await this.prisma.creative.findUnique({
      where: { id: creativeId }, select: { id: true, campaignId: true, adGroupId: true },
    });
    if (!creative) throw new NotFoundException(`Creative ${creativeId} not found`);
    await this.assertCampaignOwner(creative.campaignId, userId);

    if (targetGroupId) {
      const group = await this.prisma.adGroup.findUnique({
        where: { id: targetGroupId }, select: { campaignId: true },
      });
      if (!group || group.campaignId !== creative.campaignId) {
        throw new BadRequestException('Target group belongs to a different campaign');
      }
    }

    // Find max position in target group so we append
    const targetCreatives = await this.prisma.creative.findMany({
      where:   targetGroupId ? { adGroupId: targetGroupId } : { campaignId: creative.campaignId, adGroupId: null },
      select:  { position: true },
      orderBy: { position: 'desc' },
    });
    const nextPos = targetCreatives.length > 0 ? (targetCreatives[0].position + 1) : 0;

    return this.prisma.creative.update({
      where: { id: creativeId },
      data:  { adGroupId: targetGroupId, position: nextPos },
    });
  }

  // ── Reorder creatives inside a group ──────────────────────────────────────
  // Accepts an ordered list of creative IDs and stamps each with its index.

  async reorder(groupId: string | null, campaignId: string, orderedIds: string[], userId: string) {
    await this.assertCampaignOwner(campaignId, userId);

    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.creative.update({
          where: { id },
          data:  { position: idx },
        }),
      ),
    );
    return { reordered: orderedIds.length };
  }
}
