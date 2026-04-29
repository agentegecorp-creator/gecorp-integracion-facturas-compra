import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { listReviewCases } from '@/lib/db/queries';
import { ReviewFilters } from '@/components/review/review-filters';
import { ReviewWorkbench } from '@/components/review/review-workbench';

export default async function PendingReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ bucket?: string; status?: string }>;
}) {
  await requireSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const bucket = resolvedSearchParams.bucket || '';
  const status = resolvedSearchParams.status || '';
  const items = await listReviewCases(20, {
    bucket: bucket || undefined,
    status: status || undefined,
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

        <ReviewFilters currentBucket={bucket} currentStatus={status} />
      </section>

      <ReviewWorkbench items={items} />
    </main>
  );
}
