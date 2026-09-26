import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import configuration from './config/configuration';
import { validateConfig } from './config/validate-config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
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
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { MedicationsModule } from './modules/medications/medications.module';
import { TreatmentPlansModule } from './modules/treatment-plans/treatment-plans.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { BillingModule } from './modules/billing/billing.module';
import { JessieModule } from './modules/jessie/jessie.module';
import { ElevenLabsAgentToolsModule } from './modules/jessie/agent-tools/elevenlabs-agent-tools.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PlatformModule } from './modules/platform/platform.module';
import { MedicalConnectorsModule } from './modules/integrations/medical-connectors/medical-connectors.module';
import { HealthController } from './modules/health/health.controller';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateConfig,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: false,
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
        storage: config.get<boolean>('REDIS_RATE_LIMIT_ENABLED')
          ? new RedisThrottlerStorage(config.get<string>('REDIS_URL')!)
          : undefined,
      }),
    }),
    PrismaModule,
    AuditModule,
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
    AssessmentsModule,
    AdmissionsModule,
    MedicationsModule,
    TreatmentPlansModule,
    DocumentsModule,
    BillingModule,
    JessieModule,
    ElevenLabsAgentToolsModule,
    TasksModule,
    NotificationsModule,
    MessagingModule,
    AnalyticsModule,
    PlatformModule,
    MedicalConnectorsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
