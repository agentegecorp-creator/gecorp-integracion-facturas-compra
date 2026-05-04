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

function normalizeAccountEntry(value: any) {
  if (!value) return null;
  if (Array.isArray(value)) {
    return {
      account: value[0] ?? null,
      class: value[1] ?? null,
      department: value[2] ?? null,
      location: value[3] ?? null,
    };
  }
  if (typeof value === 'object') {
    return {
      account: value.account ?? value.accountId ?? null,
      class: value.class ?? value.classId ?? null,
      department: value.department ?? value.departmentId ?? null,
      location: value.location ?? value.locationId ?? null,
    };
  }
  return null;
}

async function main() {
  const gonzaloByEntity = loadJson(path.join(BASE, 'provider_rules_from_gonzalo_account_mapping.json')) as Record<string, any>;
  const entityAccountMerged = loadJson(path.join(BASE, 'input/entity_account.merged.json')) as Record<string, any>;
  const providerRulesByRut = loadJson(path.join(BASE, 'rules/provider_rules.json')) as Record<string, any>;

  const cases = await db.query(`
    select id, vendor_rut, payload_json
    from review_cases
    where issue_date >= DATE '2026-04-01' and issue_date < DATE '2026-06-01'
    order by created_at desc
  `);

  let updated = 0;
  const samples: any[] = [];

  for (const row of cases.rows) {
    const payload = row.payload_json || {};
    const context = { ...(payload.context || {}) };
    const entity = context.entity ? String(context.entity) : null;
    const rut = normalizeRut(row.vendor_rut || context.rut || context.supplierRut);

    let source = 'none';
    let account = null;
    let className = null;
    let department = null;
    let location = null;
    let ocPolicy = null;

    if (entity && gonzaloByEntity[entity]) {
      const entry = gonzaloByEntity[entity];
      source = 'gonzalo_mapping';
      account = entry.defaults?.account || null;
      className = entry.defaults?.class || null;
      department = entry.defaults?.department || null;
      location = entry.defaults?.location || null;
      ocPolicy = entry.ocPolicy || null;
    } else if (entity && entityAccountMerged[entity]) {
      const entry = normalizeAccountEntry(entityAccountMerged[entity]);
      source = 'entity_account_merged';
      account = entry?.account ?? null;
      className = entry?.class ?? null;
      department = entry?.department ?? null;
      location = entry?.location ?? null;
    } else if (rut && providerRulesByRut[rut]) {
      const entry = providerRulesByRut[rut];
      source = 'provider_rules_by_rut';
      account = entry.defaults?.accountName
        ? `${entry.defaults?.accountNumber || ''}${entry.defaults?.accountNumber ? ' - ' : ''}${entry.defaults.accountName}`
        : (entry.defaults?.account || null);
      className = entry.defaults?.class || entry.defaults?.classId || null;
      department = entry.defaults?.department || entry.defaults?.departmentId || null;
      location = entry.defaults?.location || entry.defaults?.locationId || null;
      ocPolicy = entry.ocPolicy || null;
    }

    if (!account && !className && !department && !location && !ocPolicy) {
      continue;
    }

    const nextPayload = {
      ...payload,
      context: {
        ...context,
        accountSuggestedB2: account,
        classSuggestedB2: className,
        departmentSuggestedB2: department,
        locationSuggestedB2: location,
        ocPolicySuggestedB2: ocPolicy,
        sourceSuggestedB2: source,
      },
    };

    await db.query(
      `update review_cases set payload_json = $2::jsonb, updated_at = now() where id = $1`,
      [row.id, JSON.stringify(nextPayload)],
    );

    updated += 1;
    if (samples.length < 8) {
      samples.push({ id: row.id, rut, entity, source, account, className, department, location, ocPolicy });
    }
  }

  console.log(JSON.stringify({ updated, samples }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
