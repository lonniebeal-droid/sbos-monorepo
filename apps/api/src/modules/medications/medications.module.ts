import { Module } from '@nestjs/common';

import { MedicationsController } from './medications.controller';
import { MedicationsService } from './medications.service';

@Module({
  controllers: [MedicationsController],
  providers: [MedicationsService],
  exports: [MedicationsService],
})
export class MedicationsModule {}
