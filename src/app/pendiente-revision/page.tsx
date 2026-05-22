import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { countReadyForSandbox, getReviewQueueCounts, listReviewCases } from '@/lib/db/queries';
import { ReviewFilters } from '@/components/review/review-filters';
import { ReviewWorkbench } from '@/components/review/review-workbench';
import { SandboxPublishPanel } from '@/components/review/sandbox-publish-panel';
import { hasNetSuiteSandboxConfig } from '@/lib/netsuite/sandbox-publisher';

type ReviewPeriod =
  | {
      key: 'current' | 'previous';
      label: string;
      startDate: string;
      endDate: string;
    }
  | {
      key: 'all';
      label: string;
    };

type DatePeriod = {
  startDate: string;
  endDate: string;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getReviewPeriod(periodKey?: string, monthScope?: string): ReviewPeriod {
  const now = new Date();
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  if (periodKey === 'all' || monthScope === 'all') {
    return {
      key: 'all',
      label: 'Todos los meses',
    };
  }

  if (periodKey === 'previous') {
    return {
      key: 'previous',
      label: 'Mes anterior',
      startDate: toDateInputValue(previousStart),
      endDate: toDateInputValue(currentStart),
    };
  }

  if (periodKey === 'current') {
    return {
      key: 'current',
      label: 'Mes actual',
      startDate: toDateInputValue(currentStart),
      endDate: toDateInputValue(nextStart),
    };
  }

  return {
    key: 'current',
    label: 'Mes actual',
    startDate: toDateInputValue(currentStart),
    endDate: toDateInputValue(nextStart),
  };
}

export default async function PendingReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{
    bucket?: string;
    status?: string;
    sandboxPublishStatus?: string;
    monthScope?: 'active' | 'all';
    period?: string;
    operationalView?: 'automatic' | 'posted' | 'pending' | 'unclassified' | 'excluded' | 'new_vendors';
  }>;
}) {
  await requireSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const bucket = resolvedSearchParams.bucket || '';
  const status = resolvedSearchParams.status || '';
  const sandboxPublishStatus = resolvedSearchParams.sandboxPublishStatus || '';
  const reviewPeriod = getReviewPeriod(resolvedSearchParams.period, resolvedSearchParams.monthScope);
  const monthScope = reviewPeriod.key === 'all' ? 'all' : 'active';
  const datePeriod: DatePeriod | undefined = reviewPeriod.key === 'all'
    ? undefined
    : { startDate: reviewPeriod.startDate, endDate: reviewPeriod.endDate };
  const operationalView = resolvedSearchParams.operationalView || '';
  const [items, counts, readyForSandboxCount] = await Promise.all([
    listReviewCases(100, {
      bucket: bucket || undefined,
      status: status || undefined,
      sandboxPublishStatus: sandboxPublishStatus || undefined,
      monthScope,
      period: datePeriod,
      operationalView: operationalView || undefined,
    }),
    getReviewQueueCounts(monthScope, datePeriod),
    countReadyForSandbox(datePeriod),
  ]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-8">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Pendiente revisión</h1>
            <p className="mt-2 text-sm text-slate-600">Mesa operativa para revisar documentos, filtrar la etapa del caso y abrir el detalle de cada documento.</p>
            <p className="mt-2 text-xs font-medium text-emerald-700">Última corrida importada: 7 casos nuevos de mayo · Sprint 1–3 activo en esta cola.</p>
            <p className="mt-2 text-xs text-slate-500">
              Documentos en esta vista: {items.length}
              {` · ${reviewPeriod.label}`}
            </p>
          </div>
          <Link href={`/dashboard${reviewPeriod.key === 'previous' ? '?period=previous' : ''}`} className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
            Volver al centro operativo
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-slate-700">Alcance:</span>
          <Link
            href={`/pendiente-revision?${new URLSearchParams({
              ...(bucket ? { bucket } : {}),
              ...(status ? { status } : {}),
              ...(sandboxPublishStatus ? { sandboxPublishStatus } : {}),
              ...(operationalView ? { operationalView } : {}),
              period: 'current',
            }).toString()}`}
            className={`rounded-full px-3 py-1 ring-1 ${reviewPeriod.key === 'current' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100'}`}
          >
            Mes actual
          </Link>
          <Link
            href={`/pendiente-revision?${new URLSearchParams({
              ...(bucket ? { bucket } : {}),
              ...(status ? { status } : {}),
              ...(sandboxPublishStatus ? { sandboxPublishStatus } : {}),
              ...(operationalView ? { operationalView } : {}),
              period: 'previous',
            }).toString()}`}
            className={`rounded-full px-3 py-1 ring-1 ${reviewPeriod.key === 'previous' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100'}`}
          >
            Mes anterior
          </Link>
          <Link
            href={`/pendiente-revision?${new URLSearchParams({
              ...(bucket ? { bucket } : {}),
              ...(status ? { status } : {}),
              ...(sandboxPublishStatus ? { sandboxPublishStatus } : {}),
              ...(operationalView ? { operationalView } : {}),
              period: 'all',
            }).toString()}`}
            className={`rounded-full px-3 py-1 ring-1 ${reviewPeriod.key === 'all' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100'}`}
          >
            Todos los meses
          </Link>
        </div>

        <ReviewFilters
          currentBucket={bucket}
          currentStatus={status}
          currentSandboxPublishStatus={sandboxPublishStatus}
          currentMonthScope={monthScope}
          currentPeriod={reviewPeriod.key}
          currentOperationalView={operationalView}
          counts={counts}
        />
      </section>

      <SandboxPublishPanel
        readyCount={readyForSandboxCount}
        configReady={hasNetSuiteSandboxConfig()}
        period={datePeriod}
      />

      <ReviewWorkbench items={items} />
    </main>
  );
}
