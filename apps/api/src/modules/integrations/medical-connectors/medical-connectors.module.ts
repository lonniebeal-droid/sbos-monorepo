import { Module } from '@nestjs/common';
import { MedicalConnectorsController } from './medical-connectors.controller';
import { MedicalConnectorsService } from './medical-connectors.service';

@Module({
  controllers: [MedicalConnectorsController],
  providers: [MedicalConnectorsService],
  exports: [MedicalConnectorsService],
})
export class MedicalConnectorsModule {}
