import fs from 'node:fs';
import path from 'node:path';
import { buildSandboxPayload, findExistingTransaction, requestNetSuite } from '@/lib/netsuite/sandbox-publisher';

function loadEnvFile(filename: string) {
  const filePath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
}

function argValue(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function expectedNetSuiteType(recordType: string) {
  if (recordType === 'vendorcredit') return 'VendCred';
  return 'VendBill';
}

function normalizeAmount(value: unknown) {
  const numeric = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? Math.abs(Math.round(numeric)) : null;
}

function numericId(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value ?? '').replace(/[^0-9]/g, '');
    if (normalized) return normalized;
  }
  return '';
}

function sqlString(value: string) {
  return value.replace(/'/g, "''");
}

function normalizeRut(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[^0-9K]/g, '');
}

function rutBody(value: unknown) {
  const normalized = normalizeRut(value);
  return normalized.length > 1 ? normalized.slice(0, -1) : normalized;
}

function buildOcManagedMonitorKey(item: Record<string, unknown>) {
  const payload = (item.payload_json ?? {}) as { context?: Record<string, unknown>; document?: Record<string, unknown> };
  const context = payload.context ?? {};
  const document = payload.document ?? {};
  const documentType = String(document.documentType ?? item.document_type ?? '');
  return {
    recordType: documentType === '61' ? 'vendorcredit' : 'vendorbill',
    tranId: String(item.folio ?? document.folio ?? '').trim(),
    entityId: numericId(context.vendorIdProposed, context.entity, document.vendorId, document.entityId),
    payload: {},
  };
}

async function fetchTransactionHeader(id: string) {
  const result = await requestNetSuite(
    'POST',
    '/services/rest/query/v1/suiteql',
    {
      q: `SELECT id, type, tranId, entity, foreigntotal FROM transaction WHERE id = ${Number(id)}`,
    },
    { prefer: 'transient' },
    'production',
  );

  if (!result.success) {
    throw new Error(`No se pudo leer transaccion Produccion ${id}: HTTP ${result.status}`);
  }

  const body = result.body as { items?: Array<Record<string, unknown>> };
  return body.items?.[0] ?? null;
}

async function findActiveVendorByRut(item: Record<string, unknown>) {
  const body = rutBody(item.vendor_rut);
  if (!body) return null;

  const result = await requestNetSuite(
    'POST',
    '/services/rest/query/v1/suiteql',
    {
      q: `
        SELECT id, entityid, altname, isinactive
        FROM vendor
        WHERE isinactive = 'F'
          AND (
            entityid LIKE '%${sqlString(body)}%'
            OR altname LIKE '%${sqlString(body)}%'
          )
      `,
    },
    { prefer: 'transient' },
    'production',
  );

  if (!result.success) {
    throw new Error(`No se pudo buscar proveedor Produccion ${item.vendor_name ?? ''} (${item.vendor_rut ?? ''}): HTTP ${result.status}`);
  }

  const rows = ((result.body as { items?: Array<Record<string, unknown>> }).items ?? [])
    .filter((row) => String(row.id ?? '').match(/^[0-9]+$/));

  if (rows.length !== 1) {
    return null;
  }

  return rows[0];
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const apply = process.argv.includes('--apply');
  const limitParam = Number(argValue('--limit', '300'));
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(Math.trunc(limitParam), 500)) : 300;
  const startDate = argValue('--start-date', '');
  const endDate = argValue('--end-date', '');
  const period = startDate && endDate ? { startDate, endDate } : undefined;
  const ocManagedOnly = process.argv.includes('--oc-managed');

  const { listOcManagedProductionMonitor, listReadyForProduction, markProductionPublishResult, updateReviewCaseVendorEntity } = await import('@/lib/db/queries');
  const cases = ocManagedOnly
    ? await listOcManagedProductionMonitor(limit, period)
    : await listReadyForProduction(limit, period);

  let exactMatches = 0;
  let noExisting = 0;
  let mismatches = 0;
  let missingEntity = 0;

  for (const item of cases) {
    const built = ocManagedOnly ? buildOcManagedMonitorKey(item) : buildSandboxPayload(item);
    if (!built.entityId) {
      const vendor = ocManagedOnly ? await findActiveVendorByRut(item) : null;
      if (vendor?.id) {
        built.entityId = String(vendor.id);
        console.log(`ENTITY_RESOLVED ${apply ? 'APPLY' : 'DRY'} ${item.vendor_name ?? 'Proveedor sin nombre'} (${item.vendor_rut ?? 'sin RUT'}) -> vendor ${vendor.id}`);
        if (apply) {
          await updateReviewCaseVendorEntity(String(item.id), String(vendor.id));
        }
      } else {
        missingEntity += 1;
        console.log(`SIN_ENTITY ${item.vendor_name ?? 'Proveedor sin nombre'} F-${built.tranId}: no se encontro un proveedor NetSuite activo unico por RUT`);
        continue;
      }
    }
    const existing = await findExistingTransaction(built.tranId, built.entityId, 'production');

    if (!existing) {
      noExisting += 1;
      console.log(`NO_EXISTE ${item.vendor_name ?? 'Proveedor sin nombre'} F-${built.tranId}: app ${built.recordType} ${normalizeAmount(item.amount_total)}`);
      continue;
    }

    const header = await fetchTransactionHeader(existing.id);
    const appAmount = normalizeAmount(item.amount_total);
    const nsAmount = normalizeAmount(header?.foreigntotal);
    const expectedType = expectedNetSuiteType(built.recordType);
    const exact =
      header &&
      String(header.tranid ?? header.tranId) === String(built.tranId) &&
      String(header.entity) === String(built.entityId) &&
      String(header.type) === expectedType &&
      appAmount !== null &&
      nsAmount !== null &&
      appAmount === nsAmount;

    if (!exact) {
      mismatches += 1;
      console.log(
        `MISMATCH ${item.vendor_name ?? 'Proveedor sin nombre'} F-${built.tranId}: app ${built.recordType} ${appAmount}, NS ${header?.type} ${nsAmount} id ${existing.id}`,
      );
      if (apply && ocManagedOnly) {
        await markProductionPublishResult({
          caseId: item.id,
          status: 'external_mismatch',
          recordType: built.recordType,
          recordId: existing.id,
          errorText: `Existe en NetSuite Producción pero requiere conciliación: app ${built.recordType} monto ${appAmount ?? 'N/A'}, NetSuite ${header?.type} monto ${nsAmount ?? 'N/A'} id ${existing.id}`,
        });
      }
      continue;
    }

    exactMatches += 1;
    console.log(`MATCH ${apply ? 'APPLY' : 'DRY'} ${item.vendor_name ?? 'Proveedor sin nombre'} F-${built.tranId} -> ${existing.type} ${existing.id}`);

    if (apply) {
      await markProductionPublishResult({
        caseId: item.id,
        status: 'published',
        recordType: built.recordType,
        recordId: existing.id,
        errorText: null,
      });
    }
  }

  console.log(JSON.stringify({ checked: cases.length, exactMatches, noExisting, mismatches, missingEntity, applied: apply, ocManagedOnly, period }, null, 2));
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message || error.stack || String(error));
  } else {
    console.error(error);
  }
  process.exit(1);
});
