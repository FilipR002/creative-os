import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService }    from '../prisma/prisma.service';
import { UpsertResourceDto, CreatePersonaDto, UpdatePersonaDto } from './resources.dto';

// ─── Shared type used by AI services ─────────────────────────────────────────

export interface PersonaContext {
  id:           string;
  name:         string;
  description:  string;
  painPoints:   string[];
  desires:      string[];
  demographics: string | null;
}

export interface ResourceContext {
  productName?:        string;
  productDescription?: string;
  productBenefits:     string[];
  brandTone?:          string;
  brandVoice?:         string;
  persona?:            PersonaContext;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ResourcesService {

  constructor(private readonly prisma: PrismaService) {}

  // ── Resource (Product + Brand) ─────────────────────────────────────────────

  async upsert(dto: UpsertResourceDto, userId: string) {
    return this.prisma.resource.upsert({
      where:  { userId },
      create: {
        userId,
        productName:        dto.productName,
        productDescription: dto.productDescription,
        productBenefits:    dto.productBenefits ?? [],
        brandTone:          dto.brandTone,
        brandVoice:         dto.brandVoice,
        imageUrls:          dto.imageUrls ?? [],
      },
      update: {
        ...(dto.productName        !== undefined && { productName:        dto.productName }),
        ...(dto.productDescription !== undefined && { productDescription: dto.productDescription }),
        ...(dto.productBenefits    !== undefined && { productBenefits:    dto.productBenefits }),
        ...(dto.brandTone          !== undefined && { brandTone:          dto.brandTone }),
        ...(dto.brandVoice         !== undefined && { brandVoice:         dto.brandVoice }),
        ...(dto.imageUrls          !== undefined && { imageUrls:          dto.imageUrls }),
      },
      include: { personas: true },
    });
  }

  async getByUser(userId: string) {
    const resource = await this.prisma.resource.findUnique({
      where:   { userId },
      include: { personas: { orderBy: { createdAt: 'asc' } } },
    });
    // Return empty structure if not yet set up
    if (!resource) {
      return {
        id:                 null,
        userId,
        productName:        null,
        productDescription: null,
        productBenefits:    [] as string[],
        brandTone:          null,
        brandVoice:         null,
        imageUrls:          [] as string[],
        personas:           [],
      };
    }
    return resource;
  }

  /** Build a ResourceContext for AI prompt injection. */
  async getContext(userId: string, personaId?: string): Promise<ResourceContext> {
    const resource = await this.prisma.resource.findUnique({
      where:   { userId },
      include: { personas: true },
    });

    const ctx: ResourceContext = {
      productName:        resource?.productName        ?? undefined,
      productDescription: resource?.productDescription ?? undefined,
      productBenefits:    resource?.productBenefits    ?? [],
      brandTone:          resource?.brandTone          ?? undefined,
      brandVoice:         resource?.brandVoice         ?? undefined,
    };

    if (personaId) {
      const persona = resource?.personas.find(p => p.id === personaId) ?? null;
      if (!persona) {
        throw new BadRequestException(
          `Persona ${personaId} not found. Check the personaId or leave it empty.`,
        );
      }
      ctx.persona = {
        id:           persona.id,
        name:         persona.name,
        description:  persona.description,
        painPoints:   persona.painPoints,
        desires:      persona.desires,
        demographics: persona.demographics ?? null,
      };
    }

    return ctx;
  }

  // ── Personas ───────────────────────────────────────────────────────────────

  async createPersona(dto: CreatePersonaDto, userId: string) {
    const resource = await this.ensureResource(userId);
    return this.prisma.persona.create({
      data: {
        resourceId:   resource.id,
        name:         dto.name,
        description:  dto.description,
        painPoints:   dto.painPoints  ?? [],
        desires:      dto.desires     ?? [],
        demographics: dto.demographics ?? null,
      },
    });
  }

  async updatePersona(personaId: string, dto: UpdatePersonaDto, userId: string) {
    await this.assertPersonaOwnership(personaId, userId);
    return this.prisma.persona.update({
      where: { id: personaId },
      data: {
        ...(dto.name         !== undefined && { name:         dto.name }),
        ...(dto.description  !== undefined && { description:  dto.description }),
        ...(dto.painPoints   !== undefined && { painPoints:   dto.painPoints }),
        ...(dto.desires      !== undefined && { desires:      dto.desires }),
        ...(dto.demographics !== undefined && { demographics: dto.demographics }),
      },
    });
  }

  async deletePersona(personaId: string, userId: string) {
    await this.assertPersonaOwnership(personaId, userId);
    await this.prisma.persona.delete({ where: { id: personaId } });
    return { deleted: true };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async ensureResource(userId: string) {
    const existing = await this.prisma.resource.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.resource.create({
      data: { userId, productBenefits: [], imageUrls: [] },
    });
  }

  private async assertPersonaOwnership(personaId: string, userId: string) {
    const persona = await this.prisma.persona.findUnique({
      where:   { id: personaId },
      include: { resource: true },
    });
    if (!persona) throw new NotFoundException('Persona not found');
    if (persona.resource.userId !== userId) throw new BadRequestException('Access denied');
    return persona;
  }
}
