// ─── Phase 7 — Project Store ──────────────────────────────────────────────────
// In-memory per-client project registry.
// Swap for a Prisma-backed implementation in production.

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreateProjectDto,
  ProductGenerateResult,
  ProductProject,
} from './product.types';

@Injectable()
export class ProjectStoreService {
  private readonly store = new Map<string, ProductProject>();

  create(dto: CreateProjectDto): ProductProject {
    const project: ProductProject = {
      id:        randomUUID(),
      name:      dto.name,
      goal:      dto.goal,
      context:   dto.context,
      clientId:  dto.client_id,
      createdAt: new Date().toISOString(),
    };
    this.store.set(project.id, project);
    return project;
  }

  get(id: string): ProductProject | null {
    return this.store.get(id) ?? null;
  }

  listByClient(clientId: string): ProductProject[] {
    return [...this.store.values()]
      .filter(p => p.clientId === clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  setLastResult(id: string, result: ProductGenerateResult): void {
    const p = this.store.get(id);
    if (p) p.lastResult = result;
  }
}
