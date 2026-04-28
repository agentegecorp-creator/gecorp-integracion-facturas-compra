import crypto from 'crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/client';
import { appConfig } from '@/config/app';

const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 12);

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function buildSessionExpiry() {
  return new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export async function createSession(userId: string) {
  const token = generateSessionToken();
  const expiresAt = buildSessionExpiry();

  await db.query(
    `insert into sessions (user_id, session_token, expires_at)
     values ($1, $2, $3)`,
    [userId, token, expiresAt],
  );

  return { token, expiresAt };
}

export async function getSessionFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(appConfig.sessionCookieName)?.value;

  if (!token) return null;

  const result = await db.query(
    `select s.id, s.user_id, s.expires_at, u.name, u.email, u.role, u.active
     from sessions s
     join users u on u.id = s.user_id
     where s.session_token = $1
       and s.expires_at > now()
       and u.active = true
     limit 1`,
    [token],
  );

  return result.rows[0] ?? null;
}

export async function deleteSessionByToken(token: string) {
  await db.query('delete from sessions where session_token = $1', [token]);
}
