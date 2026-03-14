import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { EventTypesService } from './event-types.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReqUser } from '../common/decorators/req-user.decorator';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('api/event')
@UseGuards(JwtAuthGuard)
export class EventTypesController {
  constructor(private readonly eventTypesService: EventTypesService) {}

  @Post('create')
  async create(
    @ReqUser('id') userId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventTypesService.create(userId, dto);
  }

  @Get('all')
  async findAll(@ReqUser('id') userId: string) {
    const result = await this.eventTypesService.findAllByUser(userId);
    return { message: 'OK', data: result };
  }

  @Put('toggle-privacy')
  async togglePrivacy(
    @ReqUser('id') userId: string,
    @Body() body: { eventId: string },
  ) {
    const event = await this.eventTypesService.togglePrivacy(body.eventId, userId);
    return { message: 'OK', event };
  }

  @Delete(':eventId')
  async remove(
    @ReqUser('id') userId: string,
    @Param('eventId') eventId: string,
  ) {
    await this.eventTypesService.remove(eventId, userId);
    return { message: 'Event deleted' };
  }
}
