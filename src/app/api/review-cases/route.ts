import { NextResponse } from 'next/server';
import { listReviewCases } from '@/lib/db/queries';

export async function GET() {
  try {
    const items = await listReviewCases();
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'No se pudo leer review_cases.', error: String(error) },
      { status: 500 },
    );
  }
}
