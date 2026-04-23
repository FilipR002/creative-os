import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { computeRole } from '../common/constants/roles';

const SALT_ROUNDS = 12;

/** Shape returned for every user in auth responses. */
function userPayload(user: {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  createdAt: Date;
}) {
  return {
    id:        user.id,
    email:     user.email,
    username:  user.username,
    name:      user.name,
    role:      computeRole(user.email),
    createdAt: user.createdAt,
  };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── REGISTER ─────────────────────────────────────────────────────────────

  /**
   * Creates a new account.
   * Validates uniqueness of email + username, hashes password with bcrypt.
   */
  async register(email: string, username: string, password: string, name?: string) {
    if (!email?.includes('@')) {
      throw new BadRequestException('A valid email address is required.');
    }
    if (!username || username.trim().length < 3) {
      throw new BadRequestException('Username must be at least 3 characters.');
    }
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const slug = username.trim().toLowerCase();

    // Uniqueness checks (parallel)
    const [existingEmail, existingUsername] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.user.findUnique({ where: { username: slug } }),
    ]);

    if (existingEmail)    throw new ConflictException('An account with this email already exists.');
    if (existingUsername) throw new ConflictException('That username is already taken.');

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email,
        username: slug,
        name:     name?.trim() || username.trim(),
        passwordHash,
      },
    });

    return {
      accessToken:  user.id,
      refreshToken: user.id,
      user: userPayload(user),
    };
  }

  // ─── LOGIN ─────────────────────────────────────────────────────────────────

  /**
   * Authenticates an existing account with email + password.
   */
  async login(email: string, password: string) {
    if (!email?.includes('@')) {
      throw new BadRequestException('A valid email address is required.');
    }
    if (!password) {
      throw new BadRequestException('Password is required.');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });

    // Generic error — never reveal whether the email exists
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return {
      accessToken:  user.id,
      refreshToken: user.id,
      user: userPayload(user),
    };
  }

  // ─── ME ────────────────────────────────────────────────────────────────────

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where:   { id: userId },
      include: { _count: { select: { campaigns: true, memories: true } } },
    });
    if (!user) throw new UnauthorizedException('User not found — please sign in again.');
    return { ...userPayload(user), _count: user._count };
  }

  // ─── CHANGE PASSWORD ──────────────────────────────────────────────────────

  /**
   * Allows an authenticated user to change their own password.
   * Requires the current password to prevent session-hijacking attacks.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword) throw new BadRequestException('Current password is required.');
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters.');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current one.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('No password set on this account.');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect.');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return { message: 'Password updated successfully.' };
  }

  // ─── REFRESH ───────────────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    if (!refreshToken?.trim() || refreshToken.trim().length < 10) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: refreshToken.trim() },
    });

    if (!user) throw new UnauthorizedException('Refresh token invalid or expired. Please sign in again.');

    return {
      accessToken:  user.id,
      refreshToken: user.id,
      user: userPayload(user),
    };
  }
}
