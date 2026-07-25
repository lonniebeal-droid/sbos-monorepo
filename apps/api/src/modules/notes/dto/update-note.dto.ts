import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateNoteDto } from './create-note.dto';

/**
 * Editable fields on a draft note. Client/clinician/type are immutable after
 * creation, so they are omitted from updates.
 */
export class UpdateNoteDto extends PartialType(
  OmitType(CreateNoteDto, ['clientId', 'clinicianId', 'type'] as const),
) {}
