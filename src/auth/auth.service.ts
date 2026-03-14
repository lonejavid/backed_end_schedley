import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async validateUserByEmail(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user?.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async validateUserById(id: string): Promise<User | null> {
    return this.usersService.findOne(id);
  }

  async register(name: string, email: string, password: string): Promise<User> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const username = this.emailToUsername(email);
    const existsUsername = await this.usersService.findByUsername(username);
    const finalUsername = existsUsername
      ? `${username}${Date.now().toString(36)}`
      : username;
    const passwordHash = await bcrypt.hash(password, 10);
    return this.usersService.create({
      name,
      email,
      username: finalUsername,
      passwordHash,
      timezone: 'UTC',
      isApproved: 1,
    });
  }

  async login(user: User): Promise<{
    message: string;
    user: { id: string; name: string; username: string; email: string; isApproved?: boolean };
    accessToken: string;
    expiresAt: number;
  }> {
    const payload = { sub: user.id, email: user.email };
    const expiresIn = this.config.get<string>('jwt.expiresIn') || '7d';
    const expiresInSeconds = this.parseExpiresIn(expiresIn);
    const accessToken = this.jwtService.sign(
      { sub: payload.sub, email: payload.email },
      { expiresIn },
    );
    return {
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        isApproved: Number(user.isApproved) === 1,
      },
      accessToken,
      expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds,
    };
  }

  async loginGoogle(profile: {
    id: string;
    email: string;
    name?: string;
  }): Promise<{
    message: string;
    user: { id: string; name: string; username: string; email: string; isApproved?: boolean };
    accessToken: string;
    expiresAt: number;
  }> {
    let user = await this.usersService.findByEmail(profile.email);
    if (user) {
      await this.usersService.setGoogleId(user.id, profile.id);
    } else {
      const username = this.emailToUsername(profile.email);
      const existingUsername = await this.usersService.findByUsername(username);
      const finalUsername = existingUsername
        ? `${username}${Date.now().toString(36)}`
        : username;
      user = await this.usersService.create({
        name: profile.name || profile.email.split('@')[0],
        email: profile.email,
        username: finalUsername,
        passwordHash: null,
        googleId: profile.id,
        timezone: 'UTC',
        isApproved: 0,
      });
    }
    // Do NOT mark Google as connected here – user must explicitly connect via Integrations
    // so we get calendar scope and can sync events. See integration/google/authorize flow.
    return this.login(user);
  }

  emailToUsername(email: string): string {
    return (
      email
        .split('@')[0]
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase() || 'user'
    );
  }

  parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)(d|h|m|s)$/);
    if (!match) return 7 * 24 * 3600;
    const [, num, unit] = match;
    const n = parseInt(num, 10);
    switch (unit) {
      case 'd':
        return n * 24 * 3600;
      case 'h':
        return n * 3600;
      case 'm':
        return n * 60;
      case 's':
        return n;
      default:
        return 7 * 24 * 3600;
    }
  }
}
