import { db } from '@/lib/db/client';
import {
  accountOptions,
  approvalGroupIds,
  classOptions,
  departmentOptions,
  locationOptions,
  optionLabel,
  optionName,
  paymentTermDays,
  paymentTermsOptions,
} from '@/lib/review/catalogs';
import pipelineRunSummaries from '@/lib/review/pipeline-run-summaries.json';
import rcvSiiSummaries from '@/lib/review/rcv-sii-summaries.json';
import automaticCreatedDocuments from '@/lib/review/automatic-created-documents.json';

let cachedHasSandboxPublishStatus: boolean | null = null;

async function hasSandboxPublishStatusColumn() {
  if (cachedHasSandboxPublishStatus !== null) {
    return cachedHasSandboxPublishStatus;
  }

  const result = await db.query(
    `select exists (
      select 1
      from information_schema.columns
      where table_name = 'review_cases'
        and column_name = 'sandbox_publish_status'
    ) as exists`,
  );

  cachedHasSandboxPublishStatus = Boolean(result.rows[0]?.exists);
  return cachedHasSandboxPublishStatus;
}

export async function healthcheckDb() {
  const result = await db.query('select now() as now');
  return result.rows[0];
}

export async function listAuditLog(limit = 50) {
  const result = await db.query(
    `select a.id,
            a.user_id,
            a.action,
            a.entity_type,
            a.entity_id,
            a.details_json,
            a.created_at,
            u.name as user_name,
            u.email as user_email
     from audit_log a
     left join users u on u.id = a.user_id
     order by a.created_at desc
     limit $1`,
    [limit],
  );

  return result.rows;
}

type DashboardPeriod = {
  startDate: string;
  endDate: string;
};

type DocumentTypeSummaryRow = {
  documentType: string;
  totalDocuments: number;
  montoExento: number;
  montoNeto: number;
  ivaRecuperable: number;
  ivaUsoComun: number;
  ivaNoRecuperable: number;
  montoOtrosImpuestos: number;
  montoTotal: number;
};

type RcvSiiSummary = {
  sourceFile: string;
  generatedAt: string;
  rows: DocumentTypeSummaryRow[];
};

type PipelineRunSummary = {
  sourceRun: string;
  generatedAt: string;
  mode: string;
  createdAutomatically: number;
  duplicates: number;
  pendingApproval: number;
  newVendors: number;
  rejectedSii: number;
  accountingErrors: number;
  revisionOcReferential: number;
};

type AutomaticCreatedDocument = {
  id: string;
  sourceRun: string;
  generatedAt: string;
  vendor_name: string | null;
  vendor_rut: string | null;
  folio: string | null;
  document_type: string | null;
  issue_date: string | null;
  reception_date: string | null;
  bucket: string;
  status: string;
  amount_total: string | number | null;
  summary_text: string | null;
  sandbox_publish_status: string | null;
  payload_json: {
    document?: Record<string, unknown>;
    context?: Record<string, unknown>;
  };
};

function periodMonthKey(period?: DashboardPeriod) {
  if (!period?.startDate) return null;
  return period.startDate.slice(0, 7);
}

function automaticDocumentsForPeriod(period?: DashboardPeriod) {
  const documentsByMonth = automaticCreatedDocuments as Record<string, AutomaticCreatedDocument[]>;

  if (period) {
    return documentsByMonth[periodMonthKey(period) ?? ''] ?? [];
  }

  return Object.values(documentsByMonth).flat();
}

export async function getDashboardSummary(period?: DashboardPeriod) {
  const periodValues = period ? [period.startDate, period.endDate] : [];
  const periodWhereClause = period ? `where issue_date >= $1::date and issue_date < $2::date` : '';
  const documentTypeValues: string[] = [];
  const documentTypeConditions: string[] = [];

  if (period) {
    documentTypeValues.push(period.startDate, period.endDate);
    documentTypeConditions.push(`issue_date >= $1::date and issue_date < $2::date`);
  }

  const documentTypeWhereClause = documentTypeConditions.length > 0 ? `where ${documentTypeConditions.join(' and ')}` : '';

  const [totalCases, byBucket, byStatus, operationalRows, fallbackRows] = await Promise.all([
    db.query(`select count(*)::int as total from review_cases ${periodWhereClause}`, periodValues),
    db.query(`select bucket, count(*)::int as total from review_cases ${periodWhereClause} group by bucket order by bucket`, periodValues),
    db.query(`select status, count(*)::int as total from review_cases ${periodWhereClause} group by status order by status`, periodValues),
    db.query(
      `select bucket, status, document_type, amount_total, vendor_name, payload_json
       from review_cases
       ${periodWhereClause}`,
      periodValues,
    ),
    db.query(
      `select bucket, status, document_type, amount_total, vendor_name, payload_json
       from review_cases
       ${documentTypeWhereClause}`,
      documentTypeValues,
    ),
  ]);

  const operationalSummary = {
    creadasManuales: 0,
    creadasAutomaticas: 0,
    porContabilizar: 0,
    fueraDeFlujo: 0,
    excluidos: 0,
    nuevosProveedores: 0,
  };

  const documentTypeSummaryMap = new Map<string, DocumentTypeSummaryRow>();

  for (const row of operationalRows.rows) {
    const payload = row.payload_json ?? {};
    const context = payload.context ?? {};
    const document = payload.document ?? {};
    const vendorName = String(row.vendor_name || '').toUpperCase();
    const docType = String(document.documentType || row.document_type || 'Sin tipo');

    if (row.status === 'resolved') {
      operationalSummary.creadasManuales += 1;
    } else {
      operationalSummary.porContabilizar += 1;
    }

    if (vendorName.includes('DIN') || vendorName.includes('SCOTIABANK SIN VALOR') || docType === '914') {
      operationalSummary.excluidos += 1;
    }

    if (String(context.motivo || '').toLowerCase().includes('proveedor nuevo') || String(context.requiereRevisionManual || '').toLowerCase() === 'nuevo_proveedor') {
      operationalSummary.nuevosProveedores += 1;
    }
  }

  const monthKey = periodMonthKey(period) ?? '';
  const pipelineSummary = (pipelineRunSummaries as Record<string, PipelineRunSummary>)[monthKey];

  if (pipelineSummary) {
    operationalSummary.creadasAutomaticas = pipelineSummary.createdAutomatically;
  }

  const siiSummary = (rcvSiiSummaries as Record<string, RcvSiiSummary>)[monthKey];

  if (siiSummary) {
    const rcvTotalDocuments = siiSummary.rows.reduce((total, row) => total + row.totalDocuments, 0);
    const mesaCases = Number(totalCases.rows[0]?.total ?? 0);
    operationalSummary.fueraDeFlujo = Math.max(
      rcvTotalDocuments - operationalSummary.creadasAutomaticas - mesaCases,
      0,
    );

    return {
      totalCases: totalCases.rows[0]?.total ?? 0,
      byBucket: byBucket.rows,
      byStatus: byStatus.rows,
      operationalSummary,
      pipelineSummary: pipelineSummary ?? null,
      documentTypeSummary: siiSummary.rows,
      documentTypeSummarySource: {
        type: 'sii_csv' as const,
        sourceFile: siiSummary.sourceFile,
        generatedAt: siiSummary.generatedAt,
      },
    };
  }

  for (const row of fallbackRows.rows) {
    const payload = row.payload_json ?? {};
    const document = payload.document ?? {};
    const amountTotal = Number(document.amountTotal ?? row.amount_total ?? 0) || 0;
    const amountNet = Number(document.amountNet ?? (String(row.document_type || '') === '34' ? 0 : amountTotal)) || 0;
    const amountExempt = Number(document.amountExempt ?? (String(row.document_type || '') === '34' ? amountTotal : 0)) || 0;
    const amountOtherTax = (Number(document.amountOtherTax ?? 0) || 0) + (Number(document.amountNoCreditTax ?? 0) || 0);
    const ivaRecuperable = Number(document.amountVat ?? Math.max(amountTotal - amountNet - amountExempt - amountOtherTax, 0)) || 0;
    const ivaUsoComun = Number(document.amountCommonUseVat ?? document.ivaUsoComun ?? 0) || 0;
    const ivaNoRecuperable = Number(document.amountVatNonRecoverable ?? document.ivaNoRecuperable ?? 0) || 0;
    const docType = String(document.documentType || row.document_type || 'Sin tipo');

    if (!documentTypeSummaryMap.has(docType)) {
      documentTypeSummaryMap.set(docType, {
        documentType: docType,
        totalDocuments: 0,
        montoExento: 0,
        montoNeto: 0,
        ivaRecuperable: 0,
        ivaUsoComun: 0,
        ivaNoRecuperable: 0,
        montoOtrosImpuestos: 0,
        montoTotal: 0,
      });
    }

    const target = documentTypeSummaryMap.get(docType)!;
    target.totalDocuments += 1;
    target.montoExento += amountExempt;
    target.montoNeto += amountNet;
    target.ivaRecuperable += ivaRecuperable;
    target.ivaUsoComun += ivaUsoComun;
    target.ivaNoRecuperable += ivaNoRecuperable;
    target.montoOtrosImpuestos += amountOtherTax;
    target.montoTotal += amountTotal;
  }

  const documentTypeSummary = Array.from(documentTypeSummaryMap.values()).sort((a, b) => a.documentType.localeCompare(b.documentType, 'es'));

  return {
    totalCases: totalCases.rows[0]?.total ?? 0,
    byBucket: byBucket.rows,
    byStatus: byStatus.rows,
    operationalSummary,
    pipelineSummary: pipelineSummary ?? null,
    documentTypeSummary,
    documentTypeSummarySource: {
      type: 'review_cases' as const,
    },
  };
}

export async function listReviewCases(
  limit = 20,
  filters?: {
    bucket?: string;
    status?: string;
    sandboxPublishStatus?: string;
    monthScope?: 'active' | 'all';
    period?: DashboardPeriod;
    operationalView?: 'automatic' | 'posted' | 'pending' | 'excluded' | 'new_vendors';
  },
) {
  if (filters?.operationalView === 'automatic') {
    return automaticDocumentsForPeriod(filters.period).slice(0, limit);
  }

  const hasSandboxPublishStatus = await hasSandboxPublishStatusColumn();
  const conditions: string[] = [];
  const values: Array<string | number> = [];
  const monthScope = filters?.monthScope ?? 'active';

  if (filters?.period) {
    values.push(filters.period.startDate, filters.period.endDate);
    conditions.push(`issue_date >= $${values.length - 1}::date and issue_date < $${values.length}::date`);
  } else if (monthScope === 'active') {
    conditions.push(`issue_date >= DATE '2026-04-01' and issue_date < DATE '2026-06-01'`);
  }

  if (filters?.bucket) {
    values.push(filters.bucket);
    conditions.push(`bucket = $${values.length}`);
  }

  if (filters?.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filters?.sandboxPublishStatus && hasSandboxPublishStatus) {
    values.push(filters.sandboxPublishStatus);
    conditions.push(`coalesce(sandbox_publish_status, 'not_ready') = $${values.length}`);
  }

  if (filters?.operationalView === 'posted') {
    conditions.push(`status = 'resolved'`);
  }

  if (filters?.operationalView === 'pending') {
    conditions.push(`status <> 'resolved'`);
  }

  if (filters?.operationalView === 'excluded') {
    conditions.push(`(
      upper(coalesce(vendor_name, '')) like '%DIN%'
      or upper(coalesce(vendor_name, '')) like '%SCOTIABANK SIN VALOR%'
      or coalesce(payload_json->'document'->>'documentType', document_type, '') = '914'
    )`);
  }

  if (filters?.operationalView === 'new_vendors') {
    conditions.push(`(
      lower(coalesce(payload_json->'context'->>'motivo', '')) like '%proveedor nuevo%'
      or lower(coalesce(payload_json->'context'->>'requiereRevisionManual', '')) = 'nuevo_proveedor'
    )`);
  }

  values.push(limit);

  const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
  const sandboxPublishSelect = hasSandboxPublishStatus
    ? `coalesce(sandbox_publish_status, 'not_ready')`
    : `'not_ready'`;

  const result = await db.query(
    `select id, vendor_name, vendor_rut, folio, document_type, issue_date, bucket, status, amount_total, summary_text, created_at,
            ${sandboxPublishSelect} as sandbox_publish_status
     from review_cases
     ${whereClause}
     order by
       case status
         when 'new' then 1
         when 'in_review' then 2
         when 'exception' then 3
         when 'resolved' then 4
         when 'rejected_for_learning' then 5
         else 9
       end,
       created_at desc,
       case bucket
         when 'error_real' then 1
         when 'rejected_sii' then 2
         when 'revision_oc' then 3
         when 'pending_review' then 4
         else 9
       end
     limit $${values.length}`,
    values,
  );

  return result.rows;
}

export async function getReviewQueueCounts(monthScope: 'active' | 'all' = 'active', period?: DashboardPeriod) {
  const conditions: string[] = [];
  const values: string[] = [];

  if (period) {
    values.push(period.startDate, period.endDate);
    conditions.push(`issue_date >= $1::date and issue_date < $2::date`);
  } else if (monthScope === 'active') {
    conditions.push(`issue_date >= DATE '2026-04-01' and issue_date < DATE '2026-06-01'`);
  }

  const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
  const result = await db.query(
    `select bucket, status, vendor_name, payload_json
     from review_cases
     ${whereClause}`,
    values,
  );

  const counts = {
    operational: {
      automatic: automaticDocumentsForPeriod(period).length,
      posted: 0,
      pending: 0,
      excluded: 0,
      new_vendors: 0,
    },
    quick: {
      rejected_sii_new: 0,
      error_real_new: 0,
      revision_oc_new: 0,
      in_review: 0,
      all: result.rows.length,
    },
  };

  for (const row of result.rows) {
    const payload = row.payload_json ?? {};
    const context = payload.context ?? {};
    const document = payload.document ?? {};
    const vendorName = String(row.vendor_name || '').toUpperCase();
    const docType = String(document.documentType || '');

    if (row.status === 'resolved') counts.operational.posted += 1;
    else counts.operational.pending += 1;

    if (vendorName.includes('DIN') || vendorName.includes('SCOTIABANK SIN VALOR') || docType === '914') {
      counts.operational.excluded += 1;
    }

    if (String(context.motivo || '').toLowerCase().includes('proveedor nuevo') || String(context.requiereRevisionManual || '').toLowerCase() === 'nuevo_proveedor') {
      counts.operational.new_vendors += 1;
    }

    if (row.bucket === 'rejected_sii' && row.status === 'new') counts.quick.rejected_sii_new += 1;
    if (row.bucket === 'error_real' && row.status === 'new') counts.quick.error_real_new += 1;
    if (row.bucket === 'revision_oc' && row.status === 'new') counts.quick.revision_oc_new += 1;
    if (row.status === 'in_review') counts.quick.in_review += 1;
  }

  return counts;
}

export async function listReadyForSandbox(limit = 100) {
  const hasSandboxPublishStatus = await hasSandboxPublishStatusColumn();

  if (!hasSandboxPublishStatus) {
    return [];
  }

  const result = await db.query(
    `select id,
            source_document_id,
            vendor_name,
            vendor_rut,
            folio,
            document_type,
            issue_date,
            reception_date,
            amount_total,
            bucket,
            status,
            coalesce(sandbox_publish_status, 'not_ready') as sandbox_publish_status,
            payload_json,
            summary_text,
            created_at,
            updated_at
     from review_cases
     where coalesce(sandbox_publish_status, 'not_ready') = 'ready'
     order by updated_at desc nulls last, created_at desc
     limit $1`,
    [limit],
  );

  return result.rows;
}

export async function getReviewCaseById(id: string) {
  if (id.startsWith('auto-')) {
    return automaticDocumentsForPeriod().find((item) => item.id === id) ?? null;
  }

  const result = await db.query(
    `select * from review_cases where id = $1 limit 1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function getNextPendingCaseId(currentCaseId?: string) {
  if (currentCaseId) {
    const current = await db.query(
      `select created_at from review_cases where id = $1 limit 1`,
      [currentCaseId],
    );

    const currentCreatedAt = current.rows[0]?.created_at;

    if (currentCreatedAt) {
      const next = await db.query(
        `select id
         from review_cases
         where status = 'new'
           and id <> $2
           and created_at < $1
         order by created_at desc
         limit 1`,
        [currentCreatedAt, currentCaseId],
      );

      if (next.rows[0]?.id) {
        return next.rows[0].id as string;
      }
    }
  }

  const fallback = currentCaseId
    ? await db.query(
        `select id
         from review_cases
         where status = 'new'
           and id <> $1
         order by created_at desc
         limit 1`,
        [currentCaseId],
      )
    : await db.query(
        `select id
         from review_cases
         where status = 'new'
         order by created_at desc
         limit 1`,
      );

  return fallback.rows[0]?.id ?? null;
}

export async function getUserByEmail(email: string) {
  const result = await db.query(
    `select id, name, email, password_hash, role, active
     from users
     where lower(email) = lower($1)
     limit 1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function getReviewDecisionsByCaseId(caseId: string) {
  const result = await db.query(
    `select d.id,
            d.case_id,
            d.user_id,
            d.decision_type,
            d.notes,
            d.correction_json,
            d.created_at,
            u.name as user_name,
            u.email as user_email
     from review_decisions d
     join users u on u.id = d.user_id
     where d.case_id = $1
     order by d.created_at desc`,
    [caseId],
  );

  return result.rows;
}

function inferSandboxPublishStatus(caseRow: {
  bucket: string;
  payload_json?: { context?: Record<string, unknown> } | null;
}, decisionType: 'approve' | 'correct_and_approve' | 'exception' | 'reject_for_learning') {
  if (decisionType !== 'approve' && decisionType !== 'correct_and_approve') {
    return 'not_ready';
  }

  if (caseRow.bucket === 'rejected_sii' || caseRow.bucket === 'revision_oc' || caseRow.bucket === 'error_real') {
    return 'not_ready';
  }

  const context = caseRow.payload_json?.context ?? {};
  const requiereRevisionManual = String(context.requiereRevisionManual ?? '').toLowerCase();
  const error = String(context.error ?? '').trim();
  const motivo = String(context.motivo ?? '').trim();
  const entity = context.entity;
  const referenciaAccount = context.referenciaAccount;

  if (requiereRevisionManual === 'si' || requiereRevisionManual === 'true') return 'not_ready';
  if (error) return 'not_ready';
  if (motivo.toLowerCase().includes('rechazo')) return 'not_ready';
  if (typeof entity !== 'number') return 'not_ready';
  if (typeof referenciaAccount !== 'number') return 'not_ready';

  return 'ready';
}

function normalizeIsoDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString();
}

function parseCatalogId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function addDaysIso(value: unknown, days: number) {
  const raw = normalizeIsoDate(value);
  if (!raw) return null;
  const date = new Date(raw);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function proposedPaymentDateIso(value: unknown, withTef: boolean) {
  const raw = normalizeIsoDate(value);
  if (!raw) return null;
  const date = new Date(raw);
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

function usesTef(document: Record<string, unknown>, context: Record<string, unknown>) {
  const tefValue = String(context.pagoPorTef ?? context.tef ?? document.tef ?? '').trim().toLowerCase();
  const paymentRule = String(document.paymentDateRule ?? context.paymentDateRule ?? '').toLowerCase();
  return ['true', 't', '1', 'si', 'sí', 'yes'].includes(tefValue) || paymentRule.includes('tef');
}

function isBalanceAccountValue(value: unknown) {
  const label = optionLabel(accountOptions, String(value ?? ''));
  return Boolean(label?.trim().match(/^[12]/));
}

function clearAccountingDimensions(document: Record<string, unknown>, context: Record<string, unknown>) {
  delete document.classId;
  delete document.departmentId;
  delete document.locationId;
  delete context.classIdProposed;
  delete context.classCorrecta;
  delete context.departmentIdProposed;
  delete context.departmentCorrecta;
  delete context.locationIdProposed;
  delete context.locationCorrecta;
}

function applyCorrectionsToCase(caseRow: { payload_json?: Record<string, any> | null; vendor_name?: string | null; document_type?: string | null; issue_date?: string | null; }, correctionJson?: Record<string, unknown>) {
  const corrections = correctionJson ?? {};
  const payload = { ...(caseRow.payload_json ?? {}) };
  const document = { ...((payload.document as Record<string, unknown> | undefined) ?? {}) };
  const context = { ...((payload.context as Record<string, unknown> | undefined) ?? {}) };

  const patch: Record<string, unknown> = {
    payload_json: payload,
  };

  if (typeof corrections.account_id === 'string' && corrections.account_id.trim()) {
    const value = corrections.account_id.trim();
    context.accountCorrecta = optionLabel(accountOptions, value);
    context.accountIdProposed = parseCatalogId(value);
    context.referenciaAccount = parseCatalogId(value);
    document.accountId = parseCatalogId(value);

    if (isBalanceAccountValue(value)) {
      clearAccountingDimensions(document, context);
      context.accountingDimensionRule = 'Cuenta de balance: no requiere clase/mercado, departamento ni ubicación';
    } else {
      delete context.accountingDimensionRule;
    }
  }

  if (typeof corrections.approval_group === 'string' && corrections.approval_group.trim()) {
    const value = corrections.approval_group.trim();
    context.approvalGroup = value;
    const ids = approvalGroupIds(value);
    if (ids) {
      context.approverIdsProposed = ids;
      context.approverSource = 'NetSuite vendor master';
    }
  }

  if (typeof corrections.oc_category === 'string' && corrections.oc_category.trim()) {
    context.ocCategory = corrections.oc_category.trim();
    context.categoriaOc = corrections.oc_category.trim();
  }

  if (typeof corrections.oc_policy === 'string' && corrections.oc_policy.trim()) {
    context.ocPolicyCorrecta = corrections.oc_policy.trim();
  }

  if (typeof corrections.new_vendor_entity === 'string' && corrections.new_vendor_entity.trim()) {
    const numericEntity = Number(corrections.new_vendor_entity.trim());
    context.entity = Number.isFinite(numericEntity) ? numericEntity : corrections.new_vendor_entity.trim();
    context.vendorIdProposed = Number.isFinite(numericEntity) ? numericEntity : corrections.new_vendor_entity.trim();
  }

  if (typeof corrections.invoice_note === 'string') {
    document.invoiceNote = corrections.invoice_note.trim();
    context.invoiceNote = corrections.invoice_note.trim();
  }

  if (typeof corrections.invoice_detail === 'string') {
    document.invoiceDetail = corrections.invoice_detail.trim();
    document.serviceDescription = corrections.invoice_detail.trim();
    context.invoiceDetail = corrections.invoice_detail.trim();
  }

  if (typeof corrections.vendor_name === 'string' && corrections.vendor_name.trim()) {
    patch.vendor_name = corrections.vendor_name.trim();
    document.vendorName = corrections.vendor_name.trim();
    context.razonSocial = corrections.vendor_name.trim();
  }

  if (typeof corrections.document_type === 'string' && corrections.document_type.trim()) {
    patch.document_type = corrections.document_type.trim();
    document.documentType = corrections.document_type.trim();
  }

  if (corrections.issue_date) {
    const iso = normalizeIsoDate(corrections.issue_date);
    if (iso) {
      patch.issue_date = iso;
      document.issueDate = iso;
    }
  }

  if (corrections.accounting_date) {
    const iso = normalizeIsoDate(corrections.accounting_date);
    if (iso) {
      document.accountingDateProposed = iso;
      context.accountingDateProposed = iso;
    }
  }

  if (corrections.due_date) {
    const iso = normalizeIsoDate(corrections.due_date);
    if (iso) {
      document.dueDate = iso;
      document.dueDateRule = 'Corregida manualmente en mesa de revisión';
      context.dueDate = iso;
    }
  }

  if (corrections.payment_date) {
    const iso = normalizeIsoDate(corrections.payment_date);
    if (iso) {
      document.paymentDate = iso;
      document.paymentDateRule = 'Corregida manualmente en mesa de revisión';
      context.paymentDate = iso;
      context.paymentDateRule = 'Corregida manualmente en mesa de revisión';
    }
  }

  if (typeof corrections.payment_terms_id === 'string' && corrections.payment_terms_id.trim()) {
    const value = corrections.payment_terms_id.trim();
    const label = optionName(paymentTermsOptions, value);
    const days = paymentTermDays(value);
    document.paymentTermsId = parseCatalogId(value);
    document.paymentTermsLabel = label;
    context.paymentTermsId = parseCatalogId(value);
    context.paymentTermsLabel = label;
    context.terminosNs = label;
    context.diasCreditoNs = days;

    if (!corrections.due_date) {
      const issueDate = document.issueDate ?? caseRow.issue_date;
      const dueDate = addDaysIso(issueDate, days);
      if (dueDate) {
        document.dueDate = dueDate;
        document.dueDateRule = `Vencimiento base: fecha documento + término NetSuite ${label} (${days} días)`;
        context.dueDate = dueDate;
      }
    }

    if (!corrections.payment_date) {
      const withTef = usesTef(document, context);
      const paymentDate = proposedPaymentDateIso(document.dueDate ?? context.dueDate, withTef);
      if (paymentDate) {
        document.paymentDate = paymentDate;
        document.paymentDateRule = paymentDateRule(withTef);
        context.paymentDate = paymentDate;
        context.paymentDateRule = document.paymentDateRule;
      }
    }
  }

  if (!corrections.due_date && (corrections.issue_date || corrections.payment_terms_id)) {
    const termsId = String(document.paymentTermsId ?? context.paymentTermsId ?? '').trim();
    const days = termsId ? paymentTermDays(termsId) : Number(context.diasCreditoNs ?? 0);
    const label = termsId ? optionName(paymentTermsOptions, termsId) : String(context.paymentTermsLabel ?? document.paymentTermsLabel ?? 'NetSuite');
    const dueDate = addDaysIso(document.issueDate ?? caseRow.issue_date, days);
    if (dueDate) {
      document.dueDate = dueDate;
      document.dueDateRule = `Vencimiento base: fecha documento + término NetSuite ${label} (${days} días)`;
      context.dueDate = dueDate;
    }
  }

  if (!corrections.payment_date && (corrections.issue_date || corrections.due_date || corrections.payment_terms_id)) {
    const withTef = usesTef(document, context);
    const paymentDate = proposedPaymentDateIso(document.dueDate ?? context.dueDate, withTef);
    if (paymentDate) {
      document.paymentDate = paymentDate;
      document.paymentDateRule = paymentDateRule(withTef);
      context.paymentDate = paymentDate;
      context.paymentDateRule = document.paymentDateRule;
    }
  }

  const hasBalanceAccount = isBalanceAccountValue(document.accountId ?? context.accountIdProposed ?? context.referenciaAccount);

  if (!hasBalanceAccount && typeof corrections.class_id === 'string' && corrections.class_id.trim()) {
    const value = corrections.class_id.trim();
    context.classIdProposed = parseCatalogId(value);
    context.classCorrecta = optionLabel(classOptions, value);
    document.classId = parseCatalogId(value);
  }

  if (!hasBalanceAccount && typeof corrections.department_id === 'string' && corrections.department_id.trim()) {
    const value = corrections.department_id.trim();
    context.departmentIdProposed = parseCatalogId(value);
    context.departmentCorrecta = optionLabel(departmentOptions, value);
    document.departmentId = parseCatalogId(value);
  }

  if (!hasBalanceAccount && typeof corrections.location_id === 'string' && corrections.location_id.trim()) {
    const value = corrections.location_id.trim();
    context.locationIdProposed = parseCatalogId(value);
    context.locationCorrecta = optionLabel(locationOptions, value);
    document.locationId = parseCatalogId(value);
  }

  payload.document = document;
  payload.context = context;

  return patch;
}

function formatCorrectionValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function currentCorrectionValues(caseRow: { payload_json?: Record<string, any> | null; vendor_name?: string | null; document_type?: string | null; issue_date?: string | null; }) {
  const payload = caseRow.payload_json ?? {};
  const document = (payload.document as Record<string, unknown> | undefined) ?? {};
  const context = (payload.context as Record<string, unknown> | undefined) ?? {};

  return {
    account_id: formatCorrectionValue(document.accountId ?? context.accountIdProposed ?? context.referenciaAccount),
    vendor_name: formatCorrectionValue(caseRow.vendor_name ?? document.vendorName ?? context.razonSocial),
    issue_date: formatCorrectionValue(caseRow.issue_date ?? document.issueDate),
    accounting_date: formatCorrectionValue(document.accountingDateProposed ?? context.accountingDateProposed),
    due_date: formatCorrectionValue(document.dueDate ?? context.dueDate),
    payment_date: formatCorrectionValue(document.paymentDate ?? context.paymentDate),
    payment_terms_id: formatCorrectionValue(document.paymentTermsId ?? context.paymentTermsId),
    document_type: formatCorrectionValue(caseRow.document_type ?? document.documentType),
    approval_group: formatCorrectionValue(context.approvalGroup),
    oc_category: formatCorrectionValue(context.ocCategory ?? context.categoriaOc),
    oc_policy: formatCorrectionValue(context.ocPolicyCorrecta ?? context.ocPolicySuggestedB2),
    class_id: formatCorrectionValue(document.classId ?? context.classIdProposed ?? context.classCorrecta ?? context.classSuggestedB2),
    department_id: formatCorrectionValue(document.departmentId ?? context.departmentIdProposed ?? context.departmentCorrecta ?? context.departmentSuggestedB2),
    location_id: formatCorrectionValue(document.locationId ?? context.locationIdProposed ?? context.locationCorrecta ?? context.locationSuggestedB2),
    new_vendor_entity: formatCorrectionValue(context.entity ?? context.vendorIdProposed),
    invoice_note: formatCorrectionValue(document.invoiceNote ?? context.invoiceNote),
    invoice_detail: formatCorrectionValue(document.invoiceDetail ?? document.serviceDescription ?? context.invoiceDetail),
  };
}

function correctionChanges(
  beforeValues: Record<string, string | null>,
  correctionJson?: Record<string, unknown>,
) {
  const corrections = correctionJson ?? {};
  return Object.entries(corrections)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([field, value]) => ({
      field,
      before: beforeValues[field] ?? null,
      after: String(value),
    }));
}

export async function createReviewDecision(params: {
  caseId: string;
  userId: string;
  decisionType: 'approve' | 'correct_and_approve' | 'exception' | 'reject_for_learning';
  notes?: string;
  correctionJson?: Record<string, unknown>;
}) {
  const nextStatusMap = {
    approve: 'resolved',
    correct_and_approve: 'resolved',
    exception: 'exception',
    reject_for_learning: 'rejected_for_learning',
  } as const;

  const client = await db.connect();

  try {
    await client.query('begin');

    const hasSandboxPublishStatus = await hasSandboxPublishStatusColumn();
    const caseResult = await client.query(`select id, bucket, vendor_name, document_type, issue_date, payload_json from review_cases where id = $1 limit 1`, [params.caseId]);

    if (!caseResult.rows[0]) {
      throw new Error('Caso no encontrado');
    }

    await client.query(
      `insert into review_decisions (case_id, user_id, decision_type, notes, correction_json)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [
        params.caseId,
        params.userId,
        params.decisionType,
        params.notes ?? null,
        JSON.stringify(params.correctionJson ?? {}),
      ],
    );

    const nextStatus = nextStatusMap[params.decisionType];
    const caseRow = caseResult.rows[0];
    const beforeCorrectionValues = currentCorrectionValues(caseRow);
    const correctedPatch = applyCorrectionsToCase(caseRow, params.correctionJson);
    const previewCaseRow = {
      ...caseRow,
      payload_json: correctedPatch.payload_json ?? caseRow.payload_json,
    };
    const sandboxPublishStatus = inferSandboxPublishStatus(previewCaseRow, params.decisionType);

    if (hasSandboxPublishStatus) {
      await client.query(
        `update review_cases
         set status = $2,
             sandbox_publish_status = $3,
             vendor_name = coalesce($4, vendor_name),
             document_type = coalesce($5, document_type),
             issue_date = coalesce($6::timestamptz, issue_date),
             payload_json = $7::jsonb,
             updated_at = now()
         where id = $1`,
        [
          params.caseId,
          nextStatus,
          sandboxPublishStatus,
          correctedPatch.vendor_name ?? null,
          correctedPatch.document_type ?? null,
          correctedPatch.issue_date ?? null,
          JSON.stringify(correctedPatch.payload_json ?? caseRow.payload_json ?? {}),
        ],
      );
    } else {
      await client.query(
        `update review_cases
         set status = $2,
             vendor_name = coalesce($3, vendor_name),
             document_type = coalesce($4, document_type),
             issue_date = coalesce($5::timestamptz, issue_date),
             payload_json = $6::jsonb,
             updated_at = now()
         where id = $1`,
        [
          params.caseId,
          nextStatus,
          correctedPatch.vendor_name ?? null,
          correctedPatch.document_type ?? null,
          correctedPatch.issue_date ?? null,
          JSON.stringify(correctedPatch.payload_json ?? caseRow.payload_json ?? {}),
        ],
      );
    }

    await client.query(
      `insert into audit_log (user_id, action, entity_type, entity_id, details_json)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [
        params.userId,
        'review_decision_created',
        'review_case',
        params.caseId,
        JSON.stringify({
          decisionType: params.decisionType,
          nextStatus,
          sandboxPublishStatus,
          notes: params.notes ?? null,
          correctionJson: params.correctionJson ?? {},
          correctionChanges: correctionChanges(beforeCorrectionValues, params.correctionJson),
        }),
      ],
    );

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
