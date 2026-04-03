import { Controller, Post, Get, Body, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UnauthorizedException } from '@nestjs/common';
import { SignupSendOtpDto } from './dto/signup-send-otp.dto';
import { SignupVerifyDto } from './dto/signup-verify.dto';
import { ForgotSendOtpDto } from './dto/forgot-send-otp.dto';
import { ForgotResetDto } from './dto/forgot-reset.dto';
import { LoginSendOtpDto } from './dto/login-send-otp.dto';
import { OtpService } from './otp.service';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
    private readonly otpService: OtpService,
  ) {}

  @Post('signup/send-otp')
  async signupSendOtp(@Body() dto: SignupSendOtpDto) {
    return this.otpService.sendSignupOtp(dto.name, dto.email, dto.password);
  }

  @Post('signup/verify')
  async signupVerify(@Body() dto: SignupVerifyDto) {
    return this.otpService.verifySignupAndLogin(dto.email, dto.code);
  }

  @Post('login/send-otp')
  async loginSendOtp(@Body() dto: LoginSendOtpDto) {
    return this.otpService.sendLoginOtp(dto.email);
  }

  @Post('login/verify-otp')
  async loginVerifyOtp(@Body() dto: SignupVerifyDto) {
    return this.otpService.verifyLoginOtp(dto.email, dto.code);
  }

  @Post('password/forgot/send-otp')
  async forgotSendOtp(@Body() dto: ForgotSendOtpDto) {
    return this.otpService.sendPasswordResetOtp(dto.email);
  }

  @Post('password/forgot/reset')
  async forgotReset(@Body() dto: ForgotResetDto) {
    return this.otpService.resetPasswordWithOtp(dto.email, dto.code, dto.newPassword);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto.name, dto.email, dto.password);
    return this.authService.login(user);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUserByEmail(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: { user?: { accessToken: string; user: unknown; expiresAt?: number } },
    @Res() res: Response,
  ) {
    const payload = req.user;
    if (!payload) {
      const frontendOrigin =
        this.config.get<string>('frontend.origin') || 'http://localhost:3000';
      return res.redirect(`${frontendOrigin}/login?error=google_signin_failed`);
    }
    const frontendOrigin = this.config.get<string>('frontend.origin');
    const params = new URLSearchParams({
      accessToken: payload.accessToken,
      user: JSON.stringify(payload.user),
    });
    if (payload.expiresAt != null) {
      params.set('expiresAt', String(payload.expiresAt));
    }
    // Use hash so token is never in the query string (not sent to server, easy to strip in frontend)
    res.redirect(`${frontendOrigin}/oauth-success#${params.toString()}`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: { user: { id: string } }) {
    const user = await this.usersService.findOne(req.user.id);
    if (!user) return { user: null };
    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        timezone: user.timezone,
        imageUrl: user.imageUrl ?? undefined,
        isApproved: Number(user.isApproved) === 1,
        setupStep: user.setupStep ?? 0,
        passwordLoginEnabled: !!user.passwordHash,
      },
    };
  }

  @Post('setup-complete')
  @UseGuards(JwtAuthGuard)
  async setupComplete(@Req() req: { user: { id: string } }) {
    await this.usersService.setApproved(req.user.id, 1);
    await this.usersService.setSetupStep(req.user.id, 4);
    const user = await this.usersService.findOne(req.user.id);
    if (!user) return { user: null };
    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        timezone: user.timezone,
        imageUrl: user.imageUrl ?? undefined,
        isApproved: true,
        setupStep: 4,
      },
    };
  }

  @Post('setup-progress')
  @UseGuards(JwtAuthGuard)
  async setupProgress(
    @Req() req: { user: { id: string } },
    @Body() body: { step: number },
  ) {
    const step = typeof body.step === 'number' ? body.step : 0;
    const clamped = Math.max(0, Math.min(4, Math.floor(step)));
    await this.usersService.setSetupStep(req.user.id, clamped);
    return { step: clamped };
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: { user: { id: string } }) {
    await this.usersService.remove(req.user.id);
    return { message: 'Account deleted' };
  }
}
