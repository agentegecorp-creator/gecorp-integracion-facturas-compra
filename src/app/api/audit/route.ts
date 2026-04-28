import { NextResponse } from 'next/server';
import { healthcheckDb } from '@/lib/db/queries';

export async function GET() {
  try {
    const dbNow = await healthcheckDb();
    return NextResponse.json({ ok: true, dbNow });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'DB healthcheck falló.', error: String(error) },
      { status: 500 },
    );
  }
}
