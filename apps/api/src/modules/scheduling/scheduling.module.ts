import { Module } from '@nestjs/common';

import { SchedulingController } from './scheduling.controller';
import { AvailabilityService } from './availability.service';
import { WaitlistService } from './waitlist.service';

@Module({
  controllers: [SchedulingController],
  providers: [AvailabilityService, WaitlistService],
  exports: [AvailabilityService, WaitlistService],
})
export class SchedulingModule {}
