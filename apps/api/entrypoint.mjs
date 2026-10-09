import { spawnSync } from 'node:child_process';

const pw = process.env.DB_PASSWORD;
if (!pw) {
  console.error('DB_PASSWORD is not set');
  process.exit(1);
}

process.env.DATABASE_URL =
  'postgresql://postgres.yqlvcmydledbkudstqfo:' +
  encodeURIComponent(pw) +
  '@aws-1-us-west-2.pooler.supabase.com:5432/postgres?schema=sbos_app&sslmode=require';

const migrate = spawnSync(
  'packages/database/node_modules/.bin/prisma',
  ['migrate', 'deploy', '--schema=packages/database/prisma/schema.prisma'],
  { stdio: 'inherit', env: process.env }
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const api = spawnSync('node', ['apps/api/dist/main.js'], {
  stdio: 'inherit',
  env: process.env
});
process.exit(api.status ?? 1);
