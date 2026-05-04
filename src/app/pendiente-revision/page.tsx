import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { listReviewCases } from '@/lib/db/queries';
import { ReviewFilters } from '@/components/review/review-filters';
import { ReviewWorkbench } from '@/components/review/review-workbench';

export default async function PendingReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ bucket?: string; status?: string; sandboxPublishStatus?: string; monthScope?: 'active' | 'all' }>;
}) {
  await requireSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const bucket = resolvedSearchParams.bucket || '';
  const status = resolvedSearchParams.status || '';
  const sandboxPublishStatus = resolvedSearchParams.sandboxPublishStatus || '';
  const monthScope = resolvedSearchParams.monthScope === 'all' ? 'all' : 'active';
  const items = await listReviewCases(20, {
    bucket: bucket || undefined,
    status: status || undefined,
    sandboxPublishStatus: sandboxPublishStatus || undefined,
    monthScope,
  });

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-8">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Pendiente revisión</h1>
            <p className="mt-2 text-sm text-slate-600">Mesa operativa para revisar documentos, filtrar la etapa del caso y abrir el detalle de cada documento.</p>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
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
            }).toString()}`}
            className={`rounded-full px-3 py-1 ring-1 ${monthScope === 'active' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100'}`}
          >
            Abril + mayo
          </Link>
          <Link
            href={`/pendiente-revision?${new URLSearchParams({
              ...(bucket ? { bucket } : {}),
              ...(status ? { status } : {}),
              ...(sandboxPublishStatus ? { sandboxPublishStatus } : {}),
              monthScope: 'all',
            }).toString()}`}
            className={`rounded-full px-3 py-1 ring-1 ${monthScope === 'all' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100'}`}
          >
            Todos los meses
          </Link>
        </div>

        <ReviewFilters currentBucket={bucket} currentStatus={status} currentSandboxPublishStatus={sandboxPublishStatus} currentMonthScope={monthScope} />
      </section>

      <ReviewWorkbench items={items} />
    </main>
  );
}
