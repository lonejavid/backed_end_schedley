import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicController } from './public.controller';
import { EventTypesModule } from '../event-types/event-types.module';
import { AvailabilityModule } from '../availability/availability.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { AuthModule } from '../auth/auth.module';
import { ContactService } from './contact.service';
import { CareerApplicationService } from './career-application.service';
import { CareerApplication } from './entities/career-application.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CareerApplication]),
    EventTypesModule,
    AvailabilityModule,
    MeetingsModule,
    AuthModule,
  ],
  controllers: [PublicController],
  providers: [ContactService, CareerApplicationService],
})
export class PublicModule {}
