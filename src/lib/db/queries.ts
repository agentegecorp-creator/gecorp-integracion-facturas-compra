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
