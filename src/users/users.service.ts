import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeRole } from '../common/constants/roles';

/** Strip sensitive fields and enrich with computed role. */
function safeUser<T extends { email?: string | null; passwordHash?: string | null }>(
  user: T,
): Omit<T, 'passwordHash'> & { role: 'admin' | 'user' } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _omit, ...safe } = user as Record<string, unknown> & { passwordHash?: unknown };
  return { ...(safe as Omit<T, 'passwordHash'>), role: computeRole(user.email) };
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
    return safeUser(user);
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
    return safeUser(user);
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
    return users.map(safeUser);
  }
}
