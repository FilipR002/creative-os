import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService }    from '@nestjs/config';
import { PrismaService }    from '../prisma/prisma.service';
import { UpsertResourceDto, CreatePersonaDto, UpdatePersonaDto } from './resources.dto';
import axios from 'axios';

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

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {}

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

  // ── URL Scanner ────────────────────────────────────────────────────────────

  async scanUrl(url: string): Promise<{
    productName:        string;
    productDescription: string;
    productBenefits:    string[];
    brandTone:          string;
    brandVoice:         string;
  }> {
    // Normalise URL
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    // ── 1. Fetch the page HTML ─────────────────────────────────────────────
    let html = '';
    try {
      const res = await axios.get<string>(target, {
        timeout: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CreativeOS-Scanner/1.0)',
          'Accept':     'text/html,application/xhtml+xml',
        },
        maxContentLength: 2_000_000, // 2 MB cap
      });
      html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    } catch (err: any) {
      throw new BadRequestException(
        `Could not fetch "${target}": ${err?.message ?? 'network error'}`,
      );
    }

    // ── 2. Extract meta tags + strip HTML to readable text ─────────────────
    const metaTitle   = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
    const ogTitle     = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
                     ?? html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1] ?? '';
    const ogDesc      = html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1]
                     ?? html.match(/content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1] ?? '';
    const metaDesc    = html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]
                     ?? html.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1] ?? '';

    // Strip scripts, styles, head, nav, footer — keep body text
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 6000); // cap to avoid token overflow

    const pageContent = [
      ogTitle     ? `Page title: ${ogTitle}`   : metaTitle ? `Page title: ${metaTitle}` : '',
      ogDesc      ? `Meta description: ${ogDesc}` : metaDesc ? `Meta description: ${metaDesc}` : '',
      `URL: ${target}`,
      `\nPage body text:\n${bodyText}`,
    ].filter(Boolean).join('\n');

    // ── 3. Ask Claude to extract the brand profile ─────────────────────────
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    const systemPrompt = `You are a brand analyst. You read website content and extract a structured brand profile.
Return ONLY valid JSON. No markdown, no backticks, no explanation.`;

    const userPrompt = `Analyze this website content and extract a brand profile.

${pageContent}

Return a JSON object with EXACTLY these fields:
{
  "productName": "the brand or product name (1–4 words)",
  "productDescription": "what it does and who it is for — 2-3 clear sentences, written in second person if possible",
  "productBenefits": ["key benefit 1", "key benefit 2", "key benefit 3"],
  "brandTone": "describe the brand's tone of voice in 1-2 sentences. e.g. Bold and direct, like a confident founder. No fluff.",
  "brandVoice": "2-4 specific voice rules inferred from the site. e.g. Uses short sentences. Leads with outcome not feature. Avoids jargon."
}

Rules:
- productBenefits must be an array of 3–6 short phrases (max 8 words each)
- If you cannot determine something, make a reasonable inference from the URL and content — never return empty strings
- Write as if briefing an ad copywriter who has never seen this brand`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model:      'claude-sonnet-4-6',
          max_tokens: 600,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          timeout: 30000,
        },
      );

      const raw  = response.data.content[0].text.trim();
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim());

      return {
        productName:        json.productName        || '',
        productDescription: json.productDescription || '',
        productBenefits:    Array.isArray(json.productBenefits) ? json.productBenefits : [],
        brandTone:          json.brandTone          || '',
        brandVoice:         json.brandVoice         || '',
      };
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || 'Unknown error';
      throw new BadRequestException(`Brand scan failed: ${JSON.stringify(msg)}`);
    }
  }

  // ── Competitor Intel ───────────────────────────────────────────────────────

  async scanCompetitor(url: string, userId: string) {
    // Normalise URL
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    // ── 1. Fetch the competitor's page HTML ────────────────────────────────
    let html = '';
    try {
      const res = await axios.get<string>(target, {
        timeout: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CreativeOS-Scanner/1.0)',
          'Accept':     'text/html,application/xhtml+xml',
        },
        maxContentLength: 2_000_000,
      });
      html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    } catch (err: any) {
      throw new BadRequestException(
        `Could not fetch "${target}": ${err?.message ?? 'network error'}`,
      );
    }

    // ── 2. Extract meta + strip HTML ──────────────────────────────────────
    const ogTitle  = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
                  ?? html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1] ?? '';
    const metaTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
    const ogDesc   = html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1]
                  ?? html.match(/content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1] ?? '';
    const metaDesc = html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]
                  ?? html.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1] ?? '';

    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 6000);

    const pageContent = [
      ogTitle   ? `Page title: ${ogTitle}`     : metaTitle ? `Page title: ${metaTitle}` : '',
      ogDesc    ? `Meta description: ${ogDesc}` : metaDesc  ? `Meta description: ${metaDesc}` : '',
      `URL: ${target}`,
      `\nPage body text:\n${bodyText}`,
    ].filter(Boolean).join('\n');

    // ── 3. Ask Claude to extract competitor intelligence ───────────────────
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    const systemPrompt = `You are a competitive intelligence analyst for a digital marketing agency.
You read competitor websites and extract actionable intelligence.
Return ONLY valid JSON. No markdown, no backticks, no explanation.`;

    const userPrompt = `Analyze this competitor website and extract intelligence.

${pageContent}

Return a JSON object with EXACTLY these fields:
{
  "name": "competitor brand/product name (1–4 words)",
  "description": "what they do and who they serve — 2 sentences max",
  "positioning": "how they position themselves in the market — their unique claim or angle in 1-2 sentences",
  "targetAudience": "who their ideal customer is — 1 sentence",
  "keyMessages": ["key message 1", "key message 2", "key message 3"],
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["gap or weakness 1", "gap or weakness 2"],
  "tone": "describe their tone and communication style in 1-2 sentences"
}

Rules:
- keyMessages must be 3–5 short phrases (max 10 words each) — their actual headline claims
- strengths must be 2–4 short phrases — what they do well based on the site
- weaknesses must be 2–3 short phrases — gaps, unclear messaging, missing proof, etc.
- If something is unclear, make a sharp inference — never return empty arrays
- Write as if briefing a strategist who needs to beat this competitor`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model:      'claude-sonnet-4-6',
          max_tokens: 700,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          timeout: 30000,
        },
      );

      const raw  = response.data.content[0].text.trim();
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim());

      // Persist to DB
      const resource = await this.ensureResource(userId);
      return this.prisma.competitor.create({
        data: {
          resourceId:    resource.id,
          url:           target,
          name:          json.name          || new URL(target).hostname,
          description:   json.description   || '',
          positioning:   json.positioning   || '',
          targetAudience: json.targetAudience || '',
          keyMessages:   Array.isArray(json.keyMessages) ? json.keyMessages : [],
          strengths:     Array.isArray(json.strengths)   ? json.strengths   : [],
          weaknesses:    Array.isArray(json.weaknesses)  ? json.weaknesses  : [],
          tone:          json.tone          || '',
        },
      });
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || 'Unknown error';
      throw new BadRequestException(`Competitor scan failed: ${JSON.stringify(msg)}`);
    }
  }

  async getCompetitors(userId: string) {
    const resource = await this.prisma.resource.findUnique({
      where:   { userId },
      include: { competitors: { orderBy: { createdAt: 'asc' } } },
    });
    return resource?.competitors ?? [];
  }

  async deleteCompetitor(competitorId: string, userId: string) {
    // Ownership check via resource
    const competitor = await this.prisma.competitor.findUnique({
      where:   { id: competitorId },
      include: { resource: true },
    });
    if (!competitor) throw new NotFoundException('Competitor not found');
    if (competitor.resource.userId !== userId) throw new BadRequestException('Access denied');
    await this.prisma.competitor.delete({ where: { id: competitorId } });
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
