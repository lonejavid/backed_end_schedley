import { randomUUID } from 'node:crypto';
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
    if (appType === 'ZOOM_MEETING' && this.config.get<string>('zoom.clientId')) {
      const state = this.jwtService.sign(
        { sub: userId, purpose: 'zoom-oauth' },
        { expiresIn: '5m' },
      );
      const origin =
        this.config.get<string>('serverOrigin') || 'http://localhost:8000';
      const url = `${origin}/api/integration/zoom/authorize?state=${encodeURIComponent(state)}`;
      return { message: 'Redirect to Zoom OAuth', url };
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
      /** Event owner (host); included as attendee when different from guest so Google emails both (Meet + RSVP). */
      organizerEmail?: string;
      description?: string;
      /** When true, creates a Google Meet conference and returns `hangoutLink` when the API provides it. */
      addConference?: boolean;
    },
  ): Promise<{ id: string | null; hangoutLink: string | null }> {
    const accessToken = await this.getValidGoogleAccessToken(userId);
    if (!accessToken) return { id: null, hangoutLink: null };

    const start = params.startTime.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const end = params.endTime.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const addConference = Boolean(params.addConference);
    const guestNorm = params.guestEmail.trim().toLowerCase();
    const orgNorm = params.organizerEmail?.trim().toLowerCase();
    const attendeeEmails = new Set<string>([params.guestEmail.trim()]);
    if (orgNorm && orgNorm !== guestNorm && params.organizerEmail) {
      attendeeEmails.add(params.organizerEmail.trim());
    }
    const attendees = [...attendeeEmails].map((email) => ({ email }));

    const body: Record<string, unknown> = {
      summary: params.title,
      description: params.description ?? `Meeting with ${params.guestEmail}`,
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: end, timeZone: 'UTC' },
      attendees,
    };
    if (addConference) {
      body.conferenceData = {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }
    const query = addConference
      ? 'conferenceDataVersion=1&sendUpdates=all'
      : 'sendUpdates=all';
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('Google Calendar create event failed:', err);
      return { id: null, hangoutLink: null };
    }
    const data = (await res.json()) as {
      id?: string;
      hangoutLink?: string;
      conferenceData?: {
        entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
      };
    };
    let hangoutLink = data.hangoutLink ?? null;
    if (!hangoutLink && data.conferenceData?.entryPoints?.length) {
      const video = data.conferenceData.entryPoints.find(
        (e) =>
          e.entryPointType === 'video' ||
          (e.uri?.includes('meet.google.com') ?? false),
      );
      hangoutLink = video?.uri ?? null;
    }
    return { id: data.id ?? null, hangoutLink };
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

  getZoomAuthorizeRedirectUrl(state: string): string {
    const clientId = this.config.get<string>('zoom.clientId');
    const callbackUrl = this.config.get<string>('zoom.callbackUrl');
    if (!clientId || !callbackUrl) {
      throw new Error('Zoom OAuth not configured');
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackUrl,
      state,
    });
    params.append('scope', 'user:read:user meeting:write');
    return `https://zoom.us/oauth/authorize?${params.toString()}`;
  }

  async handleZoomCallback(
    code: string,
    state: string,
  ): Promise<{ userId: string }> {
    const payload = this.jwtService.verify<{ sub: string; purpose: string }>(
      state,
    );
    if (payload.purpose !== 'zoom-oauth') throw new Error('Invalid state');
    const userId = payload.sub;

    const clientId = this.config.get<string>('zoom.clientId');
    const clientSecret = this.config.get<string>('zoom.clientSecret');
    const callbackUrl = this.config.get<string>('zoom.callbackUrl');
    if (!clientId || !clientSecret || !callbackUrl) {
      throw new Error('Zoom OAuth not configured');
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );
    const tokenRes = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Zoom token exchange failed: ${err}`);
    }
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    let row = await this.repo.findOne({
      where: { userId, appType: 'ZOOM_MEETING' },
    });
    if (!row) {
      row = this.repo.create({
        userId,
        appType: 'ZOOM_MEETING',
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

  async getValidZoomAccessToken(userId: string): Promise<string | null> {
    const row = await this.repo.findOne({
      where: { userId, appType: 'ZOOM_MEETING' },
    });
    if (!row || Number(row.isConnected) !== 1 || !row.accessToken) return null;
    if (row.refreshToken) {
      try {
        const refreshed = await this.refreshZoomToken(row.refreshToken);
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

  private async refreshZoomToken(refreshToken: string): Promise<string | null> {
    const clientId = this.config.get<string>('zoom.clientId');
    const clientSecret = this.config.get<string>('zoom.clientSecret');
    if (!clientId || !clientSecret) return null;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );
    const res = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string };
    return data.access_token ?? null;
  }

  async createZoomMeeting(
    userId: string,
    params: {
      topic: string;
      startTime: Date;
      endTime: Date;
      agenda?: string;
    },
  ): Promise<{ joinUrl: string | null; meetingId: string | null }> {
    const accessToken = await this.getValidZoomAccessToken(userId);
    if (!accessToken) return { joinUrl: null, meetingId: null };

    const durationMins = Math.max(
      1,
      Math.round((params.endTime.getTime() - params.startTime.getTime()) / 60000),
    );
    const startTime = params.startTime
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');

    const body = {
      topic: params.topic,
      type: 2,
      start_time: startTime,
      duration: durationMins,
      timezone: 'UTC',
      agenda: params.agenda,
      settings: {
        join_before_host: true,
      },
    };

    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Zoom create meeting failed:', err);
      return { joinUrl: null, meetingId: null };
    }
    const data = (await res.json()) as {
      join_url?: string;
      id?: number | string;
    };
    const meetingId =
      data.id !== undefined && data.id !== null ? String(data.id) : null;
    return {
      joinUrl: data.join_url ?? null,
      meetingId,
    };
  }

  async deleteZoomMeeting(
    userId: string,
    zoomMeetingId: string,
  ): Promise<void> {
    const accessToken = await this.getValidZoomAccessToken(userId);
    if (!accessToken) return;
    const res = await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(zoomMeetingId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      console.error('Zoom delete meeting failed:', err);
    }
  }
}
