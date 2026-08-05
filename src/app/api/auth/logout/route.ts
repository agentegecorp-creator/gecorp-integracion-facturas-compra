import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSessionByToken } from '@/lib/auth/session';
import { appConfig } from '@/config/app';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(appConfig.sessionCookieName)?.value;

    if (token) {
      await deleteSessionByToken(token);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(appConfig.sessionCookieName, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: appConfig.secureCookies,
      path: '/',
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'No se pudo cerrar sesión.', error: String(error) },
      { status: 500 },
    );
  }
}
