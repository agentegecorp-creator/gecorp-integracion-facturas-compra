import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth/session';
import {
  createSandboxPublishRun,
  finishSandboxPublishRun,
  listReadyForSandbox,
  markSandboxPublishResult,
  recordSandboxPublishItem,
} from '@/lib/db/queries';
import {
  buildSandboxPayload,
  createRecord,
  findExistingTransaction,
  hasNetSuiteSandboxConfig,
  normalizeRecordId,
} from '@/lib/netsuite/sandbox-publisher';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Sesión no válida.' }, { status: 401 });
  }

  if (!hasNetSuiteSandboxConfig()) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Faltan credenciales NetSuite Sandbox en variables de entorno.',
      },
      { status: 412 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const limitParam = Number(body.limit ?? 10);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(Math.trunc(limitParam), 50)) : 10;
  const period = body.period && typeof body.period.startDate === 'string' && typeof body.period.endDate === 'string'
    ? { startDate: body.period.startDate, endDate: body.period.endDate }
    : undefined;
  const items = await listReadyForSandbox(limit, period);
  const runId = await createSandboxPublishRun(session.user_id, limit);

  let attemptedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const item of items) {
    attemptedCount += 1;
    try {
      const built = buildSandboxPayload(item);
      const existing = await findExistingTransaction(built.tranId, built.entityId);

      if (existing) {
        skippedCount += 1;
        await recordSandboxPublishItem({
          runId,
          caseId: item.id,
          recordType: built.recordType,
          tranId: built.tranId,
          entityId: built.entityId,
          status: 'duplicate',
          netsuiteRecordId: existing.id,
          payload: built.payload,
          result: existing,
        });
        await markSandboxPublishResult({
          caseId: item.id,
          status: 'published',
          recordType: built.recordType,
          recordId: existing.id,
          errorText: null,
        });
        results.push({ caseId: item.id, folio: built.tranId, status: 'duplicate', recordId: existing.id });
        continue;
      }

      const createResult = await createRecord(built.recordType, built.payload);
      if (createResult.success) {
        createdCount += 1;
        const recordId = normalizeRecordId(createResult.recordId);
        await recordSandboxPublishItem({
          runId,
          caseId: item.id,
          recordType: built.recordType,
          tranId: built.tranId,
          entityId: built.entityId,
          status: 'created',
          netsuiteRecordId: recordId,
          payload: built.payload,
          result: createResult,
        });
        await markSandboxPublishResult({
          caseId: item.id,
          status: 'published',
          recordType: built.recordType,
          recordId,
          errorText: null,
        });
        results.push({ caseId: item.id, folio: built.tranId, status: 'created', recordId });
      } else {
        failedCount += 1;
        const errorText = createResult.raw || JSON.stringify(createResult.body);
        await recordSandboxPublishItem({
          runId,
          caseId: item.id,
          recordType: built.recordType,
          tranId: built.tranId,
          entityId: built.entityId,
          status: 'failed',
          errorText,
          payload: built.payload,
          result: createResult,
        });
        await markSandboxPublishResult({
          caseId: item.id,
          status: 'failed',
          recordType: built.recordType,
          recordId: null,
          errorText,
        });
        results.push({ caseId: item.id, folio: built.tranId, status: 'failed', error: errorText.slice(0, 500) });
      }
    } catch (error) {
      failedCount += 1;
      const errorText = error instanceof Error ? error.message : String(error);
      await recordSandboxPublishItem({
        runId,
        caseId: item.id,
        recordType: '',
        tranId: String(item.folio ?? ''),
        entityId: '',
        status: 'failed',
        errorText,
      });
      await markSandboxPublishResult({
        caseId: item.id,
        status: 'failed',
        recordType: '',
        recordId: null,
        errorText,
      });
      results.push({ caseId: item.id, folio: item.folio, status: 'failed', error: errorText });
    }
  }

  const status = failedCount > 0 ? (createdCount > 0 || skippedCount > 0 ? 'partial' : 'failed') : 'completed';
  await finishSandboxPublishRun(runId, {
    status,
    attemptedCount,
    createdCount,
    skippedCount,
    failedCount,
    details: { results },
  });

  return NextResponse.json({
    ok: failedCount === 0,
    runId,
    totalSelected: items.length,
    attemptedCount,
    createdCount,
    skippedCount,
    failedCount,
    results,
  });
}
