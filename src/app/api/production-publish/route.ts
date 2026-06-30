import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth/session';
import {
  claimProductionPublishCase,
  createProductionPublishRun,
  finishProductionPublishRun,
  listReadyForProduction,
  markProductionPublishResult,
  recordProductionPublishItem,
} from '@/lib/db/queries';
import {
  buildSandboxPayload,
  createRecord,
  enforceZeroTaxDetailsForExemptDocument,
  findExistingTransaction,
  hasNetSuiteProductionConfig,
  normalizeRecordId,
} from '@/lib/netsuite/sandbox-publisher';

export const runtime = 'nodejs';

function expectedNetSuiteType(recordType: string) {
  if (recordType === 'vendorcredit') return 'VendCred';
  return 'VendBill';
}

function normalizeAmount(value: unknown) {
  const numeric = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? Math.abs(Math.round(numeric)) : null;
}

export async function POST(request: Request) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Sesión no válida.' }, { status: 401 });
  }

  if (!hasNetSuiteProductionConfig()) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Faltan credenciales NetSuite Producción en variables de entorno.',
      },
      { status: 412 },
    );
  }

  const body = await request.json().catch(() => ({}));
  if (body.confirmProduction !== true) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Confirma explícitamente la publicación a Producción antes de ejecutar.',
      },
      { status: 400 },
    );
  }

  const limitParam = Number(body.limit ?? 1);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(Math.trunc(limitParam), 10)) : 1;
  const period = body.period && typeof body.period.startDate === 'string' && typeof body.period.endDate === 'string'
    ? { startDate: body.period.startDate, endDate: body.period.endDate }
    : undefined;
  const items = await listReadyForProduction(limit, period);
  const runId = await createProductionPublishRun(session.user_id, limit);

  let attemptedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const item of items) {
    attemptedCount += 1;
    try {
      const claimed = await claimProductionPublishCase(item.id);
      if (!claimed) {
        skippedCount += 1;
        await recordProductionPublishItem({
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
      const existing = await findExistingTransaction(built.tranId, built.entityId, 'production');

      if (existing) {
        const appAmount = normalizeAmount(item.amount_total);
        const nsAmount = normalizeAmount(existing.foreignTotal);
        const expectedType = expectedNetSuiteType(built.recordType);
        const exactMatch =
          String(existing.tranId) === String(built.tranId)
          && String(existing.entityId) === String(built.entityId)
          && String(existing.type) === expectedType
          && appAmount !== null
          && nsAmount !== null
          && appAmount === nsAmount;

        if (!exactMatch) {
          failedCount += 1;
          const errorText = `Transacción existente no coincide: app ${built.recordType} monto ${appAmount ?? 'N/A'}, NetSuite ${existing.type} monto ${nsAmount ?? 'N/A'} id ${existing.id}`;
          await recordProductionPublishItem({
            runId,
            caseId: item.id,
            recordType: built.recordType,
            tranId: built.tranId,
            entityId: built.entityId,
            status: 'failed',
            netsuiteRecordId: existing.id,
            errorText,
            payload: built.payload,
            result: existing,
          });
          await markProductionPublishResult({
            caseId: item.id,
            status: 'failed',
            recordType: built.recordType,
            recordId: null,
            errorText,
          });
          results.push({ caseId: item.id, folio: built.tranId, status: 'failed', recordId: existing.id, error: errorText });
          continue;
        }

        const taxDetailsResult = await enforceZeroTaxDetailsForExemptDocument(
          built.recordType,
          existing.id,
          built.zeroTaxDetails,
          'production',
        );
        if (taxDetailsResult && !taxDetailsResult.success) {
          failedCount += 1;
          const errorText = taxDetailsResult.raw || JSON.stringify(taxDetailsResult.body);
          await recordProductionPublishItem({
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
          await markProductionPublishResult({
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
        await recordProductionPublishItem({
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
        await markProductionPublishResult({
          caseId: item.id,
          status: 'published',
          recordType: built.recordType,
          recordId: existing.id,
          errorText: null,
        });
        results.push({ caseId: item.id, folio: built.tranId, status: 'duplicate', recordId: existing.id });
        continue;
      }

      const createResult = await createRecord(built.recordType, built.payload, 'production');
      if (createResult.success) {
        const recordId = normalizeRecordId(createResult.recordId);
        const taxDetailsResult = await enforceZeroTaxDetailsForExemptDocument(
          built.recordType,
          recordId,
          built.zeroTaxDetails,
          'production',
        );
        if (taxDetailsResult && !taxDetailsResult.success) {
          failedCount += 1;
          const errorText = taxDetailsResult.raw || JSON.stringify(taxDetailsResult.body);
          await recordProductionPublishItem({
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
          await markProductionPublishResult({
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
        await recordProductionPublishItem({
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
        await markProductionPublishResult({
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
        await recordProductionPublishItem({
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
        await markProductionPublishResult({
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
      await recordProductionPublishItem({
        runId,
        caseId: item.id,
        recordType: '',
        tranId: String(item.folio ?? ''),
        entityId: '',
        status: 'failed',
        errorText,
      });
      await markProductionPublishResult({
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
  await finishProductionPublishRun(runId, {
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
