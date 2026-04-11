import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReqUser } from '../common/decorators/req-user.decorator';

@Controller('api/integration')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly config: ConfigService,
  ) {}

  @Get('all')
  @UseGuards(JwtAuthGuard)
  async all(@ReqUser('id') userId: string) {
    return this.integrationsService.findAllForUser(userId);
  }

  @Get('check/:appType')
  @UseGuards(JwtAuthGuard)
  async check(
    @ReqUser('id') userId: string,
    @Param('appType') appType: string,
  ) {
    return this.integrationsService.check(userId, appType);
  }

  @Get('connect/:appType')
  @UseGuards(JwtAuthGuard)
  async connect(
    @ReqUser('id') userId: string,
    @Param('appType') appType: string,
  ) {
    return this.integrationsService.connect(userId, appType);
  }

  @Get('google/authorize')
  async googleAuthorize(@Query('state') state: string, @Res() res: Response) {
    if (!state) {
      return res.redirect(
        `${this.config.get<string>('frontend.origin')}/app/integrations?error=missing_state`,
      );
    }
    const url = this.integrationsService.getGoogleCalendarAuthorizeRedirectUrl(state);
    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendOrigin = this.config.get<string>('frontend.origin') || 'http://localhost:3000';
    if (!code || !state) {
      return res.redirect(`${frontendOrigin}/app/integrations?error=missing_code`);
    }
    try {
      await this.integrationsService.handleGoogleCalendarCallback(code, state);
      return res.redirect(`${frontendOrigin}/app/integrations?google=connected`);
    } catch (e) {
      console.error('Google Calendar callback error:', e);
      return res.redirect(`${frontendOrigin}/app/integrations?error=google_callback_failed`);
    }
  }

  @Get('zoom/authorize')
  async zoomAuthorize(@Query('state') state: string, @Res() res: Response) {
    if (!state) {
      return res.redirect(
        `${this.config.get<string>('frontend.origin')}/app/integrations?error=missing_state`,
      );
    }
    const url = this.integrationsService.getZoomAuthorizeRedirectUrl(state);
    return res.redirect(url);
  }

  @Get('zoom/callback')
  async zoomCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendOrigin =
      this.config.get<string>('frontend.origin') || 'http://localhost:3000';
    if (!code || !state) {
      return res.redirect(`${frontendOrigin}/app/integrations?error=missing_code`);
    }
    try {
      await this.integrationsService.handleZoomCallback(code, state);
      return res.redirect(`${frontendOrigin}/app/integrations?zoom=connected`);
    } catch (e) {
      console.error('Zoom OAuth callback error:', e);
      return res.redirect(`${frontendOrigin}/app/integrations?error=zoom_callback_failed`);
    }
  }
}
