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
  company_rut?: string;
  supplier_rut: string;
  supplier_name: string;
  folio: string;
  document_type: number | null;
  document_type_label?: string | null;
  document_date: string | null;
  reception_date: string | null;
  accounting_date_proposed?: string | null;
  due_date?: string | null;
  due_date_rule?: string | null;
  payment_date?: string | null;
  payment_terms_id?: number | null;
  payment_terms_label?: string | null;
  service_description?: string | null;
  amount_net?: number | null;
  amount_vat?: number | null;
  amount_vat_non_recoverable?: number | null;
  amount_exempt?: number | null;
  amount_fixed_asset_net?: number | null;
  amount_fixed_asset_vat?: number | null;
  amount_common_use_vat?: number | null;
  amount_no_credit_tax?: number | null;
  amount_unretained_vat?: number | null;
  amount_other_tax?: number | null;
  amount_total: number | null;
  amount_total_calculated?: number | null;
  amount_total_delta?: number | null;
  amount_reconciliation_status?: string | null;
  vendor_id_proposed: number | null;
  account_id_proposed: number | null;
  document_type_ns_proposed?: number | null;
  location_id_proposed?: number | null;
  department_id_proposed?: number | null;
  class_id_proposed?: number | null;
  requester_id_proposed?: number | null;
  approver_ids_proposed?: number[] | null;
  approver_group_proposed?: string | null;
  approver_source?: string | null;
  oc_category: string | null;
  expense_category?: string | null;
  posting_status?: string | null;
  confidence_level?: string | null;
  review_reason: string | null;
  engine_note: string | null;
  review_status: string | null;
  assigned_to: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  resolved_at?: string | null;
};

const inputPath = '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/dashboard_mvp/review_mvp/data/review_cases.json';

function bucketFromCase(item: BuilderCase) {
  if (String(item.document_type) === '61') return 'pending_review';
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
      document: {
        sourceSystem: item.source_system,
        companyRut: item.company_rut,
        documentType: item.document_type ? String(item.document_type) : null,
        documentTypeLabel: item.document_type_label,
        issueDate: item.document_date,
        receptionDate: item.reception_date,
        accountingDateProposed: item.accounting_date_proposed,
        dueDate: item.due_date,
        dueDateRule: item.due_date_rule,
        paymentDate: item.payment_date,
        paymentTermsLabel: item.payment_terms_label,
        serviceDescription: item.service_description,
        amountNet: item.amount_net,
        amountVat: item.amount_vat,
        amountVatNonRecoverable: item.amount_vat_non_recoverable,
        amountExempt: item.amount_exempt,
        amountFixedAssetNet: item.amount_fixed_asset_net,
        amountFixedAssetVat: item.amount_fixed_asset_vat,
        amountCommonUseVat: item.amount_common_use_vat,
        amountNoCreditTax: item.amount_no_credit_tax,
        amountUnretainedVat: item.amount_unretained_vat,
        amountOtherTax: item.amount_other_tax,
        amountTotal: item.amount_total,
        amountTotalCalculated: item.amount_total_calculated,
        amountTotalDelta: item.amount_total_delta,
        amountReconciliationStatus: item.amount_reconciliation_status,
      },
      context: {
        supplierRut: item.supplier_rut,
        vendorIdProposed: item.vendor_id_proposed,
        accountIdProposed: item.account_id_proposed,
        documentTypeNsProposed: item.document_type_ns_proposed,
        locationIdProposed: item.location_id_proposed,
        departmentIdProposed: item.department_id_proposed,
        classIdProposed: item.class_id_proposed,
        requesterIdProposed: item.requester_id_proposed,
        approverIdsProposed: item.approver_ids_proposed,
        approverGroup: item.approver_group_proposed,
        approverSource: item.approver_source,
        ocCategory: item.oc_category,
        expenseCategory: item.expense_category || item.oc_category,
        postingStatus: item.posting_status,
        confidenceLevel: item.confidence_level,
        paymentTermsLabel: item.payment_terms_label,
        accountingDateProposed: item.accounting_date_proposed,
        dueDate: item.due_date,
        paymentDate: item.payment_date,
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
             amount_net = $8,
             amount_tax = $9,
             amount_total = $10,
             bucket = $11,
             status = 'new',
             summary_text = $12,
             payload_json = $13::jsonb,
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
          item.amount_net,
          item.amount_vat,
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
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'CLP',$12,'new',$13,$14::jsonb
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
        item.amount_net,
        item.amount_vat,
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
