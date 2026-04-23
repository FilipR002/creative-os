import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { UserId } from '../common/decorators/user-id.decorator';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  /**
   * POST /api/auth/register
   * Body: { email, username, password, name? }
   * Returns: { accessToken, refreshToken, user }
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create a new account with email, username and password' })
  register(@Body() dto: { email: string; username: string; password: string; name?: string }) {
    return this.service.register(dto.email, dto.username, dto.password, dto.name);
  }

  /**
   * POST /api/auth/login
   * Body: { email, password }
   * Returns: { accessToken, refreshToken, user }
   */
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() dto: { email: string; password: string }) {
    return this.service.login(dto.email, dto.password);
  }

  /**
   * GET /api/auth/me
   * Protected — requires x-user-id header.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  me(@UserId() userId: string) {
    return this.service.me(userId);
  }

  /**
   * PUT /api/auth/password
   * Protected — requires x-user-id header.
   * Body: { currentPassword, newPassword }
   * Returns: { message }
   */
  @Put('password')
  @ApiOperation({ summary: 'Change password for the authenticated user' })
  changePassword(
    @UserId() userId: string,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.service.changePassword(userId, dto.currentPassword, dto.newPassword);
  }

  /**
   * POST /api/auth/refresh
   * Body: { refreshToken }
   * Returns: { accessToken, refreshToken, user }
   */
  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh session using refresh token' })
  refresh(@Body() dto: { refreshToken: string }) {
    return this.service.refresh(dto.refreshToken);
  }
}
