import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from './entities/integration.entity';

const APP_TYPES = [
  'GOOGLE_MEET_AND_CALENDAR',
  'ZOOM_MEETING',
  'MICROSOFT_TEAMS',
  'OUTLOOK_CALENDAR',
  'HUBSPOT_CRM',
];

const TITLES: Record<string, string> = {
  GOOGLE_MEET_AND_CALENDAR: 'Google Meet & Calendar',
  ZOOM_MEETING: 'Zoom',
  MICROSOFT_TEAMS: 'Microsoft Teams',
  OUTLOOK_CALENDAR: 'Outlook Calendar',
  HUBSPOT_CRM: 'HubSpot CRM',
};

const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'email',
  'profile',
].join(' ');

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(Integration)
    private readonly repo: Repository<Integration>,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async findAllForUser(userId: string): Promise<{
    message: string;
    integrations: Array<{
      provider: string;
      title: string;
      app_type: string;
      category: string;
      isConnected: boolean;
    }>;
  }> {
    const existing = await this.repo.find({ where: { userId } });
    const byType = new Map(existing.map((e) => [e.appType, e]));
    return {
      message: 'OK',
      integrations: APP_TYPES.map((appType) => {
        const row = byType.get(appType);
        const isConnected = Number(row?.isConnected ?? 0) === 1;
        const provider = appType.startsWith('GOOGLE')
          ? 'GOOGLE'
          : appType.startsWith('ZOOM')
            ? 'ZOOM'
            : 'MICROSOFT';
        return {
          provider,
          title: TITLES[appType] || appType,
          app_type: appType,
          category: appType.includes('CALENDAR') ? 'CALENDAR' : 'VIDEO_CONFERENCING',
          isConnected,
        };
      }),
    };
  }

  async check(
    userId: string,
    appType: string,
  ): Promise<{ isConnected: boolean }> {
    const row = await this.repo.findOne({ where: { userId, appType } });
    return { isConnected: Number(row?.isConnected ?? 0) === 1 };
  }

  async markConnected(userId: string, appType: string): Promise<void> {
    if (!APP_TYPES.includes(appType)) return;
    let row = await this.repo.findOne({ where: { userId, appType } });
    if (!row) {
      row = await this.repo.save(
        this.repo.create({ userId, appType, isConnected: 1 }),
      );
    } else {
      await this.repo.update({ userId, appType }, { isConnected: 1 });
    }
  }

  async connect(
    userId: string,
    appType: string,
  ): Promise<{ message: string; url?: string }> {
    if (!APP_TYPES.includes(appType)) {
      return { message: 'Unsupported app type' };
    }
    let integration = await this.repo.findOne({ where: { userId, appType } });
    if (!integration) {
      integration = await this.repo.save(
        this.repo.create({ userId, appType, isConnected: 0 }),
      );
    }
    if (
      appType === 'GOOGLE_MEET_AND_CALENDAR' &&
      this.config.get<string>('google.clientId')
    ) {
      const state = this.jwtService.sign(
        { sub: userId, purpose: 'google-calendar' },
        { expiresIn: '5m' },
      );
      const origin =
        this.config.get<string>('serverOrigin') || 'http://localhost:8000';
      const url = `${origin}/api/integration/google/authorize?state=${encodeURIComponent(state)}`;
      return { message: 'Redirect to Google OAuth (Calendar)', url };
    }
    const envUrl = process.env[`${appType}_OAUTH_URL`];
    return {
      message: envUrl ? 'Redirect to OAuth' : 'OAuth not configured for this integration',
      url: envUrl,
    };
  }

  getGoogleCalendarAuthorizeRedirectUrl(state: string): string {
    const clientId = this.config.get<string>('google.clientId');
    const callbackUrl = this.config.get<string>('google.calendarCallbackUrl');
    if (!clientId || !callbackUrl) {
      throw new Error('Google Calendar OAuth not configured');
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: GOOGLE_CALENDAR_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCalendarCallback(
    code: string,
    state: string,
  ): Promise<{ userId: string }> {
    const payload = this.jwtService.verify<{ sub: string; purpose: string }>(state);
    if (payload.purpose !== 'google-calendar') throw new Error('Invalid state');
    const userId = payload.sub;

    const clientId = this.config.get<string>('google.clientId');
    const clientSecret = this.config.get<string>('google.clientSecret');
    const callbackUrl = this.config.get<string>('google.calendarCallbackUrl');
    if (!clientId || !clientSecret || !callbackUrl) {
      throw new Error('Google OAuth not configured');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${err}`);
    }
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    let row = await this.repo.findOne({
      where: { userId, appType: 'GOOGLE_MEET_AND_CALENDAR' },
    });
    if (!row) {
      row = this.repo.create({
        userId,
        appType: 'GOOGLE_MEET_AND_CALENDAR',
        isConnected: 1,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
      });
    } else {
      row.accessToken = tokens.access_token;
      row.refreshToken = tokens.refresh_token ?? row.refreshToken;
      row.isConnected = 1;
    }
    await this.repo.save(row);
    return { userId };
  }

  async getValidGoogleAccessToken(userId: string): Promise<string | null> {
    const row = await this.repo.findOne({
      where: { userId, appType: 'GOOGLE_MEET_AND_CALENDAR' },
    });
    if (!row || Number(row.isConnected) !== 1 || !row.accessToken) return null;
    if (row.refreshToken) {
      try {
        const refreshed = await this.refreshGoogleToken(row.refreshToken);
        if (refreshed) {
          row.accessToken = refreshed;
          await this.repo.save(row);
        }
      } catch {
        return row.accessToken;
      }
    }
    return row.accessToken;
  }

  private async refreshGoogleToken(refreshToken: string): Promise<string | null> {
    const clientId = this.config.get<string>('google.clientId');
    const clientSecret = this.config.get<string>('google.clientSecret');
    if (!clientId || !clientSecret) return null;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string };
    return data.access_token ?? null;
  }

  async createGoogleCalendarEvent(
    userId: string,
    params: {
      title: string;
      startTime: Date;
      endTime: Date;
      guestEmail: string;
      description?: string;
    },
  ): Promise<string | null> {
    const accessToken = await this.getValidGoogleAccessToken(userId);
    if (!accessToken) return null;

    const start = params.startTime.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const end = params.endTime.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const body = {
      summary: params.title,
      description: params.description ?? `Meeting with ${params.guestEmail}`,
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: end, timeZone: 'UTC' },
      attendees: [{ email: params.guestEmail }],
    };
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Google Calendar create event failed:', err);
      return null;
    }
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  }

  async deleteGoogleCalendarEvent(
    userId: string,
    calendarEventId: string,
  ): Promise<void> {
    const accessToken = await this.getValidGoogleAccessToken(userId);
    if (!accessToken) return;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(calendarEventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      console.error('Google Calendar delete event failed:', err);
    }
  }
}
