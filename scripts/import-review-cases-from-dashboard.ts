import fs from 'node:fs';
import path from 'node:path';

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
    value = value.replace(/^['\"]|['\"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

import { db } from '../src/lib/db/client';

type ErrorReal = {
  folio: string;
  entity: number;
  error: string;
};

type RevisionOc = {
  folio: string;
  entity: number;
  referencia_account: number;
  categoria_oc: string;
  learning_category: string;
  motivo: string;
};

type RechazadaSii = {
  folio: string;
  rut: string;
  razon_social: string;
  motivo: string;
};

type DashboardData = {
  updatedAt: string;
  erroresReales: ErrorReal[];
  revisionOCReferencial: RevisionOc[];
  rechazadasSII: RechazadaSii[];
};

const dashboardPath = path.resolve(
  '/Users/agentegecorp/Projects/mission-control/data/sii-netsuite-dashboard.json',
);

function readDashboard(): DashboardData {
  return JSON.parse(fs.readFileSync(dashboardPath, 'utf8')) as DashboardData;
}

function buildRunId(updatedAt: string) {
  return `dashboard_${updatedAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
}

async function upsertCase(item: {
  sourceRunId: string;
  sourceDocumentId: string;
  vendorName: string;
  vendorRut: string | null;
  folio: string;
  documentType: string;
  bucket: string;
  status: string;
  summaryText: string;
  payloadJson: Record<string, unknown>;
}) {
  await db.query(
    `insert into review_cases (
      source_run_id,
      source_document_id,
      vendor_name,
      vendor_rut,
      folio,
      document_type,
      issue_date,
      reception_date,
      amount_net,
      amount_tax,
      amount_total,
      currency,
      bucket,
      status,
      summary_text,
      payload_json
    ) values (
      $1,$2,$3,$4,$5,$6,null,null,null,null,null,'CLP',$7,$8,$9,$10::jsonb
    )
    on conflict do nothing`,
    [
      item.sourceRunId,
      item.sourceDocumentId,
      item.vendorName,
      item.vendorRut,
      item.folio,
      item.documentType,
      item.bucket,
      item.status,
      item.summaryText,
      JSON.stringify(item.payloadJson),
    ],
  );
}

async function main() {
  const dashboard = readDashboard();
  const sourceRunId = buildRunId(dashboard.updatedAt);

  for (const item of dashboard.erroresReales) {
    await upsertCase({
      sourceRunId,
      sourceDocumentId: `error_real_${item.entity}_${item.folio}`,
      vendorName: `ENTITY ${item.entity}`,
      vendorRut: null,
      folio: item.folio,
      documentType: '33',
      bucket: 'error_real',
      status: 'new',
      summaryText: item.error,
      payloadJson: {
        source: 'mission-control dashboard',
        updatedAt: dashboard.updatedAt,
        classification: {
          bucket: 'error_real',
          reasonCode: 'accounting_error',
          summary: item.error,
        },
        context: {
          entity: item.entity,
          error: item.error,
        },
      },
    });
  }

  for (const item of dashboard.revisionOCReferencial) {
    await upsertCase({
      sourceRunId,
      sourceDocumentId: `revision_oc_${item.entity}_${item.folio}`,
      vendorName: `ENTITY ${item.entity}`,
      vendorRut: null,
      folio: item.folio,
      documentType: '33',
      bucket: 'revision_oc',
      status: 'new',
      summaryText: item.motivo,
      payloadJson: {
        source: 'mission-control dashboard',
        updatedAt: dashboard.updatedAt,
        classification: {
          bucket: 'revision_oc',
          reasonCode: 'missing_purchase_order',
          summary: item.motivo,
        },
        context: {
          entity: item.entity,
          referenciaAccount: item.referencia_account,
          categoriaOc: item.categoria_oc,
          learningCategory: item.learning_category,
          motivo: item.motivo,
        },
      },
    });
  }

  for (const item of dashboard.rechazadasSII) {
    await upsertCase({
      sourceRunId,
      sourceDocumentId: `rechazada_sii_${item.rut}_${item.folio}`,
      vendorName: item.razon_social,
      vendorRut: item.rut,
      folio: item.folio,
      documentType: '33',
      bucket: 'rejected_sii',
      status: 'new',
      summaryText: item.motivo,
      payloadJson: {
        source: 'mission-control dashboard',
        updatedAt: dashboard.updatedAt,
        classification: {
          bucket: 'rejected_sii',
          reasonCode: 'sii_rejected_missing_oc_reference',
          summary: item.motivo,
        },
        context: {
          rut: item.rut,
          razonSocial: item.razon_social,
          motivo: item.motivo,
        },
      },
    });
  }

  const result = await db.query(
    `select id, source_document_id, vendor_name, folio, bucket, status, created_at
     from review_cases
     where source_run_id = $1
     order by created_at desc`,
    [sourceRunId],
  );

  console.log(JSON.stringify({ sourceRunId, inserted: result.rows.length, items: result.rows }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
