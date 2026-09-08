import {
  BadRequestException,
  NotFoundException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { Public } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppointmentsService } from '../../appointments/appointments.service';
import { AvailabilityService } from '../../scheduling/availability.service';
import { ElevenLabsAgentToolsGuard } from './elevenlabs-agent-tools.guard';

class BookAppointmentToolDto {
  @IsString()
  clientId!: string;

  @IsString()
  clinicianId!: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsOptional()
  @IsBoolean()
  isTelehealth?: boolean;
}

@ApiTags('Jessie ElevenLabs Agent Tools')
@Public()
@UseGuards(ElevenLabsAgentToolsGuard)
@Controller({ path: 'agent-tools/elevenlabs', version: '1' })
export class ElevenLabsAgentToolsController {
  constructor(
    private readonly config: ConfigService,
    private readonly availability: AvailabilityService,
    private readonly appointments: AppointmentsService,
    private readonly prisma: PrismaService,
  ) {}

  private organizationId(): string {
    const value =
      this.config.get<string>('ELEVENLABS_AGENT_TOOLS_ORGANIZATION_ID') ??
      process.env.ELEVENLABS_AGENT_TOOLS_ORGANIZATION_ID;
    if (!value) {
      throw new BadRequestException('Agent tools organization is not configured');
    }
    return value;
  }

  private actorId(): string {
    const value =
      this.config.get<string>('ELEVENLABS_AGENT_TOOLS_ACTOR_ID') ??
      process.env.ELEVENLABS_AGENT_TOOLS_ACTOR_ID;
    if (!value) {
      throw new BadRequestException('Agent tools actor is not configured');
    }
    return value;
  }

  private async validateBookingContext(
    organizationId: string,
    actorId: string,
    clinicianId: string,
    locationId?: string,
  ): Promise<void> {
    const [actor, clinician, location] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: actorId, organizationId, status: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.clinician.findFirst({
        where: { id: clinicianId, organizationId },
        select: { id: true },
      }),
      locationId
        ? this.prisma.location.findFirst({
            where: { id: locationId, organizationId, isActive: true },
            select: { id: true },
          })
        : Promise.resolve({ id: 'not-required' }),
    ]);

    if (!actor) throw new NotFoundException('Agent tools actor not found');
    if (!clinician) throw new NotFoundException('Clinician not found');
    if (!location) throw new NotFoundException('Location not found');
  }

  @Get('health')
  @ApiOperation({ summary: 'Authenticated readiness for the ElevenLabs server-tool adapter' })
  health() {
    return {
      ok: true,
      configured: Boolean(this.organizationId()),
      bookingEnabled: Boolean(this.actorId()),
    };
  }

  @Get('availability')
  @ApiOperation({ summary: 'Return tenant-scoped open slots for Jessie' })
  availabilitySlots(
    @Query('clinicianId') clinicianId: string,
    @Query('date') date: string,
    @Query('duration') duration = '50',
  ) {
    if (!clinicianId || !date) {
      throw new BadRequestException('clinicianId and date are required');
    }
    const slotMinutes = Number.parseInt(duration, 10);
    if (!Number.isFinite(slotMinutes) || slotMinutes < 1 || slotMinutes > 480) {
      throw new BadRequestException('duration must be between 1 and 480 minutes');
    }
    return this.availability.getSlots(
      this.organizationId(),
      clinicianId,
      date,
      slotMinutes,
    );
  }

  @Post('book')
  @ApiOperation({ summary: 'Create a tenant-scoped appointment using existing conflict protection' })
  async book(@Body() dto: BookAppointmentToolDto) {
    const organizationId = this.organizationId();
    const actorId = this.actorId();
    await this.validateBookingContext(
      organizationId,
      actorId,
      dto.clinicianId,
      dto.locationId,
    );
    return this.appointments.create(organizationId, actorId, dto);
  }
}
