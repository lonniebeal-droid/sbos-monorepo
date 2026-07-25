import 'reflect-metadata';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import configuration, { type AppConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validateRuntimeConfig } from './config/validate-config';

async function bootstrap(): Promise<void> {
  // Fail fast on insecure/missing configuration in production.
  validateRuntimeConfig(configuration());

  const app = await NestFactory.create(AppModule, { cors: false });
  const configService = app.get<ConfigService<AppConfig, true>>(ConfigService);

  // Security headers (CSP is relaxed here because the API serves JSON + Swagger).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.enableCors({
    origin: configService.get('corsOrigins', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SBOS API')
    .setDescription(
      'Success Brand Operating System — behavioral health REST API. ' +
        'JWT-authenticated, role-based, versioned endpoints.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication')
    .addTag('Users')
    .addTag('Organizations')
    .addTag('Locations')
    .addTag('Clients')
    .addTag('Clinicians')
    .addTag('Appointments')
    .addTag('Scheduling')
    .addTag('Clinical Notes')
    .addTag('Diagnoses')
    .addTag('Medications')
    .addTag('Treatment Plans')
    .addTag('Documents')
    .addTag('Billing')
    .addTag('Jessie AI')
    .addTag('Tasks')
    .addTag('Notifications')
    .addTag('Messaging')
    .addTag('Analytics')
    .addTag('Platform Admin')
    .addTag('Health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = configService.get('port', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`SBOS API listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
