import { db } from '@/lib/db/client';

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

export async function getDashboardSummary() {
  const [totalCases, byBucket, byStatus, rows] = await Promise.all([
    db.query(`select count(*)::int as total from review_cases`),
    db.query(`select bucket, count(*)::int as total from review_cases group by bucket order by bucket`),
    db.query(`select status, count(*)::int as total from review_cases group by status order by status`),
    db.query(`select bucket, status, document_type, amount_total, vendor_name, payload_json from review_cases`),
  ]);

  const operationalSummary = {
    contabilizados: 0,
    porContabilizar: 0,
    excluidos: 0,
    nuevosProveedores: 0,
  };

  const documentTypeSummaryMap = new Map<string, {
    documentType: string;
    totalDocuments: number;
    montoExento: number;
    montoNeto: number;
    ivaRecuperable: number;
    ivaUsoComun: number;
    ivaNoRecuperable: number;
    montoTotal: number;
  }>();

  for (const row of rows.rows) {
    const payload = row.payload_json ?? {};
    const context = payload.context ?? {};
    const document = payload.document ?? {};
    const vendorName = String(row.vendor_name || '').toUpperCase();
    const amountTotal = Number(document.amountTotal ?? row.amount_total ?? 0) || 0;
    const amountNet = Number(document.amountNet ?? (String(row.document_type || '') === '34' ? 0 : amountTotal)) || 0;
    const amountExempt = Number(document.amountExempt ?? (String(row.document_type || '') === '34' ? amountTotal : 0)) || 0;
    const ivaRecuperable = Math.max(amountTotal - amountNet - amountExempt, 0);
    const ivaUsoComun = Number(document.ivaUsoComun ?? 0) || 0;
    const ivaNoRecuperable = Number(document.ivaNoRecuperable ?? 0) || 0;
    const docType = String(document.documentType || row.document_type || 'Sin tipo');

    if (row.status === 'resolved') {
      operationalSummary.contabilizados += 1;
    } else {
      operationalSummary.porContabilizar += 1;
    }

    if (vendorName.includes('DIN') || vendorName.includes('SCOTIABANK SIN VALOR') || docType === '914') {
      operationalSummary.excluidos += 1;
    }

    if (String(context.motivo || '').toLowerCase().includes('proveedor nuevo') || String(context.requiereRevisionManual || '').toLowerCase() === 'nuevo_proveedor') {
      operationalSummary.nuevosProveedores += 1;
    }

    if (!documentTypeSummaryMap.has(docType)) {
      documentTypeSummaryMap.set(docType, {
        documentType: docType,
        totalDocuments: 0,
        montoExento: 0,
        montoNeto: 0,
        ivaRecuperable: 0,
        ivaUsoComun: 0,
        ivaNoRecuperable: 0,
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
    target.montoTotal += amountTotal;
  }

  const documentTypeSummary = Array.from(documentTypeSummaryMap.values()).sort((a, b) => a.documentType.localeCompare(b.documentType, 'es'));

  return {
    totalCases: totalCases.rows[0]?.total ?? 0,
    byBucket: byBucket.rows,
    byStatus: byStatus.rows,
    operationalSummary,
    documentTypeSummary,
  };
}

export async function listReviewCases(
  limit = 20,
  filters?: { bucket?: string; status?: string; sandboxPublishStatus?: string; monthScope?: 'active' | 'all' },
) {
  const hasSandboxPublishStatus = await hasSandboxPublishStatusColumn();
  const conditions: string[] = [];
  const values: Array<string | number> = [];
  const monthScope = filters?.monthScope ?? 'active';

  if (monthScope === 'active') {
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
       case bucket
         when 'error_real' then 1
         when 'rejected_sii' then 2
         when 'revision_oc' then 3
         when 'pending_review' then 4
         else 9
       end,
       case status
         when 'new' then 1
         when 'in_review' then 2
         when 'exception' then 3
         when 'resolved' then 4
         when 'rejected_for_learning' then 5
         else 9
       end,
       created_at desc
     limit $${values.length}`,
    values,
  );

  return result.rows;
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

function applyCorrectionsToCase(caseRow: { payload_json?: Record<string, any> | null; vendor_name?: string | null; document_type?: string | null; issue_date?: string | null; }, correctionJson?: Record<string, unknown>) {
  const corrections = correctionJson ?? {};
  const payload = { ...(caseRow.payload_json ?? {}) };
  const document = { ...((payload.document as Record<string, unknown> | undefined) ?? {}) };
  const context = { ...((payload.context as Record<string, unknown> | undefined) ?? {}) };

  const patch: Record<string, unknown> = {
    payload_json: payload,
  };

  if (typeof corrections.account_id === 'string' && corrections.account_id.trim()) {
    context.accountCorrecta = corrections.account_id.trim();
    context.accountIdProposed = corrections.account_id.trim();
  }

  if (typeof corrections.approval_group === 'string' && corrections.approval_group.trim()) {
    context.approvalGroup = corrections.approval_group.trim();
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

  payload.document = document;
  payload.context = context;

  return patch;
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
