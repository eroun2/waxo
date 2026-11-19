import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, Session } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleAuthDto,
  LoginDto,
  RegisterArtistDto,
  RegisterListenerDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/auth.types';

const COOKIE = 'waxo_rt';
const STRICT = { default: { limit: 5, ttl: 60_000 } };
const ctx = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Throttle(STRICT) @Post('register/listener')
  registerListener(@Body() dto: RegisterListenerDto, @Req() req: Request) {
    return this.auth.registerListener(dto, ctx(req));
  }

  @Throttle(STRICT) @Post('register/artist')
  registerArtist(@Body() dto: RegisterArtistDto, @Req() req: Request) {
    return this.auth.registerArtist(dto, ctx(req));
  }

  @Throttle(STRICT) @Post('verify-email') @HttpCode(200)
  verify(@Body() dto: VerifyEmailDto) { return this.auth.verifyEmail(dto.code || dto.token || '', dto.email); }

  @Throttle(STRICT) @Post('resend-verification') @HttpCode(200)
  resend(@Body() dto: ResendVerificationDto) { return this.auth.resendVerification(dto.email); }

  @Throttle(STRICT) @Post('forgot-password') @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.forgotPassword(dto, ctx(req));
  }

  @Throttle(STRICT) @Post('reset-password') @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto, ctx(req));
  }

  @UseGuards(JwtAuthGuard) @Throttle(STRICT) @Post('change-password') @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(user.id, dto, req.cookies?.[COOKIE], ctx(req));
  }

  @UseGuards(JwtAuthGuard) @Post('logout-all') @HttpCode(200)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(user.id, ctx(req));
    res.clearCookie(COOKIE, this.cookieBase());
    return { message: 'Logged out of all devices.' };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.login(dto, ctx(req));
    this.setCookie(res, s);
    return { accessToken: s.accessToken };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post('google') @HttpCode(200)
  async googleAuth(@Body() dto: GoogleAuthDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.googleAuth(dto, ctx(req));
    this.setCookie(res, s);
    return { accessToken: s.accessToken };
  }

  @Post('refresh') @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const s = await this.auth.refresh(req.cookies?.[COOKIE], ctx(req));
      this.setCookie(res, s);
      return { accessToken: s.accessToken };
    } catch (e) {
      res.clearCookie(COOKIE, this.cookieBase());
      throw e;
    }
  }

  @Post('logout') @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, this.cookieBase());
  }

  @UseGuards(JwtAuthGuard) @Get('me')
  me(@CurrentUser() user: AuthUser) { return this.auth.me(user.id); }

  // Refresh token lives in an httpOnly, SameSite=Strict cookie scoped to /api/auth (CSRF-resistant, invisible to JS).
  private cookieBase() {
    return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/auth' };
  }
  private setCookie(res: Response, s: Session) {
    res.cookie(COOKIE, s.refreshToken, { ...this.cookieBase(), expires: s.refreshExpiresAt });
  }
}
