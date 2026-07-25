import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/** Global module exposing a single shared PrismaService to the whole app. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
