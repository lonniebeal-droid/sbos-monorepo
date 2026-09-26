import { Module } from '@nestjs/common';

import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';

@Module({
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
