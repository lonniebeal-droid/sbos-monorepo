import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JessieAuthGuard } from './jessie-auth.guard';
import { JessieIntegrationController } from './jessie-integration.controller';

describe('Jessie service-auth route metadata', () => {
  it('bypasses global JWT while retaining the required Jessie service-secret guard', () => {
    const reflector = new Reflector();
    expect(reflector.get<boolean>(IS_PUBLIC_KEY, JessieIntegrationController)).toBe(true);
    const guards = Reflect.getMetadata(GUARDS_METADATA, JessieIntegrationController) as unknown[];
    expect(guards).toContain(JessieAuthGuard);

    // A service-authenticated request must not be rejected as an application JWT.
    const jwtGuard = new JwtAuthGuard(reflector);
    const context = {
      getHandler: () => JessieIntegrationController.prototype.lookupClient,
      getClass: () => JessieIntegrationController,
    };
    expect(jwtGuard.canActivate(context as any)).toBe(true);
  });
});
