import { Controller, Get, Put, Param, Query, UseGuards } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReqUser } from '../common/decorators/req-user.decorator';

@Controller('api/meeting')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get('user/all')
  @UseGuards(JwtAuthGuard)
  async findAllByUser(
    @ReqUser('id') userId: string,
    @Query('filter') filter?: string,
  ) {
    return this.meetingsService.findAllByUser(userId, filter);
  }

  @Put('cancel/:meetingId')
  @UseGuards(JwtAuthGuard)
  async cancel(
    @ReqUser('id') userId: string,
    @Param('meetingId') meetingId: string,
  ) {
    const meeting = await this.meetingsService.cancel(meetingId, userId);
    return {
      message: 'Meeting cancelled successfully',
      meeting,
    };
  }
}
