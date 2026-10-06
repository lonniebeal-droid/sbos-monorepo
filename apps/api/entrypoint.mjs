import { spawnSync } from 'node:child_process';

// Prefer an explicit DATABASE_URL (Railway / local). Fall back to composing it
// from the Secret Manager-backed DB_PASSWORD (Cloud Run) only when it is absent.
if (!process.env.DATABASE_URL) {
  const pw = process.env.DB_PASSWORD;
  if (!pw) {
    console.error('Neither DATABASE_URL nor DB_PASSWORD is set');
    process.exit(1);
  }
  process.env.DATABASE_URL =
    'postgresql://postgres.yqlvcmydledbkudstqfo:' +
    encodeURIComponent(pw) +
    '@aws-1-us-west-2.pooler.supabase.com:5432/postgres?schema=sbos_app&sslmode=require';
}

// Schema migrations are opt-in so a redeploy never mutates the database
// unless an operator explicitly sets RUN_DB_MIGRATIONS=true.
if (process.env.RUN_DB_MIGRATIONS === 'true') {
  const migrate = spawnSync(
    'packages/database/node_modules/.bin/prisma',
    ['migrate', 'deploy', '--schema=packages/database/prisma/schema.prisma'],
    { stdio: 'inherit', env: process.env }
  );
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);
} else {
  console.log('RUN_DB_MIGRATIONS!=true: skipping prisma migrate deploy');
}

const api = spawnSync('node', ['apps/api/dist/main.js'], {
  stdio: 'inherit',
  env: process.env
});
process.exit(api.status ?? 1);
