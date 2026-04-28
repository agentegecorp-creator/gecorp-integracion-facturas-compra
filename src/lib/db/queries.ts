import { db } from '@/lib/db/client';

export async function healthcheckDb() {
  const result = await db.query('select now() as now');
  return result.rows[0];
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

export async function listReviewCases(limit = 20) {
  const result = await db.query(
    `select id, vendor_name, vendor_rut, folio, bucket, status, amount_total, created_at
     from review_cases
     order by created_at desc
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

    await client.query(
      `update review_cases
       set status = $2
       where id = $1`,
      [params.caseId, nextStatusMap[params.decisionType]],
    );

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
