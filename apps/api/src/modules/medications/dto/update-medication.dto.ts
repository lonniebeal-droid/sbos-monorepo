import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateMedicationDto } from './create-medication.dto';

export class UpdateMedicationDto extends PartialType(
  OmitType(CreateMedicationDto, ['clientId'] as const),
) {}
