import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { format, parseISO, addDays } from 'date-fns';
import { Availability, DayAvailability } from './entities/availability.entity';
import {
  isValidTimezone,
  normalizeTimeStr,
  generateSlotsForDay,
  utcToLocalTimeString,
} from '../common/timezone/timezone.util';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Availability)
    private readonly repo: Repository<Availability>,
  ) {}

  async findOrCreateForUser(userId: string): Promise<Availability> {
    let availability = await this.repo.findOne({ where: { userId } });
    if (!availability) {
      availability = this.repo.create({
        userId,
        timeGap: 30,
        timezone: 'UTC',
        days: this.defaultDays(),
      });
      availability = await this.repo.save(availability);
    }
    return availability;
  }

  async update(
    userId: string,
    dto: UpdateAvailabilityDto,
  ): Promise<Availability> {
    if (dto.timezone && !isValidTimezone(dto.timezone)) {
      throw new Error('Invalid timezone');
    }
    let availability = await this.findOrCreateForUser(userId);
    if (dto.timeGap != null) availability.timeGap = dto.timeGap;
    if (dto.timezone != null) availability.timezone = dto.timezone;
    if (dto.days != null) {
      availability.days = dto.days.map((d) => ({
        day: d.day,
        startTime: normalizeTimeStr(d.startTime),
        endTime: normalizeTimeStr(d.endTime),
        isAvailable: d.isAvailable ?? true,
      }));
    }
    return this.repo.save(availability);
  }

  async getPublicSlots(
    eventId: string,
    ownerTimezone: string,
    ownerAvailability: Availability,
    eventDurationMinutes: number,
    slotIntervalMinutes: number,
    fromDate: string,
    toDate: string,
    requestTimezone: string,
    /** Existing SCHEDULED meetings for this event — slots that overlap are removed */
    busyIntervals: Array<{ start: Date; end: Date }> = [],
  ): Promise<{ data: Array<{ day: string; dateStr: string; slots: string[]; isAvailable: boolean; timezone?: string }>; timezone: string }> {
    const from = parseISO(fromDate);
    const to = parseISO(toDate);
    const result: Array<{
      day: string;
      dateStr: string;
      slots: string[];
      isAvailable: boolean;
      timezone?: string;
    }> = [];
    const dayNames = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayOfWeek = dayNames[d.getDay()];
      const dayConfig = ownerAvailability.days.find(
        (x) => x.day.toUpperCase() === dayOfWeek && x.isAvailable,
      );
      if (!dayConfig) {
        result.push({ day: dayOfWeek, dateStr, slots: [], isAvailable: false });
        continue;
      }
      const slotDuration = Math.max(slotIntervalMinutes, eventDurationMinutes);
      const generated = generateSlotsForDay(
        dateStr,
        dayConfig.startTime,
        dayConfig.endTime,
        slotDuration,
        ownerTimezone,
      );
      const freeSlots = generated.filter(
        (slot) =>
          !busyIntervals.some(
            (b) => slot.start < b.end && slot.end > b.start,
          ),
      );
      const slotsInRequestedTz = freeSlots.map((s) =>
        utcToLocalTimeString(s.start, requestTimezone),
      );
      result.push({
        day: dayOfWeek,
        dateStr,
        slots: slotsInRequestedTz,
        isAvailable: true,
        timezone: requestTimezone,
      });
    }
    return { data: result, timezone: requestTimezone };
  }

  defaultDays(): DayAvailability[] {
    return ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map(
      (day) => ({
        day,
        startTime: '09:00',
        endTime: '17:00',
        isAvailable: true,
      }),
    );
  }
}
