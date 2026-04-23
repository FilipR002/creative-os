import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserId } from '../common/decorators/user-id.decorator';

@ApiTags('Users')
@Controller('api/users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  /**
   * GET /api/users/me
   * Returns the authenticated user with role included.
   * Role is computed from email — no DB role column needed.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user with role' })
  me(@UserId() userId: string) {
    return this.service.me(userId);
  }

  /**
   * Register / ensure a user exists.
   * Body: { id: string (UUID), email?: string, name?: string }
   * Idempotent — safe to call on every app launch.
   */
  @Post()
  @ApiOperation({ summary: 'Register or fetch a user (idempotent)' })
  findOrCreate(@Body() dto: { id: string; email?: string; name?: string }) {
    return this.service.findOrCreate(dto.id, dto.email, dto.name);
  }

  @Get()
  @ApiOperation({ summary: 'List all users' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID with campaign + memory counts' })
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }
}
