import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { approvalGroupValueFromIds } from '@/lib/review/catalogs';

type BuilderCase = {
  case_id: string;
  source_system?: string;
  company_rut?: string;
  supplier_rut?: string;
  supplier_name?: string;
  folio?: string;
  document_type?: number | string | null;
  document_type_label?: string | null;
  document_date?: string | null;
  reception_date?: string | null;
  accounting_date_proposed?: string | null;
  due_date?: string | null;
  due_date_rule?: string | null;
  payment_date?: string | null;
  payment_date_rule?: string | null;
  payment_terms_label?: string | null;
  payment_terms_id?: number | null;
  service_description?: string | null;
  amount_net?: number | null;
  amount_vat?: number | null;
  amount_vat_non_recoverable?: number | null;
  amount_exempt?: number | null;
  amount_common_use_vat?: number | null;
  amount_no_credit_tax?: number | null;
  amount_other_tax?: number | null;
  amount_total?: number | null;
  amount_total_calculated?: number | null;
  amount_total_delta?: number | null;
  amount_reconciliation_status?: string | null;
  vendor_id_proposed?: number | null;
  account_id_proposed?: number | null;
  document_type_ns_proposed?: number | null;
  location_id_proposed?: number | null;
  department_id_proposed?: number | null;
  class_id_proposed?: number | null;
  requester_id_proposed?: number | null;
  approver_ids_proposed?: number[] | null;
  approver_group_proposed?: string | null;
  approver_source?: string | null;
  account_label_proposed?: string | null;
  oc_policy_proposed?: string | null;
  oc_reference_proposed?: string | null;
  payment_tef_label?: string | null;
  oc_category?: string | null;
  expense_category?: string | null;
  posting_status?: string | null;
  confidence_level?: string | null;
  review_reason?: string | null;
  engine_note?: string | null;
  review_status?: string | null;
  assigned_to?: string | null;
};

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

function proposedApprovalGroup(item: BuilderCase) {
  return item.approver_group_proposed
    || approvalGroupValueFromIds(item.approver_ids_proposed)
    || null;
}

function normalizeDateOnly(value: string | null | undefined) {
  const raw = String(value ?? '');
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function nextPaymentDateOnOrAfter(value: string, withTef: boolean) {
  const date = new Date(`${value}T00:00:00Z`);
  const targetDay = withTef ? 5 : 1;
  const delta = (targetDay - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function safePaymentDate(item: BuilderCase) {
  const paymentDate = normalizeDateOnly(item.payment_date);
  const documentDate = normalizeDateOnly(item.document_date);
  if (!paymentDate || !documentDate || paymentDate >= documentDate) return item.payment_date;

  const dueDate = normalizeDateOnly(item.due_date) ?? documentDate;
  const withTef = String(item.payment_date_rule ?? '').toLowerCase().includes('con tef');
  return nextPaymentDateOnOrAfter(dueDate, withTef);
}

function payloadFromCase(item: BuilderCase, bucket: string) {
  const approvalGroup = proposedApprovalGroup(item);
  const paymentDate = safePaymentDate(item);

  return {
    source: 'builder review_cases.json',
    classification: { bucket, summary: item.review_reason },
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
      paymentDate,
      paymentDateRule: item.payment_date_rule,
      paymentTermsId: item.payment_terms_id,
      paymentTermsLabel: item.payment_terms_label,
      serviceDescription: item.service_description,
      amountNet: item.amount_net,
      amountVat: item.amount_vat,
      amountVatNonRecoverable: item.amount_vat_non_recoverable,
      amountExempt: item.amount_exempt,
      amountCommonUseVat: item.amount_common_use_vat,
      amountNoCreditTax: item.amount_no_credit_tax,
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
      approvalGroup,
      approverSource: item.approver_source,
      accountCorrecta: item.account_label_proposed,
      ocPolicyCorrecta: item.oc_policy_proposed,
      trabajaConOc: item.oc_reference_proposed,
      pagoPorTef: item.payment_tef_label,
      terminosNs: item.payment_terms_label,
      ocCategory: item.oc_category,
      expenseCategory: item.expense_category || item.oc_category,
      postingStatus: item.posting_status,
      confidenceLevel: item.confidence_level,
      paymentTermsLabel: item.payment_terms_label,
      paymentTermsId: item.payment_terms_id,
      accountingDateProposed: item.accounting_date_proposed,
      dueDate: item.due_date,
      paymentDate,
      paymentDateRule: item.payment_date_rule,
      engineNote: item.engine_note,
      assignedTo: item.assigned_to,
      reviewStatus: item.review_status,
    },
  };
}

export async function POST(request: Request) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'No autenticado.' }, { status: 401 });
  }

  const body = await request.json();
  const items = Array.isArray(body?.items) ? body.items as BuilderCase[] : [];
  if (!items.length) {
    return NextResponse.json({ ok: false, message: 'Sin casos para importar.' }, { status: 400 });
  }

  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    if (!item.case_id) continue;
    const sourceDocumentId = `builder_${item.case_id}`;
    const bucket = bucketFromCase(item);
    const summaryText = summaryFromCase(item);
    const payloadJson = payloadFromCase(item, bucket);
    const exists = await db.query(`select id from review_cases where source_document_id = $1 limit 1`, [sourceDocumentId]);

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
        'builder_may_2026',
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

  return NextResponse.json({ ok: true, total: items.length, inserted, updated });
}
