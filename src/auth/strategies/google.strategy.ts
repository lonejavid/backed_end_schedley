import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>('google.clientId') || '',
      clientSecret: config.get<string>('google.clientSecret') || '',
      callbackURL:
        config.get<string>('google.callbackUrl') ||
        'http://localhost:5000/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      emails?: { value: string }[];
      displayName?: string;
      photos?: { value: string }[];
    },
    done: (err: Error | null, result?: unknown) => void,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('No email from Google'), undefined);
    }
    const picture = profile.photos?.[0]?.value ?? undefined;
    const result = await this.authService.loginGoogle({
      id: profile.id,
      email,
      name: profile.displayName,
      picture: picture || undefined,
    });
    done(null, result);
  }
}
