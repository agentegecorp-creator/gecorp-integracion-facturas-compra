import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: false, message: 'Review decisions pendiente de conectar.' }, { status: 501 });
}
