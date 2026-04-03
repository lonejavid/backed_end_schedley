import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { format, addDays } from 'date-fns';
import { EventTypesService } from '../event-types/event-types.service';
import { AvailabilityService } from '../availability/availability.service';
import { MeetingsService } from '../meetings/meetings.service';
import { CreateMeetingDto } from '../meetings/dto/create-meeting.dto';
import { ContactDto } from './dto/contact.dto';
import { ContactService } from './contact.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { EventType } from '../event-types/entities/event-type.entity';

function toUserType(u: User | null): { name: string; imageUrl: string | null; timezone?: string } | null {
  if (!u) return null;
  return {
    name: u.name,
    imageUrl: u.imageUrl ?? null,
    timezone: u.timezone ?? 'UTC',
  };
}

function toEventPublic(
  e: EventType,
  user?: { name: string; imageUrl: string | null; timezone?: string } | null,
  _count = 0,
) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    duration: e.duration,
    slug: e.slug,
    isPrivate: Number(e.isPrivate) === 1,
    locationType: e.locationType,
    timeSlotInterval: e.timeSlotInterval,
    blockedDomains: e.blockedDomains,
    questions: e.questions,
    accessSpecifier: e.accessSpecifier,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    user: user ?? toUserType(e.user),
    _count,
  };
}

@Controller('api')
export class PublicController {
  @Get()
  apiRoot(): { status: string; message: string } {
    return { status: 'ok', message: 'Schedley API is running' };
  }

  @Get('health')
  health(): { status: string; message: string } {
    return { status: 'ok', message: 'Schedley API is running' };
  }

  constructor(
    private readonly eventTypesService: EventTypesService,
    private readonly availabilityService: AvailabilityService,
    private readonly meetingsService: MeetingsService,
    private readonly contactService: ContactService,
  ) {}

  /** GET /api/event/public/:username - list public events by username (frontend expects this) */
  @Get('event/public/:username')
  async getPublicEventsByUsername(@Param('username') username: string) {
    const { user, events } = await this.eventTypesService.findPublicEventsByUsername(username);
    const userPayload = user ? toUserType(user) : null;
    if (!userPayload) {
      throw new NotFoundException('User not found');
    }
    const eventsPayload = events.map((e) => toEventPublic(e, userPayload, 0));
    return {
      message: 'OK',
      user: userPayload,
      events: eventsPayload,
    };
  }

  @Get('event/public/:username/:slug')
  async getPublicEvent(
    @Param('username') username: string,
    @Param('slug') slug: string,
  ) {
    const event = await this.eventTypesService.findByUsernameAndSlug(username, slug);
    if (!event) throw new NotFoundException('Event not found');
    const user = event.user;
    return {
      message: 'OK',
      event: toEventPublic(event),
      creatorTimezone: user?.timezone ?? 'UTC',
    };
  }

  @Get('availability/public/:eventId')
  async getPublicAvailability(
    @Param('eventId') eventId: string,
    @Query('timezone') timezone = 'UTC',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const event = await this.eventTypesService.findOne(eventId);
    if (!event) throw new NotFoundException('Event not found');
    const ownerId = event.userId;
    const availability = await this.availabilityService.findOrCreateForUser(ownerId);
    const owner = event.user;
    const ownerTimezone = owner?.timezone ?? 'UTC';
    const fromDate =
      from || format(new Date(), 'yyyy-MM-dd');
    const toDate =
      to || format(addDays(new Date(), 14), 'yyyy-MM-dd');
    const slotInterval = event.timeSlotInterval || 30;
    const result = await this.availabilityService.getPublicSlots(
      eventId,
      ownerTimezone,
      availability,
      event.duration,
      slotInterval,
      fromDate,
      toDate,
      timezone,
    );
    return { message: 'OK', ...result };
  }

  @Post('meeting/public/create')
  async createPublicMeeting(@Body() dto: CreateMeetingDto) {
    const meeting = await this.meetingsService.createPublic(dto);
    return {
      message: 'Meeting scheduled',
      meeting: {
        id: meeting.id,
        guestName: meeting.guestName,
        guestEmail: meeting.guestEmail,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        guestTimezone: meeting.guestTimezone ?? undefined,
        status: meeting.status,
        meetLink: meeting.meetLink ?? null,
      },
    };
  }

  /** POST /api/contact – optional Bearer token; name/email omitted when signed in. */
  @Post('contact')
  @UseGuards(OptionalJwtAuthGuard)
  async submitContact(@Body() dto: ContactDto, @Req() req: Request & { user?: User }) {
    const user = req.user ?? null;
    return this.contactService.submit(dto, user);
  }
}
