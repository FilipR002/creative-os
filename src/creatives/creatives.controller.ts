import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags }                     from '@nestjs/swagger';
import { PrismaService }                             from '../prisma/prisma.service';
import { UserId }                                    from '../common/decorators/user-id.decorator';

@ApiTags('Creatives')
@Controller('api/creatives')
export class CreativesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/creatives/:id
   * Returns a single creative's content by its UUID.
   * The `content` JSON field stores format-specific data (scenes, slides, banners, copy).
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get creative content by ID' })
  async findOne(@Param('id') id: string, @UserId() _userId: string) {
    const creative = await this.prisma.creative.findUnique({
      where:   { id },
      include: {
        score: true,
        angle: { select: { slug: true } },
      },
    });

    if (!creative) throw new NotFoundException(`Creative ${id} not found`);

    const content = (creative.content ?? {}) as Record<string, unknown>;

    return {
      id:        creative.id,
      format:    creative.format.toLowerCase(),
      angleSlug: creative.angle?.slug ?? (content['angle'] as string | undefined) ?? '',
      isWinner:  creative.isWinner,
      score:     creative.score?.totalScore ?? undefined,
      ...content,
    };
  }
}
