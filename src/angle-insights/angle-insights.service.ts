import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';

export interface CreateInsightDto {
  angleSlug:      string;
  imageUrl:       string;
  hook:           string;
  layout:         string;
  emotion:        string;
  ctaStyle:       string;
  visualElements: string[];
  insight:        string;
  sourceFolder?:  string;
  model?:         string;
}

@Injectable()
export class AngleInsightsService {
  private readonly logger = new Logger(AngleInsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInsightDto) {
    return this.prisma.angleCreativeInsight.create({ data: dto });
  }

  async bulkCreate(items: CreateInsightDto[]) {
    const result = await this.prisma.angleCreativeInsight.createMany({
      data:           items,
      skipDuplicates: false,   // allow re-analysis of same image
    });
    this.logger.log(`Bulk insert: ${result.count} insights stored`);
    return result;
  }

  async getByAngle(angleSlug: string, limit = 10) {
    return this.prisma.angleCreativeInsight.findMany({
      where:   { angleSlug },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
  }

  async getAll(limit = 100) {
    return this.prisma.angleCreativeInsight.findMany({
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
  }

  async getSummaryByAngle() {
    const rows = await this.prisma.angleCreativeInsight.findMany({
      select: { angleSlug: true, emotion: true, hook: true, layout: true, insight: true },
      orderBy: { createdAt: 'desc' },
    });

    const grouped: Record<string, typeof rows> = {};
    for (const r of rows) {
      if (!grouped[r.angleSlug]) grouped[r.angleSlug] = [];
      grouped[r.angleSlug].push(r);
    }

    return Object.entries(grouped).map(([slug, items]) => ({
      angleSlug:   slug,
      count:       items.length,
      topEmotions: topK(items.map(i => i.emotion), 3),
      topLayouts:  topK(items.map(i => i.layout), 3),
      sampleHooks: items.slice(0, 3).map(i => i.hook),
    }));
  }

  async deleteByAngle(angleSlug: string) {
    return this.prisma.angleCreativeInsight.deleteMany({ where: { angleSlug } });
  }
}

function topK(arr: string[], k: number): string[] {
  const freq: Record<string, number> = {};
  for (const v of arr) freq[v] = (freq[v] ?? 0) + 1;
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, k)
    .map(([v]) => v);
}
