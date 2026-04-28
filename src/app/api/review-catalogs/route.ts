import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth/session';
import { accountOptions, documentTypeOptions, vendorOptions } from '@/lib/review/catalogs';

export async function GET() {
  try {
    const session = await getSessionFromCookie();

    if (!session) {
      return NextResponse.json({ ok: false, message: 'Sesión no válida.' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      accountOptions,
      documentTypeOptions,
      vendorOptions,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'No se pudieron leer los catálogos.', error: String(error) },
      { status: 500 },
    );
  }
}
