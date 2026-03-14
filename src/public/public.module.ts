import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { EventTypesModule } from '../event-types/event-types.module';
import { AvailabilityModule } from '../availability/availability.module';
import { MeetingsModule } from '../meetings/meetings.module';

@Module({
  imports: [
    EventTypesModule,
    AvailabilityModule,
    MeetingsModule,
  ],
  controllers: [PublicController],
})
export class PublicModule {}
