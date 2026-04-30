import { NextResponse } from 'next/server';
import { listReadyForSandbox } from '@/lib/db/queries';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit') || '100');
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 500)) : 100;
    const items = await listReadyForSandbox(limit);

    return NextResponse.json({
      total: items.length,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'No se pudo leer el lote listo para Sandbox.', error: String(error) },
      { status: 500 },
    );
  }
}
