import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeRole } from '../common/constants/roles';

/** Enrich any user object with a computed role field. */
function withRole<T extends { email?: string | null }>(user: T): T & { role: 'admin' | 'user' } {
  return { ...user, role: computeRole(user.email) };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent — creates user if they don't exist yet.
   * Returns user shape with role included.
   */
  async findOrCreate(userId: string, email?: string, name?: string) {
    const user = await this.prisma.user.upsert({
      where:  { id: userId },
      update: {},
      create: { id: userId, email: email || null, name: name || null },
    });
    return withRole(user);
  }

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { campaigns: true, memories: true },
        },
      },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return withRole(user);
  }

  /**
   * Lightweight me() — returns id, email, name, role, counts.
   * Used by GET /api/users/me.
   */
  async me(userId: string) {
    return this.findById(userId);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { campaigns: true } } },
    });
    return users.map(withRole);
  }
}
