import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth/session';
import {
  claimSandboxPublishCase,
  createSandboxPublishRun,
  finishSandboxPublishRun,
  listReadyForSandbox,
  markSandboxPublishResult,
  recordSandboxPublishItem,
} from '@/lib/db/queries';
import {
  buildSandboxPayload,
  createRecord,
  enforceZeroTaxDetailsForExemptDocument,
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
      const claimed = await claimSandboxPublishCase(item.id);
      if (!claimed) {
        skippedCount += 1;
        await recordSandboxPublishItem({
          runId,
          caseId: item.id,
          recordType: '',
          tranId: String(item.folio ?? ''),
          entityId: '',
          status: 'skipped',
          result: { reason: 'already_claimed_or_not_ready' },
        });
        results.push({ caseId: item.id, folio: item.folio, status: 'skipped', reason: 'already_claimed_or_not_ready' });
        continue;
      }

      const built = buildSandboxPayload(item);
      const existing = await findExistingTransaction(built.tranId, built.entityId);

      if (existing) {
        const taxDetailsResult = await enforceZeroTaxDetailsForExemptDocument(
          built.recordType,
          existing.id,
          built.zeroTaxDetails,
        );
        if (taxDetailsResult && !taxDetailsResult.success) {
          failedCount += 1;
          const errorText = taxDetailsResult.raw || JSON.stringify(taxDetailsResult.body);
          await recordSandboxPublishItem({
            runId,
            caseId: item.id,
            recordType: built.recordType,
            tranId: built.tranId,
            entityId: built.entityId,
            status: 'failed',
            netsuiteRecordId: existing.id,
            errorText,
            payload: built.payload,
            result: { existing, taxDetailsResult },
          });
          await markSandboxPublishResult({
            caseId: item.id,
            status: 'failed',
            recordType: built.recordType,
            recordId: existing.id,
            errorText,
          });
          results.push({ caseId: item.id, folio: built.tranId, status: 'failed', recordId: existing.id, error: errorText.slice(0, 500) });
          continue;
        }

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
          result: taxDetailsResult ? { existing, taxDetailsResult } : existing,
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
        const recordId = normalizeRecordId(createResult.recordId);
        const taxDetailsResult = await enforceZeroTaxDetailsForExemptDocument(
          built.recordType,
          recordId,
          built.zeroTaxDetails,
        );
        if (taxDetailsResult && !taxDetailsResult.success) {
          failedCount += 1;
          const errorText = taxDetailsResult.raw || JSON.stringify(taxDetailsResult.body);
          await recordSandboxPublishItem({
            runId,
            caseId: item.id,
            recordType: built.recordType,
            tranId: built.tranId,
            entityId: built.entityId,
            status: 'failed',
            netsuiteRecordId: recordId,
            errorText,
            payload: built.payload,
            result: { createResult, taxDetailsResult },
          });
          await markSandboxPublishResult({
            caseId: item.id,
            status: 'failed',
            recordType: built.recordType,
            recordId,
            errorText,
          });
          results.push({ caseId: item.id, folio: built.tranId, status: 'failed', recordId, error: errorText.slice(0, 500) });
          continue;
        }

        createdCount += 1;
        await recordSandboxPublishItem({
          runId,
          caseId: item.id,
          recordType: built.recordType,
          tranId: built.tranId,
          entityId: built.entityId,
          status: 'created',
          netsuiteRecordId: recordId,
          payload: built.payload,
          result: taxDetailsResult ? { createResult, taxDetailsResult } : createResult,
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
