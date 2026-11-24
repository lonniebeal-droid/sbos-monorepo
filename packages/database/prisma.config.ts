// A prisma.config.ts file takes over from Prisma's implicit .env loading, so
// load it explicitly to keep the documented `packages/database/.env` local-dev
// workflow (see docs/INSTALL.md) working the same as before this migration.
import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
});
