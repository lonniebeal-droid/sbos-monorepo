import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';

export enum CallbackUrgency {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  EMERGENCY = 'emergency',
}

export class SendMessageOrCallbackRequestDto {
  @ApiProperty({ example: 'client_abc123' })
  @IsString()
  @MinLength(1)
  clientId!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  callerName!: string;

  @ApiProperty({ example: '+15551234567' })
  @IsPhoneNumber()
  callerPhone!: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsEmail()
  callerEmail?: string;

  @ApiProperty({ example: 'Please call me back regarding my appointment' })
  @IsString()
  @MinLength(1)
  message!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  callbackRequested!: boolean;

  @ApiPropertyOptional({ example: '2026-09-01T10:00:00Z' })
  @IsOptional()
  @IsString()
  preferredCallbackTime?: string;

  @ApiPropertyOptional({ enum: CallbackUrgency, default: CallbackUrgency.NORMAL })
  @IsOptional()
  @IsEnum(CallbackUrgency)
  urgency?: CallbackUrgency;

  @ApiProperty({ example: 'conv_abc123' })
  @IsString()
  @MinLength(1)
  conversationId!: string;

  @ApiProperty({ example: 'req_xyz789' })
  @IsString()
  @MinLength(1)
  requestId!: string;
}

export class CallbackMessageResponseDto {
  @ApiProperty({ example: 'msg_abc123' })
  messageId!: string;

  @ApiProperty({ example: 'request_recorded' })
  status!: 'request_recorded' | 'sent' | 'queued' | 'failed';

  @ApiProperty({ example: '2026-08-29T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}

export class CallbackMessageErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Invalid caller phone number format' })
  message!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}
