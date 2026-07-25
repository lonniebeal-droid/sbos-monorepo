import { Module } from '@nestjs/common';

import { CliniciansController } from './clinicians.controller';
import { CliniciansService } from './clinicians.service';

@Module({
  controllers: [CliniciansController],
  providers: [CliniciansService],
  exports: [CliniciansService],
})
export class CliniciansModule {}
