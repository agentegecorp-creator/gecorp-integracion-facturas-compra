import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/lib/db/client';

const BASE = '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite';

function loadJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeRut(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

async function main() {
  const suppliers = loadJson(path.join(BASE, 'proveedores_nacionales_operativos_18m.json')).suppliers as Array<Record<string, any>>;
  const rutToEntity = new Map<string, number>();
  for (const supplier of suppliers) {
    const rut = normalizeRut(supplier.rut);
    const vendorId = Number(supplier.vendorId || 0);
    if (rut && vendorId && !rutToEntity.has(rut)) {
      rutToEntity.set(rut, vendorId);
    }
  }

  const cases = await db.query(`
    select id, vendor_rut, payload_json
    from review_cases
    where issue_date >= DATE '2026-04-01' and issue_date < DATE '2026-06-01'
    order by created_at desc
  `);

  let updated = 0;
  const samples: any[] = [];

  for (const row of cases.rows) {
    const rut = normalizeRut(row.vendor_rut);
    const entity = rutToEntity.get(rut);
    if (!entity) continue;

    const payload = row.payload_json || {};
    const context = { ...(payload.context || {}) };
    if (context.entity === entity) continue;

    const nextPayload = {
      ...payload,
      context: {
        ...context,
        entity,
        entityResolvedFromB2: 'proveedores_nacionales_operativos_18m.json',
      },
    };

    await db.query(`update review_cases set payload_json = $2::jsonb, updated_at = now() where id = $1`, [row.id, JSON.stringify(nextPayload)]);
    updated += 1;
    if (samples.length < 10) samples.push({ id: row.id, rut, entity });
  }

  console.log(JSON.stringify({ updated, samples }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
