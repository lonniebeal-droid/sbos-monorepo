import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NoteQueryDto } from './dto/note-query.dto';
import { GenerateNoteDto } from './dto/generate-note.dto';
import { NotesService } from './notes.service';

@ApiTags('Clinical Notes')
@ApiBearerAuth()
@Controller({ path: 'notes', version: '1' })
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ApiOperation({ summary: 'List notes (filter by client/clinician/type/status)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NoteQueryDto,
  ) {
    return this.notesService.findAll(user.organizationId, query);
  }

  @Post('generate')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'AI-assisted note draft (does not persist)' })
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateNoteDto,
  ) {
    return this.notesService.generateDraft(user.organizationId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a note with structured detail' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notesService.findOne(user.organizationId, id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List a note version history (audit trail)' })
  versions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notesService.listVersions(user.organizationId, id);
  }

  @Post()
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Create a clinical note (draft)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Edit a draft note (creates a new version)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(user.organizationId, id, user.id, dto);
  }

  @Post(':id/sign')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Sign a draft note (author)' })
  sign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notesService.sign(user.organizationId, id, user.id);
  }

  @Post(':id/cosign')
  @Roles(Role.SUPERVISOR)
  @ApiOperation({ summary: 'Co-sign a note awaiting supervision' })
  cosign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notesService.cosign(user.organizationId, id, user.id);
  }

  @Post(':id/amend')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Amend a signed note (creates a new version)' })
  amend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.amend(user.organizationId, id, user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Delete a draft note' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notesService.remove(user.organizationId, id, user.id);
  }
}
