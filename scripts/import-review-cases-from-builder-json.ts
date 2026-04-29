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

type BuilderCase = {
  case_id: string;
  source_system: string;
  supplier_rut: string;
  supplier_name: string;
  folio: string;
  document_type: number | null;
  document_date: string | null;
  reception_date: string | null;
  amount_total: number | null;
  vendor_id_proposed: number | null;
  account_id_proposed: number | null;
  oc_category: string | null;
  review_reason: string | null;
  engine_note: string | null;
  review_status: string | null;
  assigned_to: string | null;
};

const inputPath = '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/dashboard_mvp/review_mvp/data/review_cases.json';

function bucketFromCase(item: BuilderCase) {
  if ((item.review_reason || '').toLowerCase().includes('sin cuenta contable')) return 'error_real';
  if ((item.oc_category || '').toUpperCase() === 'RECHAZO_SII') return 'rejected_sii';
  return 'revision_oc';
}

function summaryFromCase(item: BuilderCase) {
  const amountText = typeof item.amount_total === 'number'
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.amount_total)
    : null;
  return [item.supplier_name, amountText, item.review_reason].filter(Boolean).join(' · ');
}

async function main() {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const items = JSON.parse(raw) as BuilderCase[];
  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    const sourceDocumentId = `builder_${item.case_id}`;
    const bucket = bucketFromCase(item);
    const summaryText = summaryFromCase(item);
    const exists = await db.query(`select id from review_cases where source_document_id = $1 limit 1`, [sourceDocumentId]);

    const payloadJson = {
      source: 'builder review_cases.json',
      classification: {
        bucket,
        summary: item.review_reason,
      },
      context: {
        supplierRut: item.supplier_rut,
        vendorIdProposed: item.vendor_id_proposed,
        accountIdProposed: item.account_id_proposed,
        ocCategory: item.oc_category,
        engineNote: item.engine_note,
        assignedTo: item.assigned_to,
        reviewStatus: item.review_status,
      },
    };

    if (exists.rows[0]?.id) {
      await db.query(
        `update review_cases
         set vendor_name = $2,
             vendor_rut = $3,
             folio = $4,
             document_type = $5,
             issue_date = $6,
             reception_date = $7,
             amount_total = $8,
             bucket = $9,
             status = 'new',
             summary_text = $10,
             payload_json = $11::jsonb,
             updated_at = now()
         where id = $1`,
        [
          exists.rows[0].id,
          item.supplier_name,
          item.supplier_rut,
          item.folio,
          item.document_type ? String(item.document_type) : null,
          item.document_date,
          item.reception_date,
          item.amount_total,
          bucket,
          summaryText,
          JSON.stringify(payloadJson),
        ],
      );
      updated += 1;
      continue;
    }

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
        $1,$2,$3,$4,$5,$6,$7,$8,null,null,$9,'CLP',$10,'new',$11,$12::jsonb
      )`,
      [
        'builder_april_2026',
        sourceDocumentId,
        item.supplier_name,
        item.supplier_rut,
        item.folio,
        item.document_type ? String(item.document_type) : null,
        item.document_date,
        item.reception_date,
        item.amount_total,
        bucket,
        summaryText,
        JSON.stringify(payloadJson),
      ],
    );
    inserted += 1;
  }

  console.log(JSON.stringify({ inputPath, total: items.length, inserted, updated }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
