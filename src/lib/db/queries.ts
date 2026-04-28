import { db } from '@/lib/db/client';

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
  filters?: { bucket?: string; status?: string },
) {
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

  values.push(limit);

  const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

  const result = await db.query(
    `select id, vendor_name, vendor_rut, folio, document_type, issue_date, bucket, status, amount_total, summary_text, created_at
     from review_cases
     ${whereClause}
     order by created_at desc
     limit $${values.length}`,
    values,
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
           and created_at < $1
         order by created_at desc
         limit 1`,
        [currentCreatedAt],
      );

      if (next.rows[0]?.id) {
        return next.rows[0].id as string;
      }
    }
  }

  const fallback = await db.query(
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

    const caseResult = await client.query(`select id from review_cases where id = $1 limit 1`, [params.caseId]);

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

    await client.query(
      `update review_cases
       set status = $2
       where id = $1`,
      [params.caseId, nextStatus],
    );

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
