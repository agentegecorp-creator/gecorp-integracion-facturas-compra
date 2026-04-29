import fs from 'node:fs';
import path from 'node:path';
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

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function loadEntityMap() {
  const csvPath = '/Users/agentegecorp/Projects/mission-control/data/clientes-netsuite.csv';
  const content = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const idIndex = headers.indexOf('ID interno');
  const nameIndex = headers.indexOf('Nombre');
  const companyIndex = headers.indexOf('Nombre de la empresa');
  const map = new Map<number, string>();

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const id = Number(cols[idIndex]);
    if (!Number.isFinite(id)) continue;
    const company = (cols[companyIndex] || '').trim();
    const name = (cols[nameIndex] || '').trim();
    map.set(id, company || name || `ENTITY ${id}`);
  }

  return map;
}

async function dedupeCases() {
  const duplicates = await db.query(`
    select source_document_id, array_agg(id order by created_at desc) as ids
    from review_cases
    where source_document_id is not null
    group by source_document_id
    having count(*) > 1
  `);

  let deleted = 0;

  for (const row of duplicates.rows) {
    const ids = row.ids as string[];
    const keepId = ids[0];
    const deleteIds = ids.slice(1);

    if (deleteIds.length > 0) {
      await db.query(`delete from review_cases where id = any($1::uuid[]) and id <> $2`, [deleteIds, keepId]);
      deleted += deleteIds.length;
    }
  }

  return deleted;
}

async function enrichEntityNames() {
  const entityMap = loadEntityMap();
  const result = await db.query(`
    select id, vendor_name, payload_json
    from review_cases
    where vendor_name like 'ENTITY %'
    order by created_at desc
  `);

  let updated = 0;

  for (const row of result.rows) {
    const payload = row.payload_json || {};
    const entity = payload?.context?.entity;
    if (typeof entity !== 'number') continue;

    const resolvedName = entityMap.get(entity);
    if (!resolvedName || resolvedName === row.vendor_name) continue;

    await db.query(`update review_cases set vendor_name = $2 where id = $1`, [row.id, resolvedName]);
    updated += 1;
  }

  return updated;
}

async function main() {
  const deleted = await dedupeCases();
  const updated = await enrichEntityNames();
  const summary = await db.query(`
    select bucket, count(*)::int as total
    from review_cases
    group by bucket
    order by bucket
  `);

  console.log(JSON.stringify({ deletedDuplicates: deleted, updatedEntityNames: updated, buckets: summary.rows }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
