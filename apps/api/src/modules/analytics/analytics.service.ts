import { Injectable } from '@nestjs/common';
import { AppointmentStatus, ClaimStatus, NoteStatus } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Practice-wide KPI snapshot for the dashboard. */
  async overview(organizationId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      activeClients,
      clinicians,
      apptsThisMonth,
      notesToCosign,
      openTasks,
      collectedAgg,
      outstandingAgg,
    ] = await Promise.all([
      this.prisma.client.count({
        where: { organizationId, status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.clinician.count({ where: { organizationId } }),
      this.prisma.appointment.count({
        where: { organizationId, startTime: { gte: startOfMonth } },
      }),
      this.prisma.note.count({
        where: { organizationId, status: NoteStatus.PENDING_COSIGN },
      }),
      this.prisma.task.count({
        where: { organizationId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.payment.aggregate({
        where: {
          organizationId,
          status: 'SUCCEEDED',
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.claim.aggregate({
        where: {
          organizationId,
          status: { notIn: [ClaimStatus.PAID, ClaimStatus.VOID] },
        },
        _sum: { billedAmount: true },
      }),
    ]);

    return {
      activeClients,
      clinicians,
      appointmentsThisMonth: apptsThisMonth,
      notesToCosign,
      openTasks,
      collectedThisMonth: Number(collectedAgg._sum.amount ?? 0),
      outstandingReceivables: Number(outstandingAgg._sum.billedAmount ?? 0),
    };
  }

  /** Appointment counts grouped by status (for utilization/no-show reporting). */
  async appointmentsByStatus(organizationId: string) {
    const grouped = await this.prisma.appointment.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { _all: true },
    });
    return grouped.map((row) => ({
      status: row.status as AppointmentStatus,
      count: row._count._all,
    }));
  }

  /** Claims counts and billed totals grouped by status. */
  async claimsByStatus(organizationId: string) {
    const grouped = await this.prisma.claim.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { _all: true },
      _sum: { billedAmount: true },
    });
    return grouped.map((row) => ({
      status: row.status as ClaimStatus,
      count: row._count._all,
      billed: Number(row._sum.billedAmount ?? 0),
    }));
  }
}
