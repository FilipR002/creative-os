import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';
import { CreateReferenceDto } from './dto/create-reference.dto';

@Injectable()
export class AngleReferencesService {
  private readonly logger = new Logger(AngleReferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReferenceDto) {
    return this.prisma.angleCreativeReference.create({ data: dto });
  }

  async bulkInsert(items: CreateReferenceDto[]) {
    const result = await this.prisma.angleCreativeReference.createMany({
      data:           items,
      skipDuplicates: true,
    });
    this.logger.log(`Bulk insert: ${result.count}/${items.length} references created`);
    return result;
  }

  async getByAngle(angleSlug: string, limit = 3) {
    return this.prisma.angleCreativeReference.findMany({
      where:   { angleSlug },
      orderBy: { performanceScore: 'desc' },
      take:    limit,
    });
  }

  async getAll() {
    return this.prisma.angleCreativeReference.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteByAngle(angleSlug: string) {
    return this.prisma.angleCreativeReference.deleteMany({ where: { angleSlug } });
  }
}
