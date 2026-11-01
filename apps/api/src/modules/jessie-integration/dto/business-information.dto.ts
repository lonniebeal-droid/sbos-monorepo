import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class GetBusinessInformationRequestDto {
  @ApiProperty({ example: 'client_abc123' })
  @IsString()
  @MinLength(1)
  clientId!: string;

  @ApiPropertyOptional({ example: 'conv_abc123' })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ example: 'req_xyz789' })
  @IsOptional()
  @IsString()
  requestId?: string;
}

export class BusinessInformationResponseDto {
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
  transferNumbers!: Record<string, string>;

  @ApiProperty({ example: 'callback' })
  afterHoursBehavior!: string;

  @ApiProperty({ example: false })
  bookingEnabled!: boolean;

  @ApiProperty({ example: 'active' })
  clientStatus!: string;
}

export class BusinessInformationErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'NOT_FOUND' })
  code!: string;

  @ApiProperty({ example: 'Business information not found for client' })
  message!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}
