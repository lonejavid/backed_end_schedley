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

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

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
      },
    };
  }

  @Post('setup-complete')
  @UseGuards(JwtAuthGuard)
  async setupComplete(@Req() req: { user: { id: string } }) {
    await this.usersService.setApproved(req.user.id, 1);
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
      },
    };
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: { user: { id: string } }) {
    await this.usersService.remove(req.user.id);
    return { message: 'Account deleted' };
  }
}
