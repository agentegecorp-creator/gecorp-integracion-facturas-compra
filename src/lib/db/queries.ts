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
  const [totalCases, byBucket, byStatus] = await Promise.all([
    db.query(`select count(*)::int as total from review_cases`),
    db.query(`select bucket, count(*)::int as total from review_cases group by bucket order by bucket`),
    db.query(`select status, count(*)::int as total from review_cases group by status order by status`),
  ]);

  return {
    totalCases: totalCases.rows[0]?.total ?? 0,
    byBucket: byBucket.rows,
    byStatus: byStatus.rows,
  };
}

export async function listReviewCases(
  limit = 20,
  filters?: { bucket?: string; status?: string; sandboxPublishStatus?: string },
) {
  const hasSandboxPublishStatus = await hasSandboxPublishStatusColumn();
  const conditions: string[] = [];
  const values: Array<string | number> = [];

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
    const caseResult = await client.query(`select id, bucket, payload_json from review_cases where id = $1 limit 1`, [params.caseId]);

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
    const sandboxPublishStatus = inferSandboxPublishStatus(caseResult.rows[0], params.decisionType);

    if (hasSandboxPublishStatus) {
      await client.query(
        `update review_cases
         set status = $2,
             sandbox_publish_status = $3
         where id = $1`,
        [params.caseId, nextStatus, sandboxPublishStatus],
      );
    } else {
      await client.query(
        `update review_cases
         set status = $2
         where id = $1`,
        [params.caseId, nextStatus],
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
