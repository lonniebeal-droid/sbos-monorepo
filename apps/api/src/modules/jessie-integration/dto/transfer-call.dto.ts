import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum TransferUrgency {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

export enum TransferCallerStatus {
  NEW = 'new',
  EXISTING = 'existing',
  VIP = 'vip',
}

export class TransferCallRequestDto {
  @ApiProperty({ example: 'client_abc123' })
  @IsString()
  @MinLength(1)
  clientId!: string;

  @ApiProperty({ example: 'crisis_transfer' })
  @IsString()
  @MinLength(1)
  intent!: string;

  @ApiPropertyOptional({ enum: TransferUrgency, default: TransferUrgency.ROUTINE })
  @IsOptional()
  @IsEnum(TransferUrgency)
  urgency?: TransferUrgency;

  @ApiPropertyOptional({ enum: TransferCallerStatus, default: TransferCallerStatus.NEW })
  @IsOptional()
  @IsEnum(TransferCallerStatus)
  callerStatus?: TransferCallerStatus;

  @ApiPropertyOptional({ example: 'after_hours' })
  @IsOptional()
  @IsString()
  businessHoursContext?: string;

  @ApiProperty({ example: 'conv_abc123' })
  @IsString()
  @MinLength(1)
  conversationId!: string;

  @ApiProperty({ example: 'req_xyz789' })
  @IsString()
  @MinLength(1)
  requestId!: string;
}

export class TransferCallResponseDto {
  @ApiProperty({ example: true })
  allowed!: boolean;

  @ApiPropertyOptional({ example: '+15551234567' })
  destination?: string;

  @ApiPropertyOptional({ example: 'Crisis Line' })
  destinationLabel?: string;

  @ApiProperty({ example: 'No verified telephony transfer destination is configured for this organization' })
  reason!: string;

  @ApiProperty({ example: 'callback' })
  fallbackBehavior!: 'voicemail' | 'callback' | 'queue' | 'none';

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}

export class TransferCallErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'TRANSFER_DENIED' })
  code!: string;

  @ApiProperty({ example: 'Transfer not permitted for this intent' })
  message!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}
