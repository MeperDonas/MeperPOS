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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
  RefreshTokenDto,
  SelectOrgDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt.strategy';
import { AuditAction } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('LOGIN_SUCCESS')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() loginDto: LoginDto,
    @Request()
    req: { ip?: string; headers?: Record<string, string | string[]> },
  ) {
    const ipAddress = req.ip;
    const userAgent = Array.isArray(req.headers?.['user-agent'])
      ? req.headers['user-agent'][0]
      : req.headers?.['user-agent'];
    return this.authService.login(loginDto, ipAddress, userAgent);
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

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-org')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select active organization and re-issue JWT' })
  async selectOrg(
    @Body() selectOrgDto: SelectOrgDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.authService.selectOrg(
      req.user.userId,
      selectOrgDto.organizationId,
    );
  }
}
