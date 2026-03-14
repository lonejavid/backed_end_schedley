import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TimezoneModule } from './common/timezone/timezone.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EventTypesModule } from './event-types/event-types.module';
import { AvailabilityModule } from './availability/availability.module';
import { MeetingsModule } from './meetings/meetings.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PublicModule } from './public/public.module';
import { User } from './users/entities/user.entity';
import { EventType } from './event-types/entities/event-type.entity';
import { Availability } from './availability/entities/availability.entity';
import { Meeting } from './meetings/entities/meeting.entity';
import { Integration } from './integrations/entities/integration.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const useSqlite = config.get<boolean>('database.useSqlite');
        const entities = [User, EventType, Availability, Meeting, Integration];
        if (useSqlite) {
          // SQLite with file persistence so integrations (e.g. Google tokens) survive restarts and re-login.
          const sqlitePath = config.get<string>('database.sqlitePath') ?? 'schedley.sqlite';
          return {
            type: 'sqljs',
            location: sqlitePath,
            autoSave: true,
            entities,
            synchronize: true,
          };
        }
        const url = config.get<string>('database.url');
        if (url) {
          return {
            type: 'postgres',
            url,
            entities,
            synchronize: true,
          };
        }
        return {
          type: 'postgres',
          host: String(config.get('database.host') ?? 'localhost'),
          port: Number(config.get('database.port') ?? 5432),
          username: String(config.get('database.username') ?? 'postgres'),
          password: String(config.get('database.password') ?? 'postgres'),
          database: String(config.get('database.database') ?? 'schedley'),
          entities,
          synchronize: true,
        };
      },
      inject: [ConfigService],
    }),
    TimezoneModule,
    UsersModule,
    AuthModule,
    EventTypesModule,
    AvailabilityModule,
    MeetingsModule,
    IntegrationsModule,
    PublicModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
