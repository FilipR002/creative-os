import { Body, Controller, ForbiddenException, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags }                                   from '@nestjs/swagger';
import { UsersService }                                            from './users.service';
import { UserId }                                                  from '../common/decorators/user-id.decorator';

@ApiTags('Users')
@Controller('api/users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  /**
   * GET /api/users/me
   * Returns the authenticated user's own record.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@UserId() userId: string) {
    return this.service.me(userId);
  }

  /**
   * POST /api/users
   * Idempotent — syncs the authenticated Supabase user into Prisma.
   * The user can only register themselves (id must match JWT sub).
   */
  @Post()
  @ApiOperation({ summary: 'Register or sync authenticated user (idempotent)' })
  findOrCreate(
    @UserId() userId: string,
    @Body() dto: { id?: string; email?: string; name?: string },
  ) {
    // Ignore any id from the body — always use the verified JWT identity
    return this.service.findOrCreate(userId, dto.email, dto.name);
  }

  /**
   * GET /api/users/:id
   * Users may only fetch their own record.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get own user record' })
  findOne(@Param('id') id: string, @UserId() userId: string) {
    if (id !== userId) {
      throw new ForbiddenException('You may only access your own user record.');
    }
    return this.service.findById(userId);
  }

  // NOTE: GET /api/users (list all) is intentionally removed — no endpoint
  // should expose the full user list. Admins can query Supabase directly.
}
