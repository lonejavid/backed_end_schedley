import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseISO } from 'date-fns';
import { Meeting } from './entities/meeting.entity';
import { EventType } from '../event-types/entities/event-type.entity';
import { localTimeToUtc } from '../common/timezone/timezone.util';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private readonly repo: Repository<Meeting>,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async createPublic(dto: CreateMeetingDto): Promise<Meeting> {
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

    const eventRepo = this.repo.manager.getRepository(EventType);
    const event = await eventRepo.findOne({
      where: { id: dto.eventId },
      select: ['id', 'title', 'description', 'userId'],
    });
    if (event?.userId) {
      const calendarDescription =
        (event.description ?? '') +
        (dto.questionAnswers?.length
          ? '\n\n--- Invitee answers ---\n' +
            dto.questionAnswers.map((q) => `${q.question}: ${q.answer}`).join('\n')
          : '');
      try {
        const calendarEventId = await this.integrationsService.createGoogleCalendarEvent(
          event.userId,
          {
            title: event.title,
            startTime,
            endTime,
            guestEmail: dto.guestEmail,
            description: calendarDescription.trim() || undefined,
          },
        );
        if (calendarEventId) {
          saved.calendarEventId = calendarEventId;
          await this.repo.save(saved);
        }
      } catch (err) {
        console.error('Calendar sync failed:', err);
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
    return saved;
  }
}
