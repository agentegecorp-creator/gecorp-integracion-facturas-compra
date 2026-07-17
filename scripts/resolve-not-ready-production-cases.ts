import fs from 'node:fs';
import path from 'node:path';
import { requestNetSuite } from '@/lib/netsuite/sandbox-publisher';

type ReviewCase = {
  id: string;
  vendor_name: string | null;
  vendor_rut: string | null;
  folio: string | null;
  document_type: string | null;
  issue_date: string | Date | null;
  amount_total: string | number | null;
  bucket: string | null;
  status: string | null;
  production_publish_status: string | null;
  production_publish_error: string | null;
  payload_json: {
    context?: Record<string, unknown>;
    document?: Record<string, unknown>;
  } | null;
};

type NetSuiteRow = Record<string, unknown>;

type Resolution = {
  caseId: string;
  label: string;
  action: 'mark_published' | 'mark_ready' | 'blocked' | 'unchanged';
  reasonCode: string;
  detail: string;
  vendorId?: string;
  recordType?: string;
  recordId?: string;
  applied: boolean;
};

const NATIONAL_CURRENCY_AMOUNT_TOLERANCE_CLP = 5;

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

function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? String(new Date().getUTCFullYear());
  const month = parts.find((part) => part.type === 'month')?.value ?? String(new Date().getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function periodBounds(period: string) {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Periodo invalido: ${period}. Usa YYYY-MM.`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const startDate = `${match[1]}-${match[2]}-01`;
  const next = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  return { startDate, endDate: next };
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

function numericId(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value ?? '').replace(/[^0-9]/g, '');
    if (normalized) return normalized;
  }
  return '';
}

function normalizeAmount(value: unknown) {
  const numeric = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? Math.abs(Math.round(numeric)) : null;
}

function amountsMatch(appAmount: number | null, nsAmount: number | null) {
  if (appAmount === null || nsAmount === null) return false;
  return Math.abs(appAmount - nsAmount) <= NATIONAL_CURRENCY_AMOUNT_TOLERANCE_CLP;
}

function expectedNetSuiteType(documentType: string | null) {
  return String(documentType ?? '') === '61' ? 'VendCred' : 'VendBill';
}

function recordTypeFromNetSuiteType(type: unknown) {
  return String(type ?? '') === 'VendCred' ? 'vendorcredit' : 'vendorbill';
}

function caseLabel(item: ReviewCase) {
  return `${item.vendor_name ?? 'Proveedor sin nombre'} F-${item.folio ?? 'sin folio'}`;
}

async function suiteql(query: string) {
  const result = await requestNetSuite(
    'POST',
    '/services/rest/query/v1/suiteql',
    { q: query },
    { prefer: 'transient' },
    'production',
  );

  if (!result.success) {
    throw new Error(`SuiteQL Produccion fallo HTTP ${result.status}: ${result.raw || JSON.stringify(result.body)}`);
  }

  return ((result.body as { items?: NetSuiteRow[] }).items ?? []);
}

async function findActiveVendorsByRut(vendorRut: string | null) {
  const body = rutBody(vendorRut);
  if (!body) return [];

  return suiteql(`
    SELECT id, entityid, altname, isinactive
    FROM vendor
    WHERE isinactive = 'F'
      AND (
        entityid LIKE '%${sqlString(body)}%'
        OR altname LIKE '%${sqlString(body)}%'
      )
  `);
}

async function findTransactionsByFolio(folio: string, vendorIds?: string[]) {
  const safeFolio = sqlString(folio);
  const vendorClause = vendorIds?.length
    ? `AND entity IN (${vendorIds.map((id) => Number(id)).filter(Number.isFinite).join(',')})`
    : '';

  return suiteql(`
    SELECT id, type, tranid, entity, trandate, total, foreigntotal, status
    FROM transaction
    WHERE tranid = '${safeFolio}'
      AND type IN ('VendBill', 'VendCred')
      ${vendorClause}
  `);
}

function validateExistingTransaction(item: ReviewCase, transaction: NetSuiteRow, vendorId: string) {
  const appAmount = normalizeAmount(item.amount_total);
  const nsAmount = normalizeAmount(transaction.total ?? transaction.foreigntotal);
  const expectedType = expectedNetSuiteType(item.document_type);
  const actualType = String(transaction.type ?? '');
  const actualEntity = String(transaction.entity ?? '');

  return {
    exact:
      actualEntity === vendorId &&
      actualType === expectedType &&
      amountsMatch(appAmount, nsAmount),
    appAmount,
    nsAmount,
    expectedType,
    actualType,
    actualEntity,
  };
}

async function listNotReadyCases(limit: number, startDate: string, endDate: string) {
  const { db } = await import('@/lib/db/client');
  const result = await db.query(
    `select id,
            vendor_name,
            vendor_rut,
            folio,
            document_type,
            issue_date,
            amount_total,
            bucket,
            status,
            coalesce(production_publish_status, 'not_ready') as production_publish_status,
            production_publish_error,
            payload_json
     from review_cases
     where issue_date >= $2::date
       and issue_date < $3::date
       and coalesce(production_publish_status, 'not_ready') = 'not_ready'
     order by updated_at desc nulls last, created_at desc
     limit $1`,
    [limit, startDate, endDate],
  );

  return result.rows as ReviewCase[];
}

async function updateProductionStatusReady(caseId: string, reasonCode: string) {
  const { db } = await import('@/lib/db/client');
  await db.query(
    `update review_cases
     set production_publish_status = 'ready',
         production_publish_error = $2,
         updated_at = now()
     where id = $1`,
    [caseId, reasonCode],
  );
}

async function setBlockedReason(caseId: string, reasonCode: string, detail: string) {
  const { db } = await import('@/lib/db/client');
  await db.query(
    `update review_cases
     set production_publish_error = $2,
         updated_at = now()
     where id = $1`,
    [caseId, `${reasonCode}: ${detail}`.slice(0, 1000)],
  );
}

async function productionStatusCounts(startDate: string, endDate: string) {
  const { db } = await import('@/lib/db/client');
  const result = await db.query(
    `select coalesce(production_publish_status, 'not_ready') as status,
            count(*)::int as total
     from review_cases
     where issue_date >= $1::date
       and issue_date < $2::date
     group by 1
     order by 1`,
    [startDate, endDate],
  );

  return result.rows as Array<{ status: string; total: number }>;
}

async function resolveCase(item: ReviewCase, apply: boolean): Promise<Resolution> {
  const label = caseLabel(item);
  if (!item.folio) {
    if (apply) await setBlockedReason(item.id, 'missing_folio', 'Caso sin folio para buscar en NetSuite');
    return {
      caseId: item.id,
      label,
      action: 'blocked',
      reasonCode: 'missing_folio',
      detail: 'Caso sin folio para buscar en NetSuite',
      applied: apply,
    };
  }

  const payload = item.payload_json ?? {};
  const context = payload.context ?? {};
  const document = payload.document ?? {};
  const existingVendorId = numericId(context.vendorIdProposed, context.entity, document.vendorId, document.entityId);
  const vendors = existingVendorId
    ? [{ id: existingVendorId }]
    : await findActiveVendorsByRut(item.vendor_rut);
  const vendorIds = vendors
    .map((vendor) => String(vendor.id ?? ''))
    .filter((id) => /^\d+$/.test(id));

  if (vendorIds.length === 0) {
    const detail = `No se encontro proveedor activo unico por RUT ${item.vendor_rut ?? 'sin RUT'}`;
    if (apply) await setBlockedReason(item.id, 'missing_vendor_match', detail);
    return {
      caseId: item.id,
      label,
      action: 'blocked',
      reasonCode: 'missing_vendor_match',
      detail,
      applied: apply,
    };
  }

  if (vendorIds.length > 1) {
    const detail = `Multiples proveedores activos por RUT ${item.vendor_rut}: ${vendorIds.join(', ')}`;
    if (apply) await setBlockedReason(item.id, 'multiple_vendor_matches', detail);
    return {
      caseId: item.id,
      label,
      action: 'blocked',
      reasonCode: 'multiple_vendor_matches',
      detail,
      applied: apply,
    };
  }

  const vendorId = vendorIds[0];
  const vendorTransactions = await findTransactionsByFolio(item.folio, [vendorId]);
  const matchingTransaction = vendorTransactions.find((transaction) => validateExistingTransaction(item, transaction, vendorId).exact);

  if (matchingTransaction) {
    const recordType = recordTypeFromNetSuiteType(matchingTransaction.type);
    const recordId = String(matchingTransaction.id ?? '');
    if (apply) {
      const { markProductionPublishResult, updateReviewCaseVendorEntity } = await import('@/lib/db/queries');
      await updateReviewCaseVendorEntity(item.id, vendorId);
      await markProductionPublishResult({
        caseId: item.id,
        status: 'published',
        recordType,
        recordId,
        errorText: null,
      });
    }

    return {
      caseId: item.id,
      label,
      action: 'mark_published',
      reasonCode: 'external_already_published',
      detail: `Existe en NetSuite Produccion como ${matchingTransaction.type} ${recordId}`,
      vendorId,
      recordType,
      recordId,
      applied: apply,
    };
  }

  if (vendorTransactions.length > 0) {
    const checks = vendorTransactions
      .map((transaction) => validateExistingTransaction(item, transaction, vendorId))
      .map((check) => `${check.actualType} entity ${check.actualEntity} monto ${check.nsAmount ?? 'N/A'}`)
      .join('; ');
    const detail = `Existe folio con proveedor pero no calza tipo/monto esperado: ${checks}`;
    if (apply) await setBlockedReason(item.id, 'external_mismatch', detail);
    return {
      caseId: item.id,
      label,
      action: 'blocked',
      reasonCode: 'external_mismatch',
      detail,
      vendorId,
      applied: apply,
    };
  }

  const globalTransactions = await findTransactionsByFolio(item.folio);
  if (globalTransactions.length > 0) {
    const detail = `El folio existe en otro proveedor: ${globalTransactions
      .map((transaction) => `${transaction.type ?? 'tipo'} ${transaction.id ?? 'sin id'} entity ${transaction.entity ?? 'sin entity'}`)
      .join('; ')}`;
    if (apply) await setBlockedReason(item.id, 'external_mismatch', detail);
    return {
      caseId: item.id,
      label,
      action: 'blocked',
      reasonCode: 'external_mismatch',
      detail,
      vendorId,
      applied: apply,
    };
  }

  if (item.status !== 'resolved') {
    const detail = `Caso aun no esta resuelto por mesa: status=${item.status ?? 'sin status'}`;
    if (apply) await setBlockedReason(item.id, 'waiting_internal_decision', detail);
    return {
      caseId: item.id,
      label,
      action: 'blocked',
      reasonCode: 'waiting_internal_decision',
      detail,
      vendorId,
      applied: apply,
    };
  }

  const accountId = numericId(document.accountId, context.accountIdProposed, context.referenciaAccount);
  if (!accountId) {
    const detail = 'Caso resuelto pero sin cuenta contable NetSuite';
    if (apply) await setBlockedReason(item.id, 'missing_account', detail);
    return {
      caseId: item.id,
      label,
      action: 'blocked',
      reasonCode: 'missing_account',
      detail,
      vendorId,
      applied: apply,
    };
  }

  if (apply) {
    const { updateReviewCaseVendorEntity } = await import('@/lib/db/queries');
    await updateReviewCaseVendorEntity(item.id, vendorId);
    await updateProductionStatusReady(item.id, 'ready_after_vendor_resolution');
  }

  return {
    caseId: item.id,
    label,
    action: 'mark_ready',
    reasonCode: 'ready_after_vendor_resolution',
    detail: `Proveedor ${vendorId} resuelto y sin duplicado en NetSuite Produccion`,
    vendorId,
    applied: apply,
  };
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const apply = process.argv.includes('--apply');
  const period = argValue('--period', currentPeriod());
  const limitParam = Number(argValue('--limit', '100'));
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(Math.trunc(limitParam), 500)) : 100;
  const { startDate, endDate } = periodBounds(period);
  const cases = await listNotReadyCases(limit, startDate, endDate);
  const results: Resolution[] = [];

  for (const item of cases) {
    results.push(await resolveCase(item, apply));
  }

  const counts = await productionStatusCounts(startDate, endDate);
  for (const result of results) {
    console.log(`${apply ? 'APPLY' : 'DRY'} ${result.action.toUpperCase()} ${result.label}: ${result.reasonCode} - ${result.detail}`);
  }
  console.log(JSON.stringify({ period, checked: cases.length, applied: apply, counts, results }, null, 2));
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message || error.stack || String(error));
  } else {
    console.error(error);
  }
  process.exit(1);
});
