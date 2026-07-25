import { Injectable, NotFoundException } from '@nestjs/common';
import { DiagnosisStatus, type Prisma } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';

@Injectable()
export class DiagnosesService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, dto: CreateDiagnosisDto) {
    const { clientId, ...rest } = dto;
    return this.prisma.diagnosis.create({
      data: { ...rest, clientId, organizationId },
    });
  }

  findForClient(organizationId: string, clientId: string) {
    return this.prisma.diagnosis.findMany({
      where: { organizationId, clientId },
      orderBy: [{ type: 'asc' }, { diagnosedAt: 'desc' }],
    });
  }

  private async ensure(organizationId: string, id: string) {
    const diagnosis = await this.prisma.diagnosis.findFirst({
      where: { id, organizationId },
    });
    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis ${id} not found`);
    }
    return diagnosis;
  }

  async update(organizationId: string, id: string, dto: UpdateDiagnosisDto) {
    await this.ensure(organizationId, id);
    const data: Prisma.DiagnosisUpdateInput = { ...dto };
    if (dto.status === 'RESOLVED') {
      data.resolvedAt = new Date();
    }
    return this.prisma.diagnosis.update({ where: { id }, data });
  }

  async remove(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    await this.prisma.diagnosis.delete({ where: { id } });
    return { success: true };
  }

  countActive(organizationId: string, clientId: string) {
    return this.prisma.diagnosis.count({
      where: { organizationId, clientId, status: DiagnosisStatus.ACTIVE },
    });
  }
}
