import { NextResponse } from 'next/server';
import { createReviewDecision } from '@/lib/db/queries';
import { getSessionFromCookie } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookie();

    if (!session) {
      return NextResponse.json({ ok: false, message: 'Sesión no válida.' }, { status: 401 });
    }

    const body = await request.json();
    const { caseId, decisionType, notes, corrections } = body as {
      caseId?: string;
      decisionType?: 'approve' | 'correct_and_approve' | 'exception' | 'reject_for_learning';
      notes?: string;
      corrections?: Record<string, unknown>;
    };

    if (!caseId || !decisionType) {
      return NextResponse.json({ ok: false, message: 'Faltan caseId o decisionType.' }, { status: 400 });
    }

    await createReviewDecision({
      caseId,
      userId: session.user_id,
      decisionType,
      notes,
      correctionJson: corrections,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'No se pudo guardar la decisión.', error: String(error) },
      { status: 500 },
    );
  }
}
