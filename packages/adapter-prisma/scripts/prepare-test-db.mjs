import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
const target = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(target.hostname)
  || !target.pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must name a disposable local database ending in _test');
}
const result = spawnSync(process.execPath, [
  createRequire(import.meta.url).resolve('prisma/build/index.js'),
  'db', 'push', '--force-reset', '--skip-generate',
], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
