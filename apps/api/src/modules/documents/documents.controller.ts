import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents for a client (?clientId=)' })
  findForClient(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId: string,
  ) {
    return this.documentsService.findForClient(user.organizationId, clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document with a download URL' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.getWithDownloadUrl(user.organizationId, id);
  }

  @Post()
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Register a document and get a presigned upload URL' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentsService.create(user.organizationId, user.id, dto);
  }

  @Post(':id/sign')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Mark a document as electronically signed' })
  sign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.sign(user.organizationId, id, user.id);
  }

  @Delete(':id')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete a document' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.remove(user.organizationId, id, user.id);
  }
}
