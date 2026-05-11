import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/lib/db/client';
import generatedCatalogs from '../src/lib/review/generated-catalogs.json';

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

type VendorMaster = {
  termsId?: string | null;
  termsName?: string | null;
  tef?: boolean;
  approverIds?: number[];
  approverNames?: string | null;
  classId?: string | null;
  className?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  dimensionSource?: {
    billId?: string | null;
    tranId?: string | null;
    tranDate?: string | null;
  };
};

type MasterPayload = {
  vendors: Record<string, VendorMaster>;
};

const termsById = new Map(
  generatedCatalogs.paymentTermsOptions.map((term) => [
    term.value,
    { name: term.name, daysUntilDue: term.daysUntilDue },
  ]),
);

function normalizeDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addDaysIso(value: unknown, days: number) {
  const date = normalizeDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function proposedPaymentDateIso(value: unknown, withTef: boolean) {
  const date = normalizeDate(value);
  if (!date) return null;
  const day = date.getUTCDay();
  if (withTef) {
    if (day === 4) date.setUTCDate(date.getUTCDate() + 1);
    else if (day !== 5) date.setUTCDate(date.getUTCDate() - ((day - 5 + 7) % 7));
  } else if (day === 4 || day === 5) {
    date.setUTCDate(date.getUTCDate() + ((8 - day) % 7));
  } else {
    date.setUTCDate(date.getUTCDate() - ((day - 1 + 7) % 7));
  }
  return date.toISOString();
}

function paymentDateRule(withTef: boolean) {
  return withTef
    ? 'Regla pago GECORP con TEF: viernes según vencimiento base'
    : 'Regla pago GECORP sin TEF: lunes según vencimiento base';
}

function parseCatalogId(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error('Uso: npx tsx scripts/backfill-review-master-data-from-json.ts /ruta/master.json');
  }

  const master = JSON.parse(fs.readFileSync(filePath, 'utf8')) as MasterPayload;

  return db.connect().then(async (client) => {
    try {
      await client.query('begin');
      const result = await client.query(
        `select id, issue_date, payload_json
         from review_cases
         where payload_json->'context'->>'entity' ~ '^[0-9]+$'`,
      );

      let updated = 0;
      for (const row of result.rows) {
        const payload = row.payload_json ?? {};
        const document = { ...(payload.document ?? {}) };
        const context = { ...(payload.context ?? {}) };
        const entityId = String(context.entity ?? '');
        const vendor = master.vendors[entityId];
        if (!vendor) continue;

        const termId = vendor.termsId ? String(vendor.termsId) : null;
        if (termId) {
          const term = termsById.get(termId);
          const termName = vendor.termsName || term?.name || `Término NetSuite ${termId}`;
          const days = term?.daysUntilDue ?? 0;
          document.paymentTermsId = parseCatalogId(termId);
          document.paymentTermsLabel = termName;
          context.paymentTermsId = parseCatalogId(termId);
          context.paymentTermsLabel = termName;
          context.terminosNs = termName;
          context.diasCreditoNs = days;

          const issueDate = document.issueDate ?? row.issue_date;
          const dueDate = addDaysIso(issueDate, days);
          if (dueDate) {
            document.dueDate = dueDate;
            document.dueDateRule = `Vencimiento base: fecha documento + término NetSuite ${termName} (${days} días)`;
            context.dueDate = dueDate;
          }
        }

        {
          context.pagoPorTef = Boolean(vendor.tef);
          const paymentDate = proposedPaymentDateIso(document.dueDate ?? context.dueDate, Boolean(vendor.tef));
          if (paymentDate) {
            document.paymentDate = paymentDate;
            document.paymentDateRule = paymentDateRule(Boolean(vendor.tef));
            context.paymentDate = paymentDate;
            context.paymentDateRule = document.paymentDateRule;
          }
        }

        if (vendor.approverNames) {
          context.approvalGroup = vendor.approverNames;
          context.approverIdsProposed = vendor.approverIds ?? [];
          context.approverSource = 'NetSuite vendor master';
        }

        if (vendor.classId) {
          document.classId = parseCatalogId(vendor.classId);
          context.classIdProposed = parseCatalogId(vendor.classId);
          context.classCorrecta = vendor.className || vendor.classId;
        }

        if (vendor.departmentId) {
          document.departmentId = parseCatalogId(vendor.departmentId);
          context.departmentIdProposed = parseCatalogId(vendor.departmentId);
          context.departmentCorrecta = vendor.departmentName || vendor.departmentId;
        }

        if (vendor.locationId) {
          document.locationId = parseCatalogId(vendor.locationId);
          context.locationIdProposed = parseCatalogId(vendor.locationId);
          context.locationCorrecta = vendor.locationName || vendor.locationId;
        }

        if (vendor.dimensionSource) {
          context.dimensionSource = {
            type: 'NetSuite última Vendor Bill',
            ...vendor.dimensionSource,
          };
        }

        payload.document = document;
        payload.context = context;

        await client.query(
          `update review_cases
           set payload_json = $2::jsonb,
               updated_at = now()
           where id = $1`,
          [row.id, JSON.stringify(payload)],
        );
        updated += 1;
      }

      await client.query('commit');
      console.log(`master-data backfill updated ${updated} review_cases`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
      await db.end();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
