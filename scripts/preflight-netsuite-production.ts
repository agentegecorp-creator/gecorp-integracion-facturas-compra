import fs from 'node:fs';
import path from 'node:path';
import { hasNetSuiteProductionConfig, requestNetSuite } from '@/lib/netsuite/sandbox-publisher';

function loadEnvFile(filename: string) {
  const filePath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    process.env[key] = value;
  }
}

function argValue(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function assertProductionConnection() {
  const result = await requestNetSuite(
    'POST',
    '/services/rest/query/v1/suiteql',
    { q: 'SELECT id, tranId FROM transaction WHERE rownum <= 1' },
    { prefer: 'transient' },
    'production',
  );

  if (!result.success) {
    throw new Error(`Preflight Produccion fallo HTTP ${result.status}: ${result.raw || JSON.stringify(result.body)}`);
  }

  const body = result.body as { items?: unknown[] };
  return Array.isArray(body.items) ? body.items.length : 0;
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  if (!hasNetSuiteProductionConfig()) {
    throw new Error('Faltan variables NETSUITE_PROD_* para Produccion.');
  }

  const connectionRows = await assertProductionConnection();
  console.log(`OK conexion NetSuite Produccion: SuiteQL respondio (${connectionRows} fila(s) de control).`);

  if (!process.argv.includes('--duplicates')) {
    return;
  }

  const { listReadyForProduction } = await import('@/lib/db/queries');
  const { buildSandboxPayload, findExistingTransaction } = await import('@/lib/netsuite/sandbox-publisher');
  const limitParam = Number(argValue('--limit', '5'));
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(Math.trunc(limitParam), 20)) : 5;
  const items = await listReadyForProduction(limit);
  console.log(`Casos listos para preflight Produccion revisados: ${items.length}`);

  for (const item of items) {
    const built = buildSandboxPayload(item);
    const existing = await findExistingTransaction(built.tranId, built.entityId, 'production');
    const label = `${item.vendor_name ?? 'Proveedor sin nombre'} F-${built.tranId} entity ${built.entityId}`;
    if (existing) {
      console.log(`DUPLICADO: ${label} ya existe como ${existing.type} ${existing.id}`);
    } else {
      console.log(`OK_NO_EXISTE: ${label}`);
    }
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message || error.stack || String(error));
  } else {
    console.error(error);
  }
  process.exit(1);
});
