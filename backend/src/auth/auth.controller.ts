import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  UseInterceptors,
  Put,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
  RefreshTokenDto,
  SelectOrgDto,
} from './dto/auth.dto';
import { SelectOrganizationDto } from './dto/select-organization.dto';
import { JwtAuthGuard } from './jwt.strategy';
import { AuditAction } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { Throttle } from '@nestjs/throttler';
import {
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  applyAuthCookies,
  clearAuthCookies,
} from './cookies.helper';

interface AuthRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  user?: { userId: string };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Session responses keep accessToken in the JSON body (the documented
   * controlled path that seeds the frontend memory store and future native
   * clients) while both tokens ride httpOnly cookies. The refresh token is
   * cookie-ONLY: it is stripped from every response body. Cookies are only
   * written when the service actually issued a token pair — a
   * requiresOrganizationSelection response has no session yet.
   */
  private setSessionCookies(
    res: Response,
    req: AuthRequest,
    result: unknown,
  ): void {
    if (
      typeof result === 'object' &&
      result !== null &&
      'accessToken' in result &&
      'refreshToken' in result
    ) {
      const tokens = result as { accessToken: string; refreshToken: string };
      applyAuthCookies(res, tokens, this.existingCsrfToken(req));
    }
  }

  /** Removes the refresh token from a response body (cookie-only transport). */
  private toResponseBody(result: unknown): unknown {
    if (
      typeof result === 'object' &&
      result !== null &&
      'refreshToken' in result
    ) {
      const { refreshToken: _omitted, ...body } =
        result as Record<string, unknown>;
      return body;
    }
    return result;
  }

  private existingCsrfToken(req: AuthRequest): string | null {
    return typeof req.cookies?.[CSRF_TOKEN_COOKIE] === 'string'
      ? (req.cookies[CSRF_TOKEN_COOKIE] as string)
      : null;
  }

  @Post('login')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('LOGIN_SUCCESS')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() loginDto: LoginDto,
    @Request()
    req: { ip?: string; headers?: Record<string, string | string[]> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip;
    const userAgent = Array.isArray(req.headers?.['user-agent'])
      ? req.headers['user-agent'][0]
      : req.headers?.['user-agent'];
    const result = await this.authService.login(loginDto, ipAddress, userAgent);

    this.setSessionCookies(res, req, result);

    return this.toResponseBody(result);
  }

  @Post('select-organization')
  @ApiOperation({ summary: 'Select organization and complete login' })
  async selectOrganization(
    @Body() dto: SelectOrganizationDto,
    @Request() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.selectOrganization(
      dto.preAuthToken,
      dto.organizationId,
    );

    this.setSessionCookies(res, req, result);

    return this.toResponseBody(result);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user organizations' })
  async getOrganizations(@Request() req: { user: { userId: string } }) {
    return this.authService.getUserOrganizations(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: { user: { userId: string } }) {
    return this.authService.validateUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.authService.updateProfile(req.user.userId, updateProfileDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.authService.changePassword(req.user.userId, changePasswordDto);
  }

  /**
   * Accepts the refresh token from the refresh_token cookie first and falls
   * back to the body field for native clients. The rotated refresh token is
   * delivered ONLY via the httpOnly cookie — the response body carries the
   * new accessToken (plus user), never the refresh token.
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Request() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const rawRefreshToken =
      cookieToken && cookieToken.length > 0
        ? cookieToken
        : refreshTokenDto.refreshToken;

    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const result = await this.authService.refresh(rawRefreshToken);

    applyAuthCookies(res, result, this.existingCsrfToken(req));

    return this.toResponseBody(result);
  }

  /**
   * Revokes the server-side refresh token when one is presented (cookie or
   * legacy body) and expires all auth cookies. Intentionally unauthenticated:
   * it must work for both Bearer and cookie-only clients.
   */
  @Post('logout')
  @ApiOperation({ summary: 'Revoke refresh token and clear auth cookies' })
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Request() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const rawRefreshToken =
      cookieToken && cookieToken.length > 0
        ? cookieToken
        : refreshTokenDto.refreshToken;

    await this.authService.logout(rawRefreshToken);

    clearAuthCookies(res);

    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-org')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select active organization and re-issue JWT' })
  async selectOrg(
    @Body() selectOrgDto: SelectOrgDto,
    @Request() req: { user: { userId: string }; cookies?: Record<string, string | undefined> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.selectOrg(
      req.user.userId,
      selectOrgDto.organizationId,
    );

    this.setSessionCookies(res, req, result);

    return this.toResponseBody(result);
  }
}
