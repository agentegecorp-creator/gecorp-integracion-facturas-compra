import { NextResponse } from 'next/server';
import { getNextPendingCaseId } from '@/lib/db/queries';
import { getSessionFromCookie } from '@/lib/auth/session';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromCookie();

    if (!session) {
      return NextResponse.json({ ok: false, message: 'Sesión no válida.' }, { status: 401 });
    }

    const { id } = await context.params;
    const nextCaseId = await getNextPendingCaseId(id);

    return NextResponse.json({ ok: true, nextCaseId });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'No se pudo calcular el siguiente caso.', error: String(error) },
      { status: 500 },
    );
  }
}
