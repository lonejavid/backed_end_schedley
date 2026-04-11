import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseISO } from 'date-fns';
import { Meeting } from './entities/meeting.entity';
import { EventType } from '../event-types/entities/event-type.entity';
import { localTimeToUtc } from '../common/timezone/timezone.util';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { IntegrationsService } from '../integrations/integrations.service';
import { isGuestEmailDomainBlocked } from '../common/blocked-domains.util';
import { MailService } from '../mail/mail.service';
import { publicBookingConfirmationEmail } from '../mail/email-templates';

function bookingPlatformLabel(locationType: string | undefined): string {
  switch (locationType) {
    case 'GOOGLE_MEET_AND_CALENDAR':
      return 'Google Meet';
    case 'ZOOM_MEETING':
      return 'Zoom';
    case 'MICROSOFT_TEAMS':
      return 'Microsoft Teams';
    default:
      return 'Video call';
  }
}

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private readonly repo: Repository<Meeting>,
    private readonly integrationsService: IntegrationsService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async createPublic(dto: CreateMeetingDto): Promise<Meeting> {
    const eventRepo = this.repo.manager.getRepository(EventType);
    const eventRules = await eventRepo.findOne({
      where: { id: dto.eventId },
      select: ['id', 'blockedDomains', 'accessSpecifier'],
    });
    if (!eventRules) {
      throw new NotFoundException('Event not found');
    }
    if (
      isGuestEmailDomainBlocked(
        dto.guestEmail,
        eventRules.accessSpecifier,
        eventRules.blockedDomains,
      )
    ) {
      throw new ForbiddenException(
        'Bookings from this email domain are not allowed for this event.',
      );
    }

    let startTime: Date;
    let endTime: Date;
    const guestTimezone = dto.guestTimezone || 'UTC';
    if (dto.startTime && dto.endTime) {
      const st =
        typeof dto.startTime === 'string'
          ? dto.startTime
          : (dto.startTime as Date).toISOString();
      const et =
        typeof dto.endTime === 'string'
          ? dto.endTime
          : (dto.endTime as Date).toISOString();
      startTime = parseISO(st);
      endTime = parseISO(et);
    } else if (dto.dateStr && dto.slotTime != null && dto.eventDuration != null) {
      const date = parseISO(dto.dateStr);
      startTime = localTimeToUtc(date, dto.slotTime, guestTimezone);
      endTime = new Date(
        startTime.getTime() + dto.eventDuration * 60 * 1000,
      );
    } else {
      throw new BadRequestException(
        'Provide startTime/endTime (UTC ISO) or dateStr/slotTime/eventDuration and guestTimezone',
      );
    }

    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const questionAnswersText =
      dto.questionAnswers?.length ?
        '\n\n--- Invitee answers ---\n' +
        dto.questionAnswers.map((q) => `${q.question}: ${q.answer}`).join('\n')
        : '';
    const additionalInfo = (dto.additionalInfo ?? '').trim() + questionAnswersText;

    // Overlap check + insert in one transaction so two concurrent requests cannot double-book.
    const saved = await this.repo.manager.transaction(async (manager) => {
      const overlapping = await manager
        .getRepository(Meeting)
        .createQueryBuilder('m')
        .where('m.eventId = :eventId', { eventId: dto.eventId })
        .andWhere('m.status = :status', { status: 'SCHEDULED' })
        .andWhere('m.startTime < :endTime', { endTime })
        .andWhere('m.endTime > :startTime', { startTime })
        .getOne();

      if (overlapping) {
        throw new ConflictException(
          'This time slot is already booked. Please choose another time.',
        );
      }

      const meeting = manager.getRepository(Meeting).create({
        eventId: dto.eventId,
        guestName: dto.guestName,
        guestEmail: dto.guestEmail,
        additionalInfo: additionalInfo || null,
        startTime,
        endTime,
        guestTimezone,
        status: 'SCHEDULED',
      });
      return manager.getRepository(Meeting).save(meeting);
    });

    const event = await eventRepo.findOne({
      where: { id: dto.eventId },
      relations: ['user'],
    });
    const calendarDescription =
      (event?.description ?? '') +
      (dto.questionAnswers?.length
        ? '\n\n--- Invitee answers ---\n' +
          dto.questionAnswers.map((q) => `${q.question}: ${q.answer}`).join('\n')
        : '');

    let googleCalendarEventId: string | null = null;
    let meetHangoutLink: string | null = null;
    const isGoogleMeetEvent =
      event?.locationType === 'GOOGLE_MEET_AND_CALENDAR';
    if (event?.userId && isGoogleMeetEvent) {
      try {
        const cal = await this.integrationsService.createGoogleCalendarEvent(
          event.userId,
          {
            title: event.title,
            startTime,
            endTime,
            guestEmail: dto.guestEmail,
            organizerEmail: event.user?.email,
            description: calendarDescription.trim() || undefined,
            addConference: true,
          },
        );
        if (cal.id) {
          googleCalendarEventId = cal.id;
          meetHangoutLink = cal.hangoutLink;
          saved.calendarEventId = googleCalendarEventId;
          await this.repo.save(saved);
        }
      } catch (err) {
        console.error('Calendar sync failed:', err);
      }
    }

    let zoomJoinUrl: string | null = null;
    if (event?.userId && event.locationType === 'ZOOM_MEETING') {
      try {
        const zm = await this.integrationsService.createZoomMeeting(
          event.userId,
          {
            topic: `${event.title} — ${dto.guestName}`,
            startTime,
            endTime,
            agenda:
              `${dto.guestEmail}\n${calendarDescription}`.trim() || undefined,
          },
        );
        if (zm.joinUrl && zm.meetingId) {
          zoomJoinUrl = zm.joinUrl;
          saved.meetLink = zm.joinUrl;
          saved.zoomMeetingId = zm.meetingId;
          await this.repo.save(saved);
        }
      } catch (err) {
        console.error('Zoom meeting create failed:', err);
      }
    }

    const origin = (
      this.config.get<string>('frontend.origin') || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const hostUsername = event?.user?.username;
    const eventSlug = event?.slug;
    const bookingPageUrl =
      hostUsername && eventSlug ? `${origin}/${hostUsername}/${eventSlug}` : null;

    const tz = (dto.guestTimezone || 'UTC').trim() || 'UTC';
    let startDisplay: string;
    let endDisplay: string;
    try {
      startDisplay = startTime.toLocaleString('en-US', {
        timeZone: tz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      endDisplay = endTime.toLocaleString('en-US', {
        timeZone: tz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      startDisplay = startTime.toUTCString();
      endDisplay = endTime.toUTCString();
    }
    const timezoneNote =
      tz === 'UTC'
        ? 'Times shown in UTC.'
        : `Times shown in your selected timezone (${tz}).`;

    // Google Calendar + sendUpdates=all sends real invitation emails (Meet link, RSVP, .ics) to guests
    // and notifies the organizer. Do not send our generic HTML confirmation in that case.
    if (!googleCalendarEventId) {
      try {
        const email = publicBookingConfirmationEmail({
          guestName: dto.guestName,
          eventTitle: event?.title ?? 'Meeting',
          startDisplay,
          endDisplay,
          timezoneNote,
          platformLabel: bookingPlatformLabel(event?.locationType),
          meetingJoinUrl: meetHangoutLink ?? zoomJoinUrl,
          bookingPageUrl,
        });
        await this.mailService.sendMail(
          dto.guestEmail,
          email.subject,
          email.html,
          email.text,
        );
      } catch (err) {
        console.error('Booking confirmation email failed:', err);
      }
    }

    return saved;
  }

  /** Active bookings for an event — used to hide taken slots from public availability. */
  async findScheduledMeetingsForEvent(
    eventId: string,
  ): Promise<Array<{ startTime: Date; endTime: Date }>> {
    return this.repo.find({
      where: { eventId, status: 'SCHEDULED' },
      select: ['startTime', 'endTime'],
    });
  }

  async findAllByUser(
    userId: string,
    filter?: string,
  ): Promise<{ message: string; meetings: Meeting[] }> {
    const qb = this.repo
      .createQueryBuilder('m')
      .innerJoin('m.event', 'e')
      .innerJoin('e.user', 'u')
      .where('u.id = :userId', { userId })
      .select([
        'm',
        'e.id',
        'e.title',
        'e.duration',
        'e.slug',
        'e.locationType',
        'e.description',
        'e.questions',
        'e.blockedDomains',
        'e.timeSlotInterval',
        'e.isPrivate',
        'e.accessSpecifier',
        'e.createdAt',
        'e.updatedAt',
        'u.id',
        'u.name',
        'u.username',
        'u.imageUrl',
        'u.timezone',
      ])
      .orderBy('m.startTime', 'DESC');
    const now = new Date();
    if (filter === 'UPCOMING') {
      qb.andWhere('m.startTime > :now', { now }).andWhere(
        'm.status = :status',
        { status: 'SCHEDULED' },
      );
    } else if (filter === 'PAST') {
      qb.andWhere('m.startTime <= :now', { now });
    } else if (filter === 'CANCELLED') {
      qb.andWhere('m.status = :status', { status: 'CANCELLED' });
    }
    const meetings = await qb.getMany();
    return { message: 'OK', meetings };
  }

  async cancel(meetingId: string, userId: string): Promise<Meeting> {
    const meeting = await this.repo.findOne({
      where: { id: meetingId },
      relations: ['event', 'event.user'],
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    const eventOwnerId = (meeting.event as { user: { id: string } }).user?.id;
    if (eventOwnerId !== userId) {
      throw new ForbiddenException();
    }
    meeting.status = 'CANCELLED';
    const saved = await this.repo.save(meeting);

    if (meeting.calendarEventId && eventOwnerId) {
      this.integrationsService
        .deleteGoogleCalendarEvent(eventOwnerId, meeting.calendarEventId)
        .catch((err) => console.error('Google Calendar delete failed:', err));
    }
    if (meeting.zoomMeetingId && eventOwnerId) {
      this.integrationsService
        .deleteZoomMeeting(eventOwnerId, meeting.zoomMeetingId)
        .catch((err) => console.error('Zoom meeting delete failed:', err));
    }
    return saved;
  }
}
