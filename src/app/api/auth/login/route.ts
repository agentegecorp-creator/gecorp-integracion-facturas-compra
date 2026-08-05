import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { getUserByEmail } from '@/lib/db/queries';
import { appConfig } from '@/config/app';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ ok: false, message: 'Email y clave son obligatorios.' }, { status: 400 });
    }

    const user = await getUserByEmail(email);

    if (!user || !user.active) {
      return NextResponse.json({ ok: false, message: 'Credenciales inválidas.' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
      return NextResponse.json({ ok: false, message: 'Credenciales inválidas.' }, { status: 401 });
    }

    const session = await createSession(user.id);
    const response = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });

    response.cookies.set(appConfig.sessionCookieName, session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: appConfig.secureCookies,
      path: '/',
      expires: session.expiresAt,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'No se pudo iniciar sesión.', error: String(error) },
      { status: 500 },
    );
  }
}
