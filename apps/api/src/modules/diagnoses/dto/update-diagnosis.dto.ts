import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateDiagnosisDto } from './create-diagnosis.dto';

export class UpdateDiagnosisDto extends PartialType(
  OmitType(CreateDiagnosisDto, ['clientId'] as const),
) {}
