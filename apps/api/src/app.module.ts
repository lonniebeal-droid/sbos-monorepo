import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import configuration from './config/configuration';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';
import { PaymentsModule } from './payments/payments.module';
import { ChannelsModule } from './channels/channels.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CliniciansModule } from './modules/clinicians/clinicians.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { NotesModule } from './modules/notes/notes.module';
import { DiagnosesModule } from './modules/diagnoses/diagnoses.module';
import { MedicationsModule } from './modules/medications/medications.module';
import { TreatmentPlansModule } from './modules/treatment-plans/treatment-plans.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { BillingModule } from './modules/billing/billing.module';
import { JessieModule } from './modules/jessie/jessie.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PlatformModule } from './modules/platform/platform.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuditModule,
    AiModule,
    StorageModule,
    PaymentsModule,
    ChannelsModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    LocationsModule,
    ClientsModule,
    CliniciansModule,
    AppointmentsModule,
    SchedulingModule,
    NotesModule,
    DiagnosesModule,
    MedicationsModule,
    TreatmentPlansModule,
    DocumentsModule,
    BillingModule,
    JessieModule,
    TasksModule,
    NotificationsModule,
    MessagingModule,
    AnalyticsModule,
    PlatformModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
