import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { EventTypesModule } from '../event-types/event-types.module';
import { AvailabilityModule } from '../availability/availability.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { AuthModule } from '../auth/auth.module';
import { ContactService } from './contact.service';

@Module({
  imports: [
    EventTypesModule,
    AvailabilityModule,
    MeetingsModule,
    AuthModule,
  ],
  controllers: [PublicController],
  providers: [ContactService],
})
export class PublicModule {}
