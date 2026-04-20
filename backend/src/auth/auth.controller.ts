import { Controller, Post, Body, Get, Patch, UseGuards, Request, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const REFRESH_COOKIE_NAME = 'refresh_token';
const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE);
const configuredSameSite = (process.env.AUTH_COOKIE_SAMESITE || '').toLowerCase();
const resolvedSameSite = (configuredSameSite === 'lax' || configuredSameSite === 'strict' || configuredSameSite === 'none')
  ? (configuredSameSite as 'lax' | 'strict' | 'none')
  : (isProd ? 'none' : 'lax');
const refreshCookieDomain = process.env.AUTH_COOKIE_DOMAIN || undefined;
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: resolvedSameSite === 'none' ? true : isProd,
  sameSite: resolvedSameSite,
  domain: refreshCookieDomain,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
const REFRESH_COOKIE_CLEAR_OPTIONS = {
  path: '/api/auth',
  sameSite: resolvedSameSite,
  secure: resolvedSameSite === 'none' ? true : isProd,
  domain: refreshCookieDomain,
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_CLEAR_OPTIONS);
      res.status(401).json({ statusCode: 401, message: 'No refresh token' });
      return;
    }

    try {
      const result = await this.authService.refreshTokens(refreshToken);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
      return { user: result.user, accessToken: result.accessToken };
    } catch (error) {
      // Clear stale cookie so client can re-auth cleanly after refresh failure.
      res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_CLEAR_OPTIONS);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_CLEAR_OPTIONS);
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutAll(req.user.sub);
    res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_CLEAR_OPTIONS);
    return { message: 'All sessions logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: any) {
    return this.authService.getMe(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, dto);
  }
}
