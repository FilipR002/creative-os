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
   * Always updates email if provided so the Prisma record stays in sync
   * with the Supabase JWT (required for correct role computation).
   */
  async findOrCreate(userId: string, email?: string, name?: string) {
    const user = await this.prisma.user.upsert({
      where:  { id: userId },
      update: { ...(email ? { email } : {}) },
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
   * Returns current user's record. If the Prisma record is missing an email
   * (common for Supabase-auth users created before email syncing), we sync it
   * from the JWT so that computeRole() returns the correct value immediately.
   */
  async me(userId: string, jwtEmail?: string | null) {
    // Upsert — creates the record if it doesn't exist yet (first Supabase login),
    // and always syncs the email from the JWT so computeRole() works correctly.
    const user = await this.prisma.user.upsert({
      where:   { id: userId },
      update:  jwtEmail ? { email: jwtEmail } : {},
      create:  { id: userId, email: jwtEmail ?? null },
      include: { _count: { select: { campaigns: true, memories: true } } },
    });

    return safeUser(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { campaigns: true } } },
    });
    return users.map(safeUser);
  }
}
