// LEGACY / TRANSICIÓN
// Este script fue absorbido por el flujo unificado oficial.
// La ruta oficial actual es: scripts/sync-review-cases-from-pipeline.ts

import fs from 'node:fs';
import { db } from '../src/lib/db/client';

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function readDelimited(path: string) {
  const raw = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? '']));
  });
}

function buildEntityNameMap() {
  const map = new Map<string, string>();

  const enrichedRows = readDelimited('/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/salida_revision_gonzalo_feb2026_enriquecida.csv');
  for (const row of enrichedRows) {
    const entity = String(row['entity'] || row['entity_id'] || row['ID interno'] || row[''] || '').trim();
    const vendor = String(row['proveedor_nombre_ns'] || row['supplier_name_ns'] || row['Nombre NS'] || row['razon_social'] || row['Razon Social'] || '').trim();
    const fallback = String(row['RazonSocial'] || row['Proveedor'] || row['razon_social_sii'] || '').trim();
    const resolved = vendor || fallback;
    if (entity && resolved && !map.has(entity)) map.set(entity, resolved);
  }

  const ocRows = readDelimited('/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/provider_rules_oc_obligatoria_reference.csv');
  for (const row of ocRows) {
    const entity = String(row['entity_id'] || row['entity'] || '').trim();
    const vendor = String(row['supplier_name_ns'] || row['proveedor_nombre_ns'] || row['supplier_name'] || '').trim();
    if (entity && vendor && !map.has(entity)) map.set(entity, vendor);
  }

  return map;
}

async function main() {
  const entityMap = buildEntityNameMap();
  const result = await db.query(`
    select id, vendor_name, payload_json
    from review_cases
    where vendor_name like 'ENTITY %'
    order by created_at desc
  `);

  let updated = 0;

  for (const row of result.rows) {
    const entity = row.payload_json?.context?.entity;
    if (typeof entity !== 'number') continue;

    const resolved = entityMap.get(String(entity));
    if (!resolved || resolved === row.vendor_name) continue;

    await db.query(`update review_cases set vendor_name = $2 where id = $1`, [row.id, resolved]);
    updated += 1;
  }

  const sample = await db.query(`
    select vendor_name, folio, bucket
    from review_cases
    where bucket in ('revision_oc', 'error_real')
    order by created_at desc
    limit 12
  `);

  console.log(JSON.stringify({ updated, sample: sample.rows }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
