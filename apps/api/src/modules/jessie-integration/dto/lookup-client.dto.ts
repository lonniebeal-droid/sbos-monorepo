import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum LookupIdentifierType {
  INBOUND_NUMBER = 'inbound_number',
  CALLED_PHONE_NUMBER = 'called_phone_number',
  LINE_IDENTIFIER = 'line_identifier',
  CLIENT_SLUG = 'client_slug',
  ORGANIZATION_ID = 'organization_id',
  METADATA = 'metadata',
}

export class LookupClientRequestDto {
  @ApiProperty({ enum: LookupIdentifierType })
  @IsEnum(LookupIdentifierType)
  identifierType!: LookupIdentifierType;

  @ApiProperty({ example: '+15551234567' })
  @IsString()
  @MinLength(1)
  identifierValue!: string;

  @ApiPropertyOptional({ example: 'conv_abc123' })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ example: 'req_xyz789' })
  @IsOptional()
  @IsString()
  requestId?: string;
}

export class LookupClientResponseDto {
  @ApiProperty({ example: 'org_abc123' })
  clientId!: string;

  @ApiProperty({ example: 'JU Receptionist Demo' })
  businessName!: string;

  @ApiProperty({ example: 'service_business' })
  businessType!: string;

  @ApiProperty({ example: 'Welcome to JU Receptionist Demo. How can I help you today?' })
  greeting!: string;

  @ApiProperty({ example: '+15551234567' })
  phone!: string;

  @ApiProperty({ example: '123 Main St, Springfield, IL, 62701' })
  location!: string;

  @ApiProperty({ example: '{}' })
  businessHours!: Record<string, string>;

  @ApiProperty({ example: 'America/Chicago' })
  timezone!: string;

  @ApiProperty({ example: '[]' })
  services!: string[];

  @ApiProperty({ example: '[]' })
  faq!: Array<{ question: string; answer: string }>;

  @ApiProperty({ example: '{}' })
  transferRules!: Record<string, string>;

  @ApiProperty({ example: '[]' })
  transferNumbers!: string[];

  @ApiProperty({ example: '["name", "phone", "email", "reason_for_call"]' })
  leadCaptureFields!: string[];

  @ApiProperty({ example: 'callback' })
  afterHoursBehavior!: string;

  @ApiProperty({ example: false })
  bookingEnabled!: boolean;

  @ApiProperty({ example: '{}' })
  bookingRules!: Record<string, unknown>;

  @ApiProperty({ example: '{}' })
  emergencyRules!: Record<string, unknown>;

  @ApiProperty({ example: '[]' })
  restrictedTopics!: string[];

  @ApiProperty({ example: '[]' })
  approvedClaims!: string[];

  @ApiProperty({ example: '' })
  customInstructions!: string;

  @ApiProperty({ example: 'active' })
  clientStatus!: string;
}

export class LookupClientErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'CLIENT_NOT_FOUND' })
  code!: string;

  @ApiProperty({ example: 'No active client found for the provided identifier' })
  message!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}
