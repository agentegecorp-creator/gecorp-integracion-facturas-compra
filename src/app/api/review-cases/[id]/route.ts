import { NextResponse } from 'next/server';
import { getReviewCaseById } from '@/lib/db/queries';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const item = await getReviewCaseById(params.id);

    if (!item) {
      return NextResponse.json({ ok: false, message: 'Caso no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'No se pudo leer el caso.', error: String(error) },
      { status: 500 },
    );
  }
}
