import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReqUser } from '../common/decorators/req-user.decorator';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Controller('api/availability')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('me')
  async getMe(@ReqUser('id') userId: string) {
    const availability = await this.availabilityService.findOrCreateForUser(userId);
    return { message: 'OK', availability };
  }

  @Put('update')
  async update(
    @ReqUser('id') userId: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    const availability = await this.availabilityService.update(userId, dto);
    return { message: 'OK', availability };
  }
}
