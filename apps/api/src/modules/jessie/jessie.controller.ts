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
import {
  CreateKnowledgeArticleDto,
  CreatePromptTemplateDto,
  SendMessageDto,
  StartConversationDto,
  UpdateKnowledgeArticleDto,
  UpdatePromptTemplateDto,
} from './dto/jessie.dto';
import { ConversationsService } from './conversations.service';
import { PromptsService } from './prompts.service';
import { KnowledgeService } from './knowledge.service';

@ApiTags('Jessie AI')
@ApiBearerAuth()
@Controller({ path: 'jessie', version: '1' })
export class JessieController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly prompts: PromptsService,
    private readonly knowledge: KnowledgeService,
  ) {}

  // ----- Conversations -----
  @Get('conversations')
  @ApiOperation({ summary: 'List Jessie conversations' })
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.conversations.list(user.organizationId);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Start a conversation with a Jessie assistant' })
  startConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartConversationDto,
  ) {
    return this.conversations.start(user.organizationId, user.id, dto);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation with its message history' })
  getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.conversations.get(user.organizationId, id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message and get Jessie’s reply' })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversations.sendMessage(user.organizationId, id, dto);
  }

  @Post('conversations/:id/close')
  @ApiOperation({ summary: 'Close a conversation' })
  closeConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.conversations.close(user.organizationId, user.id, id);
  }

  // ----- Prompt management (admin) -----
  @Get('prompts')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'List assistant prompt templates' })
  listPrompts(@CurrentUser() user: AuthenticatedUser) {
    return this.prompts.list(user.organizationId);
  }

  @Post('prompts')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create an assistant prompt template' })
  createPrompt(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromptTemplateDto,
  ) {
    return this.prompts.create(user.organizationId, dto);
  }

  @Patch('prompts/:id')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Update a prompt template (bumps version)' })
  updatePrompt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePromptTemplateDto,
  ) {
    return this.prompts.update(user.organizationId, id, dto);
  }

  // ----- Knowledge base -----
  @Get('knowledge')
  @ApiOperation({ summary: 'List/search knowledge-base articles (?search=)' })
  listKnowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
  ) {
    return this.knowledge.list(user.organizationId, search);
  }

  @Post('knowledge')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a knowledge-base article' })
  createKnowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateKnowledgeArticleDto,
  ) {
    return this.knowledge.create(user.organizationId, dto);
  }

  @Patch('knowledge/:id')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Update a knowledge-base article' })
  updateKnowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeArticleDto,
  ) {
    return this.knowledge.update(user.organizationId, id, dto);
  }

  @Delete('knowledge/:id')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete a knowledge-base article' })
  removeKnowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.knowledge.remove(user.organizationId, user.id, id);
  }
}
