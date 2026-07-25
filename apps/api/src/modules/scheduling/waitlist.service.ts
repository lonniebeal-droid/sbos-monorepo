import { Injectable, NotFoundException } from '@nestjs/common';
import { WaitlistStatus, type Prisma } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateWaitlistDto, UpdateWaitlistDto } from './dto/waitlist.dto';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, dto: CreateWaitlistDto) {
    return this.prisma.waitlistEntry.create({
      data: { ...dto, organizationId },
    });
  }

  findAll(organizationId: string, status?: WaitlistStatus) {
    const where: Prisma.WaitlistEntryWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
    };
    return this.prisma.waitlistEntry.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        client: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      },
    });
  }

  async updateStatus(organizationId: string, id: string, dto: UpdateWaitlistDto) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException(`Waitlist entry ${id} not found`);
    return this.prisma.waitlistEntry.update({
      where: { id },
      data: { status: dto.status as WaitlistStatus },
    });
  }

  async remove(organizationId: string, id: string) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException(`Waitlist entry ${id} not found`);
    await this.prisma.waitlistEntry.delete({ where: { id } });
    return { success: true };
  }
}
